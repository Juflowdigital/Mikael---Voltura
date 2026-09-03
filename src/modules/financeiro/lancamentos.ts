/** Financeiro › Lançamentos — contas a pagar e a receber. */
import { h, mount } from '../../ui/dom'
import { card, gridCols } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { statFilter, KPI_ICONS } from '../../ui/components/kpi'
import { dataTable, type Column } from '../../ui/components/table'
import { badge } from '../../ui/components/badge'
import { confirmModal, openModal } from '../../ui/components/modal'
import { formRow, selectField, textField } from '../../ui/components/form'
import { guard, toast } from '../../ui/components/feedback'
import { date, isoDay, money, parseMoney } from '../../core/format'
import { setQuery, type RouteContext } from '../../core/router'
import {
  accounts,
  CATEGORIES,
  costCenters,
  createTransaction,
  DIRECTION_LABEL,
  effectiveStatus,
  removeTransaction,
  settle,
  STATUS_LABEL,
  STATUS_TONE,
  transactions,
  type TransactionInput,
} from '../../data/finance'
import { findAll as findClients } from '../../data/clients'
import { suppliers } from '../../data/inventory'
import type { CostCenter, FinanceDirection, FinancialAccount, FinancialTransaction } from '../../core/types'

const BUCKETS: { id: string; label: string; mark: string; tone: string; match: (row: FinancialTransaction) => boolean }[] = [
  { id: 'todos', label: 'Todos', mark: KPI_ICONS.money, tone: 'var(--accent)', match: () => true },
  { id: 'receber', label: 'A receber', mark: KPI_ICONS.check, tone: '#22c55e', match: (row) => row.direction === 'income' && effectiveStatus(row) !== 'paid' && row.status !== 'cancelled' },
  { id: 'pagar', label: 'A pagar', mark: KPI_ICONS.alert, tone: '#f6a623', match: (row) => row.direction === 'expense' && effectiveStatus(row) !== 'paid' && row.status !== 'cancelled' },
  { id: 'vencidos', label: 'Vencidos', mark: KPI_ICONS.clock, tone: '#ef4444', match: (row) => effectiveStatus(row) === 'overdue' },
  { id: 'pagos', label: 'Liquidados', mark: KPI_ICONS.archive, tone: '#8ba0b8', match: (row) => row.status === 'paid' },
]

