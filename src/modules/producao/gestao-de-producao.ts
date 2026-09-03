/** Produção › Gestão de Produção — cartões-filtro e fluxo por ordem (tela M22). */
import { h, mount } from '../../ui/dom'
import { card, gridCols } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { statFilter, KPI_ICONS } from '../../ui/components/kpi'
import { dataTable, type Column } from '../../ui/components/table'
import { badge } from '../../ui/components/badge'
import { openModal } from '../../ui/components/modal'
import { formRow, selectField, textField } from '../../ui/components/form'
import { guard, toast } from '../../ui/components/feedback'
import { date, orDash } from '../../core/format'
import { setQuery, type RouteContext } from '../../core/router'
import { app } from '../../core/session'
import {
  createOrder,
  FLOW_LABEL,
  FLOW_TONE,
  orders,
  setFlow,
  setStage,
  STAGE_LABEL,
  STAGE_TONE,
} from '../../data/production'
import { findAll as findClients } from '../../data/clients'
import { findAll as findContracts } from '../../data/contracts'
import { members, nameOf, type Member } from '../../data/team'
import { units } from '../../data/organization'
import { nextCode } from '../../data/inventory'
import type { Client, FlowStatus, ProductionOrder, ProductionStage } from '../../core/types'

const BUCKETS: { id: string; label: string; mark: string; tone: string; stage: ProductionStage | null }[] = [
  { id: 'todas', label: 'Todas', mark: KPI_ICONS.box, tone: 'var(--accent)', stage: null },
  { id: 'a-produzir', label: 'A produzir', mark: KPI_ICONS.clock, tone: '#f6a623', stage: 'a-produzir' },
  { id: 'em-producao', label: 'Em produção', mark: KPI_ICONS.chart, tone: '#38bdf8', stage: 'em-producao' },
  { id: 'concluida', label: 'Concluída', mark: KPI_ICONS.check, tone: '#22c55e', stage: 'concluida' },
]

const FLOWS: FlowStatus[] = ['nao-iniciado', 'em-andamento', 'concluido']

function orderForm(
  clients: Client[],
  contracts: { id: string; contract_number: string; title: string | null; client_id: string }[],
  team: Member[],
  existing: string[],
  onSaved: () => Promise<void>,
): void {
  let clientId = ''
  let contractId = ''
  let managerId = app.get().user?.id ?? ''

  const handle = openModal({
    title: 'Nova ordem de produção',
    subtitle: 'Vincule um contrato para puxar o cliente automaticamente.',
    width: '600px',
    body: h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      selectField({
        label: 'Contrato (opcional)',
        placeholder: 'Sem contrato',
        options: contracts.map((contract) => ({ value: contract.id, label: contract.contract_number + ' · ' + (contract.title ?? '') })),
        onChange: (value) => {
          contractId = value
          const contract = contracts.find((entry) => entry.id === value)
          if (contract) clientId = contract.client_id
        },
      }),
      selectField({
        label: 'Cliente',
        placeholder: 'Selecione o cliente',
        options: clients.map((client) => ({ value: client.id, label: client.name })),
        onChange: (value) => (clientId = value),
      }),
      selectField({
        label: 'Gestor',
        value: managerId,
        placeholder: 'Sem gestor',
        options: team.map((member) => ({ value: member.userId, label: member.name })),
        onChange: (value) => (managerId = value),
      }),
    ),
    footer: [
      h('button.btn.btn-ghost', { onClick: () => handle.close() }, 'Cancelar'),
      h(
        'button.btn.btn-primary',
        {
          onClick: async () => {
            if (!clientId) {
              toast('Selecione o cliente da produção.', 'error')
              return
            }
            const ok = await guard(async () => {
              await createOrder({
                code: nextCode('PR', existing),
                client_id: clientId,
                contract_id: contractId || null,
                business_unit_id: null,
                manager_id: managerId || null,
                stage: 'a-produzir',
              })
              await onSaved()
            }, 'Ordem de produção criada.')
            if (ok) handle.close()
          },
        },
        'Criar produção',
      ),
    ],
  })
}

