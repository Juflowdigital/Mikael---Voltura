/** Financeiro › Caixas e Bancos — contas e saldos. */
import { h, mount } from '../../ui/dom'
import { card, gridCols } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { kpiCard, KPI_ICONS } from '../../ui/components/kpi'
import { dataTable, type Column } from '../../ui/components/table'
import { badge } from '../../ui/components/badge'
import { openModal } from '../../ui/components/modal'
import { formRow, selectField, textField, toggleField } from '../../ui/components/form'
import { guard, toast } from '../../ui/components/feedback'
import { money, orDash, parseMoney } from '../../core/format'
import { accounts, balanceOf, createAccount, saveAccount, transactions, type AccountInput } from '../../data/finance'
import type { FinancialAccount, FinancialTransaction } from '../../core/types'

const TYPES = [
  { value: 'Conta corrente', label: 'Conta corrente' },
  { value: 'Poupança', label: 'Poupança' },
  { value: 'Caixa', label: 'Caixa (dinheiro)' },
  { value: 'Cartão', label: 'Cartão' },
  { value: 'Investimento', label: 'Investimento' },
]

function accountForm(initial: FinancialAccount | null, onSaved: () => Promise<void>): void {
  let draft: AccountInput = {
    name: initial ? initial.name : '',
    bank_name: initial ? initial.bank_name : null,
    account_type: initial ? initial.account_type : 'Conta corrente',
    opening_balance: Number(initial ? initial.opening_balance : 0),
    active: initial ? initial.active : true,
  }
  const patch = (part: Partial<AccountInput>) => {
    draft = { ...draft, ...part }
  }

  const handle = openModal({
    title: initial ? 'Editar conta' : 'Nova conta',
    subtitle: 'O saldo é o valor de abertura mais os lançamentos já liquidados.',
    width: '580px',
    body: h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      textField({ label: 'Nome da conta', required: true, value: draft.name, onInput: (value) => patch({ name: value }) }),
      formRow(
        '1fr 1fr',
        textField({ label: 'Banco', value: draft.bank_name ?? '', onInput: (value) => patch({ bank_name: value || null }) }),
        selectField({
          label: 'Tipo',
          value: draft.account_type ?? '',
          options: TYPES,
          onChange: (value) => patch({ account_type: value || null }),
        }),
      ),
      formRow(
        '1fr 1fr',
        textField({
          label: 'Saldo de abertura (R$)',
          value: String(draft.opening_balance),
          disabled: Boolean(initial),
          onInput: (value) => patch({ opening_balance: parseMoney(value) }),
        }),
        h('div', { style: { alignSelf: 'end', paddingBottom: '9px' } }, toggleField('Conta ativa', draft.active, (value) => patch({ active: value }))),
      ),
      initial ? h('div.faint', { style: { fontSize: '11.5px' } }, 'O saldo de abertura não muda depois de criado, para não reescrever o histórico.') : null,
    ),
    footer: [
      h('button.btn.btn-ghost', { onClick: () => handle.close() }, 'Cancelar'),
      h(
        'button.btn.btn-primary',
        {
          onClick: async () => {
            if (!draft.name.trim()) {
              toast('Informe o nome da conta.', 'error')
              return
            }
            const ok = await guard(async () => {
              if (initial) await saveAccount(initial.id, { ...draft, opening_balance: Number(initial.opening_balance) })
              else await createAccount(draft)
              await onSaved()
            }, initial ? 'Conta atualizada.' : 'Conta cadastrada.')
            if (ok) handle.close()
          },
        },
        'Salvar conta',
      ),
    ],
  })
}

export async function render(host: HTMLElement): Promise<void> {
  async function draw(): Promise<void> {
    const [rows, movements] = await Promise.all([accounts(), transactions()])
    const active = rows.filter((account) => account.active)
    const totalBalance = active.reduce((sum, account) => sum + balanceOf(account, movements), 0)
    const pendingIncome = movements
      .filter((row: FinancialTransaction) => row.direction === 'income' && row.status === 'pending')
      .reduce((sum, row) => sum + Number(row.amount), 0)
    const pendingExpense = movements
      .filter((row: FinancialTransaction) => row.direction === 'expense' && row.status === 'pending')
      .reduce((sum, row) => sum + Number(row.amount), 0)

    const columns: Column<FinancialAccount>[] = [
      {
        key: 'name',
        label: 'Conta',
        sortable: true,
        render: (row) => h('div', h('b', row.name), h('div.faint', { style: { fontSize: '11.5px' } }, orDash(row.bank_name))),
      },
      { key: 'account_type', label: 'Tipo', sortable: true, render: (row) => orDash(row.account_type) },
      {
        key: 'opening_balance',
        label: 'Abertura',
        align: 'right',
        value: (row) => Number(row.opening_balance),
        render: (row) => money(row.opening_balance),
      },
      {
        key: 'movements',
        label: 'Liquidados',
        align: 'right',
        value: (row) => movements.filter((entry) => entry.account_id === row.id && entry.status === 'paid').length,
        render: (row) => String(movements.filter((entry) => entry.account_id === row.id && entry.status === 'paid').length),
      },
      {
        key: 'balance',
        label: 'Saldo atual',
        align: 'right',
        sortable: true,
        value: (row) => balanceOf(row, movements),
        render: (row) => {
          const value = balanceOf(row, movements)
          return h('b', { style: { color: value < 0 ? 'var(--red)' : 'var(--green)' } }, money(value))
        },
      },
      {
        key: 'active',
        label: 'Situação',
        value: (row) => (row.active ? 'Ativa' : 'Inativa'),
        render: (row) => badge(row.active ? 'Ativa' : 'Inativa', row.active ? 'green' : 'gray'),
      },
      {
        key: 'actions',
        label: 'Ações',
        align: 'right',
        width: '100px',
        render: (row) =>
          h('button.btn.btn-ghost', { style: { fontSize: '12px', padding: '4px 10px' }, onClick: () => accountForm(row, draw) }, 'Editar'),
      },
    ]

    mount(
      host,
      pageHead({
        title: 'Caixas e Bancos',
        crumbs: [{ label: 'Financeiro' }, { label: 'Caixas e Bancos' }],
        actions: [h('button.btn.btn-primary', { onClick: () => accountForm(null, draw) }, '+ Nova conta')],
      }),
      h(
        'div.stack',
        gridCols(
          3,
          kpiCard({ label: 'Saldo consolidado', value: money(totalBalance), hint: active.length + ' conta(s) ativa(s)', mark: KPI_ICONS.money, color: '#22c55e', soft: 'rgba(34,197,94,.14)' }),
          kpiCard({ label: 'A receber em aberto', value: money(pendingIncome), mark: KPI_ICONS.check, color: '#38bdf8', soft: 'rgba(56,189,248,.14)' }),
          kpiCard({ label: 'A pagar em aberto', value: money(pendingExpense), mark: KPI_ICONS.alert, color: '#f6a623', soft: 'rgba(246,166,35,.14)' }),
        ),
        card(
          { flush: true },
          dataTable({
            columns,
            rows,
            searchable: true,
            searchPlaceholder: 'Buscar conta',
            initialSort: { key: 'name', ascending: true },
            emptyTitle: 'Nenhuma conta cadastrada',
            emptyHint: 'Cadastre caixas e contas bancárias para lançar movimentações.',
            totalLabel: (total) => `${total} conta(s)`,
          }),
        ),
      ),
    )
  }

  await draw()
}
