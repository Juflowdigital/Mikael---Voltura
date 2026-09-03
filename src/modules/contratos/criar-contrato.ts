/** Contratos › Criar Contrato — produtos, preço, pagamento, garantia e prazo (telas M15/M16). */
import { h, icon, mount } from '../../ui/dom'
import { card } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { formRow, formSection, selectField, textField, toggleField } from '../../ui/components/form'
import { dataTable, type Column } from '../../ui/components/table'
import { guard, toast } from '../../ui/components/feedback'
import { money, parseMoney } from '../../core/format'
import { navigate } from '../../core/router'
import { app } from '../../core/session'
import { create, findAll, nextNumber, type ContractInput, type ItemInput } from '../../data/contracts'
import { findAll as findClients } from '../../data/clients'
import { members } from '../../data/team'

const ICON_PANEL = '<rect x="2" y="4" width="20" height="12" rx="1"/><path d="M2 10h20M8 4v12M16 4v12"/><path d="M12 16v4M8 20h8"/>'
const ICON_INVERTER = '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>'
const ICON_STRUCT = '<path d="M3 20h18"/><path d="m5 20 4-12 6 12"/><path d="M9 8h10l-4 12"/>'

const ITEM_TYPES = [
  { value: 'painel', label: 'Painel Solar' },
  { value: 'inversor', label: 'Inversor' },
  { value: 'estrutura', label: 'Estrutura' },
  { value: 'servico', label: 'Serviço' },
  { value: 'outro', label: 'Outro' },
]

const PAYMENT_METHODS = [
  { value: 'pix', label: 'PIX' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'cartao', label: 'Cartão de crédito' },
  { value: 'financiamento', label: 'Financiamento bancário' },
  { value: 'transferencia', label: 'Transferência' },
]

interface Draft {
  contractNumber: string
  title: string
  clientId: string
  sellerId: string
  managerId: string
  items: (ItemInput & { key: number })[]
  extraMarginPercent: number
  extraMarginValue: number
  discountPercent: number
  discountValue: number
  useCalculated: boolean
  manualPrice: number
  commissionPercent: number
  paymentTerms: string
  installments: number | null
  paymentMethod: string
  warrantyPanels: number | null
  warrantyStorage: number | null
  warrantyInverters: number | null
  warrantyLabor: number | null
  executionDays: number | null
  systemPowerKwp: number | null
}

function emptyDraft(): Draft {
  return {
    contractNumber: '',
    title: '',
    clientId: '',
    sellerId: '',
    managerId: '',
    items: [],
    extraMarginPercent: 0,
    extraMarginValue: 0,
    discountPercent: 0,
    discountValue: 0,
    useCalculated: true,
    manualPrice: 0,
    commissionPercent: 0,
    paymentTerms: '',
    installments: null,
    paymentMethod: '',
    warrantyPanels: null,
    warrantyStorage: null,
    warrantyInverters: null,
    warrantyLabor: null,
    executionDays: null,
    systemPowerKwp: null,
  }
}

/** Regras de preco do ASTER: base -> margem -> desconto -> valor final. */
export function priceOf(draft: Draft): { products: number; withMargin: number; final: number; commission: number } {
  const products = draft.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
  const withMargin = products + (products * draft.extraMarginPercent) / 100 + draft.extraMarginValue
  const discounted = withMargin - (withMargin * draft.discountPercent) / 100 - draft.discountValue
  const calculated = Math.max(0, discounted)
  const final = draft.useCalculated ? calculated : Math.max(0, draft.manualPrice)
  return { products, withMargin, final, commission: (final * draft.commissionPercent) / 100 }
}

