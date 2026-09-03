/** Produção › Gestão de Compras — pedidos por situação. */
import { h, mount } from '../../ui/dom'
import { card, gridCols } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { statFilter, KPI_ICONS } from '../../ui/components/kpi'
import { dataTable, type Column } from '../../ui/components/table'
import { badge } from '../../ui/components/badge'
import { guard } from '../../ui/components/feedback'
import { date, money } from '../../core/format'
import { setQuery, type RouteContext } from '../../core/router'
import { PURCHASE_LABEL, PURCHASE_TONE, purchaseOrders, setPurchaseStatus, suppliers } from '../../data/inventory'
import type { PurchaseOrder, PurchaseStatus } from '../../core/types'

const FLOW: PurchaseStatus[] = ['draft', 'quoted', 'approved', 'ordered', 'partially_received', 'received', 'cancelled']

const BUCKETS: { id: string; label: string; mark: string; tone: string; match: (row: PurchaseOrder) => boolean }[] = [
  { id: 'todos', label: 'Todos', mark: KPI_ICONS.box, tone: 'var(--accent)', match: () => true },
  { id: 'aberto', label: 'Em aberto', mark: KPI_ICONS.clock, tone: '#f6a623', match: (row) => ['draft', 'quoted', 'approved', 'ordered'].includes(row.status) },
  { id: 'recebendo', label: 'Recebendo', mark: KPI_ICONS.chart, tone: '#38bdf8', match: (row) => row.status === 'partially_received' },
  { id: 'recebido', label: 'Recebidos', mark: KPI_ICONS.check, tone: '#22c55e', match: (row) => row.status === 'received' },
]

export async function render(host: HTMLElement, ctx: RouteContext): Promise<void> {
  async function draw(): Promise<void> {
    const [rows, vendors] = await Promise.all([purchaseOrders(), suppliers()])
    const supplierName = (id: string) => vendors.find((vendor) => vendor.id === id)?.name ?? '—'

    const bucket = ctx.query.get('filtro') ?? 'todos'
    const active = BUCKETS.find((entry) => entry.id === bucket) ?? BUCKETS[0]
    const visible = rows.filter(active.match)
    const openValue = rows.filter(BUCKETS[1].match).reduce((sum, row) => sum + Number(row.total_value), 0)

    const columns: Column<PurchaseOrder>[] = [
      { key: 'order_number', label: 'Pedido', sortable: true, render: (row) => h('b', row.order_number) },
      { key: 'supplier', label: 'Fornecedor', sortable: true, value: (row) => supplierName(row.supplier_id), render: (row) => supplierName(row.supplier_id) },
      {
        key: 'status',
        label: 'Situação',
        value: (row) => PURCHASE_LABEL[row.status],
        render: (row) =>
          h(
            'select.page-size',
            {
              onChange: (event: Event) => {
                const value = (event.target as HTMLSelectElement).value as PurchaseStatus
                void guard(async () => {
                  await setPurchaseStatus(row.id, value)
                  await draw()
                }, 'Situação atualizada.')
              },
            },
            FLOW.map((status) => h('option', { value: status, selected: status === row.status }, PURCHASE_LABEL[status])),
          ),
      },
      {
        key: 'badge',
        label: 'Etapa',
        value: (row) => PURCHASE_LABEL[row.status],
        render: (row) => badge(PURCHASE_LABEL[row.status], PURCHASE_TONE[row.status]),
      },
      {
        key: 'total_value',
        label: 'Valor',
        align: 'right',
        sortable: true,
        value: (row) => Number(row.total_value),
        render: (row) => money(row.total_value),
      },
      { key: 'expected_at', label: 'Previsão', sortable: true, render: (row) => (row.expected_at ? date(row.expected_at) : '—') },
      { key: 'created_at', label: 'Aberto em', sortable: true, render: (row) => date(row.created_at) },
    ]

    mount(
      host,
      pageHead({ title: 'Gestão de Compras', crumbs: [{ label: 'Produção e Estoque' }, { label: 'Gestão de Compras' }] }),
      h(
        'div.stack',
        gridCols(
          4,
          ...BUCKETS.map((entry) =>
            statFilter({
              label: entry.label,
              value: String(rows.filter(entry.match).length),
              hint: entry.id === 'aberto' ? money(openValue) : undefined,
              mark: entry.mark,
              tone: entry.tone,
              active: bucket === entry.id,
              onClick: () => setQuery({ filtro: entry.id === 'todos' ? null : entry.id }),
            }),
          ),
        ),
        card(
          { flush: true },
          dataTable({
            columns,
            rows: visible,
            searchable: true,
            searchPlaceholder: 'Buscar pedido ou fornecedor',
            pageSize: 10,
            initialSort: { key: 'created_at', ascending: false },
            emptyTitle: 'Nenhum pedido nesta situação',
            emptyHint: 'Pedidos de compra abertos a partir das requisições aparecem aqui.',
            totalLabel: (total) => `${total} pedido(s)`,
          }),
        ),
      ),
    )
  }

  await draw()
}
