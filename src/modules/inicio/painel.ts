/** Painel inicial — equivalente ao dashboard raiz do padrao ASTER (tela M1). */
import { h, mount } from '../../ui/dom'
import { card, gridCols, gridTemplate } from '../../ui/components/card'
import { kpiCard, kpiSoon, KPI_ICONS } from '../../ui/components/kpi'
import { stackedBar, type Series } from '../../ui/components/chart'
import { emptyState } from '../../ui/components/feedback'
import { badge } from '../../ui/components/badge'
import { greeting, longDate, daysSince } from '../../core/format'
import { app } from '../../core/session'
import { navigate } from '../../core/router'
import { list } from '../../data/db'
import type { Contract, Homologation, Work } from '../../core/types'

interface Ticket {
  id: string
  title: string
  status: string
  resolved_at: string | null
  created_at: string
}

const IN_PROGRESS: Work['status'][] = ['separation', 'mobilization', 'installation', 'commissioning']

function isToday(value: string | null): boolean {
  if (!value) return false
  return value.slice(0, 10) === new Date().toISOString().slice(0, 10)
}

function worksByStatus(works: Work[]): Series[] {
  const running = works.filter((work) => IN_PROGRESS.includes(work.status))
  return [
    { label: 'Prontas para iniciar', value: works.filter((w) => w.status === 'planning').length, color: '#8ba0b8' },
    { label: 'Em andamento', value: running.length, color: '#38bdf8' },
    { label: 'Execução hoje', value: running.filter((w) => isToday(w.actual_start) || isToday(w.planned_start)).length, color: '#f6a623' },
    { label: 'Aguardando vistoria', value: works.filter((w) => w.status === 'delivery').length, color: '#2dd4bf' },
    { label: 'Concluídas', value: works.filter((w) => w.status === 'completed').length, color: '#22c55e' },
  ]
}

interface Pending {
  label: string
  detail: string
  path: string
  tone: 'amber' | 'red' | 'blue'
}

function buildPendings(works: Work[], contracts: Contract[], tickets: Ticket[], homologations: Homologation[]): Pending[] {
  const pendings: Pending[] = []

  const awaitingInspection = works.filter((work) => work.status === 'delivery').length
  if (awaitingInspection) {
    pendings.push({
      label: `${awaitingInspection} obra(s) aguardando vistoria`,
      detail: 'Agende a vistoria para liberar a entrega técnica.',
      path: '/obras/gestao-de-obras',
      tone: 'amber',
    })
  }

  const toIssue = contracts.filter((contract) => contract.status === 'draft').length
  if (toIssue) {
    pendings.push({
      label: `${toIssue} contrato(s) a emitir`,
      detail: 'Contratos em rascunho ainda não enviados ao cliente.',
      path: '/contratos/gestao-de-contratos',
      tone: 'blue',
    })
  }

  const openTickets = tickets.filter((ticket) => !ticket.resolved_at)
  const late = openTickets.filter((ticket) => daysSince(ticket.created_at) > 3).length
  if (late) {
    pendings.push({
      label: `${late} chamado(s) abertos há mais de 3 dias`,
      detail: 'Pós-vendas com atendimento pendente.',
      path: '/pos-vendas/chamados',
      tone: 'red',
    })
  }

  const expiring = homologations.filter((item) => {
    if (!item.access_opinion_expires_at) return false
    const days = (new Date(item.access_opinion_expires_at).getTime() - Date.now()) / 86400000
    return days >= 0 && days <= 30
  }).length
  if (expiring) {
    pendings.push({
      label: `${expiring} orçamento(s) de conexão vencendo em 30 dias`,
      detail: 'Renove antes do vencimento para não refazer o processo.',
      path: '/projetos/gestao-de-projetos',
      tone: 'amber',
    })
  }

  return pendings
}

function pendingPanel(pendings: Pending[]): HTMLElement {
  return card(
    {
      title: 'O que precisa de você agora',
      mark: h('span', { style: { color: 'var(--accent)' } }, '✦'),
      tools: [
        badge(pendings.length ? `${pendings.length} pendência(s)` : 'Tudo em dia', pendings.length ? 'amber' : 'green'),
      ],
    },
    pendings.length
      ? h(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: '9px' } },
          pendings.map((pending) =>
            h(
              'div.row',
              {
                style: {
                  gap: '12px',
                  padding: '11px 14px',
                  borderRadius: '10px',
                  background: 'var(--surface-2)',
                  cursor: 'pointer',
                },
                onClick: () => navigate(pending.path),
              },
              badge('•', pending.tone),
              h(
                'div',
                { style: { flex: '1', minWidth: '0' } },
                h('div', { style: { fontSize: '13px', fontWeight: '600' } }, pending.label),
                h('div.faint', { style: { fontSize: '12px' } }, pending.detail),
              ),
              h('span', { style: { color: 'var(--accent)', fontSize: '12.5px', fontWeight: '650' } }, 'Abrir →'),
            ),
          ),
        )
      : h(
          'div.muted',
          { style: { fontSize: '13px', padding: '6px 0 2px' } },
          'Nenhuma pendência crítica no momento. Obras, contratos, chamados e prazos de conexão estão em dia.',
        ),
  )
}

