/** Financeiro › Conciliação — extrato bancário contra lançamentos. */
import { h, mount } from '../../ui/dom'
import { card, gridCols } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { statFilter, KPI_ICONS } from '../../ui/components/kpi'
import { dataTable, type Column } from '../../ui/components/table'
import { badge } from '../../ui/components/badge'
import { openModal } from '../../ui/components/modal'
import { formRow, selectField, textField } from '../../ui/components/form'
import { banner, guard, toast } from '../../ui/components/feedback'
import { date, isoDay, money, orDash, parseMoney } from '../../core/format'
import { setQuery, type RouteContext } from '../../core/router'
import {
  accounts,
  addStatementEntry,
  DIRECTION_LABEL,
  reconcile,
  statement,
  suggestMatch,
  transactions,
  type StatementInput,
} from '../../data/finance'
import type { FinanceDirection, FinancialAccount, FinancialTransaction, StatementEntry } from '../../core/types'

function entryForm(accountList: FinancialAccount[], onSaved: () => Promise<void>): void {
  let draft: StatementInput = {
    account_id: accountList[0]?.id ?? '',
    occurred_at: isoDay(),
    description: '',
    amount: 0,
    direction: 'income',
    bank_reference: null,
  }
  const patch = (part: Partial<StatementInput>) => {
    draft = { ...draft, ...part }
  }

  const handle = openModal({
    title: 'Lançar linha do extrato',
    subtitle: 'Informe a movimentação como ela aparece no banco. A conciliação sugere o lançamento correspondente.',
    width: '620px',
    body: h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      formRow(
        '2fr 1fr',
        selectField({
          label: 'Conta',
          value: draft.account_id,
          options: accountList.map((account) => ({ value: account.id, label: account.name })),
          onChange: (value) => patch({ account_id: value }),
        }),
        textField({ label: 'Data', type: 'date', value: draft.occurred_at, onInput: (value) => patch({ occurred_at: value }) }),
      ),
      textField({ label: 'Descrição no extrato', required: true, onInput: (value) => patch({ description: value }) }),
      formRow(
        '1fr 1fr 1fr',
        selectField({
          label: 'Sentido',
          value: 'income',
          options: [
            { value: 'income', label: 'Crédito' },
            { value: 'expense', label: 'Débito' },
          ],
          onChange: (value) => patch({ direction: value as FinanceDirection }),
        }),
        textField({ label: 'Valor (R$)', required: true, onInput: (value) => patch({ amount: parseMoney(value) }) }),
        textField({ label: 'Referência', onInput: (value) => patch({ bank_reference: value || null }) }),
      ),
    ),
    footer: [
      h('button.btn.btn-ghost', { onClick: () => handle.close() }, 'Cancelar'),
      h(
        'button.btn.btn-primary',
        {
          onClick: async () => {
            if (!draft.account_id) {
              toast('Selecione a conta.', 'error')
              return
            }
            if (!draft.description.trim()) {
              toast('Informe a descrição do extrato.', 'error')
              return
            }
            if (draft.amount <= 0) {
              toast('Informe um valor maior que zero.', 'error')
              return
            }
            const ok = await guard(async () => {
              await addStatementEntry(draft)
              await onSaved()
            }, 'Linha do extrato registrada.')
            if (ok) handle.close()
          },
        },
        'Registrar linha',
      ),
    ],
  })
}

