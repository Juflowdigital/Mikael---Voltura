/** Comercial › Visão Geral — indicadores, filtros e painéis (tela M5). */
import { h, mount } from '../../ui/dom'
import { card, gridCols, gridTemplate } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { kpiCard, KPI_ICONS } from '../../ui/components/kpi'
import { badge } from '../../ui/components/badge'
import { lineChart } from '../../ui/components/chart'
import { emptyState } from '../../ui/components/feedback'
import { selectField } from '../../ui/components/form'
import { money, percent, power } from '../../core/format'
import { navigate, setQuery, type RouteContext } from '../../core/router'
import { clientName, dailySeries, findAll as findProposals, powerKwp, PROPOSAL_LABEL, PROPOSAL_TONE } from '../../data/proposals'
import { findAll as findLeads } from '../../data/leads'
import { members, type Member } from '../../data/team'
import type { Lead, Proposal } from '../../core/types'

const PERIODS = [
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '90', label: 'Últimos 90 dias' },
]

function withinPeriod(iso: string, days: number): boolean {
  const limit = Date.now() - days * 86400000
  return new Date(iso).getTime() >= limit
}

interface SellerRow {
  name: string
  sales: number
  total: number
  conversion: number
}

function ranking(leads: Lead[], team: Member[]): SellerRow[] {
  return team
    .map((member) => {
      const own = leads.filter((lead) => lead.assigned_to === member.userId)
      const won = own.filter((lead) => lead.stage === 'won')
      return {
        name: member.name,
        sales: won.length,
        total: won.reduce((sum, lead) => sum + (lead.estimated_value ?? 0), 0),
        conversion: own.length ? (won.length / own.length) * 100 : 0,
      }
    })
    .filter((row) => row.sales > 0 || row.total > 0)
    .sort((a, b) => b.total - a.total)
}

function proposalsTable(proposals: Proposal[]): HTMLElement {
  if (!proposals.length) return emptyState({ title: 'Nenhuma proposta encontrada' })
  return h(
    'div.table-wrap',
    h(
      'table.data',
      h('thead', h('tr', h('th', 'Nome'), h('th', 'Potência'), h('th.col-right', 'Valor'), h('th', 'Status'))),
      h(
        'tbody',
        proposals.slice(0, 6).map((proposal) =>
          h(
            'tr',
            h('td', h('b', clientName(proposal)), h('div.faint', { style: { fontSize: '11.5px' } }, '#' + proposal.proposal_number)),
            h('td', power(powerKwp(proposal))),
            h('td.col-right', money(proposal.total_value)),
            h('td', badge(PROPOSAL_LABEL[proposal.status], PROPOSAL_TONE[proposal.status])),
          ),
        ),
      ),
    ),
  )
}

function sellersTable(rows: SellerRow[]): HTMLElement {
  if (!rows.length) return emptyState({ title: 'Nenhuma venda encontrada' })
  return h(
    'div.table-wrap',
    h(
      'table.data',
      h('thead', h('tr', h('th', '#'), h('th', 'Vendedor'), h('th.col-right', 'Vendas'), h('th.col-right', 'Valor total'), h('th.col-right', 'Taxa conversão'))),
      h(
        'tbody',
        rows.map((row, index) =>
          h(
            'tr',
            h('td', String(index + 1)),
            h('td', h('b', row.name)),
            h('td.col-right', String(row.sales)),
            h('td.col-right', money(row.total)),
            h('td.col-right', percent(row.conversion)),
          ),
        ),
      ),
    ),
  )
}

