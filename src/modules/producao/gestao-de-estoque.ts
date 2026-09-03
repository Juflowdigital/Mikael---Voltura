/** Produção › Gestão de Estoque — saldo, mínimo e movimentações. */
import { h, mount } from '../../ui/dom'
import { card, gridCols } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { kpiCard, KPI_ICONS } from '../../ui/components/kpi'
import { dataTable, type Column } from '../../ui/components/table'
import { badge } from '../../ui/components/badge'
import { openModal } from '../../ui/components/modal'
import { formRow, selectField, textField } from '../../ui/components/form'
import { guard, toast } from '../../ui/components/feedback'
import { dateTime, decimal, money, orDash, parseMoney } from '../../core/format'
import { setQuery, type RouteContext } from '../../core/router'
import { createItem, isBelowMinimum, items, moveStock, movements, saveItem, type ItemInput } from '../../data/inventory'
import type { InventoryItem, MovementType } from '../../core/types'

const MOVEMENT_LABEL: Record<MovementType, string> = {
  in: 'Entrada',
  out: 'Saída',
  reserve: 'Reserva',
  release: 'Liberação',
  adjustment: 'Ajuste',
  transfer: 'Transferência',
}

function itemForm(initial: InventoryItem | null, onSaved: () => Promise<void>): void {
  let draft: ItemInput = {
    sku: initial?.sku ?? '',
    name: initial?.name ?? '',
    category: initial?.category ?? null,
    unit: initial?.unit ?? 'un',
    quantity: Number(initial?.quantity ?? 0),
    minimum_quantity: Number(initial?.minimum_quantity ?? 0),
    average_cost: Number(initial?.average_cost ?? 0),
    location: initial?.location ?? null,
    active: initial?.active ?? true,
  }
  const patch = (part: Partial<ItemInput>) => {
    draft = { ...draft, ...part }
  }

  const handle = openModal({
    title: initial ? 'Editar item' : 'Novo item de estoque',
    width: '620px',
    body: h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      formRow(
        '1fr 2fr',
        textField({ label: 'SKU', required: true, value: draft.sku, onInput: (value) => patch({ sku: value }) }),
        textField({ label: 'Nome', required: true, value: draft.name, onInput: (value) => patch({ name: value }) }),
      ),
      formRow(
        '1fr 1fr 1fr',
        textField({ label: 'Categoria', value: draft.category ?? '', onInput: (value) => patch({ category: value || null }) }),
        textField({ label: 'Unidade', value: draft.unit, onInput: (value) => patch({ unit: value || 'un' }) }),
        textField({ label: 'Localização', value: draft.location ?? '', onInput: (value) => patch({ location: value || null }) }),
      ),
      formRow(
        '1fr 1fr 1fr',
        textField({
          label: initial ? 'Saldo atual' : 'Saldo inicial',
          value: String(draft.quantity),
          disabled: Boolean(initial),
          onInput: (value) => patch({ quantity: parseMoney(value) }),
        }),
        textField({ label: 'Quantidade mínima', value: String(draft.minimum_quantity), onInput: (value) => patch({ minimum_quantity: parseMoney(value) }) }),
        textField({ label: 'Custo médio (R$)', value: String(draft.average_cost), onInput: (value) => patch({ average_cost: parseMoney(value) }) }),
      ),
      initial ? h('div.faint', { style: { fontSize: '11.5px' } }, 'O saldo só muda por movimentação, para preservar o histórico.') : null,
    ),
    footer: [
      h('button.btn.btn-ghost', { onClick: () => handle.close() }, 'Cancelar'),
      h(
        'button.btn.btn-primary',
        {
          onClick: async () => {
            if (!draft.sku.trim() || !draft.name.trim()) {
              toast('Informe SKU e nome do item.', 'error')
              return
            }
            const ok = await guard(async () => {
              if (initial) {
                const { quantity, ...rest } = draft
                void quantity
                await saveItem(initial.id, rest)
              } else {
                await createItem(draft)
              }
              await onSaved()
            }, initial ? 'Item atualizado.' : 'Item cadastrado.')
            if (ok) handle.close()
          },
        },
        'Salvar item',
      ),
    ],
  })
}

