/** Financeiro › Relatórios — extrações em CSV. */
import { h, icon, mount } from '../../ui/dom'
import { pageHead } from '../../ui/components/page'
import { guard } from '../../ui/components/feedback'
import { csvNumber, downloadCsv, toCsv } from '../../core/csv'
import { date, isoDay } from '../../core/format'
import {
  accounts,
  balanceOf,
  costCenters,
  DIRECTION_LABEL,
  effectiveStatus,
  installments,
  INVOICE_LABEL,
  invoices,
  statement,
  STATUS_LABEL,
  transactions,
} from '../../data/finance'
import { findAll as findClients } from '../../data/clients'
import { findAll as findContracts } from '../../data/contracts'
import { suppliers } from '../../data/inventory'

interface Report {
  id: string
  title: string
  description: string
  mark: string
  color: string
  soft: string
  build: () => Promise<{ headers: string[]; rows: unknown[][] }>
}

const I = {
  money: '<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  bank: '<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
  chart: '<line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5"/>',
}

const REPORTS: Report[] = [
  {
    id: 'lancamentos',
    title: 'Lançamentos',
    description: 'Todas as receitas e despesas com conta, centro de custo e situação.',
    mark: I.money,
    color: '#22c55e',
    soft: 'rgba(34,197,94,.14)',
    build: async () => {
      const [rows, accountList, centers, clients, vendors] = await Promise.all([
        transactions(),
        accounts(),
        costCenters(),
        findClients(),
        suppliers(),
      ])
      const accountName = (id: string | null) => accountList.find((entry) => entry.id === id)?.name ?? ''
      const centerCode = (id: string | null) => centers.find((entry) => entry.id === id)?.code ?? ''
      const party = (row: (typeof rows)[number]) =>
        row.direction === 'income'
          ? clients.find((client) => client.id === row.client_id)?.name ?? ''
          : vendors.find((vendor) => vendor.id === row.supplier_id)?.name ?? ''
      return {
        headers: ['Descrição', 'Tipo', 'Categoria', 'Contraparte', 'Conta', 'Centro de custo', 'Vencimento', 'Valor (R$)', 'Situação', 'Pago em'],
        rows: rows.map((row) => [
          row.description,
          DIRECTION_LABEL[row.direction],
          row.category,
          party(row),
          accountName(row.account_id),
          centerCode(row.cost_center_id),
          date(row.due_date),
          csvNumber(row.amount),
          STATUS_LABEL[effectiveStatus(row)],
          row.paid_at ? date(row.paid_at) : '',
        ]),
      }
    },
  },
  {
    id: 'fluxo-de-caixa',
    title: 'Fluxo de Caixa',
    description: 'Receitas, despesas e resultado líquido por mês, somente liquidados.',
    mark: I.chart,
    color: '#38bdf8',
    soft: 'rgba(56,189,248,.14)',
    build: async () => {
      const rows = await transactions()
      const paid = rows.filter((row) => row.status === 'paid')
      const months = [...new Set(paid.map((row) => (row.paid_at ?? row.due_date).slice(0, 7)))].sort()
      return {
        headers: ['Mês', 'Receitas (R$)', 'Despesas (R$)', 'Resultado (R$)'],
        rows: months.map((month) => {
          const own = paid.filter((row) => (row.paid_at ?? row.due_date).slice(0, 7) === month)
          const income = own.filter((row) => row.direction === 'income').reduce((sum, row) => sum + Number(row.amount), 0)
          const expense = own.filter((row) => row.direction === 'expense').reduce((sum, row) => sum + Number(row.amount), 0)
          return [month, csvNumber(income), csvNumber(expense), csvNumber(income - expense)]
        }),
      }
    },
  },
  {
    id: 'saldos-por-conta',
    title: 'Saldos por Conta',
    description: 'Abertura, movimentações liquidadas e saldo atual de cada conta.',
    mark: I.bank,
    color: '#a78bfa',
    soft: 'rgba(167,139,250,.14)',
    build: async () => {
      const [accountList, rows] = await Promise.all([accounts(), transactions()])
      return {
        headers: ['Conta', 'Banco', 'Tipo', 'Abertura (R$)', 'Entradas (R$)', 'Saídas (R$)', 'Saldo (R$)', 'Situação'],
        rows: accountList.map((account) => {
          const own = rows.filter((row) => row.account_id === account.id && row.status === 'paid')
          const income = own.filter((row) => row.direction === 'income').reduce((sum, row) => sum + Number(row.amount), 0)
          const expense = own.filter((row) => row.direction === 'expense').reduce((sum, row) => sum + Number(row.amount), 0)
          return [
            account.name,
            account.bank_name ?? '',
            account.account_type ?? '',
            csvNumber(account.opening_balance),
            csvNumber(income),
            csvNumber(expense),
            csvNumber(balanceOf(account, rows)),
            account.active ? 'Ativa' : 'Inativa',
          ]
        }),
      }
    },
  },
  {
    id: 'parcelas-de-contrato',
    title: 'Parcelas de Contrato',
    description: 'Parcelamento dos contratos com vencimento e situação.',
    mark: I.file,
    color: '#f6a623',
    soft: 'rgba(246,166,35,.14)',
    build: async () => {
      const [rows, contracts] = await Promise.all([installments(), findContracts()])
      const contractNumber = (id: string) => contracts.find((entry) => entry.id === id)?.contract_number ?? ''
      return {
        headers: ['Contrato', 'Parcela', 'Total de parcelas', 'Valor (R$)', 'Vencimento', 'Situação', 'Pago em'],
        rows: rows.map((row) => [
          contractNumber(row.contract_id),
          row.installment_number,
          row.total_installments,
          csvNumber(row.amount),
          date(row.due_date),
          STATUS_LABEL[effectiveStatus(row)],
          row.paid_at ? date(row.paid_at) : '',
        ]),
      }
    },
  },
  {
    id: 'notas-fiscais',
    title: 'Notas Fiscais',
    description: 'Numeração, valor e situação das notas registradas.',
    mark: I.file,
    color: '#2dd4bf',
    soft: 'rgba(45,212,191,.14)',
    build: async () => {
      const [rows, clients] = await Promise.all([invoices(), findClients()])
      const clientName = (id: string | null) => clients.find((client) => client.id === id)?.name ?? ''
      return {
        headers: ['Tipo', 'Número', 'Série', 'Cliente', 'Emissão', 'Valor (R$)', 'Situação'],
        rows: rows.map((row) => [
          row.kind.toUpperCase(),
          row.number,
          row.series ?? '',
          clientName(row.client_id),
          date(row.issue_date),
          csvNumber(row.total_value),
          INVOICE_LABEL[row.status],
        ]),
      }
    },
  },
  {
    id: 'conciliacao',
    title: 'Conciliação Bancária',
    description: 'Linhas do extrato com o lançamento conciliado, quando houver.',
    mark: I.bank,
    color: '#fb7185',
    soft: 'rgba(251,113,133,.14)',
    build: async () => {
      const [entries, rows, accountList] = await Promise.all([statement(), transactions(), accounts()])
      const accountName = (id: string) => accountList.find((entry) => entry.id === id)?.name ?? ''
      const txName = (id: string | null) => rows.find((entry) => entry.id === id)?.description ?? ''
      return {
        headers: ['Data', 'Conta', 'Descrição no extrato', 'Sentido', 'Valor (R$)', 'Referência', 'Lançamento conciliado', 'Conciliada em'],
        rows: entries.map((entry) => [
          date(entry.occurred_at),
          accountName(entry.account_id),
          entry.description,
          DIRECTION_LABEL[entry.direction],
          csvNumber(entry.amount),
          entry.bank_reference ?? '',
          txName(entry.matched_transaction_id),
          entry.reconciled_at ? date(entry.reconciled_at) : '',
        ]),
      }
    },
  },
]

