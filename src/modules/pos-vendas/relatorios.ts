/** Pós-Vendas › Relatórios — extrações em CSV. */
import { h, icon, mount } from '../../ui/dom'
import { pageHead } from '../../ui/components/page'
import { guard } from '../../ui/components/feedback'
import { csvNumber, downloadCsv, toCsv } from '../../core/csv'
import { date, dateTime, daysSince, isoDay } from '../../core/format'
import {
  isOrderLate,
  isSlaBreached,
  npsGroup,
  npsResponses,
  NPS_LABEL,
  omContracts,
  ORDER_KIND_LABEL,
  ORDER_STATUS_LABEL,
  orders,
  PRIORITY_LABEL,
  TICKET_LABEL,
  tickets,
  warranties,
} from '../../data/aftersales'
import { findAll as findClients } from '../../data/clients'
import { members, nameOf } from '../../data/team'

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
  headset: '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5a9 9 0 0 1 18 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
  star: '<polygon points="12 2 15 9 22 9.3 17 14 18.5 21 12 17.3 5.5 21 7 14 2 9.3 9 9"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
}

const REPORTS: Report[] = [
  {
    id: 'chamados',
    title: 'Chamados',
    description: 'Prioridade, SLA, responsável, tempo em aberto e situação.',
    mark: I.headset,
    color: '#2dd4bf',
    soft: 'rgba(45,212,191,.14)',
    build: async () => {
      const [rows, clients, team] = await Promise.all([tickets(), findClients(), members()])
      const clientName = (id: string) => clients.find((client) => client.id === id)?.name ?? ''
      return {
        headers: ['Número', 'Título', 'Cliente', 'Prioridade', 'Situação', 'Responsável', 'Prazo SLA', 'SLA estourado', 'Dias em aberto', 'Resolvido em'],
        rows: rows.map((ticket) => [
          ticket.ticket_number,
          ticket.title,
          clientName(ticket.client_id),
          PRIORITY_LABEL[ticket.priority],
          TICKET_LABEL[ticket.status],
          nameOf(team, ticket.assigned_to),
          ticket.sla_due_at ? dateTime(ticket.sla_due_at) : '',
          isSlaBreached(ticket) ? 'Sim' : 'Não',
          daysSince(ticket.created_at),
          ticket.resolved_at ? date(ticket.resolved_at) : '',
        ]),
      }
    },
  },
  {
    id: 'ordens-de-servico',
    title: 'Ordens de Serviço',
    description: 'Tipo, agendamento, técnico e situação de cada visita.',
    mark: I.wrench,
    color: '#38bdf8',
    soft: 'rgba(56,189,248,.14)',
    build: async () => {
      const [rows, allTickets, clients, team] = await Promise.all([orders(), tickets(), findClients(), members()])
      const clientName = (id: string) => clients.find((client) => client.id === id)?.name ?? ''
      const ticketNumber = (id: string | null) => allTickets.find((ticket) => ticket.id === id)?.ticket_number ?? ''
      return {
        headers: ['OS', 'Chamado', 'Cliente', 'Tipo', 'Situação', 'Agendada para', 'Atrasada', 'Técnico', 'Início', 'Conclusão'],
        rows: rows.map((order) => [
          order.order_number,
          ticketNumber(order.ticket_id),
          clientName(order.client_id),
          ORDER_KIND_LABEL[order.kind],
          ORDER_STATUS_LABEL[order.status],
          order.scheduled_for ? date(order.scheduled_for) : '',
          isOrderLate(order) ? 'Sim' : 'Não',
          nameOf(team, order.technician_id),
          order.started_at ? date(order.started_at) : '',
          order.finished_at ? date(order.finished_at) : '',
        ]),
      }
    },
  },
  {
    id: 'satisfacao',
    title: 'Satisfação (NPS)',
    description: 'Nota, classificação e comentário de cada resposta.',
    mark: I.star,
    color: '#22c55e',
    soft: 'rgba(34,197,94,.14)',
    build: async () => {
      const [rows, clients] = await Promise.all([npsResponses(), findClients()])
      const clientName = (id: string) => clients.find((client) => client.id === id)?.name ?? ''
      return {
        headers: ['Cliente', 'Nota', 'Classificação', 'Comentário', 'Respondido em'],
        rows: rows.map((row) => [
          clientName(row.client_id),
          row.score,
          NPS_LABEL[npsGroup(row.score)],
          row.comment ?? '',
          dateTime(row.responded_at),
        ]),
      }
    },
  },
  {
    id: 'garantias-e-planos',
    title: 'Garantias e Planos de O&M',
    description: 'Cobertura vigente por cliente e planos de manutenção ativos.',
    mark: I.shield,
    color: '#a78bfa',
    soft: 'rgba(167,139,250,.14)',
    build: async () => {
      const [covers, plans, clients] = await Promise.all([warranties(), omContracts(), findClients()])
      const clientName = (id: string) => clients.find((client) => client.id === id)?.name ?? ''
      const rows: unknown[][] = [
        ...covers.map((cover) => [
          'Garantia',
          clientName(cover.client_id),
          cover.kind,
          cover.manufacturer ?? '',
          date(cover.starts_on),
          date(cover.ends_on),
          '',
          '',
        ]),
        ...plans.map((plan) => [
          'Plano de O&M',
          clientName(plan.client_id),
          plan.plan_name,
          plan.frequency,
          date(plan.starts_on),
          plan.ends_on ? date(plan.ends_on) : '',
          csvNumber(plan.amount),
          plan.active ? 'Ativo' : 'Inativo',
        ]),
      ]
      return { headers: ['Tipo', 'Cliente', 'Item', 'Detalhe', 'Início', 'Fim', 'Valor (R$)', 'Situação'], rows }
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
    pageHead({ title: 'Relatórios', crumbs: [{ label: 'Pós-Vendas' }, { label: 'Relatórios' }] }),
    h('div.grid', { style: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' } }, REPORTS.map(reportCard)),
  )
}
