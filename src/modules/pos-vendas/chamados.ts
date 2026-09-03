/** Pós-Vendas › Chamados — atendimento com prioridade e SLA. */
import { h, mount } from '../../ui/dom'
import { card, gridCols } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { statFilter, KPI_ICONS } from '../../ui/components/kpi'
import { dataTable, type Column } from '../../ui/components/table'
import { badge } from '../../ui/components/badge'
import { openModal } from '../../ui/components/modal'
import { formRow, selectField, textAreaField, textField } from '../../ui/components/form'
import { guard, toast } from '../../ui/components/feedback'
import { dateTime, daysSince, orDash } from '../../core/format'
import { setQuery, type RouteContext } from '../../core/router'
import {
  assignTicket,
  createTicket,
  isOpen,
  isSlaBreached,
  nextCode,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  setTicketStatus,
  SLA_HOURS,
  slaDueFor,
  TICKET_FLOW,
  TICKET_LABEL,
  TICKET_TONE,
  tickets,
  type TicketInput,
} from '../../data/aftersales'
import { findAll as findClients } from '../../data/clients'
import { findAll as findWorks } from '../../data/works'
import { members, nameOf, type Member } from '../../data/team'
import type { Client, Priority, ServiceTicket, TicketStatus, Work } from '../../core/types'

const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'critical']

const BUCKETS: { id: string; label: string; mark: string; tone: string; match: (row: ServiceTicket) => boolean }[] = [
  { id: 'todos', label: 'Todos', mark: KPI_ICONS.chart, tone: 'var(--accent)', match: () => true },
  { id: 'abertos', label: 'Em aberto', mark: KPI_ICONS.alert, tone: '#f6a623', match: isOpen },
  { id: 'sla', label: 'SLA estourado', mark: KPI_ICONS.clock, tone: '#ef4444', match: isSlaBreached },
  { id: 'resolvidos', label: 'Resolvidos', mark: KPI_ICONS.check, tone: '#22c55e', match: (row) => row.status === 'resolved' },
]

function ticketForm(clients: Client[], works: Work[], team: Member[], existing: string[], onSaved: () => Promise<void>): void {
  let draft: TicketInput = {
    ticket_number: nextCode('CH', existing),
    client_id: '',
    work_id: null,
    title: '',
    description: null,
    priority: 'medium',
    status: 'open',
    assigned_to: null,
    sla_due_at: slaDueFor('medium'),
  }
  const patch = (part: Partial<TicketInput>) => {
    draft = { ...draft, ...part }
  }

  const handle = openModal({
    title: 'Novo chamado',
    subtitle: 'O prazo de SLA é calculado pela prioridade: crítica 8h, alta 24h, média 72h, baixa 120h.',
    width: '660px',
    body: h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      formRow(
        '1fr 2fr',
        textField({ label: 'Número', value: draft.ticket_number, onInput: (value) => patch({ ticket_number: value }) }),
        textField({ label: 'Título', required: true, onInput: (value) => patch({ title: value }) }),
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
          label: 'Prioridade',
          value: 'medium',
          options: PRIORITIES.map((priority) => ({ value: priority, label: PRIORITY_LABEL[priority] + ' · ' + SLA_HOURS[priority] + 'h' })),
          onChange: (value) => {
            const priority = value as Priority
            patch({ priority, sla_due_at: slaDueFor(priority) })
          },
        }),
      ),
      formRow(
        '1fr 1fr',
        selectField({
          label: 'Obra (opcional)',
          placeholder: 'Sem obra',
          options: works.map((work) => ({ value: work.id, label: work.name })),
          onChange: (value) => patch({ work_id: value || null }),
        }),
        selectField({
          label: 'Responsável',
          placeholder: 'Sem responsável',
          options: team.map((member) => ({ value: member.userId, label: member.name })),
          onChange: (value) => patch({ assigned_to: value || null }),
        }),
      ),
      textAreaField({ label: 'Descrição', onInput: (value) => patch({ description: value || null }) }),
    ),
    footer: [
      h('button.btn.btn-ghost', { onClick: () => handle.close() }, 'Cancelar'),
      h(
        'button.btn.btn-primary',
        {
          onClick: async () => {
            if (!draft.title.trim()) {
              toast('Informe o título do chamado.', 'error')
              return
            }
            if (!draft.client_id) {
              toast('Selecione o cliente do chamado.', 'error')
              return
            }
            const ok = await guard(async () => {
              await createTicket(draft)
              await onSaved()
            }, 'Chamado aberto.')
            if (ok) handle.close()
          },
        },
        'Abrir chamado',
      ),
    ],
  })
}