export async function render(host: HTMLElement, _ctx: unknown): Promise<void> {
  void _ctx
  const state = app.get()
  const firstName = (state.user?.name ?? '').split(/\s+/)[0] || 'você'

  const [works, contracts, tickets, homologations] = await Promise.all([
    list<Work>('works', { select: 'id,status,planned_start,actual_start,created_at' }),
    list<Contract>('contracts', { select: 'id,status,total_value,created_at' }),
    list<Ticket>('service_tickets', { select: 'id,title,status,resolved_at,created_at' }),
    list<Homologation>('homologations', { select: 'id,status,access_opinion_expires_at,deadline' }),
  ])

  const running = works.filter((work) => IN_PROGRESS.includes(work.status)).length
  const openTickets = tickets.filter((ticket) => !ticket.resolved_at).length
  const resolvedThisMonth = tickets.filter(
    (ticket) => ticket.resolved_at && ticket.resolved_at.slice(0, 7) === new Date().toISOString().slice(0, 7),
  ).length

  mount(
    host,
    h(
      'header.page-head',
      h(
        'div',
        h('h1.page-title', `${greeting()}, ${firstName.toUpperCase()}.`),
        h('div.muted', { style: { fontSize: '13px', marginTop: '4px' } }, longDate()),
      ),
      h(
        'div.page-head-actions',
        h('button.btn.btn-ghost', { onClick: () => navigate('/administracao/configuracoes-gerais') }, '⚙ Personalizar'),
      ),
    ),
    h(
      'div.stack',
      pendingPanel(buildPendings(works, contracts, tickets, homologations)),
      gridCols(
        4,
        kpiCard({
          label: 'OBRAS EM ANDAMENTO',
          value: String(running),
          mark: KPI_ICONS.building,
          color: '#f6a623',
          soft: 'rgba(246,166,35,.14)',
          onClick: () => navigate('/obras/gestao-de-obras'),
        }),
        kpiSoon('ENTREGAS NA SEMANA', KPI_ICONS.calendar, '#38bdf8', 'rgba(56,189,248,.14)'),
        kpiSoon('EQUIPES EM CAMPO', KPI_ICONS.users, '#a78bfa', 'rgba(167,139,250,.14)'),
        kpiCard({
          label: 'CHAMADOS ABERTOS',
          value: String(openTickets),
          hint: `${resolvedThisMonth} resolvidos no mês`,
          mark: KPI_ICONS.alert,
          color: '#2dd4bf',
          soft: 'rgba(45,212,191,.14)',
          onClick: () => navigate('/pos-vendas/chamados'),
        }),
      ),
      card({ title: 'Obras por status', mark: h('span', { style: { color: 'var(--accent)' } }, '▦') }, stackedBar(worksByStatus(works))),
      gridTemplate(
        '1fr 1fr',
        card(
          { title: 'Tarefas e agenda', footerLink: { label: 'Ver agenda', path: '/obras/gestao-de-obras' } },
          emptyState({ title: 'Nenhuma tarefa pendente', hint: 'Tarefas atribuídas a você aparecem aqui.' }),
        ),
        card(
          { title: 'Contratos vigentes', footerLink: { label: 'Ver todos', path: '/contratos/gestao-de-contratos' } },
          h(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
            h('div.row', h('span.muted', { style: { flex: '1', fontSize: '13px' } }, 'Assinados'), h('b', String(contracts.filter((c) => c.status === 'signed').length))),
            h('div.row', h('span.muted', { style: { flex: '1', fontSize: '13px' } }, 'Aguardando assinatura'), h('b', String(contracts.filter((c) => c.status === 'sent' || c.status === 'partially_signed').length))),
            h('div.row', h('span.muted', { style: { flex: '1', fontSize: '13px' } }, 'Em rascunho'), h('b', String(contracts.filter((c) => c.status === 'draft').length))),
          ),
        ),
      ),
    ),
  )
}
