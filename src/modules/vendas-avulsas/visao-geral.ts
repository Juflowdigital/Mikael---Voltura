/** Vendas Avulsas › Visão Geral — receita avulsa e itens mais vendidos. */
import { h, mount } from '../../ui/dom'
import { card, gridCols, gridTemplate } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { kpiCard, KPI_ICONS } from '../../ui/components/kpi'
import { barChart } from '../../ui/components/chart'
import { emptyState } from '../../ui/components/feedback'
import { date, money } from '../../core/format'
import { navigate } from '../../core/router'
import { countsAsRevenue, saleItems, sales, SALE_LABEL } from '../../data/sales'
import { findAll as findClients } from '../../data/clients'
import { members } from '../../data/team'
import type { Child } from '../../ui/dom'
import type { DirectSale } from '../../core/types'

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

/** Receita avulsa dos ultimos 12 meses, contando confirmadas e entregues. */
function revenueSeries(rows: DirectSale[]): { label: string; value: number }[] {
  const points: { label: string; value: number }[] = []
  const base = new Date()
  base.setDate(1)
  base.setMonth(base.getMonth() - 5)

  for (let index = 0; index < 12; index += 1) {
    const month = new Date(base)
    month.setMonth(base.getMonth() + index)
    const key = month.toISOString().slice(0, 7)
    const total = rows
      .filter((row) => countsAsRevenue(row) && row.sold_at.slice(0, 7) === key)
      .reduce((sum, row) => sum + Number(row.total_value), 0)
    points.push({ label: month.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') + '/' + key.slice(2, 4), value: total })
  }
  return points
}

export async function render(host: HTMLElement): Promise<void> {
  const [rows, lines, clients, team] = await Promise.all([sales(), saleItems(), findClients(), members()])
  const clientName = (id: string | null) => clients.find((client) => client.id === id)?.name ?? 'Consumidor não identificado'

  const revenue = rows.filter(countsAsRevenue)
  const month = new Date().toISOString().slice(0, 7)
  const thisMonth = revenue.filter((row) => row.sold_at.slice(0, 7) === month)
  const totalMonth = thisMonth.reduce((sum, row) => sum + Number(row.total_value), 0)
  const ticket = revenue.length ? revenue.reduce((sum, row) => sum + Number(row.total_value), 0) / revenue.length : 0

  const byItem = new Map<string, { quantity: number; total: number }>()
  for (const line of lines) {
    const sale = rows.find((entry) => entry.id === line.sale_id)
    if (!sale || !countsAsRevenue(sale)) continue
    const current = byItem.get(line.description) ?? { quantity: 0, total: 0 }
    byItem.set(line.description, {
      quantity: current.quantity + Number(line.quantity),
      total: current.total + Number(line.quantity) * Number(line.unit_price),
    })
  }
  const topItems = [...byItem.entries()].sort((left, right) => right[1].total - left[1].total).slice(0, 6)

  const bySeller = team
    .map((member) => ({
      name: member.name,
      total: revenue.filter((row) => row.seller_id === member.userId).reduce((sum, row) => sum + Number(row.total_value), 0),
      count: revenue.filter((row) => row.seller_id === member.userId).length,
    }))
    .filter((entry) => entry.count > 0)
    .sort((left, right) => right.total - left.total)

  mount(
    host,
    pageHead({
      title: 'Vendas Avulsas',
      crumbs: [{ label: 'Vendas Avulsas' }, { label: 'Visão Geral' }],
      actions: [h('button.btn.btn-primary', { onClick: () => navigate('/vendas-avulsas/gestao-de-vendas') }, '+ Nova venda')],
    }),
    h(
      'div.stack',
      gridCols(
        4,
        kpiCard({ label: 'Receita do mês', value: money(totalMonth), hint: thisMonth.length + ' venda(s)', mark: KPI_ICONS.money, color: '#fb7185', soft: 'rgba(251,113,133,.14)' }),
        kpiCard({ label: 'Vendas confirmadas', value: String(revenue.length), mark: KPI_ICONS.check, color: '#22c55e', soft: 'rgba(34,197,94,.14)', onClick: () => navigate('/vendas-avulsas/gestao-de-vendas', { filtro: 'confirmadas' }) }),
        kpiCard({ label: 'Ticket médio', value: money(ticket), mark: KPI_ICONS.chart, color: '#38bdf8', soft: 'rgba(56,189,248,.14)' }),
        kpiCard({ label: 'Rascunhos', value: String(rows.filter((row) => row.status === 'draft').length), mark: KPI_ICONS.file, color: '#8ba0b8', soft: 'rgba(139,160,184,.14)', onClick: () => navigate('/vendas-avulsas/gestao-de-vendas', { filtro: 'rascunho' }) }),
      ),
      card({ title: 'Receita avulsa por mês', subtitle: 'Somente vendas confirmadas ou entregues' }, barChart({ data: revenueSeries(rows), height: 190, format: (value) => (value ? money(value) : '') })),
      gridTemplate(
        '1fr 1fr',
        card(
          { title: 'Itens mais vendidos', flush: true },
          miniTable(
            ['Item', 'Quantidade', 'Total'],
            topItems.map(([name, data]) => [h('b', name), String(data.quantity), money(data.total)]),
          ),
        ),
        card(
          { title: 'Vendas por vendedor', flush: true },
          miniTable(
            ['Vendedor', 'Vendas', 'Total'],
            bySeller.map((entry) => [h('b', entry.name), String(entry.count), money(entry.total)]),
          ),
        ),
      ),
      card(
        { title: 'Últimas vendas', footerLink: { label: 'Ver todas', path: '/vendas-avulsas/gestao-de-vendas' }, flush: true },
        miniTable(
          ['Venda', 'Cliente', 'Valor'],
          rows.slice(0, 6).map((row) => [
            h('div', h('b', row.sale_number), h('div.faint', { style: { fontSize: '11.5px' } }, SALE_LABEL[row.status] + ' · ' + date(row.sold_at))),
            clientName(row.client_id),
            money(row.total_value),
          ]),
        ),
      ),
    ),
  )
}
