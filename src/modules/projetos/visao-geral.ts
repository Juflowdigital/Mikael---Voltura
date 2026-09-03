/** Projetos › Visão Geral — indicadores, tempo por etapa e pendências (tela M17). */
import { h, mount } from '../../ui/dom'
import { card, gridCols, gridTemplate } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { kpiCard, KPI_ICONS } from '../../ui/components/kpi'
import { barChart } from '../../ui/components/chart'
import { emptyState } from '../../ui/components/feedback'
import { selectField } from '../../ui/components/form'
import { date, daysSince, power } from '../../core/format'
import { navigate, setQuery, type RouteContext } from '../../core/router'
import { average, daysToMilestone, findAll, hasPendency, median, MILESTONES, nameOf, powerKwp } from '../../data/projects'
import { findAll as findClients } from '../../data/clients'
import { members } from '../../data/team'
import type { Client, Homologation } from '../../core/types'

function table(rows: Homologation[], clients: Client[], columns: string[], cell: (row: Homologation) => (string | HTMLElement)[]): HTMLElement {
  if (!rows.length) return emptyState({ title: 'Nenhum projeto encontrado' })
  void clients
  return h(
    'div.table-wrap',
    h(
      'table.data',
      h('thead', h('tr', columns.map((label, index) => h(index === columns.length - 1 ? 'th.col-right' : 'th', label)))),
      h(
        'tbody',
        rows.slice(0, 6).map((row) =>
          h('tr', cell(row).map((value, index) => h(index === columns.length - 1 ? 'td.col-right' : 'td', value))),
        ),
      ),
    ),
  )
}


function legendItem(label: string, color: string): HTMLElement {
  return h(
    'span.row',
    { style: { gap: '6px' } },
    h('span', { style: { width: '8px', height: '8px', borderRadius: '50%', background: color } }),
    h('span.muted', label),
  )
}

export async function render(host: HTMLElement, ctx: RouteContext): Promise<void> {
  const [projects, clients, team] = await Promise.all([findAll(), findClients(), members()])
  const manager = ctx.query.get('gestor') ?? ''
  const scoped = manager ? projects.filter((project) => project.responsible_id === manager) : projects
  const clientName = (id: string) => clients.find((client) => client.id === id)?.name ?? '—'

  const running = scoped.filter((project) => project.status === 'documents' || project.status === 'submitted' || project.status === 'under_review')
  const approved = scoped.filter((project) => project.status === 'approved')
  const done = scoped.filter((project) => project.status === 'connected')
  const inspections = scoped.filter((project) => project.status === 'approved' && !project.metadata?.inspection_done)
  const pendencies = scoped.filter(hasPendency)

  const expiring = scoped.filter((project) => {
    if (!project.access_opinion_expires_at) return false
    const days = (new Date(project.access_opinion_expires_at).getTime() - Date.now()) / 86400000
    return days >= 0 && days <= 60
  })

  const milestoneData = MILESTONES.flatMap((milestone) => {
    const values = scoped.map((project) => daysToMilestone(project, milestone.key)).filter((value): value is number => value !== null)
    return [
      { label: milestone.label, value: Math.round(average(values)), color: '#f6a623' },
      { label: '·', value: Math.round(median(values)), color: '#fbbf24' },
    ]
  })

  mount(
    host,
    pageHead({ title: 'Projetos', crumbs: [{ label: 'Projetos' }, { label: 'Visão Geral' }] }),
    h(
      'div.stack',
      gridCols(
        4,
        kpiCard({ label: 'Projetos em andamento', value: String(running.length), mark: KPI_ICONS.file, color: '#38bdf8', soft: 'rgba(56,189,248,.14)', onClick: () => navigate('/projetos/gestao-de-projetos') }),
        kpiCard({ label: 'Projetos aprovados', value: String(approved.length), mark: KPI_ICONS.check, color: '#22c55e', soft: 'rgba(34,197,94,.14)' }),
        kpiCard({ label: 'Concluídos', value: String(done.length), mark: KPI_ICONS.flag, color: '#a78bfa', soft: 'rgba(167,139,250,.14)' }),
        kpiCard({ label: 'Vistorias pendentes', value: String(inspections.length), mark: KPI_ICONS.alert, color: '#f6a623', soft: 'rgba(246,166,35,.14)' }),
      ),
      h(
        'div.filter-bar',
        selectField({
          label: 'Gestor de Projetos',
          value: manager,
          placeholder: 'Todos',
          options: team.map((member) => ({ value: member.userId, label: member.name })),
          onChange: (value) => setQuery({ gestor: value || null }),
        }),
        h('button.btn.btn-ghost', { style: { alignSelf: 'flex-end' }, onClick: () => setQuery({ gestor: null }) }, 'Limpar filtros'),
      ),
      gridTemplate(
        '1fr 1fr',
        card({ title: 'Novos Projetos', footerLink: { label: 'Ver todos', path: '/projetos/gestao-de-projetos' }, flush: true },
          table(running, clients, ['Projeto', 'Cliente', 'Potência'], (row) => [nameOf(row), clientName(row.client_id), power(powerKwp(row))])),
        card({ title: 'Solicitar Vistoria', footerLink: { label: 'Ver todos', path: '/projetos/gestao-de-projetos' }, flush: true },
          table(inspections, clients, ['Projeto', 'Cliente', 'Potência'], (row) => [nameOf(row), clientName(row.client_id), power(powerKwp(row))])),
      ),
      card(
        {
          title: 'Tempo médio por etapa',
          subtitle: `${scoped.length} projeto(s) no período — média e mediana calculadas só sobre quem atingiu cada marco.`,
        },
        h(
          'div.row',
          { style: { gap: '18px', justifyContent: 'center', fontSize: '12px', marginBottom: '12px' } },
          legendItem('Média (dias)', '#f6a623'),
          legendItem('Mediana (dias)', '#fbbf24'),
        ),
        barChart({ data: milestoneData, height: 190, format: (value) => (value ? value + 'd' : '') }),
      ),
      gridTemplate(
        '1fr 1fr',
        card({ title: 'Projetos com Pendência', flush: true },
          table(pendencies, clients, ['Projeto', 'Cliente', 'Dias em aberto'], (row) => [nameOf(row), clientName(row.client_id), String(daysSince(row.created_at))])),
        card({ title: 'Orçamento de Conexão com Vencimento Próximo', flush: true },
          table(expiring, clients, ['Projeto', 'Cliente', 'Vencimento'], (row) => [nameOf(row), clientName(row.client_id), date(row.access_opinion_expires_at)])),
      ),
    ),
  )
}
