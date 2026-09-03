/** Projetos › Relatórios — extrações em CSV do ciclo de homologação. */
import { h, icon, mount } from '../../ui/dom'
import { pageHead } from '../../ui/components/page'
import { guard } from '../../ui/components/feedback'
import { csvNumber, downloadCsv, toCsv } from '../../core/csv'
import { date, daysSince, isoDay } from '../../core/format'
import { average, daysToMilestone, findAll, hasPendency, median, MILESTONES, nameOf, powerKwp, STAGE_LABEL } from '../../data/projects'
import { findAll as findClients } from '../../data/clients'
import { members, nameOf as memberName } from '../../data/team'

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
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  alert: '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3z"/><line x1="12" x2="12" y1="9" y2="13"/>',
}

const REPORTS: Report[] = [
  {
    id: 'projetos',
    title: 'Projetos',
    description: 'Um projeto por linha — cliente, concessionária, etapa, protocolo e responsável.',
    mark: I.file,
    color: '#60a5fa',
    soft: 'rgba(96,165,250,.14)',
    build: async () => {
      const [projects, clients, team] = await Promise.all([findAll(), findClients(), members()])
      const clientName = (id: string) => clients.find((client) => client.id === id)?.name ?? ''
      return {
        headers: ['Projeto', 'Cliente', 'Concessionária', 'Protocolo', 'Etapa', 'Potência (kWp)', 'Responsável', 'Vínculo', 'Criado em'],
        rows: projects.map((project) => [
          nameOf(project),
          clientName(project.client_id),
          project.utility_company,
          project.protocol ?? '',
          STAGE_LABEL[project.status],
          csvNumber(powerKwp(project)),
          memberName(team, project.responsible_id),
          project.contract_id ? 'Contrato' : 'Avulso',
          date(project.created_at),
        ]),
      }
    },
  },
  {
    id: 'tempo-por-etapa',
    title: 'Tempo por Etapa',
    description: 'Média e mediana de dias até cada marco, entre os projetos que já o atingiram.',
    mark: I.clock,
    color: '#f6a623',
    soft: 'rgba(246,166,35,.14)',
    build: async () => {
      const projects = await findAll()
      return {
        headers: ['Marco', 'Projetos que atingiram', 'Média (dias)', 'Mediana (dias)'],
        rows: MILESTONES.map((milestone) => {
          const values = projects
            .map((project) => daysToMilestone(project, milestone.key))
            .filter((value): value is number => value !== null)
          return [milestone.label, values.length, csvNumber(average(values)), csvNumber(median(values))]
        }),
      }
    },
  },
  {
    id: 'pendencias-e-prazos',
    title: 'Pendências e Prazos',
    description: 'Projetos com pendência aberta e orçamentos de conexão a vencer.',
    mark: I.alert,
    color: '#ef4444',
    soft: 'rgba(239,68,68,.14)',
    build: async () => {
      const [projects, clients] = await Promise.all([findAll(), findClients()])
      const clientName = (id: string) => clients.find((client) => client.id === id)?.name ?? ''
      return {
        headers: ['Projeto', 'Cliente', 'Etapa', 'Pendência', 'Dias em aberto', 'Prazo', 'Orçamento de conexão vence em'],
        rows: projects
          .filter((project) => hasPendency(project) || project.access_opinion_expires_at || project.deadline)
          .map((project) => [
            nameOf(project),
            clientName(project.client_id),
            STAGE_LABEL[project.status],
            hasPendency(project) ? 'Sim' : 'Não',
            daysSince(project.created_at),
            project.deadline ? date(project.deadline) : '',
            project.access_opinion_expires_at ? date(project.access_opinion_expires_at) : '',
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
      downloadCsv(`${report.id}-${isoDay()}`, toCsv(headers, rows))
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
    pageHead({ title: 'Relatórios', crumbs: [{ label: 'Projetos', path: '/projetos/visao-geral' }, { label: 'Relatórios' }] }),
    h('div.grid', { style: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' } }, REPORTS.map(reportCard)),
  )
}
