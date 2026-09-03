/** Produção › Produtos — lista e cadastro de gerador completo (tela M20). */
import { h, mount } from '../../ui/dom'
import { card } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { tabs } from '../../ui/components/tabs'
import { dataTable, type Column } from '../../ui/components/table'
import { badge } from '../../ui/components/badge'
import { confirmModal, openModal } from '../../ui/components/modal'
import { formRow, formSection, selectField, textField, toggleField } from '../../ui/components/form'
import { guard, toast } from '../../ui/components/feedback'
import { date, decimal, money, parseMoney } from '../../core/format'
import { setQuery, type RouteContext } from '../../core/router'
import {
  allComponents,
  COMPONENT_LABEL,
  createProduct,
  GENERATOR_LABEL,
  kitPowerKwp,
  products,
  removeProduct,
  saveProduct,
  type ComponentInput,
  type ProductInput,
} from '../../data/inventory'
import type { ComponentType, GeneratorType, Product } from '../../core/types'

const GENERATOR_TYPES: GeneratorType[] = ['ongrid', 'hibrido', 'offgrid']

interface Line extends ComponentInput {
  key: number
}

/** Campos exibidos por tipo de componente, espelhando o formulário do ASTER. */
const LINE_FIELDS: Record<ComponentType, { power: string | null; extra: { key: string; label: string }[] }> = {
  painel: {
    power: 'Potência (W)',
    extra: [
      { key: 'warranty_defects_years', label: 'Garantia contra defeitos (anos)' },
      { key: 'warranty_linear_years', label: 'Garantia produção linear (anos)' },
      { key: 'warranty_linear_percent', label: 'Garantia produção linear (%)' },
    ],
  },
  inversor: {
    power: 'Potência (kW)',
    extra: [
      { key: 'inverter_type', label: 'Tipo de inversor' },
      { key: 'ac_connection', label: 'Ligação CA' },
      { key: 'warranty_years', label: 'Garantia (anos)' },
    ],
  },
  estrutura: { power: null, extra: [{ key: 'structure_type', label: 'Tipo de estrutura' }] },
  stringbox: { power: null, extra: [] },
  otimizador: { power: null, extra: [] },
  servico: { power: null, extra: [] },
}