function productSummary(draft: Draft): HTMLElement {
  const summary = (label: string, mark: string, type: string) => {
    const lines = draft.items.filter((item) => item.item_type === type)
    const text = lines.length
      ? lines.map((line) => `${line.quantity}× ${line.name}`).join(' · ')
      : 'Sem ' + label
    return h(
      'div.row',
      { style: { flex: '1', gap: '12px', minWidth: '0' } },
      h('div.kpi-icon', { style: { background: 'var(--surface-3)', color: 'var(--text-muted)' } }, icon(mark, 16)),
      h(
        'div',
        { style: { minWidth: '0' } },
        h('div', { style: { fontSize: '13px', fontWeight: '650' } }, label),
        h('div.faint', { style: { fontSize: '11.5px', overflow: 'hidden', textOverflow: 'ellipsis' } }, text),
      ),
    )
  }

  return h(
    'div',
    { style: { display: 'flex', gap: '18px', padding: '16px', background: 'var(--surface-2)', borderRadius: 'var(--radius)', flexWrap: 'wrap' } },
    summary('Painel Solar', ICON_PANEL, 'painel'),
    summary('Inversor', ICON_INVERTER, 'inversor'),
    summary('Estrutura', ICON_STRUCT, 'estrutura'),
  )
}

export async function render(host: HTMLElement): Promise<void> {
  const [existing, clients, team] = await Promise.all([findAll(), findClients(), members()])
  const org = app.get().organization
  const draft: Draft = { ...emptyDraft(), contractNumber: nextNumber(existing) }
  let nextKey = 1

  const body = h('div')

  function itemColumns(): Column<ItemInput & { key: number }>[] {
    return [
      {
        key: 'item_type',
        label: 'Tipo',
        value: (row) => ITEM_TYPES.find((type) => type.value === row.item_type)?.label ?? row.item_type,
        render: (row) => ITEM_TYPES.find((type) => type.value === row.item_type)?.label ?? row.item_type,
      },
      { key: 'name', label: 'Nome' },
      { key: 'quantity', label: 'Qtd.', align: 'right', render: (row) => String(row.quantity) },
      { key: 'unit_price', label: 'Valor un.', align: 'right', render: (row) => money(row.unit_price) },
      { key: 'total', label: 'Total', align: 'right', value: (row) => row.quantity * row.unit_price, render: (row) => h('b', money(row.quantity * row.unit_price)) },
      {
        key: 'actions',
        label: 'Ações',
        align: 'right',
        width: '80px',
        render: (row) =>
          h(
            'span',
            {
              title: 'Remover',
              style: { cursor: 'pointer', color: 'var(--red)' },
              onClick: () => {
                draft.items = draft.items.filter((item) => item.key !== row.key)
                draw()
              },
            },
            '✕',
          ),
      },
    ]
  }

  function addItemRow(): HTMLElement {
    let line: ItemInput = { item_type: 'painel', name: '', quantity: 1, unit_price: 0, warranty_months: null }
    const inputs = h(
      'div',
      { style: { display: 'grid', gridTemplateColumns: '1fr 2fr 90px 140px auto', gap: '10px', alignItems: 'end', padding: '14px 16px', borderTop: '1px solid var(--border)' } },
      selectField({ label: 'Tipo', value: 'painel', options: ITEM_TYPES, onChange: (v) => (line = { ...line, item_type: v }) }),
      textField({ label: 'Nome do produto', onInput: (v) => (line = { ...line, name: v }) }),
      textField({ label: 'Qtd.', value: '1', onInput: (v) => (line = { ...line, quantity: Math.max(0, parseMoney(v)) }) }),
      textField({ label: 'Valor unitário (R$)', onInput: (v) => (line = { ...line, unit_price: parseMoney(v) }) }),
      h(
        'button.btn.btn-primary',
        {
          onClick: () => {
            if (!line.name.trim()) {
              toast('Informe o nome do produto.', 'error')
              return
            }
            draft.items = [...draft.items, { ...line, key: nextKey++ }]
            draw()
          },
        },
        'Adicionar',
      ),
    )
    return inputs
  }

  function drawIdentity(): HTMLElement {
    return h(
      'div',
      formSection('Identificação'),
      formRow(
        '1fr 2fr',
        textField({ label: 'Número do Contrato', value: draft.contractNumber, onInput: (v) => (draft.contractNumber = v) }),
        textField({ label: 'Título', value: draft.title, onInput: (v) => (draft.title = v) }),
      ),
      h('div', { style: { marginTop: '14px' } }, formRow(
        '2fr 1fr 1fr',
        selectField({
          label: 'Cliente',
          value: draft.clientId,
          placeholder: 'Selecione o cliente',
          options: clients.map((client) => ({ value: client.id, label: client.name })),
          onChange: (v) => (draft.clientId = v),
        }),
        selectField({
          label: 'Vendedor',
          value: draft.sellerId,
          placeholder: 'Selecione',
          options: team.map((member) => ({ value: member.userId, label: member.name })),
          onChange: (v) => (draft.sellerId = v),
        }),
        selectField({
          label: 'Gestor',
          value: draft.managerId,
          placeholder: 'Selecione',
          options: team.map((member) => ({ value: member.userId, label: member.name })),
          onChange: (v) => (draft.managerId = v),
        }),
      )),
      h(
        'div.field',
        { style: { marginTop: '14px' } },
        h('span.field-label', 'Unidade de Negócio'),
        h('div.input', { style: { color: 'var(--text-muted)' } }, org?.name ?? '—'),
      ),
    )
  }

  function drawPrice(): HTMLElement {
    const price = priceOf(draft)
    const readOnly = (label: string, value: string, strong = false) =>
      h(
        'div.field',
        h('span.field-label', label),
        h('div.input', { style: strong ? { borderColor: 'var(--accent)', fontWeight: '700' } : { color: 'var(--text-muted)' } }, value),
      )

    return h(
      'div',
      formSection('Preço'),
      h(
        'div.card',
        { style: { padding: '18px' } },
        h('div.field-label', { style: { marginBottom: '10px' } }, 'Valores Base'),
        formRow('1fr 1fr', readOnly('Valor dos Produtos (R$)', money(price.products)), readOnly('Preço com Margem (R$)', money(price.withMargin))),
        h('div.field-label', { style: { margin: '18px 0 10px' } }, 'Ajustes de Preço'),
        formRow(
          '1fr 1fr 1fr 1fr',
          textField({ label: 'Margem Adicional (%)', onInput: (v) => { draft.extraMarginPercent = parseMoney(v); draw() } }),
          textField({ label: 'Margem Adicional (R$)', onInput: (v) => { draft.extraMarginValue = parseMoney(v); draw() } }),
          textField({ label: 'Desconto (%)', onInput: (v) => { draft.discountPercent = parseMoney(v); draw() } }),
          textField({ label: 'Desconto (R$)', onInput: (v) => { draft.discountValue = parseMoney(v); draw() } }),
        ),
        h('div.field-label', { style: { margin: '18px 0 10px' } }, 'Valor Final e Comissão'),
        formRow(
          '1.2fr 1fr 1fr 1fr',
          draft.useCalculated
            ? readOnly('Preço do contrato (R$)', money(price.final), true)
            : textField({ label: 'Preço do contrato (R$)', onInput: (v) => { draft.manualPrice = parseMoney(v); draw() } }),
          h('div', { style: { alignSelf: 'end', paddingBottom: '9px' } }, toggleField('Usar Valor Calculado', draft.useCalculated, (value) => { draft.useCalculated = value; draw() })),
          textField({ label: 'Comissão (%)', onInput: (v) => { draft.commissionPercent = parseMoney(v); draw() } }),
          readOnly('Comissão do Vendedor (R$)', money(price.commission)),
        ),
      ),
    )
  }

  function drawTerms(): HTMLElement {
    return h(
      'div',
      formSection('Pagamento'),
      h(
        'div.card',
        { style: { padding: '18px' } },
        textField({ label: 'Condição de Pagamento', onInput: (v) => (draft.paymentTerms = v) }),
        h(
          'div',
          { style: { marginTop: '14px' } },
          formRow(
            '1fr 1fr',
            textField({ label: 'Número de Parcelas (1 a 120)', onInput: (v) => (draft.installments = v.trim() ? Math.round(parseMoney(v)) : null) }),
            selectField({ label: 'Forma de Pagamento Padrão', placeholder: 'Selecione', options: PAYMENT_METHODS, onChange: (v) => (draft.paymentMethod = v) }),
          ),
        ),
      ),
      formSection('Garantia'),
      h(
        'div.card',
        { style: { padding: '18px' } },
        formRow(
          '1fr 1fr',
          textField({ label: 'Painéis Solares (anos)', onInput: (v) => (draft.warrantyPanels = v.trim() ? parseMoney(v) : null) }),
          textField({ label: 'Armazenamento (anos)', onInput: (v) => (draft.warrantyStorage = v.trim() ? parseMoney(v) : null) }),
        ),
        h(
          'div',
          { style: { marginTop: '14px' } },
          formRow(
            '1fr 1fr',
            textField({ label: 'Inversores (anos)', onInput: (v) => (draft.warrantyInverters = v.trim() ? parseMoney(v) : null) }),
            textField({ label: 'Mão de Obra (dias)', onInput: (v) => (draft.warrantyLabor = v.trim() ? parseMoney(v) : null) }),
          ),
        ),
      ),
      formSection('Prazo'),
      h(
        'div.card',
        { style: { padding: '18px' } },
        formRow(
          '1fr 1fr',
          textField({ label: 'Prazo de Execução (Dias)', onInput: (v) => (draft.executionDays = v.trim() ? Math.round(parseMoney(v)) : null) }),
          textField({ label: 'Potência do sistema (kWp)', onInput: (v) => (draft.systemPowerKwp = v.trim() ? parseMoney(v) : null) }),
        ),
      ),
    )
  }

  function draw(): void {
    mount(
      body,
      drawIdentity(),
      formSection('Produtos'),
      productSummary(draft),
      h(
        'div',
        { style: { marginTop: '14px' } },
        card(
          { flush: true },
          dataTable({
            columns: itemColumns(),
            rows: draft.items,
            emptyTitle: 'Nenhum produto adicionado',
            emptyHint: 'Preencha a linha abaixo e clique em "Adicionar".',
            totalLabel: (total) => `${total} item(ns)`,
          }),
          addItemRow(),
        ),
      ),
      drawPrice(),
      drawTerms(),
      h(
        'div.row',
        { style: { justifyContent: 'flex-end', gap: '10px', marginTop: '22px' } },
        h('button.btn.btn-ghost', { onClick: () => navigate('/contratos/gestao-de-contratos') }, 'Cancelar'),
        h('button.btn.btn-light', { onClick: () => void save() }, 'Criar Contrato'),
      ),
    )
  }

  async function save(): Promise<void> {
    if (!draft.clientId) {
      toast('Selecione o cliente do contrato.', 'error')
      return
    }
    if (!draft.contractNumber.trim()) {
      toast('Informe o número do contrato.', 'error')
      return
    }

    const price = priceOf(draft)
    const input: ContractInput = {
      contract_number: draft.contractNumber.trim(),
      client_id: draft.clientId,
      title: draft.title.trim() || null,
      status: 'draft',
      total_value: price.final,
      seller_id: draft.sellerId || null,
      manager_id: draft.managerId || null,
      payment_terms: draft.paymentTerms.trim() || null,
      installment_count: draft.installments,
      execution_days: draft.executionDays,
      commission_percent: draft.commissionPercent || null,
      metadata: {
        stage: 'a-emitir',
        system_power_kwp: draft.systemPowerKwp,
        payment_method: draft.paymentMethod || null,
        pricing: {
          products: price.products,
          extra_margin_percent: draft.extraMarginPercent,
          extra_margin_value: draft.extraMarginValue,
          discount_percent: draft.discountPercent,
          discount_value: draft.discountValue,
          use_calculated: draft.useCalculated,
        },
        warranty: {
          panels_years: draft.warrantyPanels,
          storage_years: draft.warrantyStorage,
          inverters_years: draft.warrantyInverters,
          labor_days: draft.warrantyLabor,
        },
      },
    }

    const lines: ItemInput[] = draft.items.map((item) => ({
      item_type: item.item_type,
      name: item.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      warranty_months: item.warranty_months,
    }))

    const ok = await guard(() => create(input, lines).then(() => undefined), 'Contrato criado.')
    if (ok) navigate('/contratos/gestao-de-contratos')
  }

  mount(
    host,
    pageHead({
      title: 'Criar Contrato',
      crumbs: [
        { label: 'Contratos', path: '/contratos/visao-geral' },
        { label: 'Gestão de Contratos', path: '/contratos/gestao-de-contratos' },
        { label: 'Criar Contrato' },
      ],
    }),
    body,
  )
  draw()
}
