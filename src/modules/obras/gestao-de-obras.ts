/** Obras › Gestão de Obras — lista, kanban por etapa e ficha com checklist. */
import { h, icon, mount } from '../../ui/dom'
import { card } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { tabs } from '../../ui/components/tabs'
import { dataTable, type Column } from '../../ui/components/table'
import { badge } from '../../ui/components/badge'
import { openModal } from '../../ui/components/modal'
import { formRow, selectField, textField } from '../../ui/components/form'
import { guard, toast } from '../../ui/components/feedback'
import { date, decimal, parseMoney, percent, power } from '../../core/format'
import { setQuery, type RouteContext } from '../../core/router'
import { app } from '../../core/session'
import {
  addressOf,
  assign,
  assignments,
  checklist,
  create,
  findAll,
  isLate,
  nextNumber,
  progressOf,
  setStatus,
  STAGE_LABEL,
  STAGE_TONE,
  STAGES,
  toggleChecklistItem,
  type WorkInput,
} from '../../data/works'
import { findAll as findClients } from '../../data/clients'
import { findAll as findContracts } from '../../data/contracts'
import { members, nameOf, type Member } from '../../data/team'
import type { Client, Work, WorkChecklistItem, WorkStatus } from '../../core/types'

const ICON_LIST = '<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>'
const ICON_BOARD = '<rect width="7" height="18" x="3" y="3" rx="1"/><rect width="7" height="10" x="14" y="3" rx="1"/>'

const BOARD_STAGES: WorkStatus[] = ['planning', 'separation', 'mobilization', 'installation', 'commissioning', 'delivery', 'completed']

function workForm(
  clients: Client[],
  contracts: { id: string; contract_number: string; title: string | null; client_id: string }[],
  existing: string[],
  onSaved: () => Promise<void>,
): void {
  let draft: WorkInput = {
    work_number: nextNumber(existing),
    client_id: '',
    contract_id: null,
    name: '',
    status: 'planning',
    system_power_kwp: null,
    address: {},
    planned_start: null,
    planned_end: null,
    budgeted_cost: null,
  }
  const patch = (part: Partial<WorkInput>) => {
    draft = { ...draft, ...part }
  }

  const handle = openModal({
    title: 'Nova obra',
    subtitle: 'A obra nasce com o checklist padrão de execução já montado.',
    width: '660px',
    body: h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      formRow(
        '1fr 2fr',
        textField({ label: 'Número', value: draft.work_number, onInput: (value) => patch({ work_number: value }) }),
        textField({ label: 'Nome da obra', required: true, onInput: (value) => patch({ name: value }) }),
      ),
      selectField({
        label: 'Contrato (opcional)',
        placeholder: 'Sem contrato',
        options: contracts.map((contract) => ({ value: contract.id, label: contract.contract_number + ' · ' + (contract.title ?? '') })),
        onChange: (value) => {
          const contract = contracts.find((entry) => entry.id === value)
          patch({ contract_id: value || null, client_id: contract ? contract.client_id : draft.client_id })
        },
      }),
      selectField({
        label: 'Cliente',
        placeholder: 'Selecione o cliente',
        options: clients.map((client) => ({ value: client.id, label: client.name })),
        onChange: (value) => patch({ client_id: value }),
      }),
      textField({
        label: 'Endereço da instalação',
        onInput: (value) => patch({ address: { ...draft.address, full: value } }),
      }),
      formRow(
        '1fr 1fr 1fr',
        textField({ label: 'Potência (kWp)', onInput: (value) => patch({ system_power_kwp: value.trim() ? parseMoney(value) : null }) }),
        textField({ label: 'Início previsto', type: 'date', onInput: (value) => patch({ planned_start: value || null }) }),
        textField({ label: 'Fim previsto', type: 'date', onInput: (value) => patch({ planned_end: value || null }) }),
      ),
    ),
    footer: [
      h('button.btn.btn-ghost', { onClick: () => handle.close() }, 'Cancelar'),
      h(
        'button.btn.btn-primary',
        {
          onClick: async () => {
            if (!draft.name.trim()) {
              toast('Informe o nome da obra.', 'error')
              return
            }
            if (!draft.client_id) {
              toast('Selecione o cliente da obra.', 'error')
              return
            }
            if (draft.planned_start && draft.planned_end && draft.planned_end < draft.planned_start) {
              toast('O fim previsto não pode ser antes do início.', 'error')
              return
            }
            const ok = await guard(async () => {
              await create(draft)
              await onSaved()
            }, 'Obra criada com checklist padrão.')
            if (ok) handle.close()
          },
        },
        'Criar obra',
      ),
    ],
  })
}

