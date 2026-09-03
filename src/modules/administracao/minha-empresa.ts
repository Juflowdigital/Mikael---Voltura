/** Administração › Minha Empresa — unidades, identidade, fiscal e responsáveis (tela M3). */
import { h, icon, mount } from '../../ui/dom'
import { card } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { tabs } from '../../ui/components/tabs'
import { dataTable, type Column } from '../../ui/components/table'
import { badge } from '../../ui/components/badge'
import { confirmModal, openModal } from '../../ui/components/modal'
import { formRow, selectField, textField } from '../../ui/components/form'
import { banner, guard, toast } from '../../ui/components/feedback'
import { orDash, taxId as fmtTaxId } from '../../core/format'
import { setQuery, type RouteContext } from '../../core/router'
import { app, refreshTenant } from '../../core/session'
import {
  createUnit,
  fiscalPending,
  FISCAL_FIELDS,
  removeUnit,
  saveCompany,
  saveUnit,
  units,
  uploadLogo,
  type UnitInput,
} from '../../data/organization'
import type { BusinessUnit } from '../../core/types'

const ICON_EDIT = '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'
const ICON_TRASH = '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'
const ICON_LOCK = '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'

const UF = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']

function unitForm(initial: BusinessUnit | null, onSaved: () => Promise<void>): void {
  let draft: UnitInput = {
    name: initial?.name ?? '',
    tax_id: initial?.tax_id ?? null,
    address: initial?.address ?? null,
    city: initial?.city ?? null,
    state: initial?.state ?? null,
    utility_company: initial?.utility_company ?? null,
    is_primary: initial?.is_primary ?? false,
  }
  const patch = (part: Partial<UnitInput>) => {
    draft = { ...draft, ...part }
  }
  const clean = (value: string) => (value.trim() ? value.trim() : null)

  const handle = openModal({
    title: initial ? 'Editar Unidade de Negócio' : 'Cadastrar Unidade de Negócio',
    subtitle: 'A prontidão fiscal é calculada a partir destes campos.',
    width: '620px',
    body: h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      textField({ label: 'Nome', required: true, value: draft.name, onInput: (v) => patch({ name: v }) }),
      formRow(
        '1fr 1fr',
        textField({ label: 'CNPJ', value: draft.tax_id ?? '', onInput: (v) => patch({ tax_id: clean(v) }) }),
        textField({ label: 'Concessionária', value: draft.utility_company ?? '', onInput: (v) => patch({ utility_company: clean(v) }) }),
      ),
      textField({ label: 'Endereço', value: draft.address ?? '', onInput: (v) => patch({ address: clean(v) }) }),
      formRow(
        '2fr 1fr',
        textField({ label: 'Cidade', value: draft.city ?? '', onInput: (v) => patch({ city: clean(v) }) }),
        selectField({
          label: 'UF',
          value: draft.state ?? '',
          placeholder: 'Selecione',
          options: UF.map((uf) => ({ value: uf, label: uf })),
          onChange: (v) => patch({ state: v || null }),
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
              toast('Informe o nome da unidade.', 'error')
              return
            }
            const ok = await guard(async () => {
              if (initial) await saveUnit(initial.id, draft)
              else await createUnit(draft)
              await onSaved()
            }, initial ? 'Unidade atualizada.' : 'Unidade cadastrada.')
            if (ok) handle.close()
          },
        },
        'Salvar',
      ),
    ],
  })
}

