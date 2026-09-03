/** Produção › Requisições de Material — pedidos internos de material. */
import { h, mount } from '../../ui/dom'
import { card } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { tabs } from '../../ui/components/tabs'
import { dataTable, type Column } from '../../ui/components/table'
import { badge } from '../../ui/components/badge'
import { openModal } from '../../ui/components/modal'
import { selectField, textField } from '../../ui/components/form'
import { guard, toast } from '../../ui/components/feedback'
import { date, decimal, orDash } from '../../core/format'
import { setQuery, type RouteContext } from '../../core/router'
import { app } from '../../core/session'
import { items, nextCode } from '../../data/inventory'
import {
  createRequisition,
  REQUISITION_LABEL,
  REQUISITION_TONE,
  requisitionItems,
  requisitions,
  setRequisitionStatus,
  type RequisitionLine,
} from '../../data/production'
import type { InventoryItem, MaterialRequisition, RequisitionStatus } from '../../core/types'

const STATUSES: RequisitionStatus[] = ['open', 'approved', 'separated', 'delivered', 'cancelled']

function requisitionForm(stock: InventoryItem[], existing: string[], onSaved: () => Promise<void>): void {
  let notes = ''
  let lines: (RequisitionLine & { key: number })[] = []
  let nextKey = 1
  const body = h('div')

  function draw(): void {
    let itemId = stock[0]?.id ?? ''
    let quantity = 1

    mount(
      body,
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
        textField({ label: 'Observação', value: notes, onInput: (value) => (notes = value) }),
        h(
          'div',
          { style: { display: 'grid', gridTemplateColumns: '2fr 120px auto', gap: '10px', alignItems: 'end' } },
          selectField({
            label: 'Item',
            value: itemId,
            options: stock.map((item) => ({ value: item.id, label: `${item.name} (saldo ${decimal(item.quantity)} ${item.unit})` })),
            onChange: (value) => (itemId = value),
          }),
          textField({ label: 'Quantidade', value: '1', onInput: (value) => (quantity = Number(value.replace(',', '.')) || 0) }),
          h(
            'button.btn.btn-primary',
            {
              onClick: () => {
                if (!itemId || quantity <= 0) {
                  toast('Escolha o item e uma quantidade maior que zero.', 'error')
                  return
                }
                lines = [...lines, { key: nextKey++, inventory_item_id: itemId, quantity }]
                draw()
              },
            },
            'Adicionar',
          ),
        ),
        lines.length
          ? h(
              'div.table-wrap',
              h(
                'table.data',
                h('thead', h('tr', h('th', 'Item'), h('th.col-right', 'Quantidade'), h('th.col-right', 'Ações'))),
                h(
                  'tbody',
                  lines.map((line) =>
                    h(
                      'tr',
                      h('td', stock.find((item) => item.id === line.inventory_item_id)?.name ?? '—'),
                      h('td.col-right', decimal(line.quantity)),
                      h(
                        'td.col-right',
                        h(
                          'span',
                          {
                            style: { cursor: 'pointer', color: 'var(--red)' },
                            onClick: () => {
                              lines = lines.filter((entry) => entry.key !== line.key)
                              draw()
                            },
                          },
                          '✕',
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            )
          : h('div.faint', { style: { fontSize: '12.5px' } }, 'Nenhum item adicionado ainda.'),
      ),
    )
  }

  const handle = openModal({
    title: 'Nova requisição de material',
    subtitle: 'Solicite os itens necessários para a obra ou produção.',
    width: '680px',
    body,
    footer: [
      h('button.btn.btn-ghost', { onClick: () => handle.close() }, 'Cancelar'),
      h(
        'button.btn.btn-primary',
        {
          onClick: async () => {
            if (!lines.length) {
              toast('Adicione ao menos um item à requisição.', 'error')
              return
            }
            const ok = await guard(async () => {
              await createRequisition(
                {
                  number: nextCode('RM', existing),
                  work_id: null,
                  production_order_id: null,
                  requested_by: app.get().user?.id ?? null,
                  status: 'open',
                  notes: notes.trim() || null,
                },
                lines.map(({ key, ...rest }) => {
                  void key
                  return rest
                }),
              )
              await onSaved()
            }, 'Requisição criada.')
            if (ok) handle.close()
          },
        },
        'Criar requisição',
      ),
    ],
  })

  draw()
}

export async function render(host: HTMLElement, ctx: RouteContext): Promise<void> {
  async function draw(): Promise<void> {
    const [rows, lines, stock] = await Promise.all([requisitions(), requisitionItems(), items()])
    const activeTab = ctx.query.get('aba') ?? 'todas'
    const linesOf = (id: string) => lines.filter((line) => line.requisition_id === id)

    const visible = activeTab === 'todas' ? rows : rows.filter((row) => row.status === activeTab)

    const columns: Column<MaterialRequisition>[] = [
      { key: 'number', label: 'Nº', sortable: true, render: (row) => h('b', row.number) },
      {
        key: 'items',
        label: 'Itens',
        value: (row) => linesOf(row.id).length,
        render: (row) => {
          const own = linesOf(row.id)
          return h(
            'div',
            h('div', own.length + ' item(ns)'),
            h(
              'div.faint',
              { style: { fontSize: '11.5px' } },
              own
                .slice(0, 2)
                .map((line) => `${decimal(line.quantity)}× ${stock.find((item) => item.id === line.inventory_item_id)?.name ?? '—'}`)
                .join(' · ') || 'Sem itens',
            ),
          )
        },
      },
      {
        key: 'status',
        label: 'Status',
        value: (row) => REQUISITION_LABEL[row.status],
        render: (row) =>
          h(
            'select.page-size',
            {
              onChange: (event: Event) => {
                const value = (event.target as HTMLSelectElement).value as RequisitionStatus
                void guard(async () => {
                  await setRequisitionStatus(row.id, value)
                  await draw()
                }, 'Status atualizado.')
              },
            },
            STATUSES.map((status) => h('option', { value: status, selected: status === row.status }, REQUISITION_LABEL[status])),
          ),
      },
      {
        key: 'badge',
        label: 'Situação',
        value: (row) => REQUISITION_LABEL[row.status],
        render: (row) => badge(REQUISITION_LABEL[row.status], REQUISITION_TONE[row.status]),
      },
      { key: 'notes', label: 'Observação', render: (row) => orDash(row.notes) },
      { key: 'created_at', label: 'Solicitada em', sortable: true, render: (row) => date(row.created_at) },
    ]

    mount(
      host,
      pageHead({
        title: 'Requisições de Material',
        crumbs: [{ label: 'Produção e Estoque' }, { label: 'Requisições de Material' }],
        actions: [
          h(
            'button.btn.btn-primary',
            {
              onClick: () => {
                if (!stock.length) {
                  toast('Cadastre itens de estoque antes de abrir uma requisição.', 'error')
                  return
                }
                requisitionForm(stock, rows.map((row) => row.number), draw)
              },
            },
            '+ Nova requisição',
          ),
        ],
      }),
      card(
        { flush: true },
        h(
          'div',
          { style: { padding: '0 16px' } },
          tabs({
            tabs: [
              { id: 'todas', label: 'Todas', count: rows.length },
              ...STATUSES.map((status) => ({
                id: status,
                label: REQUISITION_LABEL[status],
                count: rows.filter((row) => row.status === status).length,
              })),
            ],
            active: activeTab,
            onChange: (id) => setQuery({ aba: id === 'todas' ? null : id }),
          }),
        ),
        dataTable({
          columns,
          rows: visible,
          searchable: true,
          searchPlaceholder: 'Buscar requisição',
          pageSize: 10,
          initialSort: { key: 'created_at', ascending: false },
          emptyTitle: 'Nenhuma requisição nesta situação',
          emptyHint: 'Abra uma requisição para separar material de obra ou produção.',
          totalLabel: (total) => `${total} requisição(ões)`,
        }),
      ),
    )
  }

  await draw()
}
