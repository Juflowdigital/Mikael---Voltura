/** Recursos Humanos › Colaboradores — equipe, perfis e alocação. */
import { h, mount } from '../../ui/dom'
import { card, gridCols } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { kpiCard, KPI_ICONS } from '../../ui/components/kpi'
import { dataTable, type Column } from '../../ui/components/table'
import { badge } from '../../ui/components/badge'
import { guard } from '../../ui/components/feedback'
import { initials } from '../../core/format'
import { navigate } from '../../core/router'
import { app, ROLE_LABEL } from '../../core/session'
import { setMemberActive, team, type TeamRow } from '../../data/organization'
import { assignments, findAll as findWorks, RUNNING } from '../../data/works'
import type { Role, Work } from '../../core/types'

interface Row extends TeamRow {
  activeWorks: Work[]
}

export async function render(host: HTMLElement): Promise<void> {
  async function draw(): Promise<void> {
    const [people, crew, works] = await Promise.all([team(), assignments(), findWorks()])
    const currentUserId = app.get().user?.id

    const rows: Row[] = people.map((member) => ({
      ...member,
      activeWorks: works.filter(
        (work) => RUNNING.includes(work.status) && crew.some((entry) => entry.work_id === work.id && entry.user_id === member.userId),
      ),
    }))

    const active = rows.filter((row) => row.active)
    const byRole = [...new Set(active.map((row) => row.role))] as Role[]

    const columns: Column<Row>[] = [
      {
        key: 'name',
        label: 'Colaborador',
        sortable: true,
        render: (row) =>
          h(
            'div.row',
            h(
              'div.avatar',
              { style: { width: '30px', height: '30px', fontSize: '11.5px', background: 'var(--purple-soft)', color: 'var(--purple)' } },
              initials(row.name),
            ),
            h(
              'div',
              h('div.row', h('b', row.name), row.userId === currentUserId ? h('span.faint', { style: { fontSize: '11px' } }, '(você)') : null),
              h('div.faint', { style: { fontSize: '11.5px' } }, ROLE_LABEL[row.role]),
            ),
          ),
      },
      {
        key: 'role',
        label: 'Perfil de acesso',
        sortable: true,
        value: (row) => ROLE_LABEL[row.role],
        render: (row) => badge(ROLE_LABEL[row.role], row.role === 'admin' ? 'amber' : 'blue'),
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
        key: 'active',
        label: 'Acesso',
        value: (row) => (row.active ? 'Ativo' : 'Inativo'),
        render: (row) => badge(row.active ? 'Ativo' : 'Inativo', row.active ? 'green' : 'gray'),
      },
      {
        key: 'actions',
        label: 'Ações',
        align: 'right',
        width: '190px',
        render: (row) =>
          h(
            'div.row',
            { style: { justifyContent: 'flex-end', gap: '6px' } },
            row.userId === currentUserId
              ? h('span.faint', { style: { fontSize: '12px' } }, '—')
              : h(
                  'button.btn.btn-ghost',
                  {
                    style: { fontSize: '12px', padding: '4px 10px' },
                    onClick: () => {
                      void guard(async () => {
                        await setMemberActive(row.userId, !row.active)
                        await draw()
                      }, row.active ? 'Acesso desativado.' : 'Acesso reativado.')
                    },
                  },
                  row.active ? 'Desativar' : 'Reativar',
                ),
            h('button.btn.btn-ghost', { style: { fontSize: '12px', padding: '4px 10px' }, onClick: () => navigate('/administracao/usuarios') }, 'Permissões'),
          ),
      },
    ]

    mount(
      host,
      pageHead({
        title: 'Colaboradores',
        crumbs: [{ label: 'Recursos Humanos' }, { label: 'Colaboradores' }],
        actions: [h('button.btn.btn-primary', { onClick: () => navigate('/administracao/usuarios') }, '+ Convidar colaborador')],
      }),
      h(
        'div.stack',
        gridCols(
          3,
          kpiCard({ label: 'Colaboradores ativos', value: String(active.length), mark: KPI_ICONS.users, color: '#c084fc', soft: 'rgba(192,132,252,.14)' }),
          kpiCard({ label: 'Perfis em uso', value: String(byRole.length), hint: byRole.map((role) => ROLE_LABEL[role]).join(', '), mark: KPI_ICONS.check, color: '#38bdf8', soft: 'rgba(56,189,248,.14)' }),
          kpiCard({ label: 'Alocados em obra ativa', value: String(rows.filter((row) => row.activeWorks.length > 0).length), mark: KPI_ICONS.building, color: '#f6a623', soft: 'rgba(246,166,35,.14)' }),
        ),
        card(
          { flush: true },
          dataTable({
            columns,
            rows,
            searchable: true,
            searchPlaceholder: 'Buscar colaborador',
            initialSort: { key: 'name', ascending: true },
            emptyTitle: 'Nenhum colaborador cadastrado',
            emptyHint: 'Convide pessoas em Administração › Usuários.',
            totalLabel: (total) => `${total} colaborador(es)`,
          }),
        ),
      ),
    )
  }

  await draw()
}
