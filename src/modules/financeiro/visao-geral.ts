/** Financeiro › Visão Geral — caixa, fluxo e vencimentos. */
import { h, mount } from '../../ui/dom'
import { card, gridCols, gridTemplate } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { kpiCard, KPI_ICONS } from '../../ui/components/kpi'
import { barChart, donutChart } from '../../ui/components/chart'
import { badge } from '../../ui/components/badge'
import { emptyState } from '../../ui/components/feedback'
import { date, money } from '../../core/format'
import { navigate } from '../../core/router'
import {
  accounts,
  balanceOf,
  costCenters,
  effectiveStatus,
  invoices,
  statement,
  STATUS_LABEL,
  STATUS_TONE,
  transactions,
} from '../../data/finance'
import { findAll as findClients } from '../../data/clients'
import { suppliers } from '../../data/inventory'
import type { Child } from '../../ui/dom'
import type { FinancialTransaction } from '../../core/types'

function miniTable(headers: string[], rows: Child[][]): HTMLElement {
  if (!rows.length) return emptyState({ title: 'Nada por aqui' })
  return h(
    'div.table-wrap',
    h(
      'table.data',
      h('thead', h('tr', headers.map((label, index) => h(index >= headers.length - 1 ? 'th.col-right' : 'th', label)))),
      h('tbody', rows.map((cells) => h('tr', cells.map((cell, index) => h(index >= headers.length - 1 ? 'td.col-right' : 'td', cell))))),
    ),
  )
}

/** Realizado de 12 meses: receitas menos despesas liquidadas por mes. */
function cashFlowSeries(rows: FinancialTransaction[]): { label: string; value: number; color: string }[] {
  const points: { label: string; value: number; color: string }[] = []
  const base = new Date()
  base.setDate(1)
  base.setMonth(base.getMonth() - 5)

  for (let index = 0; index < 12; index += 1) {
    const month = new Date(base)
    month.setMonth(base.getMonth() + index)
    const key = month.toISOString().slice(0, 7)
    const paid = rows.filter((row) => row.status === 'paid' && (row.paid_at ?? row.due_date).slice(0, 7) === key)
    const income = paid.filter((row) => row.direction === 'income').reduce((sum, row) => sum + Number(row.amount), 0)
    const expense = paid.filter((row) => row.direction === 'expense').reduce((sum, row) => sum + Number(row.amount), 0)
    const net = income - expense
    points.push({
      label: month.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') + '/' + key.slice(2, 4),
      value: Math.abs(net),
      color: net >= 0 ? '#22c55e' : '#ef4444',
    })
  }
  return points
}