function productForm(onSaved: () => Promise<void>): void {
  let draft: ProductInput = {
    kind: 'gerador',
    generator_type: 'ongrid',
    name: '',
    unit: 'Conjunto',
    category: null,
    active: true,
    total_power_wp: 0,
    kit_price: 0,
    metadata: {},
  }
  let lines: Line[] = []
  let nextKey = 1
  let activeTab = 'caracteristicas'

  const body = h('div')

  function autoName(): string {
    const type = draft.generator_type ? GENERATOR_LABEL[draft.generator_type] : ''
    return `Gerador Fotovoltaico ${type} ${decimal(kitPowerKwp(lines))} kWp`.replace(/\s+/g, ' ').trim()
  }

  function lineEditor(line: Line): HTMLElement {
    const config = LINE_FIELDS[line.component_type]
    const patch = (part: Partial<Line>) => {
      lines = lines.map((entry) => (entry.key === line.key ? { ...entry, ...part } : entry))
      draw()
    }
    const patchAttr = (key: string, value: string) => {
      const attributes = { ...line.attributes, [key]: value }
      lines = lines.map((entry) => (entry.key === line.key ? { ...entry, attributes } : entry))
    }

    return h(
      'div',
      { style: { border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px', background: 'var(--surface-2)' } },
      h(
        'div.row',
        { style: { marginBottom: '12px' } },
        badge(COMPONENT_LABEL[line.component_type], 'blue'),
        h('span.spacer'),
        h(
          'span',
          {
            title: 'Remover componente',
            style: { cursor: 'pointer', color: 'var(--red)' },
            onClick: () => {
              lines = lines.filter((entry) => entry.key !== line.key)
              draw()
            },
          },
          '✕',
        ),
      ),
      formRow(
        config.power ? '1fr 1fr 1fr 90px' : '1fr 1fr 90px',
        ...[
          config.power
            ? textField({
                label: config.power,
                value: line.power ? String(line.power) : '',
                onInput: (value) => patch({ power: parseMoney(value) || null }),
              })
            : null,
          textField({ label: 'Marca', value: line.brand ?? '', onInput: (value) => patch({ brand: value || null }) }),
          textField({ label: 'Modelo', value: line.model ?? '', onInput: (value) => patch({ model: value || null }) }),
          textField({
            label: 'Qtd.',
            value: String(line.quantity),
            onInput: (value) => patch({ quantity: Math.max(1, parseMoney(value) || 1) }),
          }),
        ].filter((node): node is HTMLElement => node !== null),
      ),
      config.extra.length
        ? h(
            'div',
            { style: { marginTop: '12px' } },
            formRow(
              config.extra.map(() => '1fr').join(' '),
              ...config.extra.map((field) =>
                textField({
                  label: field.label,
                  value: String(line.attributes[field.key] ?? ''),
                  onInput: (value) => patchAttr(field.key, value),
                }),
              ),
            ),
          )
        : null,
    )
  }

  function addLine(type: ComponentType): void {
    lines = [...lines, { key: nextKey++, component_type: type, brand: null, model: null, quantity: 1, power: null, attributes: {} }]
    draw()
  }

  function draw(): void {
    const power = kitPowerKwp(lines)
    draft = { ...draft, total_power_wp: power * 1000 }

    const characteristics = h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
      h(
        'div.row',
        {
          style: {
            justifyContent: 'space-between',
            padding: '14px 16px',
            borderRadius: 'var(--radius)',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
          },
        },
        h('span', { style: { fontSize: '13px', fontWeight: '650' } }, 'Potência Total do Gerador Completo'),
        h(
          'span',
          { style: { fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', color: 'var(--accent)' } },
          decimal(power, ' kWp'),
        ),
      ),
      ...(['painel', 'inversor', 'estrutura'] as ComponentType[]).map((type) =>
        h(
          'div',
          formSection(COMPONENT_LABEL[type]),
          h(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
            lines.filter((line) => line.component_type === type).map(lineEditor),
            h(
              'button.btn',
              { style: { alignSelf: 'flex-start' }, onClick: () => addLine(type) },
              '+ Adicionar ' + COMPONENT_LABEL[type],
            ),
          ),
        ),
      ),
    )

    const price = h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      formSection('Preço do Kit Gerador'),
      formRow(
        '1fr 1fr',
        textField({
          label: 'Preço do Kit (R$)',
          value: draft.kit_price ? String(draft.kit_price) : '',
          onInput: (value) => {
            draft = { ...draft, kit_price: parseMoney(value) }
          },
        }),
        h(
          'div.field',
          h('span.field-label', 'Preço por kWp'),
          h('div.input', { style: { color: 'var(--text-muted)' } }, power > 0 ? money(draft.kit_price / power) : '—'),
        ),
      ),
    )

    const warranty = h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      formSection('Garantias do conjunto'),
      formRow(
        '1fr 1fr',
        textField({
          label: 'Garantia de instalação (anos)',
          onInput: (value) => {
            draft = { ...draft, metadata: { ...draft.metadata, installation_warranty_years: parseMoney(value) } }
          },
        }),
        textField({
          label: 'Garantia de mão de obra (dias)',
          onInput: (value) => {
            draft = { ...draft, metadata: { ...draft.metadata, labor_warranty_days: parseMoney(value) } }
          },
        }),
      ),
    )

    mount(
      body,
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
        formRow(
          '1fr 2fr',
          selectField({
            label: 'Tipo de Produto',
            value: draft.kind,
            options: [
              { value: 'gerador', label: 'Gerador Completo' },
              { value: 'componente', label: 'Componente avulso' },
              { value: 'servico', label: 'Serviço' },
            ],
            onChange: (value) => {
              draft = { ...draft, kind: value as ProductInput['kind'] }
              draw()
            },
          }),
          h(
            'div.field',
            h('span.field-label', 'Tipo de gerador'),
            h(
              'div.row',
              { style: { gap: '16px', paddingTop: '6px' } },
              GENERATOR_TYPES.map((type) =>
                h(
                  'label.row',
                  { style: { gap: '6px', cursor: 'pointer', fontSize: '13px' } },
                  h('input', {
                    type: 'radio',
                    name: 'generator-type',
                    checked: draft.generator_type === type,
                    onChange: () => {
                      draft = { ...draft, generator_type: type }
                      draw()
                    },
                  }),
                  GENERATOR_LABEL[type],
                ),
              ),
            ),
          ),
        ),
        formRow(
          '3fr 1fr',
          textField({
            label: 'Nome',
            required: true,
            value: draft.name,
            placeholder: autoName(),
            onInput: (value) => {
              draft = { ...draft, name: value }
            },
          }),
          h(
            'div',
            { style: { alignSelf: 'end', paddingBottom: '9px' } },
            toggleField('Ativo', draft.active, (value) => {
              draft = { ...draft, active: value }
              draw()
            }),
          ),
        ),
        formRow(
          '1fr 1fr',
          textField({ label: 'Unidade', value: draft.unit, onInput: (value) => (draft = { ...draft, unit: value }) }),
          textField({ label: 'Categoria', onInput: (value) => (draft = { ...draft, category: value || null }) }),
        ),
        tabs({
          tabs: [
            { id: 'caracteristicas', label: 'Características' },
            { id: 'preco', label: 'Preço' },
            { id: 'garantia', label: 'Garantia' },
          ],
          active: activeTab,
          onChange: (id) => {
            activeTab = id
            draw()
          },
        }),
        activeTab === 'preco' ? price : activeTab === 'garantia' ? warranty : characteristics,
      ),
    )
  }

  const handle = openModal({
    title: 'Cadastrar Produto',
    subtitle: 'A potência total é calculada a partir dos painéis informados.',
    width: '900px',
    body,
    footer: [
      h('button.btn.btn-ghost', { onClick: () => handle.close() }, 'Cancelar'),
      h(
        'button.btn.btn-primary',
        {
          onClick: async () => {
            const name = draft.name.trim() || autoName()
            if (!name) {
              toast('Informe o nome do produto.', 'error')
              return
            }
            if (draft.kind === 'gerador' && !lines.some((line) => line.component_type === 'painel')) {
              toast('Um gerador completo precisa de ao menos um painel solar.', 'error')
              return
            }
            const ok = await guard(async () => {
              await createProduct(
                { ...draft, name },
                lines.map(({ key, ...rest }) => {
                  void key
                  return rest
                }),
              )
              await onSaved()
            }, 'Produto cadastrado.')
            if (ok) handle.close()
          },
        },
        'Salvar produto',
      ),
    ],
  })

  draw()
}

