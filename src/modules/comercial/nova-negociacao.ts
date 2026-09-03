/** Comercial › Nova Negociação — cadastro da negociação a partir do cliente/dimensionamento (tela M6). */
import { h, mount } from '../../ui/dom'
import { card } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { formRow, formSection, selectField, textAreaField, textField } from '../../ui/components/form'
import { guard, toast } from '../../ui/components/feedback'
import { money, parseMoney, power } from '../../core/format'
import { navigate, type RouteContext } from '../../core/router'
import { create, findAll, nextNumber, type ProposalInput } from '../../data/proposals'
import { findAll as findClients } from '../../data/clients'
import { findAll as findBudgets } from '../../data/budgets'
import { STAGES } from '../../data/leads'
import { units } from '../../data/organization'
import { members } from '../../data/team'
import type { Budget } from '../../core/types'

/** Validade padrao de uma proposta comercial: 30 dias. */
const VALIDITY_DAYS = 30

const FUNNELS = [
  { value: 'padrao', label: 'Funil padrão' },
  { value: 'b2b', label: 'Funil B2B' },
  { value: 'indicacao', label: 'Funil de indicação' },
]

interface Draft {
  proposalNumber: string
  title: string
  clientId: string
  budgetId: string
  address: string
  businessUnitId: string
  utilityCompany: string
  managerId: string
  sellerId: string
  totalValue: number
  funnel: string
  phase: string
  tags: string
  notes: string
}

function addDays(days: number): string {
  const day = new Date()
  day.setDate(day.getDate() + days)
  return day.toISOString().slice(0, 10)
}

function budgetLabel(budget: Budget, name: string): string {
  const parts = [name, power(budget.system_power_kwp)]
  if (budget.estimated_price) parts.push(money(budget.estimated_price))
  return parts.join(' · ')
}