export async function render(host: HTMLElement): Promise<void> {
  const [rows, accountList, centers, notes, entries, clients, vendors] = await Promise.all([
    transactions(),
    accounts(),
    costCenters(),
    invoices(),
    statement(),
    findClients(),
    suppliers(),
  ])

  const partyName = (row: FinancialTransaction) =>
    row.direction === 'income'
      ? clients.find((client) => client.id === row.client_id)?.name ?? '—'
      : vendors.find((vendor) => vendor.id === row.supplier_id)?.name ?? '—'

  const balance = accountList.filter((account) => account.active).reduce((sum, account) => sum + balanceOf(account, rows), 0)
  const open = rows.filter((row) => row.status === 'pending' || effectiveStatus(row) === 'overdue')
  const receivable = open.filter((row) => row.direction === 'income')
  const payable = open.filter((row) => row.direction === 'expense')
  const overdue = open.filter((row) => effectiveStatus(row) === 'overdue')
  const total = (list: FinancialTransaction[]) => list.reduce((sum, row) => sum + Number(row.amount), 0)

  const limit = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  const dueSoon = open
    .filter((row) => row.due_date <= limit)
    .sort((left, right) => left.due_date.localeCompare(right.due_date))

  const month = new Date().toISOString().slice(0, 7)
  const byCenter = centers
    .map((center) => ({
      label: center.code,
      value: rows
        .filter((row) => row.cost_center_id === center.id && row.direction === 'expense' && row.due_date.slice(0, 7) === month)
        .reduce((sum, row) => sum + Number(row.amount), 0),
    }))
    .filter((entry) => entry.value > 0)

  const pendingReconciliation = entries.filter((entry) => !entry.matched_transaction_id).length
  const draftInvoices = notes.filter((note) => note.status === 'draft').length

  mount(
    host,
    pageHead({ title: 'Financeiro', crumbs: [{ label: 'Financeiro' }, { label: 'Visão Geral' }] }),
    h(
      'div.stack',
      gridCols(
        4,
        kpiCard({ label: 'Saldo em caixa', value: money(balance), hint: accountList.filter((a) => a.active).length + ' conta(s)', mark: KPI_ICONS.money, color: '#22c55e', soft: 'rgba(34,197,94,.14)', onClick: () => navigate('/financeiro/caixas-e-bancos') }),
        kpiCard({ label: 'A receber', value: money(total(receivable)), hint: receivable.length + ' lançamento(s)', mark: KPI_ICONS.check, color: '#38bdf8', soft: 'rgba(56,189,248,.14)', onClick: () => navigate('/financeiro/lancamentos', { filtro: 'receber' }) }),
        kpiCard({ label: 'A pagar', value: money(total(payable)), hint: payable.length + ' lançamento(s)', mark: KPI_ICONS.alert, color: '#f6a623', soft: 'rgba(246,166,35,.14)', onClick: () => navigate('/financeiro/lancamentos', { filtro: 'pagar' }) }),
        kpiCard({ label: 'Vencidos', value: money(total(overdue)), hint: overdue.length + ' lançamento(s)', mark: KPI_ICONS.clock, color: '#ef4444', soft: 'rgba(239,68,68,.14)', onClick: () => navigate('/financeiro/lancamentos', { filtro: 'vencidos' }) }),
      ),
      card(
        { title: 'Fluxo de caixa realizado', subtitle: 'Receitas menos despesas liquidadas, por mês' },
        barChart({ data: cashFlowSeries(rows), height: 190, format: (value) => (value ? money(value) : '') }),
      ),
      gridTemplate(
        '1fr 1fr',
        card(
          { title: 'Vence nos próximos 7 dias', footerLink: { label: 'Ver lançamentos', path: '/financeiro/lancamentos' }, flush: true },
          miniTable(
            ['Lançamento', 'Vencimento', 'Valor'],
            dueSoon.slice(0, 6).map((row) => [
              h('div', h('b', row.description), h('div.faint', { style: { fontSize: '11.5px' } }, partyName(row))),
              h('div', date(row.due_date), h('div', { style: { marginTop: '3px' } }, badge(STATUS_LABEL[effectiveStatus(row)], STATUS_TONE[effectiveStatus(row)]))),
              h('b', { style: { color: row.direction === 'income' ? 'var(--green)' : 'var(--accent)' } }, money(row.amount)),
            ]),
          ),
        ),
        byCenter.length
          ? card({ title: 'Despesas do mês por centro de custo', footerLink: { label: 'Ver centros', path: '/financeiro/centros-de-custo' } }, donutChart({ data: byCenter, totalLabel: 'Centros' }))
          : card({ title: 'Despesas do mês por centro de custo' }, emptyState({ title: 'Nenhuma despesa classificada no mês', hint: 'Vincule os lançamentos a um centro de custo.' })),
      ),
      gridTemplate(
        '1fr 1fr',
        card(
          { title: 'Conciliação bancária', footerLink: { label: 'Abrir conciliação', path: '/financeiro/conciliacao' } },
          h(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
            h('div.row', h('span.muted', { style: { flex: '1', fontSize: '13px' } }, 'Linhas do extrato pendentes'), h('b', String(pendingReconciliation))),
            h('div.row', h('span.muted', { style: { flex: '1', fontSize: '13px' } }, 'Linhas já conciliadas'), h('b', String(entries.length - pendingReconciliation))),
          ),
        ),
        card(
          { title: 'Notas fiscais', footerLink: { label: 'Ver notas', path: '/financeiro/notas-fiscais' } },
          h(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
            h('div.row', h('span.muted', { style: { flex: '1', fontSize: '13px' } }, 'Em rascunho'), h('b', String(draftInvoices))),
            h('div.row', h('span.muted', { style: { flex: '1', fontSize: '13px' } }, 'Emitidas'), h('b', String(notes.filter((note) => note.status === 'issued').length))),
            h('div.row', h('span.muted', { style: { flex: '1', fontSize: '13px' } }, 'Valor emitido'), h('b', money(notes.filter((note) => note.status === 'issued').reduce((sum, note) => sum + Number(note.total_value), 0)))),
          ),
        ),
      ),
    ),
  )
}
