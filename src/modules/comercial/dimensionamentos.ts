/** Comercial › Dimensionamentos — lista, seleção de tipo e cálculo (tela M9). */
import { h, icon, mount } from '../../ui/dom'
import { card } from '../../ui/components/card'
import { pageHead, pageNote } from '../../ui/components/page'
import { tabs } from '../../ui/components/tabs'
import { dataTable, type Column } from '../../ui/components/table'
import { badge } from '../../ui/components/badge'
import { openModal, type ModalHandle } from '../../ui/components/modal'
import { formRow, selectField, textField } from '../../ui/components/form'
import { guard, toast } from '../../ui/components/feedback'
import { date, decimal, integer, parseMoney, power } from '../../core/format'
import { sizeSystem, type Scenario } from '../../core/sizing'
import { setQuery, type RouteContext } from '../../core/router'
import { app } from '../../core/session'
import { cityOf, create, findAll, kindOf, KIND_LABEL, scenarioOf, type SystemKind } from '../../data/budgets'
import { findAll as findClients } from '../../data/clients'
import { findAll as findProposals } from '../../data/proposals'
import type { Budget, Client } from '../../core/types'

const KINDS: { id: SystemKind; title: string; description: string; mark: string; color: string; soft: string; soon?: boolean }[] = [
  {
    id: 'ongrid',
    title: 'On-grid',
    description: 'Conectado à rede, sem armazenamento. Micro ou minigeração.',
    mark: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    color: '#f6a623',
    soft: 'rgba(246,166,35,.14)',
  },
  {
    id: 'hibrido',
    title: 'Híbrido',
    description: 'Conectado à rede com banco de baterias para backup.',
    mark: '<rect x="2" y="7" width="16" height="10" rx="2"/><line x1="22" x2="22" y1="11" y2="13"/><line x1="6" x2="6" y1="11" y2="13"/><line x1="10" x2="10" y1="11" y2="13"/>',
    color: '#38bdf8',
    soft: 'rgba(56,189,248,.14)',
  },
  {
    id: 'offgrid',
    title: 'Off-grid',
    description: 'Isolado da rede. Dimensionado por ciclagem e dias de pior sol.',
    mark: '<path d="m2 2 20 20"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/><circle cx="12" cy="12" r="4"/>',
    color: '#22c55e',
    soft: 'rgba(34,197,94,.14)',
  },
  {
    id: 'bess',
    title: 'BESS',
    description: 'Armazenamento puro para arbitragem e corte de pico.',
    mark: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10v4m5-4v4m5-4v4"/>',
    color: '#8ba0b8',
    soft: 'rgba(139,160,184,.14)',
    soon: true,
  },
]

function scenarioCard(scenario: Scenario, selected: boolean, onPick: () => void): HTMLElement {
  return h(
    'article',
    {
      style: {
        border: '1px solid ' + (selected ? 'var(--accent)' : 'var(--border)'),
        background: selected ? 'var(--accent-soft)' : 'var(--surface-2)',
        borderRadius: 'var(--radius)',
        padding: '14px',
        cursor: 'pointer',
      },
      onClick: onPick,
    },
    h(
      'div.row',
      h('div', { style: { fontSize: '13px', fontWeight: '650', flex: '1' } }, scenario.label),
      scenario.recommended ? badge('Recomendado', 'amber') : null,
    ),
    h(
      'div',
      { style: { fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '650', margin: '8px 0 4px' } },
      decimal(scenario.installedKwp, ' kWp'),
    ),
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '12px', color: 'var(--text-muted)' } },
      h('span', `${scenario.moduleCount} módulos de ${scenario.modulePowerW} W`),
      h('span', `Inversor ${scenario.inverterKw} kW`),
      h('span', `Geração: ${integer(scenario.monthlyGenerationKwh)} kWh/mês`),
      h('span', `Área ocupada: ${scenario.areaM2} m²`),
    ),
  )
}