export async function render(host: HTMLElement, ctx: RouteContext): Promise<void> {
  async function draw(): Promise<void> {
    const [entries, rows, accountList] = await Promise.all([statement(), transactions(), accounts()])
    const accountName = (id: string) => accountList.find((account) => account.id === id)?.name ?? '—'
    const txOf = (id: string | null) => rows.find((row: FinancialTransaction) => row.id === id) ?? null

    const used = new Set(entries.map((entry) => entry.matched_transaction_id).filter(Boolean) as string[])
    const filter = ctx.query.get('filtro') ?? 'pendentes'
    const pending = entries.filter((entry) => !entry.matched_transaction_id)
    const done = entries.filter((entry) => entry.matched_transaction_id)
    const visible = filter === 'conciliadas' ? done : filter === 'todas' ? entries : pending

    function manualMatch(row: StatementEntry): void {
      const candidates = rows.filter((entry) => !used.has(entry.id))
      if (!candidates.length) {
        toast('Nenhum lançamento disponível para conciliar.', 'error')
        return
      }
      let chosen = candidates[0].id
      const handle = openModal({
        title: 'Conciliar manualmente',
        subtitle: row.description + ' · ' + money(row.amount),
        width: '620px',
        body: selectField({
          label: 'Lançamento correspondente',
          value: chosen,
          options: candidates.map((entry) => ({
            value: entry.id,
            label: entry.description + ' · ' + money(entry.amount) + ' · vence ' + date(entry.due_date),
          })),
          onChange: (value) => (chosen = value),
        }),
        footer: [
          h('button.btn.btn-ghost', { onClick: () => handle.close() }, 'Cancelar'),
          h(
            'button.btn.btn-primary',
            {
              onClick: async () => {
                const ok = await guard(async () => {
                  await reconcile(row.id, chosen)
                  await draw()
                }, 'Conciliado.')
                if (ok) handle.close()
              },
            },
            'Conciliar',
          ),
        ],
      })
    }

    const columns: Column<StatementEntry>[] = [
      { key: 'occurred_at', label: 'Data', sortable: true, render: (row) => date(row.occurred_at) },
      {
        key: 'description',
        label: 'Extrato',
        sortable: true,
        render: (row) =>
          h(
            'div',
            h('b', row.description),
            h('div.faint', { style: { fontSize: '11.5px' } }, accountName(row.account_id) + ' · ' + orDash(row.bank_reference)),
          ),
      },
      {
        key: 'direction',
        label: 'Sentido',
        value: (row) => DIRECTION_LABEL[row.direction],
        render: (row) => badge(row.direction === 'income' ? 'Crédito' : 'Débito', row.direction === 'income' ? 'green' : 'amber'),
      },
      { key: 'amount', label: 'Valor', align: 'right', sortable: true, value: (row) => Number(row.amount), render: (row) => h('b', money(row.amount)) },
      {
        key: 'match',
        label: 'Lançamento',
        value: (row) => {
          const matched = txOf(row.matched_transaction_id)
          return matched ? matched.description : ''
        },
        render: (row) => {
          const matched = txOf(row.matched_transaction_id)
          if (matched) {
            return h(
              'div',
              badge('Conciliada', 'green'),
              h('div.faint', { style: { fontSize: '11.5px', marginTop: '3px' } }, matched.description),
            )
          }
          const suggestion = suggestMatch(row, rows, used)
          return suggestion
            ? h(
                'div',
                h('div.faint', { style: { fontSize: '11.5px' } }, 'Sugestão: ' + suggestion.description),
                h('div.faint', { style: { fontSize: '11.5px' } }, 'vence ' + date(suggestion.due_date)),
              )
            : h('span.faint', { style: { fontSize: '12px' } }, 'Sem correspondência automática')
        },
      },
      {
        key: 'actions',
        label: 'Ações',
        align: 'right',
        width: '190px',
        render: (row) => {
          if (row.matched_transaction_id) {
            return h(
              'button.btn.btn-ghost',
              {
                style: { fontSize: '12px', padding: '4px 10px' },
                onClick: () => {
                  void guard(async () => {
                    await reconcile(row.id, null)
                    await draw()
                  }, 'Conciliação desfeita.')
                },
              },
              'Desfazer',
            )
          }
          const suggestion = suggestMatch(row, rows, used)
          return h(
            'div.row',
            { style: { justifyContent: 'flex-end', gap: '6px' } },
            suggestion
              ? h(
                  'button.btn.btn-ghost',
                  {
                    style: { fontSize: '12px', padding: '4px 10px' },
                    onClick: () => {
                      void guard(async () => {
                        await reconcile(row.id, suggestion.id)
                        await draw()
                      }, 'Conciliado com a sugestão.')
                    },
                  },
                  'Conciliar',
                )
              : null,
            h('button.btn.btn-ghost', { style: { fontSize: '12px', padding: '4px 10px' }, onClick: () => manualMatch(row) }, 'Escolher'),
          )
        },
      },
    ]

    mount(
      host,
      pageHead({
        title: 'Conciliação',
        crumbs: [{ label: 'Financeiro' }, { label: 'Conciliação' }],
        actions: [
          h(
            'button.btn.btn-primary',
            {
              onClick: () => {
                if (!accountList.length) {
                  toast('Cadastre uma conta em Caixas e Bancos antes de conciliar.', 'error')
                  return
                }
                entryForm(accountList, draw)
              },
            },
            '+ Lançar extrato',
          ),
        ],
      }),
      h(
        'div.stack',
        banner(
          'info',
          'A conciliação compara conta, sentido e valor, e sugere o lançamento com a data mais próxima. A confirmação é sempre sua — nada é conciliado automaticamente.',
        ),
        gridCols(
          3,
          statFilter({
            label: 'Pendentes',
            value: String(pending.length),
            hint: money(pending.reduce((sum, row) => sum + Number(row.amount), 0)),
            mark: KPI_ICONS.clock,
            tone: '#f6a623',
            active: filter === 'pendentes',
            onClick: () => setQuery({ filtro: null }),
          }),
          statFilter({
            label: 'Conciliadas',
            value: String(done.length),
            hint: money(done.reduce((sum, row) => sum + Number(row.amount), 0)),
            mark: KPI_ICONS.check,
            tone: '#22c55e',
            active: filter === 'conciliadas',
            onClick: () => setQuery({ filtro: 'conciliadas' }),
          }),
          statFilter({
            label: 'Todas',
            value: String(entries.length),
            mark: KPI_ICONS.chart,
            tone: 'var(--accent)',
            active: filter === 'todas',
            onClick: () => setQuery({ filtro: 'todas' }),
          }),
        ),
        card(
          { flush: true },
          dataTable({
            columns,
            rows: visible,
            searchable: true,
            searchPlaceholder: 'Buscar no extrato',
            pageSize: 10,
            initialSort: { key: 'occurred_at', ascending: false },
            emptyTitle: 'Nada para conciliar',
            emptyHint: 'Lance as linhas do extrato bancário para conferir contra os lançamentos.',
            totalLabel: (total) => `${total} linha(s)`,
          }),
        ),
      ),
    )
  }

  await draw()
}