function transactionForm(
  accountList: FinancialAccount[],
  centers: CostCenter[],
  clients: { id: string; name: string }[],
  vendors: { id: string; name: string }[],
  onSaved: () => Promise<void>,
): void {
  let draft: TransactionInput = {
    account_id: accountList[0]?.id ?? null,
    client_id: null,
    supplier_id: null,
    contract_id: null,
    cost_center_id: null,
    direction: 'income',
    category: CATEGORIES.income[0],
    description: '',
    amount: 0,
    due_date: isoDay(),
    status: 'pending',
    payment_method: null,
  }
  const body = h('div')

  function draw(): void {
    mount(
      body,
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
        formRow(
          '1fr 1fr',
          selectField({
            label: 'Tipo',
            value: draft.direction,
            options: [
              { value: 'income', label: 'Receita' },
              { value: 'expense', label: 'Despesa' },
            ],
            onChange: (value) => {
              const direction = value as FinanceDirection
              draft = { ...draft, direction, category: CATEGORIES[direction][0], client_id: null, supplier_id: null }
              draw()
            },
          }),
          selectField({
            label: 'Categoria',
            value: draft.category,
            options: CATEGORIES[draft.direction].map((entry) => ({ value: entry, label: entry })),
            onChange: (value) => (draft = { ...draft, category: value }),
          }),
        ),
        textField({ label: 'Descrição', required: true, value: draft.description, onInput: (value) => (draft = { ...draft, description: value }) }),
        formRow(
          '1fr 1fr 1fr',
          textField({ label: 'Valor (R$)', required: true, onInput: (value) => (draft = { ...draft, amount: parseMoney(value) }) }),
          textField({ label: 'Vencimento', type: 'date', value: draft.due_date, onInput: (value) => (draft = { ...draft, due_date: value }) }),
          selectField({
            label: 'Situação',
            value: draft.status,
            options: [
              { value: 'pending', label: 'Em aberto' },
              { value: 'paid', label: 'Já liquidado' },
            ],
            onChange: (value) => (draft = { ...draft, status: value as TransactionInput['status'] }),
          }),
        ),
        formRow(
          '1fr 1fr',
          selectField({
            label: 'Conta',
            value: draft.account_id ?? '',
            placeholder: 'Sem conta',
            options: accountList.map((account) => ({ value: account.id, label: account.name })),
            onChange: (value) => (draft = { ...draft, account_id: value || null }),
          }),
          selectField({
            label: 'Centro de custo',
            placeholder: 'Sem centro de custo',
            options: centers.map((center) => ({ value: center.id, label: center.code + ' · ' + center.name })),
            onChange: (value) => (draft = { ...draft, cost_center_id: value || null }),
          }),
        ),
        draft.direction === 'income'
          ? selectField({
              label: 'Cliente',
              placeholder: 'Sem cliente',
              options: clients.map((client) => ({ value: client.id, label: client.name })),
              onChange: (value) => (draft = { ...draft, client_id: value || null }),
            })
          : selectField({
              label: 'Fornecedor',
              placeholder: 'Sem fornecedor',
              options: vendors.map((vendor) => ({ value: vendor.id, label: vendor.name })),
              onChange: (value) => (draft = { ...draft, supplier_id: value || null }),
            }),
      ),
    )
  }

  const handle = openModal({
    title: 'Novo lançamento',
    subtitle: 'Receitas e despesas alimentam o fluxo de caixa e os relatórios.',
    width: '660px',
    body,
    footer: [
      h('button.btn.btn-ghost', { onClick: () => handle.close() }, 'Cancelar'),
      h(
        'button.btn.btn-primary',
        {
          onClick: async () => {
            if (!draft.description.trim()) {
              toast('Informe a descrição do lançamento.', 'error')
              return
            }
            if (draft.amount <= 0) {
              toast('Informe um valor maior que zero.', 'error')
              return
            }
            const ok = await guard(async () => {
              await createTransaction(draft)
              await onSaved()
            }, 'Lançamento criado.')
            if (ok) handle.close()
          },
        },
        'Salvar lançamento',
      ),
    ],
  })

  draw()
}