export async function render(host: HTMLElement, ctx: RouteContext): Promise<void> {
  async function draw(): Promise<void> {
    const [rows, clients, works, team] = await Promise.all([tickets(), findClients(), findWorks(), members()])
    const clientName = (id: string) => clients.find((client) => client.id === id)?.name ?? '—'

    const bucket = ctx.query.get('filtro') ?? 'abertos'
    const active = BUCKETS.find((entry) => entry.id === bucket) ?? BUCKETS[0]
    const visible = rows.filter(active.match)

    const columns: Column<ServiceTicket>[] = [
      {
        key: 'title',
        label: 'Chamado',
        sortable: true,
        render: (row) =>
          h(
            'div',
            h('div.row', h('b', row.title), isSlaBreached(row) ? badge('SLA estourado', 'red') : null),
            h('div.faint', { style: { fontSize: '11.5px', marginTop: '2px' } }, row.ticket_number + ' · ' + clientName(row.client_id)),
          ),
      },
      {
        key: 'priority',
        label: 'Prioridade',
        sortable: true,
        value: (row) => PRIORITY_LABEL[row.priority],
        render: (row) => badge(PRIORITY_LABEL[row.priority], PRIORITY_TONE[row.priority]),
      },
      {
        key: 'status',
        label: 'Situação',
        value: (row) => TICKET_LABEL[row.status],
        render: (row) =>
          h(
            'select.page-size',
            {
              onChange: (event: Event) => {
                const value = (event.target as HTMLSelectElement).value as TicketStatus
                void guard(async () => {
                  await setTicketStatus(row.id, value)
                  await draw()
                }, 'Situação atualizada.')
              },
            },
            TICKET_FLOW.map((status) => h('option', { value: status, selected: status === row.status }, TICKET_LABEL[status])),
          ),
      },
      {
        key: 'badge',
        label: 'Etapa',
        value: (row) => TICKET_LABEL[row.status],
        render: (row) => badge(TICKET_LABEL[row.status], TICKET_TONE[row.status]),
      },
      {
        key: 'assigned_to',
        label: 'Responsável',
        value: (row) => nameOf(team, row.assigned_to),
        render: (row) =>
          h(
            'select.page-size',
            {
              onChange: (event: Event) => {
                const value = (event.target as HTMLSelectElement).value
                void guard(async () => {
                  await assignTicket(row.id, value || null)
                  await draw()
                }, 'Responsável atualizado.')
              },
            },
            h('option', { value: '', selected: !row.assigned_to }, 'Sem responsável'),
            team.map((member) => h('option', { value: member.userId, selected: member.userId === row.assigned_to }, member.name)),
          ),
      },
      {
        key: 'sla_due_at',
        label: 'Prazo (SLA)',
        sortable: true,
        value: (row) => row.sla_due_at ?? '',
        render: (row) =>
          row.sla_due_at
            ? h(
                'div',
                h('div', { style: { color: isSlaBreached(row) ? 'var(--red)' : 'var(--text)' } }, dateTime(row.sla_due_at)),
                isOpen(row) ? h('div.faint', { style: { fontSize: '11.5px' } }, 'aberto há ' + daysSince(row.created_at) + ' dia(s)') : null,
              )
            : h('span.faint', '—'),
      },
      { key: 'description', label: 'Descrição', render: (row) => orDash(row.description) },
    ]

    mount(
      host,
      pageHead({
        title: 'Chamados',
        crumbs: [{ label: 'Pós-Vendas' }, { label: 'Chamados' }],
        actions: [
          h(
            'button.btn.btn-primary',
            {
              onClick: () => {
                if (!clients.length) {
                  toast('Cadastre um cliente antes de abrir chamados.', 'error')
                  return
                }
                ticketForm(clients, works, team, rows.map((row) => row.ticket_number), draw)
              },
            },
            '+ Novo chamado',
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
              onClick: () => setQuery({ filtro: entry.id === 'abertos' ? null : entry.id }),
            }),
          ),
        ),
        card(
          { flush: true },
          dataTable({
            columns,
            rows: visible,
            searchable: true,
            searchPlaceholder: 'Buscar chamado ou cliente',
            pageSize: 10,
            initialSort: { key: 'sla_due_at', ascending: true },
            emptyTitle: 'Nenhum chamado nesta situação',
            emptyHint: 'Abra um chamado quando o cliente reportar um problema.',
            totalLabel: (total) => `${total} chamado(s)`,
          }),
        ),
      ),
    )
  }

  await draw()
}