export async function render(host: HTMLElement, ctx: RouteContext): Promise<void> {
  async function draw(): Promise<void> {
    const [rows, parts] = await Promise.all([products(), allComponents()])
    const filter = ctx.query.get('tipo') ?? 'todos'
    const visible = filter === 'todos' ? rows : rows.filter((product) => product.kind === filter)
    const partsOf = (productId: string) => parts.filter((part) => part.product_id === productId)

    const columns: Column<Product>[] = [
      {
        key: 'name',
        label: 'Produto',
        sortable: true,
        render: (row) =>
          h(
            'div',
            h('b', row.name),
            h(
              'div.faint',
              { style: { fontSize: '11.5px', marginTop: '2px' } },
              partsOf(row.id).map((part) => `${part.quantity}× ${COMPONENT_LABEL[part.component_type]}`).join(' · ') || 'Sem componentes',
            ),
          ),
      },
      {
        key: 'kind',
        label: 'Tipo',
        sortable: true,
        value: (row) => row.kind,
        render: (row) =>
          h(
            'div.row',
            badge(row.kind === 'gerador' ? 'Gerador Completo' : row.kind === 'componente' ? 'Componente' : 'Serviço', 'blue'),
            row.generator_type ? badge(GENERATOR_LABEL[row.generator_type], 'amber') : null,
          ),
      },
      {
        key: 'total_power_wp',
        label: 'Potência',
        align: 'right',
        sortable: true,
        value: (row) => Number(row.total_power_wp),
        render: (row) => decimal(Number(row.total_power_wp) / 1000, ' kWp'),
      },
      {
        key: 'kit_price',
        label: 'Preço do kit',
        align: 'right',
        sortable: true,
        value: (row) => Number(row.kit_price),
        render: (row) => money(row.kit_price),
      },
      {
        key: 'active',
        label: 'Situação',
        value: (row) => (row.active ? 'Ativo' : 'Inativo'),
        render: (row) => badge(row.active ? 'Ativo' : 'Inativo', row.active ? 'green' : 'gray'),
      },
      { key: 'created_at', label: 'Criado em', sortable: true, render: (row) => date(row.created_at) },
      {
        key: 'actions',
        label: 'Ações',
        align: 'right',
        width: '150px',
        render: (row) =>
          h(
            'div.row',
            { style: { justifyContent: 'flex-end', gap: '8px' } },
            h(
              'button.btn.btn-ghost',
              {
                style: { fontSize: '12px', padding: '4px 10px' },
                onClick: () => {
                  void guard(async () => {
                    await saveProduct(row.id, { active: !row.active })
                    await draw()
                  }, row.active ? 'Produto desativado.' : 'Produto ativado.')
                },
              },
              row.active ? 'Desativar' : 'Ativar',
            ),
            h(
              'button.btn.btn-ghost',
              {
                style: { fontSize: '12px', padding: '4px 10px', color: 'var(--red)' },
                onClick: () =>
                  confirmModal('Excluir produto', `Excluir "${row.name}"? Contratos já emitidos não são afetados.`, () => {
                    void guard(async () => {
                      await removeProduct(row.id)
                      await draw()
                    }, 'Produto excluído.')
                  }),
              },
              'Excluir',
            ),
          ),
      },
    ]

    mount(
      host,
      pageHead({
        title: 'Produtos',
        crumbs: [{ label: 'Produção e Estoque' }, { label: 'Produtos' }],
        actions: [h('button.btn.btn-primary', { onClick: () => productForm(draw) }, '+ Cadastrar Produto')],
      }),
      card(
        { flush: true },
        h(
          'div',
          { style: { padding: '0 16px' } },
          tabs({
            tabs: [
              { id: 'todos', label: 'Todos', count: rows.length },
              { id: 'gerador', label: 'Geradores', count: rows.filter((row) => row.kind === 'gerador').length },
              { id: 'componente', label: 'Componentes', count: rows.filter((row) => row.kind === 'componente').length },
              { id: 'servico', label: 'Serviços', count: rows.filter((row) => row.kind === 'servico').length },
            ],
            active: filter,
            onChange: (id) => setQuery({ tipo: id === 'todos' ? null : id }),
          }),
        ),
        dataTable({
          columns,
          rows: visible,
          searchable: true,
          searchPlaceholder: 'Buscar produto',
          pageSize: 10,
          initialSort: { key: 'created_at', ascending: false },
          emptyTitle: 'Nenhum produto cadastrado',
          emptyHint: 'Cadastre um gerador completo para usá-lo em propostas e contratos.',
          totalLabel: (total) => `${total} produto(s)`,
        }),
      ),
    )
  }

  await draw()
}