export async function render(host: HTMLElement, ctx: RouteContext): Promise<void> {
  async function draw(): Promise<void> {
    const [rows, accountList, centers, clients, vendors] = await Promise.all([
      transactions(),
      accounts(),
      costCenters(),
      findClients(),
      suppliers(),
    ])
    const accountName = (id: string | null) => accountList.find((account) => account.id === id)?.name ?? '—'
    const centerName = (id: string | null) => {
      const center = centers.find((entry) => entry.id === id)
      return center ? center.code + ' · ' + center.name : '—'
    }
    const partyName = (row: FinancialTransaction) =>
      row.direction === 'income'
        ? clients.find((client) => client.id === row.client_id)?.name ?? '—'
        : vendors.find((vendor) => vendor.id === row.supplier_id)?.name ?? '—'

    const bucket = ctx.query.get('filtro') ?? 'todos'
    const active = BUCKETS.find((entry) => entry.id === bucket) ?? BUCKETS[0]
    const visible = rows.filter(active.match)
    const totalOf = (list: FinancialTransaction[]) => list.reduce((sum, row) => sum + Number(row.amount), 0)

    const columns: Column<FinancialTransaction>[] = [
      {
        key: 'description',
        label: 'Descrição',
        sortable: true,
        render: (row) =>
          h(
            'div',
            h('b', row.description),
            h('div.faint', { style: { fontSize: '11.5px', marginTop: '2px' } }, row.category + ' · ' + partyName(row)),
          ),
      },
      {
        key: 'direction',
        label: 'Tipo',
        value: (row) => DIRECTION_LABEL[row.direction],
        render: (row) => badge(DIRECTION_LABEL[row.direction], row.direction === 'income' ? 'green' : 'amber'),
      },
      { key: 'account', label: 'Conta', value: (row) => accountName(row.account_id), render: (row) => accountName(row.account_id) },
      { key: 'center', label: 'Centro de custo', value: (row) => centerName(row.cost_center_id), render: (row) => centerName(row.cost_center_id) },
      { key: 'due_date', label: 'Vencimento', sortable: true, render: (row) => date(row.due_date) },
      {
        key: 'amount',
        label: 'Valor',
        align: 'right',
        sortable: true,
        value: (row) => Number(row.amount),
        render: (row) =>
          h('b', { style: { color: row.direction === 'income' ? 'var(--green)' : 'var(--accent)' } }, money(row.amount)),
      },
      {
        key: 'status',
        label: 'Situação',
        value: (row) => STATUS_LABEL[effectiveStatus(row)],
        render: (row) => badge(STATUS_LABEL[effectiveStatus(row)], STATUS_TONE[effectiveStatus(row)]),
      },
      {
        key: 'actions',
        label: 'Ações',
        align: 'right',
        width: '180px',
        render: (row) =>
          h(
            'div.row',
            { style: { justifyContent: 'flex-end', gap: '6px' } },
            row.status === 'cancelled'
              ? null
              : h(
                  'button.btn.btn-ghost',
                  {
                    style: { fontSize: '12px', padding: '4px 10px' },
                    onClick: () => {
                      void guard(async () => {
                        await settle(row.id, row.status !== 'paid')
                        await draw()
                      }, row.status === 'paid' ? 'Liquidação desfeita.' : 'Lançamento liquidado.')
                    },
                  },
                  row.status === 'paid' ? 'Reabrir' : 'Liquidar',
                ),
            h(
              'button.btn.btn-ghost',
              {
                style: { fontSize: '12px', padding: '4px 10px', color: 'var(--red)' },
                onClick: () =>
                  confirmModal('Excluir lançamento', `Excluir "${row.description}"? Esta ação não pode ser desfeita.`, () => {
                    void guard(async () => {
                      await removeTransaction(row.id)
                      await draw()
                    }, 'Lançamento excluído.')
                  }),
              },
              'Excluir',
            ),
          ),
      },
    ]

    mount(
      host,
      pageHead({
        title: 'Lançamentos',
        crumbs: [{ label: 'Financeiro' }, { label: 'Lançamentos' }],
        actions: [
          h(
            'button.btn.btn-primary',
            {
              onClick: () => {
                if (!accountList.length) {
                  toast('Cadastre uma conta em Caixas e Bancos antes de lançar.', 'error')
                  return
                }
                transactionForm(accountList, centers, clients, vendors, draw)
              },
            },
            '+ Novo lançamento',
          ),
        ],
      }),
      h(
        'div.stack',
        gridCols(
          5,
          ...BUCKETS.map((entry) => {
            const list = rows.filter(entry.match)
            return statFilter({
              label: entry.label,
              value: String(list.length),
              hint: money(totalOf(list)),
              mark: entry.mark,
              tone: entry.tone,
              active: bucket === entry.id,
              onClick: () => setQuery({ filtro: entry.id === 'todos' ? null : entry.id }),
            })
          }),
        ),
        card(
          { flush: true },
          dataTable({
            columns,
            rows: visible,
            searchable: true,
            searchPlaceholder: 'Buscar lançamento',
            pageSize: 10,
            initialSort: { key: 'due_date', ascending: true },
            emptyTitle: 'Nenhum lançamento nesta situação',
            emptyHint: 'Registre receitas e despesas para acompanhar o fluxo de caixa.',
            totalLabel: (total) => `${total} lançamento(s) · ${money(totalOf(visible))}`,
          }),
        ),
      ),
    )
  }

  await draw()
}
