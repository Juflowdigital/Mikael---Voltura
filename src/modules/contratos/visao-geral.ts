/** Contratos › Visão Geral — indicadores e faturamento no período (tela M13). */
import { h, mount } from '../../ui/dom'
import { card, gridCols, gridTemplate } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { kpiCard, KPI_ICONS } from '../../ui/components/kpi'
import { barChart } from '../../ui/components/chart'
import { emptyState } from '../../ui/components/feedback'
import { selectField } from '../../ui/components/form'
import { money, power } from '../../core/format'
import { navigate, setQuery, type RouteContext } from '../../core/router'
import { findAll, powerKwp, stageOf } from '../../data/contracts'
import { findAll as findClients } from '../../data/clients'
import { members } from '../../data/team'
import type { Client, Contract } from '../../core/types'

/** Doze meses a partir do mes atual, para o grafico de faturamento. */
function billingSeries(contracts: Contract[]): { label: string; value: number }[] {
  const points: { label: string; value: number }[] = []
  const base = new Date()
  base.setDate(1)
  base.setMonth(base.getMonth() - 5)

  for (let index = 0; index < 12; index += 1) {
    const month = new Date(base)
    month.setMonth(base.getMonth() + index)
    const key = month.toISOString().slice(0, 7)
    const total = contracts
      .filter((contract) => (contract.signed_at ?? contract.created_at).slice(0, 7) === key)
      .reduce((sum, contract) => sum + Number(contract.total_value ?? 0), 0)
    points.push({
      label: month.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') + '/' + key.slice(2, 4),
      value: total,
    })
  }
  return points
}

function miniTable(contracts: Contract[], clients: Client[]): HTMLElement {
  if (!contracts.length) return emptyState({ title: 'Nenhum contrato encontrado' })
  const clientName = (id: string) => clients.find((client) => client.id === id)?.name ?? '—'
  return h(
    'div.table-wrap',
    h(
      'table.data',
      h('thead', h('tr', h('th', 'Nome'), h('th.col-right', 'Potência'), h('th.col-right', 'Valor'))),
      h(
        'tbody',
        contracts.slice(0, 6).map((contract) =>
          h(
            'tr',
            h('td', h('b', contract.title || contract.contract_number), h('div.faint', { style: { fontSize: '11.5px' } }, clientName(contract.client_id))),
            h('td.col-right', power(powerKwp(contract))),
            h('td.col-right', money(contract.total_value)),
          ),
        ),
      ),
    ),
  )
}

export async function render(host: HTMLElement, ctx: RouteContext): Promise<void> {
  const [contracts, clients, team] = await Promise.all([findAll(), findClients(), members()])
  const manager = ctx.query.get('gestor') ?? ''
  const scoped = manager ? contracts.filter((contract) => contract.manager_id === manager) : contracts

  const active = scoped.filter((contract) => contract.status === 'signed' && stageOf(contract) !== 'finalizado')
  const toIssue = scoped.filter((contract) => stageOf(contract) === 'a-emitir')
  const toFinish = scoped.filter((contract) => stageOf(contract) === 'em-finalizacao')

  const in30Days = scoped.filter((contract) => {
    if (!contract.execution_days || !contract.signed_at) return false
    const due = new Date(contract.signed_at).getTime() + contract.execution_days * 86400000
    const days = (due - Date.now()) / 86400000
    return days >= 0 && days <= 30
  })

  mount(
    host,
    pageHead({ title: 'Contratos', crumbs: [{ label: 'Contratos' }, { label: 'Visão Geral' }] }),
    h(
      'div.stack',
      gridCols(
        4,
        kpiCard({ label: 'Contratos vigentes', value: String(active.length), mark: KPI_ICONS.file, color: '#38bdf8', soft: 'rgba(56,189,248,.14)', onClick: () => navigate('/contratos/gestao-de-contratos') }),
        kpiCard({ label: 'A emitir', value: String(toIssue.length), mark: KPI_ICONS.flag, color: '#f6a623', soft: 'rgba(246,166,35,.14)', onClick: () => navigate('/contratos/gestao-de-contratos', { etapa: 'a-emitir' }) }),
        kpiCard({ label: 'A finalizar', value: String(toFinish.length), mark: KPI_ICONS.check, color: '#22c55e', soft: 'rgba(34,197,94,.14)', onClick: () => navigate('/contratos/gestao-de-contratos', { etapa: 'em-finalizacao' }) }),
        kpiCard({ label: 'Vencendo em 30 dias', value: String(in30Days.length), hint: 'pelo prazo de execução', mark: KPI_ICONS.calendar, color: '#a78bfa', soft: 'rgba(167,139,250,.14)' }),
      ),
      h(
        'div.filter-bar',
        selectField({
          label: 'Gestor de Contratos',
          value: manager,
          placeholder: 'Todos',
          options: team.map((member) => ({ value: member.userId, label: member.name })),
          onChange: (value) => setQuery({ gestor: value || null }),
        }),
        h('button.btn.btn-ghost', { style: { alignSelf: 'flex-end' }, onClick: () => setQuery({ gestor: null }) }, 'Limpar filtros'),
      ),
      gridTemplate(
        '1fr 1fr',
        card({ title: 'Contratos a Emitir', footerLink: { label: 'Ver todos', path: '/contratos/gestao-de-contratos' }, flush: true }, miniTable(toIssue, clients)),
        card({ title: 'Contratos a Finalizar', footerLink: { label: 'Ver todos', path: '/contratos/gestao-de-contratos' }, flush: true }, miniTable(toFinish, clients)),
      ),
      card(
        {
          title: 'Faturamento no período',
          subtitle: 'Valor total dos contratos por mês',
          tools: [h('b', { style: { color: 'var(--accent)' } }, money(scoped.reduce((sum, c) => sum + Number(c.total_value ?? 0), 0)))],
        },
        barChart({ data: billingSeries(scoped), height: 190, format: (value) => (value ? money(value) : '') }),
      ),
    ),
  )
}