export async function render(host: HTMLElement, ctx: RouteContext): Promise<void> {
  async function draw(): Promise<void> {
    const [rows, clients, contracts, team, businessUnits] = await Promise.all([
      orders(),
      findClients(),
      findContracts(),
      members(),
      units(),
    ])
    const clientName = (id: string) => clients.find((client) => client.id === id)?.name ?? '—'
    const unitName = (id: string | null) => businessUnits.find((unit) => unit.id === id)?.name ?? '—'

    const bucket = ctx.query.get('filtro') ?? 'todas'
    const visible = bucket === 'todas' ? rows : rows.filter((row) => row.stage === bucket)
    const counts = Object.fromEntries(
      BUCKETS.map((entry) => [entry.id, entry.stage ? rows.filter((row) => row.stage === entry.stage).length : rows.length]),
    )

    const flowCell = (row: ProductionOrder, field: 'purchase_flow' | 'shipping_flow') =>
      h(
        'select.page-size',
        {
          onChange: (event: Event) => {
            const value = (event.target as HTMLSelectElement).value as FlowStatus
            void guard(async () => {
              await setFlow(row.id, field, value)
              await draw()
            }, 'Fluxo atualizado.')
          },
        },
        FLOWS.map((flow) => h('option', { value: flow, selected: flow === row[field] }, FLOW_LABEL[flow])),
      )

    const columns: Column<ProductionOrder>[] = [
      {
        key: 'code',
        label: 'Produção',
        sortable: true,
        render: (row) => h('div', h('b', clientName(row.client_id)), h('div.faint', { style: { fontSize: '11.5px' } }, row.code)),
      },
      { key: 'client', label: 'Cliente', sortable: true, value: (row) => clientName(row.client_id), render: (row) => clientName(row.client_id) },
      {
        key: 'stage',
        label: 'Etapa',
        value: (row) => STAGE_LABEL[row.stage],
        render: (row) => badge(STAGE_LABEL[row.stage], STAGE_TONE[row.stage]),
      },
      { key: 'manager', label: 'Gestor', value: (row) => nameOf(team, row.manager_id), render: (row) => nameOf(team, row.manager_id) },
      { key: 'unit', label: 'Unidade', value: (row) => unitName(row.business_unit_id), render: (row) => unitName(row.business_unit_id) },
      { key: 'purchase_flow', label: 'Fluxo de compra', value: (row) => FLOW_LABEL[row.purchase_flow], render: (row) => flowCell(row, 'purchase_flow') },
      { key: 'shipping_flow', label: 'Fluxo de expedição', value: (row) => FLOW_LABEL[row.shipping_flow], render: (row) => flowCell(row, 'shipping_flow') },
      {
        key: 'conflicts',
        label: 'Conflitos',
        value: (row) => (row.conflicts ?? []).length,
        render: (row) => ((row.conflicts ?? []).length ? badge(String(row.conflicts.length), 'red') : h('span.faint', '—')),
      },
      { key: 'created_at', label: 'Criada em', sortable: true, render: (row) => date(row.created_at) },
      {
        key: 'actions',
        label: 'Ações',
        align: 'right',
        width: '170px',
        render: (row) =>
          h(
            'div.row',
            { style: { justifyContent: 'flex-end', gap: '6px' } },
            row.stage === 'a-produzir'
              ? h(
                  'button.btn.btn-ghost',
                  {
                    style: { fontSize: '12px', padding: '4px 10px' },
                    onClick: () => {
                      void guard(async () => {
                        await setStage(row.id, 'em-producao')
                        await draw()
                      }, 'Produção iniciada.')
                    },
                  },
                  'Iniciar',
                )
              : null,
            row.stage === 'em-producao'
              ? h(
                  'button.btn.btn-ghost',
                  {
                    style: { fontSize: '12px', padding: '4px 10px' },
                    onClick: () => {
                      void guard(async () => {
                        await setStage(row.id, 'concluida')
                        await draw()
                      }, 'Produção concluída.')
                    },
                  },
                  'Concluir',
                )
              : null,
            row.stage === 'concluida' ? h('span.faint', { style: { fontSize: '12px' } }, orDash(row.finished_at ? date(row.finished_at) : '')) : null,
          ),
      },
    ]

    mount(
      host,
      pageHead({
        title: 'Gestão de Produção',
        crumbs: [{ label: 'Produção e Estoque' }, { label: 'Gestão de Produção' }],
        actions: [
          h(
            'button.btn.btn-primary',
            { onClick: () => orderForm(clients, contracts, team, rows.map((row) => row.code), draw) },
            '+ Nova produção',
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
              value: String(counts[entry.id]),
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
            searchPlaceholder: 'Buscar por cliente ou contrato',
            pageSize: 10,
            initialSort: { key: 'created_at', ascending: false },
            emptyTitle: 'Nenhuma produção nesta situação',
            emptyHint: 'Crie uma ordem a partir de um contrato assinado.',
            totalLabel: (total) => `${total} registro(s)`,
          }),
        ),
      ),
    )
  }

  await draw()
}