function sizingModal(kind: SystemKind, clients: Client[], onSaved: () => Promise<void>): void {
  const settings = app.get().settings
  const config = {
    modulePowerW: Number(settings?.calculation?.module_power_w) || undefined,
    irradiation: Number(String(settings?.calculation?.irradiation ?? '').replace(',', '.')) || undefined,
  }

  let clientId = ''
  let consumption = 0
  let city = ''
  let picked: Scenario | null = null

  const results = h('div')
  const saveButton = h('button.btn.btn-primary', { disabled: true }, 'Salvar dimensionamento') as HTMLButtonElement

  function recalc(): void {
    if (consumption <= 0) {
      mount(
        results,
        h('div.banner.banner-info', 'Informe o consumo mensal para ver os cenários.'),
      )
      picked = null
      saveButton.disabled = true
      return
    }

    const result = sizeSystem(consumption, city || clients.find((c) => c.id === clientId)?.city || '', config)
    if (!picked) picked = result.scenarios.find((scenario) => scenario.recommended) ?? result.scenarios[1]
    const current = result.scenarios.find((scenario) => scenario.id === picked?.id) ?? result.scenarios[1]
    picked = current
    saveButton.disabled = false

    mount(
      results,
      h(
        'div.muted',
        { style: { fontSize: '12px', marginBottom: '10px' } },
        `Irradiação usada: ${decimal(result.irradiation)} kWh/m²·dia · rendimento específico ${integer(result.specificYield)} kWh/kWp·mês`,
      ),
      h(
        'div.grid',
        { style: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' } },
        result.scenarios.map((scenario) =>
          scenarioCard(scenario, scenario.id === current.id, () => {
            picked = scenario
            recalc()
          }),
        ),
      ),
    )
  }

  const handle: ModalHandle = openModal({
    title: `Novo dimensionamento · ${KIND_LABEL[kind]}`,
    subtitle: 'Nada é salvo até você confirmar. Os cenários recalculam a cada mudança.',
    width: '760px',
    body: h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      formRow(
        '2fr 1fr 1fr',
        selectField({
          label: 'Cliente',
          placeholder: 'Selecione o cliente',
          options: clients.map((client) => ({ value: client.id, label: client.name })),
          onChange: (value) => {
            clientId = value
            const client = clients.find((entry) => entry.id === value)
            if (client?.city && !city) city = client.city
            recalc()
          },
        }),
        textField({
          label: 'Consumo mensal (kWh)',
          required: true,
          onInput: (value) => {
            consumption = parseMoney(value)
            recalc()
          },
        }),
        textField({
          label: 'Cidade',
          onInput: (value) => {
            city = value
            recalc()
          },
        }),
      ),
      results,
    ),
    footer: [
      h('button.btn.btn-ghost', { onClick: () => handle.close() }, 'Cancelar'),
      saveButton,
    ],
  })

  saveButton.addEventListener('click', async () => {
    if (!clientId) {
      toast('Selecione o cliente do dimensionamento.', 'error')
      return
    }
    if (!picked) return
    const scenario = picked
    const ok = await guard(async () => {
      await create({
        client_id: clientId,
        monthly_consumption_kwh: consumption,
        system_power_kwp: scenario.installedKwp,
        module_count: scenario.moduleCount,
        module_power_w: scenario.modulePowerW,
        inverter_power_kw: scenario.inverterKw,
        estimated_generation_kwh: scenario.monthlyGenerationKwh,
        roof_area_m2: scenario.areaM2,
        assumptions: { system_kind: kind, scenario: scenario.label, city, irradiation_source: city ? 'cidade' : 'padrão' },
      })
      await onSaved()
    }, 'Dimensionamento salvo.')
    if (ok) handle.close()
  })

  recalc()
}