function unitsTab(rows: BusinessUnit[], reload: () => Promise<void>): HTMLElement {
  const columns: Column<BusinessUnit>[] = [
    {
      key: 'name',
      label: 'Nome',
      sortable: true,
      render: (row) =>
        h('div.row', h('b', { style: { color: 'var(--blue)' } }, row.name), row.is_primary ? badge('Principal', 'amber') : null),
    },
    { key: 'tax_id', label: 'CNPJ', value: (row) => row.tax_id ?? '', render: (row) => (row.tax_id ? fmtTaxId(row.tax_id) : '—') },
    {
      key: 'address',
      label: 'Endereço',
      value: (row) => [row.address, row.city, row.state].filter(Boolean).join(', '),
      render: (row) => orDash([row.address, row.city, row.state].filter(Boolean).join(', ')),
    },
    {
      key: 'fiscal',
      label: 'Prontidão fiscal',
      value: (row) => fiscalPending(row).length,
      render: (row) => {
        const pending = fiscalPending(row)
        return pending.length
          ? badge(pending.length + ' pendência' + (pending.length > 1 ? 's' : ''), 'red')
          : badge('Completa', 'green')
      },
    },
    {
      key: 'actions',
      label: 'Ações',
      align: 'right',
      width: '120px',
      render: (row) =>
        h(
          'div.row',
          { style: { justifyContent: 'flex-end', gap: '8px' } },
          h(
            'span',
            {
              title: 'Editar',
              style: { cursor: 'pointer', color: 'var(--text-muted)' },
              onClick: () => unitForm(row, reload),
            },
            icon(ICON_EDIT, 15),
          ),
          h(
            'span',
            {
              title: row.is_primary ? 'Unidade principal' : 'Definir como principal',
              style: { cursor: 'pointer', color: row.is_primary ? 'var(--accent)' : 'var(--text-faint)' },
              onClick: () => {
                if (row.is_primary) {
                  toast('Esta já é a unidade principal.')
                  return
                }
                void guard(async () => {
                  const current = rows.find((unit) => unit.is_primary)
                  if (current) {
                    await saveUnit(current.id, {
                      name: current.name,
                      tax_id: current.tax_id,
                      address: current.address,
                      city: current.city,
                      state: current.state,
                      utility_company: current.utility_company,
                      is_primary: false,
                    })
                  }
                  await saveUnit(row.id, {
                    name: row.name,
                    tax_id: row.tax_id,
                    address: row.address,
                    city: row.city,
                    state: row.state,
                    utility_company: row.utility_company,
                    is_primary: true,
                  })
                  await reload()
                }, 'Unidade principal atualizada.')
              },
            },
            icon(ICON_LOCK, 15),
          ),
          h(
            'span',
            {
              title: 'Excluir',
              style: { cursor: 'pointer', color: 'var(--red)' },
              onClick: () =>
                confirmModal('Excluir unidade', `Excluir "${row.name}"? Contratos e propostas emitidos por ela continuam no histórico.`, () => {
                  void guard(async () => {
                    await removeUnit(row.id)
                    await reload()
                  }, 'Unidade excluída.')
                }),
            },
            icon(ICON_TRASH, 15),
          ),
        ),
    },
  ]

  return card(
    {
      title: 'Unidades de Negócio',
      tools: [h('button.btn.btn-primary', { onClick: () => unitForm(null, reload) }, 'Cadastrar Unidade de Negócio')],
      flush: true,
    },
    dataTable({
      columns,
      rows,
      searchable: true,
      searchPlaceholder: 'Pesquisar Unidade de Negócio…',
      pageSize: 5,
      emptyTitle: 'Nenhuma unidade cadastrada',
      totalLabel: (total) => `${total} unidade(s)`,
    }),
  )
}

function identityTab(reload: () => Promise<void>): HTMLElement {
  const state = app.get()
  const org = state.organization
  let draft = {
    name: org?.name ?? '',
    legal_name: org?.legal_name ?? null,
    tax_id: org?.tax_id ?? null,
    city: org?.city ?? null,
    state: org?.state ?? null,
    utility_company: org?.utility_company ?? null,
    address: org?.address ?? null,
  }
  const patch = (part: Partial<typeof draft>) => {
    draft = { ...draft, ...part }
  }
  const clean = (value: string) => (value.trim() ? value.trim() : null)

  const fileInput = h('input', {
    type: 'file',
    accept: 'image/png,image/jpeg,image/svg+xml',
    style: { display: 'none' },
  }) as HTMLInputElement

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0]
    if (!file) return
    void guard(async () => {
      await uploadLogo(file)
      await refreshTenant()
      await reload()
    }, 'Logo atualizado.')
  })

  return card(
    { title: 'Identidade Visual', subtitle: 'Aparece nas propostas, contratos e documentos gerados.' },
    h(
      'div.row',
      { style: { gap: '18px', marginBottom: '20px' } },
      h(
        'div',
        {
          style: {
            width: '110px',
            height: '76px',
            borderRadius: 'var(--radius)',
            border: '1px dashed var(--border-strong)',
            display: 'grid',
            placeItems: 'center',
            overflow: 'hidden',
            background: 'var(--surface-2)',
          },
        },
        state.logoUrl
          ? h('img', { src: state.logoUrl, alt: 'Logo da empresa', style: { maxWidth: '100%', maxHeight: '100%' } })
          : h('span.faint', { style: { fontSize: '11.5px' } }, 'Sem logo'),
      ),
      h(
        'div',
        h('button.btn', { onClick: () => fileInput.click() }, 'Enviar logo'),
        h('div.faint', { style: { fontSize: '11.5px', marginTop: '7px' } }, 'PNG, JPG ou SVG. Recomendado 400×140 px.'),
        fileInput,
      ),
    ),
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      formRow(
        '1fr 1fr',
        textField({ label: 'Nome fantasia', required: true, value: draft.name, onInput: (v) => patch({ name: v }) }),
        textField({ label: 'Razão social', value: draft.legal_name ?? '', onInput: (v) => patch({ legal_name: clean(v) }) }),
      ),
      formRow(
        '1fr 1fr',
        textField({ label: 'CNPJ', value: draft.tax_id ?? '', onInput: (v) => patch({ tax_id: clean(v) }) }),
        textField({ label: 'Concessionária padrão', value: draft.utility_company ?? '', onInput: (v) => patch({ utility_company: clean(v) }) }),
      ),
      textField({ label: 'Endereço', value: draft.address ?? '', onInput: (v) => patch({ address: clean(v) }) }),
      formRow(
        '2fr 1fr',
        textField({ label: 'Cidade', value: draft.city ?? '', onInput: (v) => patch({ city: clean(v) }) }),
        selectField({
          label: 'UF',
          value: draft.state ?? '',
          placeholder: 'Selecione',
          options: UF.map((uf) => ({ value: uf, label: uf })),
          onChange: (v) => patch({ state: v || null }),
        }),
      ),
      h(
        'div.row',
        { style: { justifyContent: 'flex-end' } },
        h(
          'button.btn.btn-primary',
          {
            onClick: () => {
              if (!draft.name.trim()) {
                toast('Informe o nome da empresa.', 'error')
                return
              }
              void guard(async () => {
                await saveCompany(draft)
                await refreshTenant()
                await reload()
              }, 'Dados da empresa salvos.')
            },
          },
          'Salvar empresa',
        ),
      ),
    ),
  )
}

