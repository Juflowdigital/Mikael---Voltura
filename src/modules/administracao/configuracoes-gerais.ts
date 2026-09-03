/** Administração › Configurações Gerais — parâmetros de cálculo e alertas. */
import { h, mount } from '../../ui/dom'
import { card, gridTemplate } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { formRow, textField, toggleField } from '../../ui/components/form'
import { banner, guard, toast } from '../../ui/components/feedback'
import { decimal, integer, parseMoney } from '../../core/format'
import { sizeSystem } from '../../core/sizing'
import { app, refreshTenant } from '../../core/session'
import { saveSettings } from '../../data/organization'

interface Calculation {
  module_power_w: number
  irradiation: number
  margin: number
  module_model: string
}

const ALERTS: { key: string; label: string; hint: string }[] = [
  { key: 'proposal_expiring', label: 'Proposta perto de vencer', hint: 'Avisa 3 dias antes da validade da proposta.' },
  { key: 'connection_budget', label: 'Orçamento de conexão vencendo', hint: 'Avisa 30 dias antes do vencimento do parecer de acesso.' },
  { key: 'work_inspection', label: 'Obra aguardando vistoria', hint: 'Avisa quando a obra entra em entrega sem vistoria agendada.' },
  { key: 'ticket_sla', label: 'Chamado fora do prazo', hint: 'Avisa quando um chamado passa do SLA definido.' },
  { key: 'stock_minimum', label: 'Estoque abaixo do mínimo', hint: 'Avisa quando um item atinge o ponto de reposição.' },
]

function calculationOf(): Calculation {
  const raw = (app.get().settings?.calculation ?? {}) as Record<string, unknown>
  return {
    module_power_w: Number(raw.module_power_w) > 0 ? Number(raw.module_power_w) : 570,
    irradiation: Number(String(raw.irradiation ?? '').replace(',', '.')) || 0,
    margin: Number(raw.margin) >= 0 ? Number(raw.margin) : 10.2,
    module_model: String(raw.module_model ?? ''),
  }
}

function togglesOf(): Record<string, boolean> {
  const raw = (app.get().settings?.alerts ?? {}) as Record<string, unknown>
  const stored = (raw.toggles ?? {}) as Record<string, unknown>
  const out: Record<string, boolean> = {}
  for (const alert of ALERTS) out[alert.key] = Boolean(stored[alert.key])
  return out
}

async function persistCalculation(calc: Calculation): Promise<void> {
  const settings = app.get().settings
  await saveSettings({
    alerts: settings?.alerts ?? {},
    integrations: settings?.integrations ?? {},
    document_models: settings?.document_models ?? [],
    approval_rules: settings?.approval_rules ?? [],
    calculation: {
      module_power_w: calc.module_power_w,
      irradiation: calc.irradiation ? String(calc.irradiation) : '',
      margin: calc.margin,
      module_model: calc.module_model,
    },
  })
  await refreshTenant()
}

async function persistToggles(toggles: Record<string, boolean>): Promise<void> {
  const settings = app.get().settings
  await saveSettings({
    calculation: settings?.calculation ?? {},
    integrations: settings?.integrations ?? {},
    document_models: settings?.document_models ?? [],
    approval_rules: settings?.approval_rules ?? [],
    alerts: { ...(settings?.alerts ?? {}), toggles },
  })
  await refreshTenant()
}

export function render(host: HTMLElement): void {
  function draw(): void {
    let calc = calculationOf()
    const toggles = togglesOf()
    const preview = h('div')

    function drawPreview(): void {
      const result = sizeSystem(1000, app.get().organization?.city ?? '', {
        modulePowerW: calc.module_power_w,
        irradiation: calc.irradiation || undefined,
      })
      const ideal = result.scenarios.find((scenario) => scenario.recommended) ?? result.scenarios[1]
      mount(
        preview,
        banner(
          'info',
          h(
            'div',
            h('div', { style: { fontWeight: '650', marginBottom: '3px' } }, 'Prévia com estes parâmetros'),
            h(
              'div.muted',
              { style: { fontSize: '12.5px' } },
              'Para 1.000 kWh/mês: ' + ideal.moduleCount + ' módulos de ' + ideal.modulePowerW + ' W · ' +
                decimal(ideal.installedKwp, ' kWp') + ' · inversor ' + ideal.inverterKw + ' kW · geração ' +
                integer(ideal.monthlyGenerationKwh) + ' kWh/mês (irradiação ' + decimal(result.irradiation) + ').',
            ),
          ),
        ),
      )
    }

    const calcCard = card(
      { title: 'Parâmetros de cálculo', subtitle: 'Usados no dimensionamento e nas propostas.' },
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
        formRow(
          '1fr 1fr',
          textField({
            label: 'Potência do módulo (W)',
            value: String(calc.module_power_w),
            onInput: (value) => {
              calc = { ...calc, module_power_w: Math.max(100, parseMoney(value) || 570) }
              drawPreview()
            },
          }),
          textField({
            label: 'Irradiação (kWh/m²·dia)',
            value: calc.irradiation ? String(calc.irradiation) : '',
            placeholder: 'Deduzir pela cidade',
            onInput: (value) => {
              calc = { ...calc, irradiation: parseMoney(value) }
              drawPreview()
            },
          }),
        ),
        formRow(
          '1fr 1fr',
          textField({
            label: 'Margem comercial padrão (%)',
            value: String(calc.margin),
            onInput: (value) => (calc = { ...calc, margin: parseMoney(value) }),
          }),
          textField({
            label: 'Modelo de módulo',
            value: calc.module_model,
            placeholder: 'Ex.: Trina Vertex S+ 570W',
            onInput: (value) => (calc = { ...calc, module_model: value }),
          }),
        ),
        preview,
        h(
          'div.row',
          { style: { justifyContent: 'flex-end' } },
          h(
            'button.btn.btn-primary',
            {
              onClick: () => {
                if (calc.module_power_w < 100) {
                  toast('A potência do módulo deve ser maior que 100 W.', 'error')
                  return
                }
                void guard(() => persistCalculation(calc), 'Parâmetros de cálculo salvos.')
              },
            },
            'Salvar parâmetros',
          ),
        ),
      ),
    )

    const alertsCard = card(
      { title: 'Alertas', subtitle: 'Quais avisos aparecem no painel inicial.' },
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
        ALERTS.map((alert) =>
          h(
            'div',
            toggleField(alert.label, toggles[alert.key], (value) => {
              void guard(async () => {
                await persistToggles({ ...toggles, [alert.key]: value })
                draw()
              }, value ? 'Alerta ativado.' : 'Alerta desativado.')
            }),
            h('div.faint', { style: { fontSize: '11.5px', marginLeft: '45px', marginTop: '2px' } }, alert.hint),
          ),
        ),
      ),
    )

    mount(
      host,
      pageHead({
        title: 'Configurações Gerais',
        crumbs: [{ label: 'Administração', path: '/administracao/visao-geral' }, { label: 'Configurações Gerais' }],
      }),
      gridTemplate('1.3fr 1fr', calcCard, alertsCard),
    )

    drawPreview()
  }

  draw()
}
