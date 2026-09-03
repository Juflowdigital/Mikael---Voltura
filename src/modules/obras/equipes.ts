/** Obras › Equipes — alocação por pessoa e presença em campo. */
import { h, mount } from '../../ui/dom'
import { card, gridCols } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { kpiCard, KPI_ICONS } from '../../ui/components/kpi'
import { dataTable, type Column } from '../../ui/components/table'
import { badge } from '../../ui/components/badge'
import { emptyState } from '../../ui/components/feedback'
import { dateTime, initials, orDash } from '../../core/format'
import { navigate } from '../../core/router'
import { assignments, checkins, findAll, RUNNING, STAGE_LABEL, STAGE_TONE } from '../../data/works'
import { members, type Member } from '../../data/team'
import { ROLE_LABEL } from '../../core/session'
import type { FieldCheckin, Work } from '../../core/types'

interface Row {
  member: Member
  activeWorks: Work[]
  roles: string[]
  lastVisit: FieldCheckin | null
  inField: boolean
  currentWork: Work | null
}

function columnsOf(): Column<Row>[] {
  return [
    {
      key: 'name',
      label: 'Pessoa',
      sortable: true,
      value: (row) => row.member.name,
      render: (row) =>
        h(
          'div.row',
          h(
            'div.avatar',
            {
              style: {
                width: '28px',
                height: '28px',
                fontSize: '11px',
                background: row.inField ? 'var(--green-soft)' : 'var(--surface-3)',
                color: row.inField ? 'var(--green)' : 'var(--text-muted)',
              },
            },
            initials(row.member.name),
          ),
          h('div', h('b', row.member.name), h('div.faint', { style: { fontSize: '11.5px' } }, ROLE_LABEL[row.member.role])),
        ),
    },
    {
      key: 'roles',
      label: 'Funções em obra',
      value: (row) => row.roles.join(', '),
      render: (row) =>
        row.roles.length
          ? h('div.row', { style: { gap: '6px', flexWrap: 'wrap' } }, row.roles.map((role) => badge(role, 'blue')))
          : h('span.faint', 'Nenhuma'),
    },
    {
      key: 'works',
      label: 'Obras ativas',
      align: 'right',
      sortable: true,
      value: (row) => row.activeWorks.length,
      render: (row) =>
        row.activeWorks.length
          ? h('div', row.activeWorks.map((work) => h('div', { style: { fontSize: '12.5px' } }, work.name)))
          : h('span.faint', '—'),
    },
    {
      key: 'field',
      label: 'Em campo',
      value: (row) => (row.inField ? 'Sim' : 'Não'),
      render: (row) =>
        row.inField
          ? h(
              'div',
              badge('Em campo', 'green'),
              row.currentWork ? h('div.faint', { style: { fontSize: '11.5px', marginTop: '3px' } }, row.currentWork.name) : null,
            )
          : badge('Fora', 'gray'),
    },
    {
      key: 'lastVisit',
      label: 'Último apontamento',
      sortable: true,
      value: (row) => (row.lastVisit ? row.lastVisit.occurred_at : ''),
      render: (row) =>
        row.lastVisit
          ? h(
              'div',
              h('div', dateTime(row.lastVisit.occurred_at)),
              h('div.faint', { style: { fontSize: '11.5px' } }, row.lastVisit.kind === 'checkin' ? 'Check-in' : 'Check-out'),
            )
          : h('span.faint', 'Sem registro'),
    },
  ]
}

export async function render(host: HTMLElement): Promise<void> {
  const [works, crew, visits, team] = await Promise.all([findAll(), assignments(), checkins(), members()])

  /** Último apontamento de cada pessoa define quem está em campo agora. */
  const lastByUser = new Map<string, FieldCheckin>()
  for (const visit of [...visits].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))) {
    lastByUser.set(visit.user_id, visit)
  }

  const rows: Row[] = team.map((member) => {
    const own = crew.filter((entry) => entry.user_id === member.userId)
    const activeWorks = works.filter((work) => own.some((entry) => entry.work_id === work.id) && RUNNING.includes(work.status))
    const lastVisit = lastByUser.get(member.userId) ?? null
    const inField = lastVisit !== null && lastVisit.kind === 'checkin'
    return {
      member,
      activeWorks,
      roles: [...new Set(own.map((entry) => entry.assignment_role))],
      lastVisit,
      inField,
      currentWork: inField && lastVisit ? works.find((work) => work.id === lastVisit.work_id) ?? null : null,
    }
  })

  const inFieldRows = rows.filter((row) => row.inField)
  const allocated = rows.filter((row) => row.activeWorks.length > 0)
  const unassigned = works.filter((work) => RUNNING.includes(work.status) && !crew.some((entry) => entry.work_id === work.id))

  mount(
    host,
    pageHead({ title: 'Equipes', crumbs: [{ label: 'Obras', path: '/obras/visao-geral' }, { label: 'Equipes' }] }),
    h(
      'div.stack',
      gridCols(
        3,
        kpiCard({ label: 'Pessoas na equipe', value: String(rows.length), mark: KPI_ICONS.users, color: '#a78bfa', soft: 'rgba(167,139,250,.14)' }),
        kpiCard({ label: 'Em campo agora', value: String(inFieldRows.length), hint: 'com check-in aberto', mark: KPI_ICONS.flag, color: '#22c55e', soft: 'rgba(34,197,94,.14)' }),
        kpiCard({ label: 'Alocadas em obra ativa', value: String(allocated.length), mark: KPI_ICONS.building, color: '#f6a623', soft: 'rgba(246,166,35,.14)' }),
      ),
      unassigned.length
        ? card(
            { title: 'Obras em andamento sem equipe alocada', subtitle: unassigned.length + ' obra(s) precisam de equipe', flush: true },
            h(
              'div.table-wrap',
              h(
                'table.data',
                h('thead', h('tr', h('th', 'Obra'), h('th', 'Etapa'), h('th.col-right', 'Ação'))),
                h(
                  'tbody',
                  unassigned.map((work) =>
                    h(
                      'tr',
                      h('td', h('b', work.name), h('div.faint', { style: { fontSize: '11.5px' } }, orDash(work.work_number))),
                      h('td', badge(STAGE_LABEL[work.status], STAGE_TONE[work.status])),
                      h(
                        'td.col-right',
                        h(
                          'button.btn.btn-ghost',
                          { style: { fontSize: '12px', padding: '4px 10px' }, onClick: () => navigate('/obras/gestao-de-obras') },
                          'Alocar equipe',
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          )
        : null,
      card(
        { flush: true },
        rows.length
          ? dataTable({
              columns: columnsOf(),
              rows,
              searchable: true,
              searchPlaceholder: 'Buscar pessoa',
              initialSort: { key: 'name', ascending: true },
              emptyTitle: 'Nenhuma pessoa na equipe',
              totalLabel: (total) => `${total} pessoa(s)`,
            })
          : emptyState({ title: 'Nenhuma pessoa na equipe', hint: 'Convide usuários em Administração › Usuários.' }),
      ),
    ),
  )
}
