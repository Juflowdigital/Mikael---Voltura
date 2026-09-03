/** Pós-Vendas › Visão Geral — chamados, OS, garantias e satisfação. */
import { h, mount } from '../../ui/dom'
import { card, gridCols, gridTemplate } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { kpiCard, KPI_ICONS } from '../../ui/components/kpi'
import { stackedBar } from '../../ui/components/chart'
import { badge } from '../../ui/components/badge'
import { emptyState } from '../../ui/components/feedback'
import { date, daysSince, money, orDash } from '../../core/format'
import { navigate } from '../../core/router'
import {
  isExpiringSoon,
  isOpen,
  isOrderLate,
  isSlaBreached,
  npsScore,
  npsResponses,
  omContracts,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  orders,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  tickets,
  warranties,
} from '../../data/aftersales'
import { findAll as findClients } from '../../data/clients'
import type { Child } from '../../ui/dom'

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

export async function render(host: HTMLElement): Promise<void> {
  const [allTickets, allOrders, plans, covers, nps, clients] = await Promise.all([
    tickets(),
    orders(),
    omContracts(),
    warranties(),
    npsResponses(),
    findClients(),
  ])
  const clientName = (id: string) => clients.find((client) => client.id === id)?.name ?? '—'

  const open = allTickets.filter(isOpen)
  const breached = allTickets.filter(isSlaBreached)
  const scheduled = allOrders.filter((order) => order.status === 'scheduled')
  const lateOrders = allOrders.filter(isOrderLate)
  const activePlans = plans.filter((plan) => plan.active)
  const expiring = covers.filter((cover) => isExpiringSoon(cover))
  const month = new Date().toISOString().slice(0, 7)
  const resolvedThisMonth = allTickets.filter((ticket) => ticket.resolved_at && ticket.resolved_at.slice(0, 7) === month)

  const byPriority = (['critical', 'high', 'medium', 'low'] as const).map((priority) => ({
    label: PRIORITY_LABEL[priority],
    value: open.filter((ticket) => ticket.priority === priority).length,
    color: priority === 'critical' ? '#ef4444' : priority === 'high' ? '#f6a623' : priority === 'medium' ? '#38bdf8' : '#8ba0b8',
  }))

  mount(
    host,
    pageHead({ title: 'Pós-Vendas', crumbs: [{ label: 'Pós-Vendas' }, { label: 'Visão Geral' }] }),
    h(
      'div.stack',
      gridCols(
        4,
        kpiCard({ label: 'Chamados abertos', value: String(open.length), hint: resolvedThisMonth.length + ' resolvidos no mês', mark: KPI_ICONS.alert, color: '#f6a623', soft: 'rgba(246,166,35,.14)', onClick: () => navigate('/pos-vendas/chamados') }),
        kpiCard({ label: 'SLA estourado', value: String(breached.length), mark: KPI_ICONS.clock, color: '#ef4444', soft: 'rgba(239,68,68,.14)', onClick: () => navigate('/pos-vendas/chamados', { filtro: 'sla' }) }),
        kpiCard({ label: 'OS agendadas', value: String(scheduled.length), hint: lateOrders.length + ' atrasada(s)', mark: KPI_ICONS.calendar, color: '#38bdf8', soft: 'rgba(56,189,248,.14)', onClick: () => navigate('/pos-vendas/ordens-de-servico', { filtro: 'agendadas' }) }),
        kpiCard({ label: 'NPS', value: String(npsScore(nps)), hint: nps.length + ' resposta(s)', mark: KPI_ICONS.trophy, color: '#22c55e', soft: 'rgba(34,197,94,.14)', onClick: () => navigate('/pos-vendas/satisfacao') }),
      ),
      card({ title: 'Chamados abertos por prioridade' }, stackedBar(byPriority)),
      gridTemplate(
        '1fr 1fr',
        card(
          { title: 'Chamados com SLA estourado', footerLink: { label: 'Ver chamados', path: '/pos-vendas/chamados' }, flush: true },
          miniTable(
            ['Chamado', 'Cliente', 'Aberto há'],
            breached.slice(0, 6).map((ticket) => [
              h('div', h('b', ticket.title), h('div', { style: { marginTop: '3px' } }, badge(PRIORITY_LABEL[ticket.priority], PRIORITY_TONE[ticket.priority]))),
              clientName(ticket.client_id),
              h('b', { style: { color: 'var(--red)' } }, daysSince(ticket.created_at) + ' dia(s)'),
            ]),
          ),
        ),
        card(
          { title: 'Próximas ordens de serviço', footerLink: { label: 'Ver OS', path: '/pos-vendas/ordens-de-servico' }, flush: true },
          miniTable(
            ['OS', 'Cliente', 'Agendada'],
            [...scheduled]
              .sort((left, right) => (left.scheduled_for ?? '').localeCompare(right.scheduled_for ?? ''))
              .slice(0, 6)
              .map((order) => [
                h('div', h('b', order.order_number), h('div', { style: { marginTop: '3px' } }, badge(ORDER_STATUS_LABEL[order.status], ORDER_STATUS_TONE[order.status]))),
                clientName(order.client_id),
                order.scheduled_for ? date(order.scheduled_for) : '—',
              ]),
          ),
        ),
      ),
      gridTemplate(
        '1fr 1fr',
        card(
          { title: 'Garantias vencendo em 90 dias', subtitle: expiring.length ? expiring.length + ' garantia(s)' : undefined, flush: true },
          miniTable(
            ['Garantia', 'Cliente', 'Vence em'],
            expiring.slice(0, 6).map((cover) => [
              h('div', h('b', cover.kind), h('div.faint', { style: { fontSize: '11.5px' } }, orDash(cover.manufacturer))),
              clientName(cover.client_id),
              h('b', { style: { color: 'var(--accent)' } }, date(cover.ends_on)),
            ]),
          ),
        ),
        card(
          { title: 'Planos de O&M ativos', subtitle: activePlans.length ? money(activePlans.reduce((sum, plan) => sum + Number(plan.amount), 0)) + ' por ciclo' : undefined, flush: true },
          miniTable(
            ['Plano', 'Cliente', 'Valor'],
            activePlans.slice(0, 6).map((plan) => [
              h('div', h('b', plan.plan_name), h('div.faint', { style: { fontSize: '11.5px' } }, plan.frequency)),
              clientName(plan.client_id),
              money(plan.amount),
            ]),
          ),
        ),
      ),
    ),
  )
}