function reportCard(report: Report): HTMLElement {
  const button = h('button.btn.btn-primary', { style: { marginTop: '14px' } }, 'Gerar CSV') as HTMLButtonElement

  button.addEventListener('click', async () => {
    button.disabled = true
    button.textContent = 'Gerando…'
    await guard(async () => {
      const { headers, rows } = await report.build()
      downloadCsv(report.id + '-' + isoDay(), toCsv(headers, rows))
    }, 'Relatório gerado. O download começou.')
    button.disabled = false
    button.textContent = 'Gerar CSV'
  })

  return h(
    'article.card',
    { style: { padding: '20px' } },
    h('div.kpi-icon', { style: { background: report.soft, color: report.color, width: '38px', height: '38px' } }, icon(report.mark, 17)),
    h('div', { style: { fontSize: '15px', fontWeight: '650', marginTop: '14px' } }, report.title),
    h('div.muted', { style: { fontSize: '12.5px', marginTop: '6px', lineHeight: '1.55' } }, report.description),
    button,
  )
}

export function render(host: HTMLElement): void {
  mount(
    host,
    pageHead({ title: 'Relatórios', crumbs: [{ label: 'Financeiro' }, { label: 'Relatórios' }] }),
    h('div.grid', { style: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' } }, REPORTS.map(reportCard)),
  )
}
