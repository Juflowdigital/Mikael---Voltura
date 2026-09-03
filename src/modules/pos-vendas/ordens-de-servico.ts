/** Pós-Vendas › Ordens de Serviço — visitas agendadas em campo. */
import { h, mount } from '../../ui/dom'
import { card, gridCols } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { statFilter, KPI_ICONS } from '../../ui/components/kpi'
import { dataTable, type Column } from '../../ui/components/table'
import { badge } from '../../ui/components/badge'
import { openModal } from '../../ui/components/modal'
import { formRow, selectField, textAreaField, textField } from '../../ui/components/form'
import { guard, toast } from '../../ui/components/feedback'
import { date, isoDay, orDash } from '../../core/format'
import { setQuery, type RouteContext } from '../../core/router'
import {
  createOrder,
  isOrderLate,
  nextCode,
  ORDER_KIND_LABEL,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  orders,
  setOrderStatus,
  tickets,
  type OrderInput,
} from '../../data/aftersales'
import { findAll as findClients } from '../../data/clients'
import { findAll as findWorks } from '../../data/works'
import { members, nameOf, type Member } from '../../data/team'
import type { Client, ServiceOrder, ServiceOrderKind, ServiceOrderStatus, ServiceTicket, Work } from '../../core/types'

const KINDS: ServiceOrderKind[] = ['corretiva', 'preventiva', 'garantia', 'instalacao']
const FLOW: ServiceOrderStatus[] = ['scheduled', 'in_progress', 'done', 'cancelled']

const BUCKETS: { id: string; label: string; mark: string; tone: string; match: (row: ServiceOrder) => boolean }[] = [
  { id: 'todas', label: 'Todas', mark: KPI_ICONS.chart, tone: 'var(--accent)', match: () => true },
  { id: 'agendadas', label: 'Agendadas', mark: KPI_ICONS.calendar, tone: '#38bdf8', match: (row) => row.status === 'scheduled' },
  { id: 'atrasadas', label: 'Atrasadas', mark: KPI_ICONS.alert, tone: '#ef4444', match: isOrderLate },
  { id: 'concluidas', label: 'Concluídas', mark: KPI_ICONS.check, tone: '#22c55e', match: (row) => row.status === 'done' },
]

function orderForm(
  clients: Client[],
  works: Work[],
  openTickets: ServiceTicket[],
  team: Member[],
  existing: string[],
  onSaved: () => Promise<void>,
): void {
  let draft: OrderInput = {
    order_number: nextCode('OS', existing),
    ticket_id: null,
    client_id: '',
    work_id: null,
    kind: 'corretiva',
    status: 'scheduled',
    scheduled_for: isoDay(),
    technician_id: null,
    notes: null,
  }
  const patch = (part: Partial<OrderInput>) => {
    draft = { ...draft, ...part }
  }

  const handle = openModal({
    title: 'Nova ordem de serviço',
    subtitle: 'Vincule um chamado para puxar o cliente automaticamente.',
    width: '660px',
    body: h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      formRow(
        '1fr 2fr',
        textField({ label: 'Número', value: draft.order_number, onInput: (value) => patch({ order_number: value }) }),
        selectField({
          label: 'Chamado de origem (opcional)',
          placeholder: 'Sem chamado',
          options: openTickets.map((ticket) => ({ value: ticket.id, label: ticket.ticket_number + ' · ' + ticket.title })),
          onChange: (value) => {
            const ticket = openTickets.find((entry) => entry.id === value)
            patch({
              ticket_id: value || null,
              client_id: ticket ? ticket.client_id : draft.client_id,
              work_id: ticket ? ticket.work_id : draft.work_id,
            })
          },
        }),
      ),
      formRow(
        '2fr 1fr',
        selectField({
          label: 'Cliente',
          placeholder: 'Selecione o cliente',
          options: clients.map((client) => ({ value: client.id, label: client.name })),
          onChange: (value) => patch({ client_id: value }),
        }),
        selectField({
          label: 'Tipo',
          value: 'corretiva',
          options: KINDS.map((kind) => ({ value: kind, label: ORDER_KIND_LABEL[kind] })),
          onChange: (value) => patch({ kind: value as ServiceOrderKind }),
        }),
      ),
      formRow(
        '1fr 1fr 1fr',
        selectField({
          label: 'Obra (opcional)',
          placeholder: 'Sem obra',
          options: works.map((work) => ({ value: work.id, label: work.name })),
          onChange: (value) => patch({ work_id: value || null }),
        }),
        textField({ label: 'Agendada para', type: 'date', value: draft.scheduled_for ?? '', onInput: (value) => patch({ scheduled_for: value || null }) }),
        selectField({
          label: 'Técnico',
          placeholder: 'Sem técnico',
          options: team.map((member) => ({ value: member.userId, label: member.name })),
          onChange: (value) => patch({ technician_id: value || null }),
        }),
      ),
      textAreaField({ label: 'Observações', onInput: (value) => patch({ notes: value || null }) }),
    ),
    footer: [
      h('button.btn.btn-ghost', { onClick: () => handle.close() }, 'Cancelar'),
      h(
        'button.btn.btn-primary',
        {
          onClick: async () => {
            if (!draft.client_id) {
              toast('Selecione o cliente da ordem de serviço.', 'error')
              return
            }
            const ok = await guard(async () => {
              await createOrder(draft)
              await onSaved()
            }, 'Ordem de serviço criada.')
            if (ok) handle.close()
          },
        },
        'Criar OS',
      ),
    ],
  })
}