function workDetail(
  work: Work,
  tasks: WorkChecklistItem[],
  crew: { userId: string; role: string }[],
  team: Member[],
  onChanged: () => Promise<void>,
): void {
  const body = h('div')
  let current = tasks

  function draw(): void {
    const grouped = STAGES.filter((stage) => current.some((task) => task.stage === stage.id))

    mount(
      body,
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
        h(
          'div.row',
          { style: { gap: '18px', flexWrap: 'wrap' } },
          h('div', h('div.field-label', 'Etapa'), badge(STAGE_LABEL[work.status], STAGE_TONE[work.status])),
          h('div', h('div.field-label', 'Potência'), h('b', power(work.system_power_kwp))),
          h('div', h('div.field-label', 'Progresso'), h('b', percent(progressOf(current), 0))),
          h('div', h('div.field-label', 'Endereço'), h('span.muted', addressOf(work))),
        ),
        h('div.progress', h('span', { style: { width: progressOf(current) + '%', background: 'var(--accent)' } })),
        h(
          'div',
          h('div.field-label', { style: { marginBottom: '8px' } }, 'Equipe alocada'),
          crew.length
            ? h('div.row', { style: { gap: '8px', flexWrap: 'wrap' } }, crew.map((entry) => badge(nameOf(team, entry.userId) + ' · ' + entry.role, 'blue')))
            : h('span.faint', { style: { fontSize: '12.5px' } }, 'Ninguém alocado nesta obra ainda.'),
        ),
        ...grouped.map((stage) =>
          h(
            'div',
            h('div.field-label', { style: { margin: '10px 0 8px' } }, stage.label),
            h(
              'div',
              { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
              current
                .filter((task) => task.stage === stage.id)
                .map((task) =>
                  h(
                    'label.row',
                    {
                      style: {
                        gap: '10px',
                        cursor: 'pointer',
                        padding: '9px 12px',
                        borderRadius: '9px',
                        background: task.completed ? 'var(--green-soft)' : 'var(--surface-2)',
                      },
                      onClick: () => {
                        void guard(async () => {
                          const updated = await toggleChecklistItem(task, app.get().user?.id ?? null)
                          current = current.map((entry) => (entry.id === updated.id ? updated : entry))
                          draw()
                          await onChanged()
                        })
                      },
                    },
                    h('span', { style: { color: task.completed ? 'var(--green)' : 'var(--text-faint)', fontSize: '15px' } }, task.completed ? '☑' : '☐'),
                    h(
                      'span',
                      { style: { flex: '1', fontSize: '13px', textDecoration: task.completed ? 'line-through' : 'none', color: task.completed ? 'var(--text-muted)' : 'var(--text)' } },
                      task.title,
                    ),
                    task.completed_at ? h('span.faint', { style: { fontSize: '11.5px' } }, date(task.completed_at)) : null,
                  ),
                ),
            ),
          ),
        ),
      ),
    )
  }

  const handle = openModal({
    title: work.name,
    subtitle: work.work_number + ' · ' + (work.planned_end ? 'fim previsto ' + date(work.planned_end) : 'sem prazo definido'),
    width: '720px',
    body,
    footer: [h('button.btn.btn-ghost', { onClick: () => handle.close() }, 'Fechar')],
  })

  draw()
}

