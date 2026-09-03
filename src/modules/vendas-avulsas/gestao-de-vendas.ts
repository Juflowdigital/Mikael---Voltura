/** Vendas Avulsas › Gestão de Vendas — venda de produto ou serviço sem contrato. */
import { h, mount } from '../../ui/dom'
import { card, gridCols } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { statFilter, KPI_ICONS } from '../../ui/components/kpi'
import { dataTable, type Column } from '../../ui/components/table'
import { badge } from '../../ui/components/badge'
import { openModal } from '../../ui/components/modal'
import { formRow, selectField, textField } from '../../ui/components/form'
import { guard, toast } from '../../ui/components/feedback'
import { date, isoDay, money, orDash, parseMoney } from '../../core/format'
import { setQuery, type RouteContext } from '../../core/router'
import { app } from '../../core/session'
import {
  createSale,
  nextNumber,
  SALE_FLOW,
  SALE_LABEL,
  SALE_TONE,
  saleItems,
  sales,
  setSaleStatus,
  totalOf,
  type SaleLine,
} from '../../data/sales'
import { findAll as findClients } from '../../data/clients'
import { items as stockItems } from '../../data/inventory'
import { members, nameOf, type Member } from '../../data/team'
import type { Client, DirectSale, DirectSaleStatus, InventoryItem } from '../../core/types'

const METHODS = ['PIX', 'Dinheiro', 'Cartão de crédito', 'Cartão de débito', 'Boleto', 'Transferência']

const BUCKETS: { id: string; label: string; mark: string; tone: string; match: (row: DirectSale) => boolean }[] = [
  { id: 'todas', label: 'Todas', mark: KPI_ICONS.chart, tone: 'var(--accent)', match: () => true },
  { id: 'rascunho', label: 'Rascunho', mark: KPI_ICONS.file, tone: '#8ba0b8', match: (row) => row.status === 'draft' },
  { id: 'confirmadas', label: 'Confirmadas', mark: KPI_ICONS.check, tone: '#38bdf8', match: (row) => row.status === 'confirmed' },
  { id: 'entregues', label: 'Entregues', mark: KPI_ICONS.box, tone: '#22c55e', match: (row) => row.status === 'delivered' },
]

