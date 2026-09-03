/** Produção › Apontamentos Logísticos — expedição, entrega, coleta e devolução. */
import { h, mount } from '../../ui/dom'
import { card, gridCols } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { statFilter, KPI_ICONS } from '../../ui/components/kpi'
import { dataTable, type Column } from '../../ui/components/table'
import { badge } from '../../ui/components/badge'
import { openModal } from '../../ui/components/modal'
import { formRow, selectField, textField } from '../../ui/components/form'
import { guard, toast } from '../../ui/components/feedback'
import { dateTime, orDash } from '../../core/format'
import { setQuery, type RouteContext } from '../../core/router'
import { createLogistics, LOGISTICS_LABEL, LOGISTICS_TONE, logistics, orders } from '../../data/production'
import { findAll as findClients } from '../../data/clients'
import type { LogisticsEntry, LogisticsKind, ProductionOrder } from '../../core/types'

const KINDS: LogisticsKind[] = ['expedicao', 'entrega', 'coleta', 'devolucao']

const MARKS: Record<LogisticsKind, { mark: string; tone: string }> = {
  expedicao: { mark: KPI_ICONS.box, tone: '#38bdf8' },
  entrega: { mark: KPI_ICONS.check, tone: '#22c55e' },
  coleta: { mark: KPI_ICONS.clock, tone: '#f6a623' },
  devolucao: { mark: KPI_ICONS.alert, tone: '#ef4444' },
}

function entryForm(productions: ProductionOrder[], onSaved: () => Promise<void>): void {
  let kind: LogisticsKind = 'expedicao'
  let productionId = ''
  let vehicle = ''
  let driver = ''
  let notes = ''
  let occurredAt = new Date().toISOString().slice(0, 16)

  const handle = openModal({
    title: 'Novo apontamento logístico',
    subtitle: 'Registre a movimentação física do material.',
    width: '620px',
    body: h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      formRow(
        '1fr 1fr',
        selectField({
          label: 'Tipo',
          value: 'expedicao',
          options: KINDS.map((entry) => ({ value: entry, label: LOGISTICS_LABEL[entry] })),
          onChange: (value) => (kind = value as LogisticsKind),
        }),
        textField({
          label: 'Data e hora',
          type: 'datetime-local',
          value: occurredAt,
          onInput: (value) => (occurredAt = value),
        }),
      ),
      selectField({
        label: 'Produção (opcional)',
        placeholder: 'Sem vínculo',
        options: productions.map((order) => ({ value: order.id, label: order.code })),
        onChange: (value) => (productionId = value),
      }),
      formRow(
        '1fr 1fr',
        textField({ label: 'Veículo', onInput: (value) => (vehicle = value) }),
        textField({ label: 'Motorista', onInput: (value) => (driver = value) }),
      ),
      textField({ label: 'Observação', onInput: (value) => (notes = value) }),
    ),
    footer: [
      h('button.btn.btn-ghost', { onClick: () => handle.close() }, 'Cancelar'),
      h(
        'button.btn.btn-primary',
        {
          onClick: async () => {
            if (!occurredAt) {
              toast('Informe a data e hora do apontamento.', 'error')
              return
            }
            const ok = await guard(async () => {
              await createLogistics({
                work_id: null,
                production_order_id: productionId || null,
                kind,
                occurred_at: new Date(occurredAt).toISOString(),
                vehicle: vehicle.trim() || null,
                driver: driver.trim() || null,
                notes: notes.trim() || null,
              })
              await onSaved()
            }, 'Apontamento registrado.')
            if (ok) handle.close()
          },
        },
        'Registrar apontamento',
      ),
    ],
  })
}

export async function render(host: HTMLElement, ctx: RouteContext): Promise<void> {
  async function draw(): Promise<void> {
    const [rows, productions, clients] = await Promise.all([logistics(), orders(), findClients()])
    const productionLabel = (id: string | null) => {
      const order = productions.find((entry) => entry.id === id)
      if (!order) return '—'
      const client = clients.find((entry) => entry.id === order.client_id)?.name ?? ''
      return order.code + (client ? ' · ' + client : '')
    }

    const filter = ctx.query.get('tipo') ?? 'todos'
    const visible = filter === 'todos' ? rows : rows.filter((row) => row.kind === filter)

    const columns: Column<LogisticsEntry>[] = [
      { key: 'occurred_at', label: 'Quando', sortable: true, render: (row) => dateTime(row.occurred_at) },
      {
        key: 'kind',
        label: 'Tipo',
        value: (row) => LOGISTICS_LABEL[row.kind],
        render: (row) => badge(LOGISTICS_LABEL[row.kind], LOGISTICS_TONE[row.kind]),
      },
      { key: 'production', label: 'Produção', value: (row) => productionLabel(row.production_order_id), render: (row) => productionLabel(row.production_order_id) },
      { key: 'vehicle', label: 'Veículo', render: (row) => orDash(row.vehicle) },
      { key: 'driver', label: 'Motorista', render: (row) => orDash(row.driver) },
      { key: 'notes', label: 'Observação', render: (row) => orDash(row.notes) },
    ]

    mount(
      host,
      pageHead({
        title: 'Apontamentos Logísticos',
        crumbs: [{ label: 'Produção e Estoque' }, { label: 'Apontamentos Logísticos' }],
        actions: [h('button.btn.btn-primary', { onClick: () => entryForm(productions, draw) }, '+ Novo apontamento')],
      }),
      h(
        'div.stack',
        gridCols(
          4,
          ...KINDS.map((kind) =>
            statFilter({
              label: LOGISTICS_LABEL[kind],
              value: String(rows.filter((row) => row.kind === kind).length),
              mark: MARKS[kind].mark,
              tone: MARKS[kind].tone,
              active: filter === kind,
              onClick: () => setQuery({ tipo: filter === kind ? null : kind }),
            }),
          ),
        ),
        card(
          { flush: true },
          dataTable({
            columns,
            rows: visible,
            searchable: true,
            searchPlaceholder: 'Buscar apontamento',
            pageSize: 10,
            initialSort: { key: 'occurred_at', ascending: false },
            emptyTitle: 'Nenhum apontamento registrado',
            emptyHint: 'Registre expedições, entregas, coletas e devoluções.',
            totalLabel: (total) => `${total} apontamento(s)`,
          }),
        ),
      ),
    )
  }

  await draw()
}