export async function render(host: HTMLElement, ctx: RouteContext): Promise<void> {
  async function draw(): Promise<void> {
    const [works, tasks, crew, clients, contracts, team] = await Promise.all([
      findAll(),
      checklist(),
      assignments(),
      findClients(),
      findContracts(),
      members(),
    ])
    const clientName = (id: string) => clients.find((client: Client) => client.id === id)?.name ?? '—'
    const tasksOf = (workId: string) => tasks.filter((task) => task.work_id === workId)
    const crewOf = (workId: string) =>
      crew.filter((entry) => entry.work_id === workId).map((entry) => ({ userId: entry.user_id, role: entry.assignment_role }))

    const stage = ctx.query.get('etapa') ?? 'todas'
    const view = ctx.query.get('visao') ?? 'lista'
    const rows = stage === 'todas' ? works : works.filter((work) => work.status === stage)

    async function move(id: string, next: WorkStatus): Promise<void> {
      const work = works.find((entry) => entry.id === id)
      if (!work || work.status === next) return
      await guard(async () => {
        await setStatus(id, next)
        await draw()
      })
      toast('"' + work.name + '" movida para ' + STAGE_LABEL[next] + '.', 'success')
    }

    function allocate(row: Work): void {
      const available = team.filter((member) => !crewOf(row.id).some((entry) => entry.userId === member.userId))
      if (!available.length) {
        toast('Toda a equipe já está alocada nesta obra.')
        return
      }
      let userId = available[0].userId
      let role = 'Instalador'
      const handle = openModal({
        title: 'Alocar na obra',
        subtitle: row.name,
        width: '480px',
        body: h(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
          selectField({
            label: 'Pessoa',
            value: userId,
            options: available.map((member) => ({ value: member.userId, label: member.name })),
            onChange: (value) => (userId = value),
          }),
          textField({ label: 'Função', value: role, onInput: (value) => (role = value) }),
        ),
        footer: [
          h('button.btn.btn-ghost', { onClick: () => handle.close() }, 'Cancelar'),
          h(
            'button.btn.btn-primary',
            {
              onClick: async () => {
                const ok = await guard(async () => {
                  await assign(row.id, userId, role.trim() || 'Instalador')
                  await draw()
                }, 'Pessoa alocada na obra.')
                if (ok) handle.close()
              },
            },
            'Alocar',
          ),
        ],
      })
    }

    const columns: Column<Work>[] = [
      {
        key: 'name',
        label: 'Obra',
        sortable: true,
        render: (row) =>
          h(
            'div',
            h('div.row', h('b', row.name), isLate(row) ? badge('Atrasada', 'red') : null),
            h('div.faint', { style: { fontSize: '11.5px', marginTop: '2px' } }, row.work_number + ' · ' + addressOf(row)),
          ),
      },
      { key: 'client', label: 'Cliente', sortable: true, value: (row) => clientName(row.client_id), render: (row) => clientName(row.client_id) },
      {
        key: 'status',
        label: 'Etapa',
        value: (row) => STAGE_LABEL[row.status],
        render: (row) =>
          h(
            'select.page-size',
            { onChange: (event: Event) => void move(row.id, (event.target as HTMLSelectElement).value as WorkStatus) },
            STAGES.map((entry) => h('option', { value: entry.id, selected: entry.id === row.status }, entry.label)),
          ),
      },
      {
        key: 'progress',
        label: 'Progresso',
        align: 'right',
        sortable: true,
        value: (row) => progressOf(tasksOf(row.id)),
        render: (row) => {
          const value = progressOf(tasksOf(row.id))
          return h(
            'div',
            { style: { minWidth: '110px' } },
            h('div.row', { style: { justifyContent: 'flex-end', fontSize: '12px', marginBottom: '4px' } }, percent(value, 0)),
            h('div.progress', h('span', { style: { width: value + '%', background: value >= 100 ? 'var(--green)' : 'var(--accent)' } })),
          )
        },
      },
      {
        key: 'crew',
        label: 'Equipe',
        value: (row) => crewOf(row.id).length,
        render: (row) => {
          const own = crewOf(row.id)
          return own.length ? h('span', own.map((entry) => nameOf(team, entry.userId)).join(', ')) : h('span.faint', 'Sem equipe')
        },
      },
      {
        key: 'power',
        label: 'Potência',
        align: 'right',
        sortable: true,
        value: (row) => Number(row.system_power_kwp ?? 0),
        render: (row) => power(row.system_power_kwp),
      },
      { key: 'planned_end', label: 'Fim previsto', sortable: true, render: (row) => (row.planned_end ? date(row.planned_end) : '—') },
      {
        key: 'actions',
        label: 'Ações',
        align: 'right',
        width: '190px',
        render: (row) =>
          h(
            'div.row',
            { style: { justifyContent: 'flex-end', gap: '6px' } },
            h(
              'button.btn.btn-ghost',
              { style: { fontSize: '12px', padding: '4px 10px' }, onClick: () => workDetail(row, tasksOf(row.id), crewOf(row.id), team, draw) },
              'Checklist',
            ),
            h('button.btn.btn-ghost', { style: { fontSize: '12px', padding: '4px 10px' }, onClick: () => allocate(row) }, 'Alocar'),
          ),
      },
    ]

    const boardColumns = BOARD_STAGES.map((entry) => {
      const list = works.filter((work) => work.status === entry)
      const cards = list.map((work) => {
        const node = h(
          'article.kanban-card',
          { draggable: 'true', onClick: () => workDetail(work, tasksOf(work.id), crewOf(work.id), team, draw) },
          h('div.kanban-card-title', work.name),
          h('div.kanban-card-sub', clientName(work.client_id)),
          h(
            'div.kanban-card-foot',
            h(
              'div',
              { style: { flex: '1', display: 'flex', flexDirection: 'column', gap: '3px' } },
              h('span.kanban-meta', '⚡ ' + power(work.system_power_kwp)),
              h('span.kanban-meta', '✔ ' + percent(progressOf(tasksOf(work.id)), 0)),
            ),
            isLate(work) ? badge('Atrasada', 'red') : null,
          ),
        )
        node.addEventListener('dragstart', (event) => {
          ;(event as DragEvent).dataTransfer?.setData('text/plain', work.id)
          node.classList.add('is-dragging')
        })
        node.addEventListener('dragend', () => node.classList.remove('is-dragging'))
        return node
      })

      const column = h(
        'section.kanban-column',
        h('header.kanban-column-head', STAGE_LABEL[entry], h('span.kanban-column-count', String(list.length))),
        h('div.kanban-column-body', cards),
      )
      column.addEventListener('dragover', (event) => {
        event.preventDefault()
        column.classList.add('is-drop')
      })
      column.addEventListener('dragleave', () => column.classList.remove('is-drop'))
      column.addEventListener('drop', (event) => {
        event.preventDefault()
        column.classList.remove('is-drop')
        const id = (event as DragEvent).dataTransfer?.getData('text/plain')
        if (id) void move(id, entry)
      })
      return column
    })

    const viewToggle = (id: string, mark: string, label: string) =>
      h(
        'button',
        {
          class: 'btn btn-icon' + (view === id ? ' btn-primary' : ' btn-ghost'),
          title: label,
          onClick: () => setQuery({ visao: id === 'lista' ? null : id }),
        },
        icon(mark, 15),
      )

    mount(
      host,
      pageHead({
        title: 'Gestão de Obras',
        crumbs: [{ label: 'Obras', path: '/obras/visao-geral' }, { label: 'Gestão de Obras' }],
        actions: [
          viewToggle('lista', ICON_LIST, 'Ver em lista'),
          viewToggle('kanban', ICON_BOARD, 'Ver em kanban'),
          h('button.btn.btn-primary', { onClick: () => workForm(clients, contracts, works.map((work) => work.work_number), draw) }, '+ Nova obra'),
        ],
      }),
      card(
        { flush: true },
        h(
          'div',
          { style: { padding: '0 16px' } },
          tabs({
            tabs: [
              { id: 'todas', label: 'Todas', count: works.length },
              ...STAGES.filter((entry) => works.some((work) => work.status === entry.id)).map((entry) => ({
                id: entry.id,
                label: entry.label,
                count: works.filter((work) => work.status === entry.id).length,
              })),
            ],
            active: stage,
            onChange: (id) => setQuery({ etapa: id === 'todas' ? null : id }),
          }),
        ),
        view === 'kanban'
          ? h('div', { style: { padding: '16px' } }, h('div.kanban', h('div.kanban-zone', h('div.kanban-zone-body', boardColumns))))
          : dataTable({
              columns,
              rows,
              searchable: true,
              searchPlaceholder: 'Buscar obra ou cliente',
              pageSize: 10,
              initialSort: { key: 'planned_end', ascending: true },
              emptyTitle: 'Nenhuma obra nesta etapa',
              emptyHint: 'Crie uma obra a partir de um contrato assinado.',
              totalLabel: (total) => `${total} obra(s)`,
            }),
      ),
    )
  }

  await draw()
}
