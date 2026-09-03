/** Comercial › Clientes — lista, cadastro e edicao (tela M7). */
import { h, icon, mount } from '../../ui/dom'
import { card } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { dataTable, type Column } from '../../ui/components/table'
import { confirmModal, openModal } from '../../ui/components/modal'
import { formRow, selectField, textAreaField, textField } from '../../ui/components/form'
import { guard, toast } from '../../ui/components/feedback'
import { date, orDash, parseMoney, phone as fmtPhone, taxId as fmtTaxId } from '../../core/format'
import { cityState, create, destroy, findAll, save, type ClientInput } from '../../data/clients'
import type { Client } from '../../core/types'

const ICON_EDIT = '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'
const ICON_TRASH = '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'

function emptyInput(): ClientInput {
  return {
    name: '',
    person_type: 'individual',
    tax_id: null,
    email: null,
    phone: null,
    city: null,
    state: null,
    birth_date: null,
    utility_company: null,
    monthly_consumption_kwh: null,
    notes: null,
  }
}

function toInput(client: Client): ClientInput {
  return {
    name: client.name,
    person_type: client.person_type,
    tax_id: client.tax_id,
    email: client.email,
    phone: client.phone,
    city: client.city,
    state: client.state,
    birth_date: client.birth_date,
    utility_company: client.utility_company,
    monthly_consumption_kwh: client.monthly_consumption_kwh,
    notes: client.notes,
  }
}

function clientForm(initial: ClientInput, onSubmit: (input: ClientInput) => Promise<void>): void {
  let draft = { ...initial }
  const patch = (part: Partial<ClientInput>) => {
    draft = { ...draft, ...part }
  }
  const clean = (value: string) => (value.trim() ? value.trim() : null)

  const handle = openModal({
    title: initial.name ? 'Editar cliente' : 'Novo cliente',
    subtitle: 'Os dados alimentam propostas, contratos e obras deste cliente.',
    width: '660px',
    body: h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      formRow(
        '2fr 1fr',
        textField({ label: 'Nome', required: true, value: draft.name, onInput: (v) => patch({ name: v }) }),
        selectField({
          label: 'Tipo',
          value: draft.person_type,
          options: [
            { value: 'individual', label: 'Pessoa física' },
            { value: 'company', label: 'Pessoa jurídica' },
          ],
          onChange: (v) => patch({ person_type: v as ClientInput['person_type'] }),
        }),
      ),
      formRow(
        '1fr 1fr',
        textField({ label: 'CPF / CNPJ', value: draft.tax_id ?? '', onInput: (v) => patch({ tax_id: clean(v) }) }),
        textField({ label: 'Data de nascimento', type: 'date', value: draft.birth_date ?? '', onInput: (v) => patch({ birth_date: clean(v) }) }),
      ),
      formRow(
        '1fr 1fr',
        textField({ label: 'E-mail', type: 'email', value: draft.email ?? '', onInput: (v) => patch({ email: clean(v) }) }),
        textField({ label: 'Telefone / WhatsApp', value: draft.phone ?? '', onInput: (v) => patch({ phone: clean(v) }) }),
      ),
      formRow(
        '2fr 1fr',
        textField({ label: 'Cidade', value: draft.city ?? '', onInput: (v) => patch({ city: clean(v) }) }),
        textField({ label: 'UF', value: draft.state ?? '', onInput: (v) => patch({ state: clean(v)?.toUpperCase().slice(0, 2) ?? null }) }),
      ),
      formRow(
        '1fr 1fr',
        textField({ label: 'Concessionária', value: draft.utility_company ?? '', onInput: (v) => patch({ utility_company: clean(v) }) }),
        textField({
          label: 'Consumo mensal (kWh)',
          value: draft.monthly_consumption_kwh ? String(draft.monthly_consumption_kwh) : '',
          onInput: (v) => patch({ monthly_consumption_kwh: v.trim() ? parseMoney(v) : null }),
        }),
      ),
      textAreaField({ label: 'Observações', value: draft.notes ?? '', onInput: (v) => patch({ notes: clean(v) }) }),
    ),
    footer: [
      h('button.btn.btn-ghost', { onClick: () => handle.close() }, 'Cancelar'),
      h(
        'button.btn.btn-primary',
        {
          onClick: async () => {
            if (!draft.name.trim()) {
              toast('Informe o nome do cliente.', 'error')
              return
            }
            const ok = await guard(() => onSubmit(draft))
            if (ok) handle.close()
          },
        },
        'Salvar cliente',
      ),
    ],
  })
}