function saleForm(clients: Client[], stock: InventoryItem[], team: Member[], existing: string[], onSaved: () => Promise<void>): void {
  let clientId = ''
  let sellerId = app.get().user?.id ?? ''
  let method = ''
  let notes = ''
  let soldAt = isoDay()
  let lines: (SaleLine & { key: number })[] = []
  let nextKey = 1
  const body = h('div')

  function draw(): void {
    let description = ''
    let quantity = 1
    let unitPrice = 0
    let itemId = ''

    mount(
      body,
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
        formRow(
          '2fr 1fr 1fr',
          selectField({
            label: 'Cliente',
            placeholder: 'Consumidor não identificado',
            options: clients.map((client) => ({ value: client.id, label: client.name })),
            onChange: (value) => (clientId = value),
          }),
          selectField({
            label: 'Vendedor',
            value: sellerId,
            placeholder: 'Sem vendedor',
            options: team.map((member) => ({ value: member.userId, label: member.name })),
            onChange: (value) => (sellerId = value),
          }),
          textField({ label: 'Data da venda', type: 'date', value: soldAt, onInput: (value) => (soldAt = value) }),
        ),
        formRow(
          '1fr 1fr',
          selectField({
            label: 'Forma de pagamento',
            placeholder: 'Selecione',
            options: METHODS.map((entry) => ({ value: entry, label: entry })),
            onChange: (value) => (method = value),
          }),
          textField({ label: 'Observação', onInput: (value) => (notes = value) }),
        ),
        h(
          'div',
          { style: { display: 'grid', gridTemplateColumns: '1.4fr 1.4fr 90px 130px auto', gap: '10px', alignItems: 'end' } },
          selectField({
            label: 'Item de estoque',
            placeholder: 'Item livre',
            options: stock.map((item) => ({ value: item.id, label: item.name })),
            onChange: (value) => {
              itemId = value
              const item = stock.find((entry) => entry.id === value)
              if (item) {
                description = item.name
                unitPrice = Number(item.average_cost)
              }
            },
          }),
          textField({ label: 'Descrição', onInput: (value) => (description = value) }),
          textField({ label: 'Qtd.', value: '1', onInput: (value) => (quantity = parseMoney(value)) }),
          textField({ label: 'Valor un. (R$)', onInput: (value) => (unitPrice = parseMoney(value)) }),
          h(
            'button.btn.btn-primary',
            {
              onClick: () => {
                if (!description.trim() || quantity <= 0) {
                  toast('Informe a descrição e uma quantidade maior que zero.', 'error')
                  return
                }
                lines = [...lines, { key: nextKey++, inventory_item_id: itemId || null, description: description.trim(), quantity, unit_price: unitPrice }]
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
                h('thead', h('tr', h('th', 'Item'), h('th.col-right', 'Qtd.'), h('th.col-right', 'Valor un.'), h('th.col-right', 'Total'), h('th.col-right', 'Ações'))),
                h(
                  'tbody',
                  lines.map((line) =>
                    h(
                      'tr',
                      h('td', line.description),
                      h('td.col-right', String(line.quantity)),
                      h('td.col-right', money(line.unit_price)),
                      h('td.col-right', h('b', money(line.quantity * line.unit_price))),
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
        h(
          'div.row',
          { style: { justifyContent: 'flex-end', gap: '10px', fontSize: '15px' } },
          h('span.muted', 'Total da venda'),
          h('b', { style: { color: 'var(--accent)', fontSize: '18px' } }, money(totalOf(lines))),
        ),
      ),
    )
  }

  const handle = openModal({
    title: 'Nova venda avulsa',
    subtitle: 'Produto ou serviço vendido fora de um contrato de sistema solar.',
    width: '780px',
    body,
    footer: [
      h('button.btn.btn-ghost', { onClick: () => handle.close() }, 'Cancelar'),
      h(
        'button.btn.btn-primary',
        {
          onClick: async () => {
            if (!lines.length) {
              toast('Adicione ao menos um item à venda.', 'error')
              return
            }
            const ok = await guard(async () => {
              await createSale(
                {
                  sale_number: nextNumber(existing),
                  client_id: clientId || null,
                  seller_id: sellerId || null,
                  status: 'confirmed',
                  sold_at: soldAt,
                  total_value: totalOf(lines),
                  payment_method: method || null,
                  notes: notes.trim() || null,
                },
                lines.map(({ key, ...rest }) => {
                  void key
                  return rest
                }),
              )
              await onSaved()
            }, 'Venda registrada.')
            if (ok) handle.close()
          },
        },
        'Registrar venda',
      ),
    ],
  })

  draw()
}

export async function render(host: HTMLElement, ctx: RouteContext): Promise<void> {
  async function draw(): Promise<void> {
    const [rows, lines, clients, stock, team] = await Promise.all([
      sales(),
      saleItems(),
      findClients(),
      stockItems(),
      members(),
    ])
    const clientName = (id: string | null) => clients.find((client) => client.id === id)?.name ?? 'Consumidor não identificado'
    const linesOf = (id: string) => lines.filter((line) => line.sale_id === id)

    const bucket = ctx.query.get('filtro') ?? 'todas'
    const active = BUCKETS.find((entry) => entry.id === bucket) ?? BUCKETS[0]
    const visible = rows.filter(active.match)

    const columns: Column<DirectSale>[] = [
      {
        key: 'sale_number',
        label: 'Venda',
        sortable: true,
        render: (row) =>
          h(
            'div',
            h('b', row.sale_number),
            h('div.faint', { style: { fontSize: '11.5px' } }, linesOf(row.id).length + ' item(ns) · ' + orDash(row.payment_method)),
          ),
      },
      { key: 'client', label: 'Cliente', sortable: true, value: (row) => clientName(row.client_id), render: (row) => clientName(row.client_id) },
      { key: 'seller', label: 'Vendedor', value: (row) => nameOf(team, row.seller_id), render: (row) => nameOf(team, row.seller_id) },
      { key: 'sold_at', label: 'Data', sortable: true, render: (row) => date(row.sold_at) },
      {
        key: 'total_value',
        label: 'Valor',
        align: 'right',
        sortable: true,
        value: (row) => Number(row.total_value),
        render: (row) => h('b', money(row.total_value)),
      },
      {
        key: 'status',
        label: 'Situação',
        value: (row) => SALE_LABEL[row.status],
        render: (row) =>
          h(
            'select.page-size',
            {
              onChange: (event: Event) => {
                const value = (event.target as HTMLSelectElement).value as DirectSaleStatus
                void guard(async () => {
                  await setSaleStatus(row.id, value)
                  await draw()
                }, 'Situação atualizada.')
              },
            },
            SALE_FLOW.map((status) => h('option', { value: status, selected: status === row.status }, SALE_LABEL[status])),
          ),
      },
      {
        key: 'badge',
        label: 'Etapa',
        value: (row) => SALE_LABEL[row.status],
        render: (row) => badge(SALE_LABEL[row.status], SALE_TONE[row.status]),
      },
      { key: 'notes', label: 'Observação', render: (row) => orDash(row.notes) },
    ]

    mount(
      host,
      pageHead({
        title: 'Gestão de Vendas',
        crumbs: [{ label: 'Vendas Avulsas' }, { label: 'Gestão de Vendas' }],
        actions: [
          h(
            'button.btn.btn-primary',
            { onClick: () => saleForm(clients, stock, team, rows.map((row) => row.sale_number), draw) },
            '+ Nova venda',
          ),
        ],
      }),
      h(
        'div.stack',
        gridCols(
          4,
          ...BUCKETS.map((entry) => {
            const list = rows.filter(entry.match)
            return statFilter({
              label: entry.label,
              value: String(list.length),
              hint: money(list.reduce((sum, row) => sum + Number(row.total_value), 0)),
              mark: entry.mark,
              tone: entry.tone,
              active: bucket === entry.id,
              onClick: () => setQuery({ filtro: entry.id === 'todas' ? null : entry.id }),
            })
          }),
        ),
        card(
          { flush: true },
          dataTable({
            columns,
            rows: visible,
            searchable: true,
            searchPlaceholder: 'Buscar venda ou cliente',
            pageSize: 10,
            initialSort: { key: 'sold_at', ascending: false },
            emptyTitle: 'Nenhuma venda nesta situação',
            emptyHint: 'Registre vendas de produtos e serviços fora dos contratos.',
            totalLabel: (total) => `${total} venda(s)`,
          }),
        ),
      ),
    )
  }

  await draw()
}
