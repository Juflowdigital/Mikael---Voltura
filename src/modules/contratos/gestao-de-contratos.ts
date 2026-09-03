/** Contratos › Gestão de Contratos — abas por etapa, lista e kanban (tela M14). */
import { h, icon, mount } from '../../ui/dom'
import { card } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { tabs } from '../../ui/components/tabs'
import { dataTable, type Column } from '../../ui/components/table'
import { badge } from '../../ui/components/badge'
import { guard, toast, emptyState } from '../../ui/components/feedback'
import { initials, money, power } from '../../core/format'
import { navigate, setQuery, type RouteContext } from '../../core/router'
import { findAll, powerKwp, setStage, stageOf, STAGES, STAGE_LABEL, STAGE_TONE, type Stage } from '../../data/contracts'
import { findAll as findClients } from '../../data/clients'
import type { Client, Contract } from '../../core/types'

const ICON_LIST = '<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>'
const ICON_BOARD = '<rect width="7" height="18" x="3" y="3" rx="1"/><rect width="7" height="10" x="14" y="3" rx="1"/>'

function avatar(name: string): HTMLElement {
  return h(
    'div.avatar',
    { style: { width: '26px', height: '26px', fontSize: '10.5px', background: 'var(--green-soft)', color: 'var(--green)' } },
    initials(name),
  )
}

function board(contracts: Contract[], clientName: (id: string) => string, onMove: (id: string, stage: Stage) => Promise<void>): HTMLElement {
  const columns = STAGES.map((stage) => {
    const rows = contracts.filter((contract) => stageOf(contract) === stage.id)
    const body = h(
      'div.kanban-column-body',
      rows.map((contract) => {
        const node = h(
          'article.kanban-card',
          { draggable: 'true' },
          h('div.kanban-card-title', contract.title || contract.contract_number),
          h('div.kanban-card-sub', clientName(contract.client_id)),
          h(
            'div.kanban-card-foot',
            h(
              'div',
              { style: { flex: '1', display: 'flex', flexDirection: 'column', gap: '3px' } },
              h('span.kanban-meta', '⚡ ' + power(powerKwp(contract))),
              h('span.kanban-meta', '$ ' + money(contract.total_value)),
            ),
          ),
        )
        node.addEventListener('dragstart', (event) => {
          ;(event as DragEvent).dataTransfer?.setData('text/plain', contract.id)
          node.classList.add('is-dragging')
        })
        node.addEventListener('dragend', () => node.classList.remove('is-dragging'))
        return node
      }),
    )

    const column = h(
      'section.kanban-column',
      h('header.kanban-column-head', stage.label, h('span.kanban-column-count', String(rows.length))),
      body,
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
      if (id) void onMove(id, stage.id)
    })
    return column
  })

  return h('div.kanban', h('div.kanban-zone', h('div.kanban-zone-body', columns)))
}

export async function render(host: HTMLElement, ctx: RouteContext): Promise<void> {
  async function draw(): Promise<void> {
    const [contracts, clients] = await Promise.all([findAll(), findClients()])
    const clientName = (id: string) => clients.find((client: Client) => client.id === id)?.name ?? '—'

    const stageFilter = ctx.query.get('etapa') ?? 'todos'
    const view = ctx.query.get('visao') ?? 'lista'
    const rows = stageFilter === 'todos' ? contracts : contracts.filter((contract) => stageOf(contract) === stageFilter)

    async function onMove(id: string, stage: Stage): Promise<void> {
      const contract = contracts.find((entry) => entry.id === id)
      if (!contract || stageOf(contract) === stage) return
      await guard(async () => {
        await setStage(id, stage)
        await draw()
      })
      toast(`Contrato movido para ${STAGE_LABEL[stage]}.`, 'success')
    }

    const columns: Column<Contract>[] = [
      {
        key: 'client',
        label: 'Cliente',
        sortable: true,
        value: (row) => clientName(row.client_id),
        render: (row) =>
          h('div.row', avatar(clientName(row.client_id)), h('b', clientName(row.client_id))),
      },
      {
        key: 'title',
        label: 'Título',
        sortable: true,
        value: (row) => row.title ?? row.contract_number,
        render: (row) =>
          h('div', h('div', row.title || '—'), h('div.faint', { style: { fontSize: '11.5px' } }, row.contract_number)),
      },
      {
        key: 'power',
        label: 'Potência (kWp)',
        align: 'right',
        sortable: true,
        value: (row) => powerKwp(row) ?? 0,
        render: (row) => h('b', { style: { color: 'var(--accent)' } }, power(powerKwp(row))),
      },
      {
        key: 'total_value',
        label: 'Preço',
        align: 'right',
        sortable: true,
        value: (row) => Number(row.total_value ?? 0),
        render: (row) => money(row.total_value),
      },
      {
        key: 'stage',
        label: 'Etapa',
        value: (row) => STAGE_LABEL[stageOf(row)],
        render: (row) => badge(STAGE_LABEL[stageOf(row)], STAGE_TONE[stageOf(row)]),
      },
    ]

    const counts = STAGES.reduce(
      (acc, stage) => ({ ...acc, [stage.id]: contracts.filter((contract) => stageOf(contract) === stage.id).length }),
      {} as Record<string, number>,
    )

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
        title: 'Gestão de Contratos',
        crumbs: [{ label: 'Contratos', path: '/contratos/visao-geral' }, { label: 'Gestão de Contratos' }],
        actions: [
          viewToggle('lista', ICON_LIST, 'Ver em lista'),
          viewToggle('kanban', ICON_BOARD, 'Ver em kanban'),
          h('button.btn.btn-light', { onClick: () => navigate('/contratos/criar-contrato') }, '+ Criar Contrato'),
        ],
      }),
      card(
        { flush: true },
        h(
          'div',
          { style: { padding: '0 16px' } },
          tabs({
            tabs: [
              { id: 'todos', label: 'Todos', count: contracts.length },
              ...STAGES.map((stage) => ({ id: stage.id, label: stage.label, count: counts[stage.id] })),
            ],
            active: stageFilter,
            onChange: (id) => setQuery({ etapa: id === 'todos' ? null : id }),
          }),
        ),
        view === 'kanban'
          ? h('div', { style: { padding: '16px' } }, contracts.length ? board(contracts, clientName, onMove) : emptyState({ title: 'Nenhum contrato cadastrado' }))
          : dataTable({
              columns,
              rows,
              searchable: true,
              searchPlaceholder: 'Buscar',
              initialSort: { key: 'client', ascending: true },
              emptyTitle: 'Nenhum contrato nesta etapa',
              emptyHint: 'Crie um contrato a partir de uma negociação aceita.',
              totalLabel: (total) => `${total} registro(s)`,
            }),
      ),
    )
  }

  await draw()
}