export async function render(host: HTMLElement, ctx: RouteContext): Promise<void> {
  const [proposals, leads, team] = await Promise.all([findProposals(), findLeads(), members()])

  const days = Number(ctx.query.get('periodo') ?? '30')
  const seller = ctx.query.get('vendedor') ?? ''

  const scopedLeads = leads.filter(
    (lead) => withinPeriod(lead.created_at, days) && (!seller || lead.assigned_to === seller),
  )
  const scopedProposals = proposals.filter((proposal) => withinPeriod(proposal.created_at, days))

  const open = scopedLeads.filter((lead) => lead.stage !== 'won' && lead.stage !== 'lost')
  const won = scopedLeads.filter((lead) => lead.stage === 'won')
  const openValue = open.reduce((sum, lead) => sum + (lead.estimated_value ?? 0), 0)
  const wonValue = won.reduce((sum, lead) => sum + (lead.estimated_value ?? 0), 0)
  const conversion = scopedLeads.length ? (won.length / scopedLeads.length) * 100 : 0

  const accepted = scopedProposals.filter((proposal) => proposal.status === 'accepted')
  const negotiating = scopedProposals.filter((proposal) => proposal.status !== 'accepted' && proposal.status !== 'rejected')

  mount(
    host,
    pageHead({
      title: 'Comercial',
      crumbs: [{ label: 'Comercial' }, { label: 'Visão Geral' }],
      actions: [
        h('button.btn.btn-primary', { onClick: () => navigate('/comercial/negociacoes') }, '+ Nova negociação'),
        h('button.btn', { onClick: () => navigate('/comercial/clientes') }, 'Novo cliente'),
        h('button.btn', { onClick: () => navigate('/producao/produtos') }, 'Novo produto'),
      ],
    }),
    h(
      'div.stack',
      gridCols(
        4,
        kpiCard({ label: 'Total em negociação', value: money(openValue), hint: `${open.length} oportunidade(s)`, mark: KPI_ICONS.money, color: '#38bdf8', soft: 'rgba(56,189,248,.14)' }),
        kpiCard({ label: 'Negociações aceitas', value: money(wonValue), hint: `${won.length} fechada(s)`, mark: KPI_ICONS.check, color: '#22c55e', soft: 'rgba(34,197,94,.14)' }),
        kpiCard({ label: 'Taxa de conversão', value: percent(conversion), hint: 'ganhos sobre o total do período', mark: KPI_ICONS.chart, color: '#a78bfa', soft: 'rgba(167,139,250,.14)' }),
        kpiCard({ label: 'Negociações em andamento', value: String(negotiating.length), hint: 'propostas ainda abertas', mark: KPI_ICONS.file, color: '#f6a623', soft: 'rgba(246,166,35,.14)' }),
      ),
      h(
        'div.filter-bar',
        selectField({
          label: 'Vendedor',
          value: seller,
          placeholder: 'Todos',
          options: team.map((member) => ({ value: member.userId, label: member.name })),
          onChange: (value) => setQuery({ vendedor: value || null }),
        }),
        selectField({
          label: 'Período',
          value: String(days),
          options: PERIODS,
          onChange: (value) => setQuery({ periodo: value }),
        }),
        h(
          'button.btn.btn-ghost',
          { style: { alignSelf: 'flex-end' }, onClick: () => setQuery({ vendedor: null, periodo: null }) },
          'Limpar filtros',
        ),
      ),
      gridTemplate(
        '1fr 1fr',
        card({ title: 'Últimas propostas', footerLink: { label: 'Ver todas', path: '/comercial/negociacoes' }, flush: true }, proposalsTable(scopedProposals)),
        card({ title: 'Vendas por vendedor', footerLink: { label: 'Ver ranking completo', path: '/comercial/relatorios' }, flush: true }, sellersTable(ranking(scopedLeads, team))),
      ),
      gridTemplate(
        '1.6fr 1fr',
        card(
          { title: 'Produtividade no período', subtitle: `Valor de propostas criadas nos últimos ${days} dias` },
          h(
            'div.row',
            { style: { gap: '28px', marginBottom: '6px' } },
            h('div', h('div.field-label', 'Total em negociação'), h('div', { style: { fontSize: '19px', fontWeight: '700', color: 'var(--blue)' } }, money(openValue))),
            h('div', h('div.field-label', 'Negociações aceitas'), h('div', { style: { fontSize: '19px', fontWeight: '700', color: 'var(--green)' } }, money(wonValue))),
          ),
          lineChart({
            series: [
              { name: 'Em negociação', color: '#38bdf8', points: dailySeries(negotiating, Math.min(days, 30)) },
              { name: 'Aceitas', color: '#22c55e', points: dailySeries(accepted, Math.min(days, 30)) },
            ],
          }),
        ),
        card(
          { title: 'Tarefas e agenda', footerLink: { label: 'Ver agenda', path: '/comercial/funil-de-vendas' } },
          emptyState({ title: 'Nenhuma tarefa pendente', hint: 'Próximas ações dos leads aparecem aqui.' }),
        ),
      ),
    ),
  )
}