function kindPicker(clients: Client[], onSaved: () => Promise<void>): void {
  const handle = openModal({
    title: 'Novo dimensionamento',
    subtitle: 'O que você quer dimensionar? Dá para trocar de ideia depois — nada é salvo até você mandar salvar.',
    width: '780px',
    body: h(
      'div.grid',
      { style: { gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' } },
      KINDS.map((entry) =>
        h(
          'article',
          {
            style: {
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              background: 'var(--surface-2)',
              padding: '16px',
              cursor: entry.soon ? 'not-allowed' : 'pointer',
              opacity: entry.soon ? '0.55' : '1',
            },
            onClick: () => {
              if (entry.soon) {
                toast('Dimensionamento BESS ainda não está disponível.')
                return
              }
              handle.close()
              sizingModal(entry.id, clients, onSaved)
            },
          },
          h(
            'div.row',
            h('div.kpi-icon', { style: { background: entry.soft, color: entry.color } }, icon(entry.mark, 16)),
            h('span.spacer'),
            entry.soon ? badge('Em breve', 'gray') : null,
          ),
          h('div', { style: { fontSize: '14px', fontWeight: '650', marginTop: '12px' } }, entry.title),
          h('div.muted', { style: { fontSize: '12px', marginTop: '5px', lineHeight: '1.5' } }, entry.description),
        ),
      ),
    ),
    footer: [h('button.btn.btn-ghost', { onClick: () => handle.close() }, 'Cancelar')],
  })
}

const TABS = [
  { id: 'todos', label: 'Todos' },
  { id: 'rascunhos', label: 'Rascunhos' },
  { id: 'com-cliente', label: 'Com cliente' },
  { id: 'convertidos', label: 'Convertidos' },
]

export async function render(host: HTMLElement, ctx: RouteContext): Promise<void> {
  async function draw(): Promise<void> {
    const [budgets, clients, proposals] = await Promise.all([findAll(), findClients(), findProposals()])
    const converted = new Set(proposals.map((proposal) => proposal.budget_id).filter(Boolean) as string[])
    const clientName = (id: string | null) => clients.find((client) => client.id === id)?.name ?? '—'

    const activeTab = ctx.query.get('aba') ?? 'todos'
    const kindFilter = ctx.query.get('tipo') ?? ''

    const counts = {
      todos: budgets.length,
      rascunhos: budgets.filter((budget) => !converted.has(budget.id)).length,
      'com-cliente': budgets.filter((budget) => Boolean(budget.client_id)).length,
      convertidos: budgets.filter((budget) => converted.has(budget.id)).length,
    }

    const rows = budgets.filter((budget) => {
      if (kindFilter && kindOf(budget) !== kindFilter) return false
      if (activeTab === 'rascunhos') return !converted.has(budget.id)
      if (activeTab === 'com-cliente') return Boolean(budget.client_id)
      if (activeTab === 'convertidos') return converted.has(budget.id)
      return true
    })

    const columns: Column<Budget>[] = [
      {
        key: 'scenario',
        label: 'Dimensionamento',
        sortable: true,
        value: (row) => scenarioOf(row),
        render: (row) =>
          h(
            'div',
            h('b', scenarioOf(row)),
            h('div.faint', { style: { fontSize: '11.5px', marginTop: '2px' } }, `${integer(row.monthly_consumption_kwh)} kWh/mês · ${cityOf(row)}`),
          ),
      },
      { key: 'client', label: 'Cliente', sortable: true, value: (row) => clientName(row.client_id), render: (row) => clientName(row.client_id) },
      {
        key: 'kind',
        label: 'Tipo',
        sortable: true,
        value: (row) => KIND_LABEL[kindOf(row)],
        render: (row) => badge(KIND_LABEL[kindOf(row)], kindOf(row) === 'ongrid' ? 'amber' : kindOf(row) === 'hibrido' ? 'blue' : 'green'),
      },
      {
        key: 'power',
        label: 'Potência',
        align: 'right',
        sortable: true,
        value: (row) => row.system_power_kwp ?? 0,
        render: (row) => power(row.system_power_kwp),
      },
      {
        key: 'situacao',
        label: 'Situação',
        value: (row) => (converted.has(row.id) ? 'Convertido' : 'Rascunho'),
        render: (row) => (converted.has(row.id) ? badge('Convertido', 'green') : badge('Rascunho', 'gray')),
      },
      { key: 'created_at', label: 'Atualizado', sortable: true, render: (row) => date(row.created_at) },
    ]

    mount(
      host,
      pageHead({
        title: 'Dimensionamentos',
        crumbs: [{ label: 'Comercial' }, { label: 'Dimensionamentos' }],
        actions: [h('button.btn.btn-primary', { onClick: () => kindPicker(clients, draw) }, '+ Novo Dimensionamento')],
      }),
      pageNote(
        'Simule hipóteses antes de abrir a negociação. Um dimensionamento comporta vários cenários; quando um deles amadurecer, associe o cliente e converta em negociação — a proposta já nasce preenchida.',
      ),
      card(
        { flush: true },
        h(
          'div',
          { style: { padding: '0 16px' } },
          tabs({
            tabs: TABS.map((tab) => ({ id: tab.id, label: tab.label, count: counts[tab.id as keyof typeof counts] })),
            active: activeTab,
            onChange: (id) => setQuery({ aba: id === 'todos' ? null : id }),
          }),
        ),
        h(
          'div.filter-bar',
          { style: { padding: '14px 16px 0', margin: '0' } },
          selectField({
            label: 'Tipo',
            value: kindFilter,
            placeholder: 'Todos',
            options: KINDS.filter((entry) => !entry.soon).map((entry) => ({ value: entry.id, label: entry.title })),
            onChange: (value) => setQuery({ tipo: value || null }),
          }),
          h(
            'button.btn.btn-ghost',
            { style: { alignSelf: 'flex-end' }, onClick: () => setQuery({ aba: null, tipo: null }) },
            'Limpar filtros',
          ),
        ),
        dataTable({
          columns,
          rows,
          searchable: true,
          searchPlaceholder: 'Buscar por nome, observação ou cliente…',
          pageSize: 10,
          initialSort: { key: 'created_at', ascending: false },
          emptyTitle: 'Sem conteúdo',
          emptyHint: 'Crie um dimensionamento para simular potência, geração e área ocupada.',
        }),
      ),
    )
  }

  await draw()
}
