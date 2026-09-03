/** Obras › Relatórios — extrações em CSV da execução. */
import { h, icon, mount } from '../../ui/dom'
import { pageHead } from '../../ui/components/page'
import { guard } from '../../ui/components/feedback'
import { csvNumber, downloadCsv, toCsv } from '../../core/csv'
import { date, dateTime, daysSince, isoDay } from '../../core/format'
import { addressOf, assignments, checkins, checklist, findAll, isLate, progressOf, STAGE_LABEL } from '../../data/works'
import { findAll as findClients } from '../../data/clients'
import { members, nameOf } from '../../data/team'
import type { WorkStatus } from '../../core/types'

interface Report {
  id: string
  title: string
  description: string
  mark: string
  color: string
  soft: string
  build: () => Promise<{ headers: string[]; rows: unknown[][] }>
}

const I = {
  building: '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/>',
  check: '<path d="M21.8 10A10 10 0 1 1 17 3.3"/><path d="m9 11 3 3L22 4"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>',
  alert: '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3z"/><line x1="12" x2="12" y1="9" y2="13"/>',
}

const REPORTS: Report[] = [
  {
    id: 'obras',
    title: 'Obras',
    description: 'Uma obra por linha — etapa, potência, prazos, progresso e atraso.',
    mark: I.building,
    color: '#f6a623',
    soft: 'rgba(246,166,35,.14)',
    build: async () => {
      const [works, tasks, clients] = await Promise.all([findAll(), checklist(), findClients()])
      const clientName = (id: string) => clients.find((client) => client.id === id)?.name ?? ''
      return {
        headers: ['Número', 'Obra', 'Cliente', 'Etapa', 'Endereço', 'Potência (kWp)', 'Início previsto', 'Fim previsto', 'Início real', 'Fim real', 'Progresso (%)', 'Atrasada'],
        rows: works.map((work) => [
          work.work_number,
          work.name,
          clientName(work.client_id),
          STAGE_LABEL[work.status],
          addressOf(work),
          csvNumber(work.system_power_kwp),
          work.planned_start ? date(work.planned_start) : '',
          work.planned_end ? date(work.planned_end) : '',
          work.actual_start ? date(work.actual_start) : '',
          work.actual_end ? date(work.actual_end) : '',
          csvNumber(progressOf(tasks.filter((task) => task.work_id === work.id))),
          isLate(work) ? 'Sim' : 'Não',
        ]),
      }
    },
  },
  {
    id: 'checklist-de-execucao',
    title: 'Checklist de Execução',
    description: 'Cada item do checklist com etapa, situação e quem concluiu.',
    mark: I.check,
    color: '#22c55e',
    soft: 'rgba(34,197,94,.14)',
    build: async () => {
      const [works, tasks, team] = await Promise.all([findAll(), checklist(), members()])
      const workName = (id: string) => works.find((work) => work.id === id)?.name ?? ''
      return {
        headers: ['Obra', 'Etapa', 'Item', 'Concluído', 'Concluído por', 'Concluído em'],
        rows: tasks.map((task) => [
          workName(task.work_id),
          STAGE_LABEL[task.stage as WorkStatus] ?? task.stage,
          task.title,
          task.completed ? 'Sim' : 'Não',
          task.completed_by ? nameOf(team, task.completed_by) : '',
          task.completed_at ? date(task.completed_at) : '',
        ]),
      }
    },
  },
  {
    id: 'alocacao-de-equipe',
    title: 'Alocação de Equipe',
    description: 'Quem está alocado em cada obra e com qual função.',
    mark: I.users,
    color: '#a78bfa',
    soft: 'rgba(167,139,250,.14)',
    build: async () => {
      const [works, crew, team] = await Promise.all([findAll(), assignments(), members()])
      const workName = (id: string) => works.find((work) => work.id === id)?.name ?? ''
      const workStage = (id: string) => {
        const work = works.find((entry) => entry.id === id)
        return work ? STAGE_LABEL[work.status] : ''
      }
      return {
        headers: ['Obra', 'Etapa', 'Pessoa', 'Função', 'Início', 'Fim'],
        rows: crew.map((entry) => [
          workName(entry.work_id),
          workStage(entry.work_id),
          nameOf(team, entry.user_id),
          entry.assignment_role,
          entry.starts_at ? date(entry.starts_at) : '',
          entry.ends_at ? date(entry.ends_at) : '',
        ]),
      }
    },
  },
  {
    id: 'apontamentos-de-campo',
    title: 'Apontamentos de Campo',
    description: 'Check-ins e check-outs com data, hora e coordenadas.',
    mark: I.users,
    color: '#38bdf8',
    soft: 'rgba(56,189,248,.14)',
    build: async () => {
      const [works, visits, team] = await Promise.all([findAll(), checkins(), members()])
      const workName = (id: string) => works.find((work) => work.id === id)?.name ?? ''
      return {
        headers: ['Quando', 'Pessoa', 'Obra', 'Tipo', 'Latitude', 'Longitude'],
        rows: visits.map((visit) => [
          dateTime(visit.occurred_at),
          nameOf(team, visit.user_id),
          workName(visit.work_id),
          visit.kind === 'checkin' ? 'Check-in' : 'Check-out',
          csvNumber(visit.latitude),
          csvNumber(visit.longitude),
        ]),
      }
    },
  },
  {
    id: 'obras-atrasadas',
    title: 'Obras Atrasadas',
    description: 'Obras que passaram do fim previsto e ainda não foram concluídas.',
    mark: I.alert,
    color: '#ef4444',
    soft: 'rgba(239,68,68,.14)',
    build: async () => {
      const [works, tasks, clients] = await Promise.all([findAll(), checklist(), findClients()])
      const clientName = (id: string) => clients.find((client) => client.id === id)?.name ?? ''
      return {
        headers: ['Obra', 'Cliente', 'Etapa', 'Fim previsto', 'Dias de atraso', 'Progresso (%)'],
        rows: works.filter(isLate).map((work) => [
          work.name,
          clientName(work.client_id),
          STAGE_LABEL[work.status],
          date(work.planned_end),
          daysSince(work.planned_end),
          csvNumber(progressOf(tasks.filter((task) => task.work_id === work.id))),
        ]),
      }
    },
  },
]

function reportCard(report: Report): HTMLElement {
  const button = h('button.btn.btn-primary', { style: { marginTop: '14px' } }, 'Gerar CSV') as HTMLButtonElement

  button.addEventListener('click', async () => {
    button.disabled = true
    button.textContent = 'Gerando…'
    await guard(async () => {
      const { headers, rows } = await report.build()
      downloadCsv(report.id + '-' + isoDay(), toCsv(headers, rows))
    }, 'Relatório gerado. O download começou.')
    button.disabled = false
    button.textContent = 'Gerar CSV'
  })

  return h(
    'article.card',
    { style: { padding: '20px' } },
    h('div.kpi-icon', { style: { background: report.soft, color: report.color, width: '38px', height: '38px' } }, icon(report.mark, 17)),
    h('div', { style: { fontSize: '15px', fontWeight: '650', marginTop: '14px' } }, report.title),
    h('div.muted', { style: { fontSize: '12.5px', marginTop: '6px', lineHeight: '1.55' } }, report.description),
    button,
  )
}

export function render(host: HTMLElement): void {
  mount(
    host,
    pageHead({ title: 'Relatórios', crumbs: [{ label: 'Obras', path: '/obras/visao-geral' }, { label: 'Relatórios' }] }),
    h('div.grid', { style: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' } }, REPORTS.map(reportCard)),
  )
}
