/** Administração › Visão Geral — equipe, unidades e pendências (tela M2). */
import { h, mount } from '../../ui/dom'
import { card, gridCols, gridTemplate } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { kpiCard, KPI_ICONS } from '../../ui/components/kpi'
import { emptyState } from '../../ui/components/feedback'
import { navigate } from '../../core/router'
import { app, ROLE_LABEL } from '../../core/session'
import { fiscalPending, invitations, team, units } from '../../data/organization'

export async function render(host: HTMLElement): Promise<void> {
  const [members, invites, businessUnits] = await Promise.all([team(), invitations(), units()])
  const active = members.filter((member) => member.active)
  const pending = invites.filter((invite) => invite.status === 'pending')

  const pendings = businessUnits.flatMap((unit) => fiscalPending(unit).map((item) => ({ unit: unit.name, item })))

  const integrations = Object.keys(app.get().settings?.integrations ?? {}).filter((key) => key !== 'plan')

  mount(
    host,
    pageHead({
      title: 'Administração',
      crumbs: [{ label: 'Administração' }, { label: 'Visão Geral' }],
      actions: [
        h('button.btn.btn-primary', { onClick: () => navigate('/administracao/usuarios') }, '+ Novo usuário'),
        h('button.btn', { onClick: () => navigate('/administracao/minha-empresa') }, 'Nova unidade'),
      ],
    }),
    h(
      'div.stack',
      gridCols(
        4,
        kpiCard({ label: 'Usuários ativos', value: String(active.length), mark: KPI_ICONS.users, color: '#f6a623', soft: 'rgba(246,166,35,.14)', onClick: () => navigate('/administracao/usuarios') }),
        kpiCard({ label: 'Convites pendentes', value: String(pending.length), mark: KPI_ICONS.file, color: '#38bdf8', soft: 'rgba(56,189,248,.14)', onClick: () => navigate('/administracao/usuarios') }),
        kpiCard({ label: 'Unidades de negócio', value: String(businessUnits.length), mark: KPI_ICONS.building, color: '#22c55e', soft: 'rgba(34,197,94,.14)', onClick: () => navigate('/administracao/minha-empresa') }),
        kpiCard({ label: 'Integrações', value: String(integrations.length), mark: KPI_ICONS.chart, color: '#a78bfa', soft: 'rgba(167,139,250,.14)', onClick: () => navigate('/administracao/integracoes') }),
      ),
      gridTemplate(
        '1fr 1fr',
        card(
          { title: 'Pendências de configuração', subtitle: pendings.length + ' pendência(s)', flush: true },
          pendings.length
            ? h(
                'div.table-wrap',
                h(
                  'table.data',
                  h('thead', h('tr', h('th', 'Pendência'), h('th', 'Unidade'))),
                  h('tbody', pendings.map((row) => h('tr', h('td', row.item), h('td.muted', row.unit)))),
                ),
              )
            : emptyState({ title: 'Nenhuma pendência de configuração' }),
        ),
        card(
          { title: 'Equipe por perfil', flush: true },
          active.length
            ? h(
                'div.table-wrap',
                h(
                  'table.data',
                  h('thead', h('tr', h('th', 'Perfil'), h('th.col-right', 'Usuários'))),
                  h(
                    'tbody',
                    [...new Set(active.map((member) => member.role))].map((role) =>
                      h('tr', h('td', ROLE_LABEL[role]), h('td.col-right', String(active.filter((member) => member.role === role).length))),
                    ),
                  ),
                ),
              )
            : emptyState({ title: 'Nenhum usuário ativo' }),
        ),
      ),
    ),
  )
}