function movementForm(item: InventoryItem, onSaved: () => Promise<void>): void {
  let type: MovementType = 'in'
  let quantity = 0
  let notes = ''

  const handle = openModal({
    title: 'Movimentar estoque',
    subtitle: `${item.name} · saldo atual ${decimal(item.quantity)} ${item.unit}`,
    width: '520px',
    body: h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      formRow(
        '1fr 1fr',
        selectField({
          label: 'Tipo de movimentação',
          value: 'in',
          options: (Object.keys(MOVEMENT_LABEL) as MovementType[]).map((key) => ({ value: key, label: MOVEMENT_LABEL[key] })),
          onChange: (value) => (type = value as MovementType),
        }),
        textField({ label: 'Quantidade', required: true, onInput: (value) => (quantity = parseMoney(value)) }),
      ),
      textField({ label: 'Observação', onInput: (value) => (notes = value) }),
    ),
    footer: [
      h('button.btn.btn-ghost', { onClick: () => handle.close() }, 'Cancelar'),
      h(
        'button.btn.btn-primary',
        {
          onClick: async () => {
            if (quantity <= 0) {
              toast('Informe uma quantidade maior que zero.', 'error')
              return
            }
            if ((type === 'out' || type === 'reserve') && quantity > Number(item.quantity)) {
              toast('Saldo insuficiente para esta saída.', 'error')
              return
            }
            const ok = await guard(async () => {
              await moveStock(item, type, quantity, notes.trim() || null)
              await onSaved()
            }, 'Movimentação registrada.')
            if (ok) handle.close()
          },
        },
        'Registrar movimentação',
      ),
    ],
  })
}