function fiscalTab(rows: BusinessUnit[]): HTMLElement {
  return card(
    { title: 'Configurações Fiscais', subtitle: 'Cada unidade precisa destes campos para emitir documentos.' },
    rows.length
      ? h(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
          rows.map((unit) => {
            const pending = fiscalPending(unit)
            return h(
              'div',
              { style: { border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px' } },
              h(
                'div.row',
                h('b', { style: { flex: '1' } }, unit.name),
                pending.length ? badge(pending.length + ' pendência(s)', 'red') : badge('Completa', 'green'),
              ),
              h(
                'div.row',
                { style: { gap: '8px', flexWrap: 'wrap', marginTop: '10px' } },
                FISCAL_FIELDS.map((field) =>
                  badge(field.label, String(unit[field.key] ?? '').trim() ? 'green' : 'gray'),
                ),
              ),
            )
          }),
        )
      : banner('info', 'Cadastre uma unidade de negócio para configurar a emissão fiscal.'),
  )
}

function legalTab(rows: BusinessUnit[]): HTMLElement {
  const responsible = (app.get().settings?.integrations as Record<string, unknown> | undefined)?.legal_representatives
  const list = Array.isArray(responsible) ? (responsible as Record<string, string>[]) : []

  return card(
    { title: 'Responsáveis Legais', subtitle: 'Assinam contratos e respondem pela unidade perante a concessionária.', flush: true },
    list.length
      ? h(
          'div.table-wrap',
          h(
            'table.data',
            h('thead', h('tr', h('th', 'Nome'), h('th', 'CPF'), h('th', 'Cargo'), h('th', 'Unidade'))),
            h(
              'tbody',
              list.map((person) =>
                h(
                  'tr',
                  h('td', h('b', person.name ?? '—')),
                  h('td', person.tax_id ? fmtTaxId(person.tax_id) : '—'),
                  h('td', orDash(person.role)),
                  h('td.muted', orDash(person.unit, rows.find((unit) => unit.is_primary)?.name ?? '—')),
                ),
              ),
            ),
          ),
        )
      : h(
          'div',
          { style: { padding: '18px' } },
          banner(
            'info',
            'Nenhum responsável legal cadastrado. Enquanto isso, os contratos usam os dados da empresa em Identidade Visual.',
          ),
        ),
  )
}

const TABS = [
  { id: 'unidades', label: 'Unidades de Negócio' },
  { id: 'identidade', label: 'Identidade Visual' },
  { id: 'fiscal', label: 'Configurações Fiscais' },
  { id: 'responsaveis', label: 'Responsáveis Legais' },
]

export async function render(host: HTMLElement, ctx: RouteContext): Promise<void> {
  async function draw(): Promise<void> {
    const rows = await units()
    const activeTab = ctx.query.get('aba') ?? 'unidades'

    const content =
      activeTab === 'identidade'
        ? identityTab(draw)
        : activeTab === 'fiscal'
          ? fiscalTab(rows)
          : activeTab === 'responsaveis'
            ? legalTab(rows)
            : unitsTab(rows, draw)

    mount(
      host,
      pageHead({
        title: 'Minha Empresa',
        crumbs: [{ label: 'Administração', path: '/administracao/visao-geral' }, { label: 'Minha Empresa' }],
      }),
      h(
        'div',
        { style: { marginBottom: '18px' } },
        tabs({
          tabs: TABS.map((tab) => ({
            id: tab.id,
            label: tab.label,
            count: tab.id === 'unidades' ? rows.length : undefined,
          })),
          active: activeTab,
          onChange: (id) => setQuery({ aba: id === 'unidades' ? null : id }),
        }),
      ),
      content,
    )
  }

  await draw()
}
