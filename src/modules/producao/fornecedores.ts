/** Produção › Fornecedores — cadastro, prazo de entrega e avaliação. */
import { h, mount } from '../../ui/dom'
import { card } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { dataTable, type Column } from '../../ui/components/table'
import { badge } from '../../ui/components/badge'
import { openModal } from '../../ui/components/modal'
import { formRow, textField } from '../../ui/components/form'
import { guard, toast } from '../../ui/components/feedback'
import { decimal, orDash, parseMoney, phone as fmtPhone, taxId as fmtTaxId } from '../../core/format'
import { createSupplier, purchaseOrders, saveSupplier, suppliers, type SupplierInput } from '../../data/inventory'
import type { Supplier } from '../../core/types'

function supplierForm(initial: Supplier | null, onSaved: () => Promise<void>): void {
  let draft: SupplierInput = {
    name: initial?.name ?? '',
    tax_id: initial?.tax_id ?? null,
    email: initial?.email ?? null,
    phone: initial?.phone ?? null,
    lead_time_days: initial?.lead_time_days ?? null,
    rating: initial?.rating ?? null,
  }
  const patch = (part: Partial<SupplierInput>) => {
    draft = { ...draft, ...part }
  }
  const clean = (value: string) => (value.trim() ? value.trim() : null)

  const handle = openModal({
    title: initial ? 'Editar fornecedor' : 'Novo fornecedor',
    width: '600px',
    body: h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      formRow(
        '2fr 1fr',
        textField({ label: 'Nome', required: true, value: draft.name, onInput: (value) => patch({ name: value }) }),
        textField({ label: 'CNPJ', value: draft.tax_id ?? '', onInput: (value) => patch({ tax_id: clean(value) }) }),
      ),
      formRow(
        '1fr 1fr',
        textField({ label: 'E-mail', type: 'email', value: draft.email ?? '', onInput: (value) => patch({ email: clean(value) }) }),
        textField({ label: 'Telefone', value: draft.phone ?? '', onInput: (value) => patch({ phone: clean(value) }) }),
      ),
      formRow(
        '1fr 1fr',
        textField({
          label: 'Prazo de entrega (dias)',
          value: draft.lead_time_days ? String(draft.lead_time_days) : '',
          onInput: (value) => patch({ lead_time_days: value.trim() ? Math.round(parseMoney(value)) : null }),
        }),
        textField({
          label: 'Avaliação (0 a 5)',
          value: draft.rating ? String(draft.rating) : '',
          onInput: (value) => patch({ rating: value.trim() ? Math.min(5, Math.max(0, parseMoney(value))) : null }),
        }),
      ),
    ),
    footer: [
      h('button.btn.btn-ghost', { onClick: () => handle.close() }, 'Cancelar'),
      h(
        'button.btn.btn-primary',
        {
          onClick: async () => {
            if (!draft.name.trim()) {
              toast('Informe o nome do fornecedor.', 'error')
              return
            }
            const ok = await guard(async () => {
              if (initial) await saveSupplier(initial.id, draft)
              else await createSupplier(draft)
              await onSaved()
            }, initial ? 'Fornecedor atualizado.' : 'Fornecedor cadastrado.')
            if (ok) handle.close()
          },
        },
        'Salvar fornecedor',
      ),
    ],
  })
}

export async function render(host: HTMLElement): Promise<void> {
  async function draw(): Promise<void> {
    const [rows, orders] = await Promise.all([suppliers(), purchaseOrders()])
    const ordersOf = (id: string) => orders.filter((order) => order.supplier_id === id)

    const columns: Column<Supplier>[] = [
      { key: 'name', label: 'Fornecedor', sortable: true, render: (row) => h('b', row.name) },
      { key: 'tax_id', label: 'CNPJ', value: (row) => row.tax_id ?? '', render: (row) => (row.tax_id ? fmtTaxId(row.tax_id) : '—') },
      {
        key: 'contact',
        label: 'Contato',
        value: (row) => `${row.email ?? ''} ${row.phone ?? ''}`,
        render: (row) =>
          h('div', h('div', orDash(row.email)), row.phone ? h('div.faint', { style: { fontSize: '11.5px' } }, fmtPhone(row.phone)) : null),
      },
      {
        key: 'lead_time_days',
        label: 'Prazo de entrega',
        align: 'right',
        sortable: true,
        value: (row) => row.lead_time_days ?? 0,
        render: (row) => (row.lead_time_days ? row.lead_time_days + ' dias' : '—'),
      },
      {
        key: 'rating',
        label: 'Avaliação',
        align: 'right',
        sortable: true,
        value: (row) => Number(row.rating ?? 0),
        render: (row) => (row.rating ? badge(decimal(row.rating) + ' / 5', Number(row.rating) >= 4 ? 'green' : Number(row.rating) >= 3 ? 'amber' : 'red') : h('span.faint', '—')),
      },
      {
        key: 'orders',
        label: 'Pedidos',
        align: 'right',
        value: (row) => ordersOf(row.id).length,
        render: (row) => String(ordersOf(row.id).length),
      },
      {
        key: 'actions',
        label: 'Ações',
        align: 'right',
        width: '100px',
        render: (row) =>
          h('button.btn.btn-ghost', { style: { fontSize: '12px', padding: '4px 10px' }, onClick: () => supplierForm(row, draw) }, 'Editar'),
      },
    ]

    mount(
      host,
      pageHead({
        title: 'Fornecedores',
        crumbs: [{ label: 'Produção e Estoque' }, { label: 'Fornecedores' }],
        actions: [h('button.btn.btn-primary', { onClick: () => supplierForm(null, draw) }, '+ Novo fornecedor')],
      }),
      card(
        { flush: true },
        dataTable({
          columns,
          rows,
          searchable: true,
          searchPlaceholder: 'Buscar fornecedor',
          pageSize: 10,
          initialSort: { key: 'name', ascending: true },
          emptyTitle: 'Nenhum fornecedor cadastrado',
          emptyHint: 'Cadastre fornecedores para abrir pedidos de compra.',
          totalLabel: (total) => `${total} fornecedor(es)`,
        }),
      ),
    )
  }

  await draw()
}
