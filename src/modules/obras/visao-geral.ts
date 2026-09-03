/** Obras › Visão Geral — andamento, atrasos e equipes em campo. */
import { h, mount } from '../../ui/dom'
import { card, gridCols, gridTemplate } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { kpiCard, KPI_ICONS } from '../../ui/components/kpi'
import { stackedBar } from '../../ui/components/chart'
import { badge } from '../../ui/components/badge'
import { emptyState } from '../../ui/components/feedback'
import { date, daysSince, percent, power } from '../../core/format'
import { navigate } from '../../core/router'
import { addressOf, checkins, checklist, findAll, isLate, progressOf, RUNNING, STAGE_LABEL, STAGE_TONE, STAGES } from '../../data/works'
import { findAll as findClients } from '../../data/clients'
import { members, nameOf } from '../../data/team'
import type { Child } from '../../ui/dom'

function miniTable(headers: string[], rows: Child[][]): HTMLElement {
  if (!rows.length) return emptyState({ title: 'Nada por aqui' })
  return h(
    'div.table-wrap',
    h(
      'table.data',
      h('thead', h('tr', headers.map((label, index) => h(index >= headers.length - 1 ? 'th.col-right' : 'th', label)))),
      h('tbody', rows.map((cells) => h('tr', cells.map((cell, index) => h(index >= headers.length - 1 ? 'td.col-right' : 'td', cell))))),
    ),
  )
}

export async function render(host: HTMLElement): Promise<void> {
  const [works, tasks, visits, clients, team] = await Promise.all([
    findAll(),
    checklist(),
    checkins(),
    findClients(),
    members(),
  ])
  const clientName = (id: string) => clients.find((client) => client.id === id)?.name ?? '—'
  const tasksOf = (workId: string) => tasks.filter((task) => task.work_id === workId)

  const running = works.filter((work) => RUNNING.includes(work.status))
  const awaiting = works.filter((work) => work.status === 'delivery')
  const month = new Date().toISOString().slice(0, 7)
  const finishedThisMonth = works.filter((work) => work.status === 'completed' && (work.actual_end ?? '').slice(0, 7) === month)
  const late = works.filter(isLate)

  /* Quem entrou em campo e ainda nao saiu. */
  const lastByUser = new Map<string, (typeof visits)[number]>()
  for (const visit of [...visits].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))) {
    lastByUser.set(visit.user_id, visit)
  }
  const inField = [...lastByUser.values()].filter((visit) => visit.kind === 'checkin')

  const byStatus = STAGES.filter((stage) => stage.id !== 'cancelled').map((stage) => ({
    label: stage.label,
    value: works.filter((work) => work.status === stage.id).length,
  }))

  mount(
    host,
    pageHead({ title: 'Obras', crumbs: [{ label: 'Obras' }, { label: 'Visão Geral' }] }),
    h(
      'div.stack',
      gridCols(
        4,
        kpiCard({ label: 'Obras em andamento', value: String(running.length), mark: KPI_ICONS.building, color: '#f6a623', soft: 'rgba(246,166,35,.14)', onClick: () => navigate('/obras/gestao-de-obras') }),
        kpiCard({ label: 'Aguardando vistoria', value: String(awaiting.length), mark: KPI_ICONS.clock, color: '#38bdf8', soft: 'rgba(56,189,248,.14)', onClick: () => navigate('/obras/gestao-de-obras', { etapa: 'delivery' }) }),
        kpiCard({ label: 'Concluídas no mês', value: String(finishedThisMonth.length), mark: KPI_ICONS.check, color: '#22c55e', soft: 'rgba(34,197,94,.14)' }),
        kpiCard({ label: 'Equipes em campo', value: String(inField.length), hint: inField.length ? 'com check-in aberto' : 'ninguém em campo agora', mark: KPI_ICONS.users, color: '#a78bfa', soft: 'rgba(167,139,250,.14)', onClick: () => navigate('/obras/equipes') }),
      ),
      card({ title: 'Obras por status', mark: h('span', { style: { color: 'var(--accent)' } }, '▦') }, stackedBar(byStatus)),
      gridTemplate(
        '1fr 1fr',
        card(
          { title: 'Obras em andamento', footerLink: { label: 'Ver todas', path: '/obras/gestao-de-obras' }, flush: true },
          miniTable(
            ['Obra', 'Cliente', 'Progresso'],
            running.slice(0, 6).map((work) => [
              h('div', h('b', work.name), h('div.faint', { style: { fontSize: '11.5px' } }, work.work_number + ' · ' + STAGE_LABEL[work.status])),
              clientName(work.client_id),
              percent(progressOf(tasksOf(work.id)), 0),
            ]),
          ),
        ),
        card(
          { title: 'Obras atrasadas', subtitle: late.length ? late.length + ' obra(s) passaram do prazo previsto' : undefined, flush: true },
          miniTable(
            ['Obra', 'Fim previsto', 'Dias de atraso'],
            late.slice(0, 6).map((work) => [
              h('div', h('b', work.name), h('div.faint', { style: { fontSize: '11.5px' } }, clientName(work.client_id))),
              date(work.planned_end),
              h('b', { style: { color: 'var(--red)' } }, String(daysSince(work.planned_end))),
            ]),
          ),
        ),
      ),
      gridTemplate(
        '1fr 1fr',
        card(
          { title: 'Aguardando vistoria', footerLink: { label: 'Ver todas', path: '/obras/gestao-de-obras' }, flush: true },
          miniTable(
            ['Obra', 'Cliente', 'Potência'],
            awaiting.slice(0, 6).map((work) => [
              h('div', h('b', work.name), h('div.faint', { style: { fontSize: '11.5px' } }, addressOf(work))),
              clientName(work.client_id),
              power(work.system_power_kwp),
            ]),
          ),
        ),
        card(
          { title: 'Equipes em campo agora', footerLink: { label: 'Ver equipes', path: '/obras/equipes' }, flush: true },
          miniTable(
            ['Pessoa', 'Obra', 'Check-in'],
            inField.slice(0, 6).map((visit) => {
              const work = works.find((entry) => entry.id === visit.work_id)
              return [
                h('b', nameOf(team, visit.user_id)),
                work ? work.name : '—',
                h('div.row', { style: { justifyContent: 'flex-end' } }, badge(date(visit.occurred_at), STAGE_TONE[work?.status ?? 'planning'])),
              ]
            }),
          ),
        ),
      ),
    ),
  )
}