export async function render(host: HTMLElement, ctx: RouteContext): Promise<void> {
  const [existing, clients, budgets, businessUnits, team] = await Promise.all([
    findAll(),
    findClients(),
    findBudgets(),
    units(),
    members(),
  ])

  const primary = businessUnits.find((unit) => unit.is_primary) ?? businessUnits[0]
  const preselected = budgets.find((budget) => budget.id === ctx.query.get('dimensionamento'))

  const draft: Draft = {
    proposalNumber: nextNumber(existing),
    title: '',
    clientId: preselected?.client_id ?? ctx.query.get('cliente') ?? '',
    budgetId: preselected?.id ?? '',
    address: '',
    businessUnitId: primary?.id ?? '',
    utilityCompany: primary?.utility_company ?? '',
    managerId: '',
    sellerId: '',
    totalValue: preselected?.estimated_price ?? 0,
    funnel: 'padrao',
    phase: STAGES[0]?.key ?? '',
    tags: '',
    notes: '',
  }

  const body = h('div')

  function clientName(id: string): string {
    return clients.find((client) => client.id === id)?.name ?? 'Cliente'
  }

  /** O cliente escolhido filtra os dimensionamentos oferecidos. */
  function budgetOptions(): { value: string; label: string }[] {
    const scoped = draft.clientId ? budgets.filter((budget) => budget.client_id === draft.clientId) : budgets
    return scoped.map((budget) => ({ value: budget.id, label: budgetLabel(budget, clientName(budget.client_id)) }))
  }

  function selectedBudget(): Budget | undefined {
    return budgets.find((budget) => budget.id === draft.budgetId)
  }

  function summary(): HTMLElement {
    const budget = selectedBudget()
    const readOnly = (label: string, value: string) =>
      h('div.field', h('span.field-label', label), h('div.input', { style: { color: 'var(--text-muted)' } }, value))

    return h(
      'div',
      formSection('Resumo do dimensionamento'),
      h(
        'div.card',
        { style: { padding: '18px' } },
        formRow(
          '1fr 1fr 1fr',
          readOnly('Potência do sistema', budget ? power(budget.system_power_kwp) : '—'),
          readOnly('Módulos', budget?.module_count ? String(budget.module_count) : '—'),
          readOnly('Valor estimado', budget?.estimated_price ? money(budget.estimated_price) : '—'),
        ),
      ),
    )
  }

  function draw(): void {
    mount(
      body,
      formSection('Identificação'),
      formRow(
        '1fr 2fr',
        textField({ label: 'Número', value: draft.proposalNumber, onInput: (v) => (draft.proposalNumber = v) }),
        textField({
          label: 'Título',
          value: draft.title,
          placeholder: 'Ex.: Usina 8,55 kWp — Residencial',
          onInput: (v) => (draft.title = v),
        }),
      ),
      h(
        'div',
        { style: { marginTop: '14px' } },
        formRow(
          '2fr 2fr',
          selectField({
            label: 'Cliente',
            value: draft.clientId,
            placeholder: 'Selecione o cliente',
            options: clients.map((client) => ({ value: client.id, label: client.name })),
            onChange: (v) => {
              draft.clientId = v
              if (selectedBudget()?.client_id !== v) draft.budgetId = ''
              draw()
            },
          }),
          selectField({
            label: 'Dimensionamento',
            value: draft.budgetId,
            placeholder: draft.clientId ? 'Selecione o dimensionamento' : 'Escolha o cliente primeiro',
            options: budgetOptions(),
            onChange: (v) => {
              draft.budgetId = v
              draft.totalValue = selectedBudget()?.estimated_price ?? draft.totalValue
              draw()
            },
          }),
        ),
      ),
      h(
        'div',
        { style: { marginTop: '14px' } },
        formRow(
          '2fr 1fr',
          textField({ label: 'Endereço da instalação', value: draft.address, onInput: (v) => (draft.address = v) }),
          textField({
            label: 'Valor da negociação (R$)',
            value: draft.totalValue ? String(draft.totalValue) : '',
            placeholder: '0,00',
            onInput: (v) => (draft.totalValue = parseMoney(v)),
          }),
        ),
      ),
      summary(),
      formSection('Responsáveis'),
      h(
        'div.card',
        { style: { padding: '18px' } },
        formRow(
          '2fr 2fr',
          selectField({
            label: 'Unidade de Negócio',
            value: draft.businessUnitId,
            placeholder: 'Selecione',
            options: businessUnits.map((unit) => ({ value: unit.id, label: unit.name })),
            onChange: (v) => {
              draft.businessUnitId = v
              const unit = businessUnits.find((entry) => entry.id === v)
              if (unit?.utility_company) draft.utilityCompany = unit.utility_company
              draw()
            },
          }),
          textField({ label: 'Concessionária', value: draft.utilityCompany, onInput: (v) => (draft.utilityCompany = v) }),
        ),
        h(
          'div',
          { style: { marginTop: '14px' } },
          formRow(
            '1fr 1fr',
            selectField({
              label: 'Gestor',
              value: draft.managerId,
              placeholder: 'Selecione',
              options: team.map((member) => ({ value: member.userId, label: member.name })),
              onChange: (v) => (draft.managerId = v),
            }),
            selectField({
              label: 'Vendedor',
              value: draft.sellerId,
              placeholder: 'Selecione',
              options: team.map((member) => ({ value: member.userId, label: member.name })),
              onChange: (v) => (draft.sellerId = v),
            }),
          ),
        ),
      ),
      formSection('Acompanhamento'),
      h(
        'div.card',
        { style: { padding: '18px' } },
        formRow(
          '1fr 1fr 1fr',
          selectField({ label: 'Funil', value: draft.funnel, options: FUNNELS, onChange: (v) => (draft.funnel = v) }),
          selectField({
            label: 'Fase',
            value: draft.phase,
            options: STAGES.map((stage) => ({ value: stage.key, label: stage.label })),
            onChange: (v) => (draft.phase = v),
          }),
          textField({
            label: 'Tags',
            value: draft.tags,
            placeholder: 'Separadas por vírgula',
            onInput: (v) => (draft.tags = v),
          }),
        ),
        h(
          'div',
          { style: { marginTop: '14px' } },
          textAreaField({ label: 'Informações', value: draft.notes, onInput: (v) => (draft.notes = v) }),
        ),
      ),
      h(
        'div.row',
        { style: { justifyContent: 'flex-end', gap: '10px', marginTop: '22px' } },
        h('button.btn.btn-ghost', { onClick: () => navigate('/comercial/negociacoes') }, 'Cancelar'),
        h('button.btn.btn-light', { onClick: () => void save() }, 'Criar Negociação'),
      ),
    )
  }

  async function save(): Promise<void> {
    if (!draft.clientId) {
      toast('Selecione o cliente da negociação.', 'error')
      return
    }
    if (!draft.proposalNumber.trim()) {
      toast('Informe o número da negociação.', 'error')
      return
    }

    const budget = selectedBudget()
    const input: ProposalInput = {
      proposal_number: draft.proposalNumber.trim(),
      title: draft.title.trim() || null,
      client_id: draft.clientId,
      budget_id: draft.budgetId || null,
      status: 'draft',
      total_value: draft.totalValue,
      valid_until: addDays(VALIDITY_DAYS),
      business_unit_id: draft.businessUnitId || null,
      seller_id: draft.sellerId || null,
      manager_id: draft.managerId || null,
      metadata: {
        address: draft.address.trim() || null,
        utility_company: draft.utilityCompany.trim() || null,
        funnel: draft.funnel,
        phase: draft.phase,
        tags: draft.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        notes: draft.notes.trim() || null,
      },
    }

    const ok = await guard(() => create(input).then(() => undefined), 'Negociação criada.')
    if (ok) navigate('/comercial/negociacoes')
  }

  mount(
    host,
    pageHead({
      title: 'Nova Negociação',
      crumbs: [
        { label: 'Comercial', path: '/comercial/visao-geral' },
        { label: 'Gestão de Negociações', path: '/comercial/negociacoes' },
        { label: 'Nova Negociação' },
      ],
    }),
    card({ flush: true }, h('div', { style: { padding: '18px' } }, body)),
  )
  draw()
}