export async function render(host: HTMLElement, ctx: RouteContext): Promise<void> {
  async function draw(): Promise<void> {
    const [rows, moves] = await Promise.all([items(), movements()])
    const view = ctx.query.get('visao') ?? 'saldo'
    const itemName = (id: string) => rows.find((item) => item.id === id)?.name ?? '—'

    const belowMinimum = rows.filter(isBelowMinimum)
    const totalValue = rows.reduce((sum, item) => sum + Number(item.quantity) * Number(item.average_cost), 0)

    const itemColumns: Column<InventoryItem>[] = [
      {
        key: 'name',
        label: 'Item',
        sortable: true,
        render: (row) => h('div', h('b', row.name), h('div.faint', { style: { fontSize: '11.5px' } }, row.sku)),
      },
      { key: 'category', label: 'Categoria', sortable: true, render: (row) => orDash(row.category) },
      { key: 'location', label: 'Local', render: (row) => orDash(row.location) },
      {
        key: 'quantity',
        label: 'Saldo',
        align: 'right',
        sortable: true,
        value: (row) => Number(row.quantity),
        render: (row) =>
          h(
            'b',
            { style: { color: isBelowMinimum(row) ? 'var(--red)' : 'var(--text)' } },
            decimal(row.quantity) + ' ' + row.unit,
          ),
      },
      { key: 'minimum_quantity', label: 'Mínimo', align: 'right', value: (row) => Number(row.minimum_quantity), render: (row) => decimal(row.minimum_quantity) },
      { key: 'average_cost', label: 'Custo médio', align: 'right', value: (row) => Number(row.average_cost), render: (row) => money(row.average_cost) },
      {
        key: 'total',
        label: 'Valor em estoque',
        align: 'right',
        sortable: true,
        value: (row) => Number(row.quantity) * Number(row.average_cost),
        render: (row) => money(Number(row.quantity) * Number(row.average_cost)),
      },
      {
        key: 'status',
        label: 'Situação',
        value: (row) => (isBelowMinimum(row) ? 'Abaixo do mínimo' : 'Normal'),
        render: (row) => (isBelowMinimum(row) ? badge('Abaixo do mínimo', 'red') : badge('Normal', 'green')),
      },
      {
        key: 'actions',
        label: 'Ações',
        align: 'right',
        width: '170px',
        render: (row) =>
          h(
            'div.row',
            { style: { justifyContent: 'flex-end', gap: '6px' } },
            h('button.btn.btn-ghost', { style: { fontSize: '12px', padding: '4px 10px' }, onClick: () => movementForm(row, draw) }, 'Movimentar'),
            h('button.btn.btn-ghost', { style: { fontSize: '12px', padding: '4px 10px' }, onClick: () => itemForm(row, draw) }, 'Editar'),
          ),
      },
    ]

    const moveColumns: Column<(typeof moves)[number]>[] = [
      { key: 'occurred_at', label: 'Quando', sortable: true, render: (row) => dateTime(row.occurred_at) },
      { key: 'item', label: 'Item', value: (row) => itemName(row.inventory_item_id), render: (row) => h('b', itemName(row.inventory_item_id)) },
      {
        key: 'movement_type',
        label: 'Tipo',
        value: (row) => MOVEMENT_LABEL[row.movement_type],
        render: (row) => badge(MOVEMENT_LABEL[row.movement_type], Number(row.quantity) >= 0 ? 'green' : 'amber'),
      },
      {
        key: 'quantity',
        label: 'Quantidade',
        align: 'right',
        value: (row) => Number(row.quantity),
        render: (row) =>
          h('b', { style: { color: Number(row.quantity) >= 0 ? 'var(--green)' : 'var(--accent)' } }, decimal(row.quantity)),
      },
      { key: 'notes', label: 'Observação', render: (row) => orDash(row.notes) },
    ]

    mount(
      host,
      pageHead({
        title: 'Gestão de Estoque',
        crumbs: [{ label: 'Produção e Estoque' }, { label: 'Gestão de Estoque' }],
        actions: [
          h('button.btn', { onClick: () => setQuery({ visao: view === 'movimentacoes' ? null : 'movimentacoes' }) }, view === 'movimentacoes' ? 'Ver saldos' : 'Ver movimentações'),
          h('button.btn.btn-primary', { onClick: () => itemForm(null, draw) }, '+ Novo item'),
        ],
      }),
      h(
        'div.stack',
        gridCols(
          3,
          kpiCard({ label: 'Itens cadastrados', value: String(rows.length), mark: KPI_ICONS.box, color: '#38bdf8', soft: 'rgba(56,189,248,.14)' }),
          kpiCard({ label: 'Abaixo do mínimo', value: String(belowMinimum.length), mark: KPI_ICONS.alert, color: '#ef4444', soft: 'rgba(239,68,68,.14)' }),
          kpiCard({ label: 'Valor em estoque', value: money(totalValue), mark: KPI_ICONS.money, color: '#22c55e', soft: 'rgba(34,197,94,.14)' }),
        ),
        card(
          { flush: true },
          view === 'movimentacoes'
            ? dataTable({
                columns: moveColumns,
                rows: moves,
                searchable: true,
                searchPlaceholder: 'Buscar movimentação',
                pageSize: 10,
                initialSort: { key: 'occurred_at', ascending: false },
                emptyTitle: 'Nenhuma movimentação registrada',
                totalLabel: (total) => `${total} movimentação(ões)`,
              })
            : dataTable({
                columns: itemColumns,
                rows,
                searchable: true,
                searchPlaceholder: 'Buscar item de estoque',
                pageSize: 10,
                initialSort: { key: 'name', ascending: true },
                emptyTitle: 'Nenhum item cadastrado',
                emptyHint: 'Cadastre itens para controlar saldo, mínimo e custo médio.',
                totalLabel: (total) => `${total} item(ns)`,
              }),
        ),
      ),
    )
  }

  await draw()
}
