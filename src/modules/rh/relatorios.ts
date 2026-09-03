/** Recursos Humanos › Relatórios. */
import { renderReports, REPORT_ICONS, type ReportDef } from '../../ui/components/reports'
import { csvNumber } from '../../core/csv'
import { date } from '../../core/format'
import { ROLE_LABEL } from '../../core/session'
import { team } from '../../data/organization'
import { goals } from '../../data/sales'
import { findAll as findLeads } from '../../data/leads'
import { assignments, checkins, findAll as findWorks, RUNNING, STAGE_LABEL } from '../../data/works'
import { members, nameOf } from '../../data/team'

const REPORTS: ReportDef[] = [
  {
    id: 'colaboradores',
    title: 'Colaboradores',
    description: 'Equipe com perfil de acesso, situação e obras ativas.',
    mark: REPORT_ICONS.users,
    color: '#c084fc',
    soft: 'rgba(192,132,252,.14)',
    build: async () => {
      const [people, crew, works] = await Promise.all([team(), assignments(), findWorks()])
      return {
        headers: ['Colaborador', 'Perfil', 'Acesso', 'Obras ativas', 'Funções em obra'],
        rows: people.map((member) => {
          const own = crew.filter((entry) => entry.user_id === member.userId)
          const active = works.filter((work) => RUNNING.includes(work.status) && own.some((entry) => entry.work_id === work.id))
          return [
            member.name,
            ROLE_LABEL[member.role],
            member.active ? 'Ativo' : 'Inativo',
            active.map((work) => work.name).join(' | '),
            [...new Set(own.map((entry) => entry.assignment_role))].join(' | '),
          ]
        }),
      }
    },
  },
  {
    id: 'metas',
    title: 'Metas e Atingimento',
    description: 'Meta mensal por vendedor contra o realizado em leads ganhos.',
    mark: REPORT_ICONS.trophy,
    color: '#f6a623',
    soft: 'rgba(246,166,35,.14)',
    build: async () => {
      const [rows, people, leads] = await Promise.all([goals(), members(), findLeads()])
      return {
        headers: ['Colaborador', 'Mês', 'Meta de receita (R$)', 'Realizado (R$)', 'Atingimento (%)', 'Meta de potência (kWp)'],
        rows: rows.map((goal) => {
          const realized = leads
            .filter(
              (lead) =>
                lead.stage === 'won' &&
                lead.assigned_to === goal.user_id &&
                lead.created_at.slice(0, 7) === goal.reference_month.slice(0, 7),
            )
            .reduce((sum, lead) => sum + Number(lead.estimated_value ?? 0), 0)
          const target = Number(goal.target_revenue ?? 0)
          return [
            nameOf(people, goal.user_id),
            goal.reference_month.slice(0, 7),
            csvNumber(target),
            csvNumber(realized),
            csvNumber(target > 0 ? (realized / target) * 100 : 0),
            csvNumber(goal.target_kwp),
          ]
        }),
      }
    },
  },
  {
    id: 'presenca-em-campo',
    title: 'Presença em Campo',
    description: 'Check-ins e check-outs por pessoa, com obra e coordenadas.',
    mark: REPORT_ICONS.chart,
    color: '#38bdf8',
    soft: 'rgba(56,189,248,.14)',
    build: async () => {
      const [visits, works, people] = await Promise.all([checkins(), findWorks(), members()])
      const workName = (id: string) => works.find((work) => work.id === id)?.name ?? ''
      const workStage = (id: string) => {
        const work = works.find((entry) => entry.id === id)
        return work ? STAGE_LABEL[work.status] : ''
      }
      return {
        headers: ['Quando', 'Pessoa', 'Obra', 'Etapa da obra', 'Tipo', 'Latitude', 'Longitude'],
        rows: visits.map((visit) => [
          date(visit.occurred_at),
          nameOf(people, visit.user_id),
          workName(visit.work_id),
          workStage(visit.work_id),
          visit.kind === 'checkin' ? 'Check-in' : 'Check-out',
          csvNumber(visit.latitude),
          csvNumber(visit.longitude),
        ]),
      }
    },
  },
]

export function render(host: HTMLElement): void {
  renderReports(host, [{ label: 'Recursos Humanos' }, { label: 'Relatórios' }], REPORTS)
}