export async function render(host: HTMLElement): Promise<void> {
  async function draw(): Promise<void> {
    const clients = await findAll()

    const columns: Column<Client>[] = [
      {
        key: 'name',
        label: 'Nome',
        sortable: true,
        render: (row) =>
          h(
            'div',
            h('b', row.name),
            row.tax_id ? h('div.faint', { style: { fontSize: '11.5px', marginTop: '2px' } }, fmtTaxId(row.tax_id)) : null,
          ),
      },
      { key: 'email', label: 'E-mail', sortable: true, render: (row) => orDash(row.email, 'Não informado.') },
      { key: 'phone', label: 'Telefone', value: (row) => row.phone ?? '', render: (row) => fmtPhone(row.phone) },
      { key: 'city', label: 'Cidade/Estado', sortable: true, value: (row) => cityState(row), render: (row) => cityState(row) },
      {
        key: 'birth_date',
        label: 'Data de nascimento',
        sortable: true,
        value: (row) => row.birth_date ?? '',
        render: (row) => (row.birth_date ? date(row.birth_date) : 'Não informado.'),
      },
      {
        key: 'actions',
        label: 'Ações',
        align: 'right',
        width: '110px',
        render: (row) =>
          h(
            'div.row',
            { style: { justifyContent: 'flex-end', gap: '6px' } },
            h(
              'span',
              {
                title: 'Editar',
                style: { cursor: 'pointer', color: 'var(--text-muted)' },
                onClick: (event: MouseEvent) => {
                  event.stopPropagation()
                  clientForm(toInput(row), async (input) => {
                    await save(row.id, input)
                    toast('Cliente atualizado.', 'success')
                    await draw()
                  })
                },
              },
              icon(ICON_EDIT, 15),
            ),
            h(
              'span',
              {
                title: 'Excluir',
                style: { cursor: 'pointer', color: 'var(--red)' },
                onClick: (event: MouseEvent) => {
                  event.stopPropagation()
                  confirmModal(
                    'Excluir cliente',
                    `Excluir "${row.name}"? Propostas, contratos e obras vinculados podem ser afetados.`,
                    () => {
                      void guard(async () => {
                        await destroy(row.id)
                        await draw()
                      }, 'Cliente excluído.')
                    },
                  )
                },
              },
              icon(ICON_TRASH, 15),
            ),
          ),
      },
    ]

    mount(
      host,
      pageHead({
        title: 'Clientes',
        crumbs: [{ label: 'Comercial' }, { label: 'Clientes' }],
        actions: [
          h(
            'button.btn.btn-light',
            {
              onClick: () =>
                clientForm(emptyInput(), async (input) => {
                  await create(input)
                  toast('Cliente cadastrado.', 'success')
                  await draw()
                }),
            },
            '+ Novo Cliente',
          ),
        ],
      }),
      card(
        { flush: true },
        dataTable({
          columns,
          rows: clients,
          searchable: true,
          searchPlaceholder: 'Buscar cliente',
          initialSort: { key: 'name', ascending: true },
          emptyTitle: 'Nenhum cliente cadastrado',
          emptyHint: 'Cadastre o primeiro cliente para iniciar propostas e contratos.',
          totalLabel: (total) => `${total} registro(s)`,
        }),
      ),
    )
  }

  await draw()
}