export async function render(host: HTMLElement, ctx: RouteContext): Promise<void> {
  async function draw(): Promise<void> {
    const [rows, allTickets, clients, works, team] = await Promise.all([
      orders(),
      tickets(),
      findClients(),
      findWorks(),
      members(),
    ])
    const clientName = (id: string) => clients.find((client) => client.id === id)?.name ?? '—'
    const ticketNumber = (id: string | null) => allTickets.find((ticket) => ticket.id === id)?.ticket_number ?? '—'
    const openTickets = allTickets.filter((ticket) => ticket.status !== 'resolved' && ticket.status !== 'cancelled')

    const bucket = ctx.query.get('filtro') ?? 'todas'
    const active = BUCKETS.find((entry) => entry.id === bucket) ?? BUCKETS[0]
    const visible = rows.filter(active.match)

    const columns: Column<ServiceOrder>[] = [
      {
        key: 'order_number',
        label: 'OS',
        sortable: true,
        render: (row) =>
          h(
            'div',
            h('div.row', h('b', row.order_number), isOrderLate(row) ? badge('Atrasada', 'red') : null),
            h('div.faint', { style: { fontSize: '11.5px', marginTop: '2px' } }, 'Chamado ' + ticketNumber(row.ticket_id)),
          ),
      },
      { key: 'client', label: 'Cliente', sortable: true, value: (row) => clientName(row.client_id), render: (row) => clientName(row.client_id) },
      {
        key: 'kind',
        label: 'Tipo',
        sortable: true,
        value: (row) => ORDER_KIND_LABEL[row.kind],
        render: (row) => badge(ORDER_KIND_LABEL[row.kind], row.kind === 'garantia' ? 'purple' : row.kind === 'preventiva' ? 'blue' : 'amber'),
      },
      {
        key: 'status',
        label: 'Situação',
        value: (row) => ORDER_STATUS_LABEL[row.status],
        render: (row) =>
          h(
            'select.page-size',
            {
              onChange: (event: Event) => {
                const value = (event.target as HTMLSelectElement).value as ServiceOrderStatus
                void guard(async () => {
                  await setOrderStatus(row.id, value)
                  await draw()
                }, 'Situação atualizada.')
              },
            },
            FLOW.map((status) => h('option', { value: status, selected: status === row.status }, ORDER_STATUS_LABEL[status])),
          ),
      },
      {
        key: 'badge',
        label: 'Etapa',
        value: (row) => ORDER_STATUS_LABEL[row.status],
        render: (row) => badge(ORDER_STATUS_LABEL[row.status], ORDER_STATUS_TONE[row.status]),
      },
      {
        key: 'scheduled_for',
        label: 'Agendada para',
        sortable: true,
        value: (row) => row.scheduled_for ?? '',
        render: (row) =>
          row.scheduled_for
            ? h('span', { style: { color: isOrderLate(row) ? 'var(--red)' : 'var(--text)' } }, date(row.scheduled_for))
            : h('span.faint', 'Sem data'),
      },
      { key: 'technician', label: 'Técnico', value: (row) => nameOf(team, row.technician_id), render: (row) => nameOf(team, row.technician_id) },
      { key: 'notes', label: 'Observações', render: (row) => orDash(row.notes) },
    ]

    mount(
      host,
      pageHead({
        title: 'Ordens de Serviço',
        crumbs: [{ label: 'Pós-Vendas' }, { label: 'Ordens de Serviço' }],
        actions: [
          h(
            'button.btn.btn-primary',
            {
              onClick: () => {
                if (!clients.length) {
                  toast('Cadastre um cliente antes de abrir uma OS.', 'error')
                  return
                }
                orderForm(clients, works, openTickets, team, rows.map((row) => row.order_number), draw)
              },
            },
            '+ Nova OS',
          ),
        ],
      }),
      h(
        'div.stack',
        gridCols(
          4,
          ...BUCKETS.map((entry) =>
            statFilter({
              label: entry.label,
              value: String(rows.filter(entry.match).length),
              mark: entry.mark,
              tone: entry.tone,
              active: bucket === entry.id,
              onClick: () => setQuery({ filtro: entry.id === 'todas' ? null : entry.id }),
            }),
          ),
        ),
        card(
          { flush: true },
          dataTable({
            columns,
            rows: visible,
            searchable: true,
            searchPlaceholder: 'Buscar OS ou cliente',
            pageSize: 10,
            initialSort: { key: 'scheduled_for', ascending: true },
            emptyTitle: 'Nenhuma ordem nesta situação',
            emptyHint: 'Gere uma OS a partir de um chamado ou de um plano de manutenção.',
            totalLabel: (total) => `${total} ordem(ns)`,
          }),
        ),
      ),
    )
  }

  await draw()
}
