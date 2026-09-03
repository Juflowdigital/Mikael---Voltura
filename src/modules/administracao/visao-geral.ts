/** Administração › Visão Geral — uso do plano e pendências (tela M2). */
import { h, icon, mount } from '../../ui/dom'
import { card, gridCols, gridTemplate } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { kpiCard, KPI_ICONS } from '../../ui/components/kpi'
import { banner, emptyState } from '../../ui/components/feedback'
import { percent } from '../../core/format'
import { navigate } from '../../core/router'
import { app, ROLE_LABEL } from '../../core/session'
import { fiscalPending, invitations, team, units } from '../../data/organization'

/** Limites do plano contratado, guardados em organization_settings.integrations.plan. */
interface Plan {
  name: string
  users: number
  units: number
}

function planOf(): Plan {
  const raw = (app.get().settings?.integrations as Record<string, unknown> | undefined)?.plan as Partial<Plan> | undefined
  return {
    name: String(raw?.name ?? 'Planetário'),
    users: Number(raw?.users) > 0 ? Number(raw?.users) : 1,
    units: Number(raw?.units) > 0 ? Number(raw?.units) : 1,
  }
}

function usageBar(label: string, used: number, total: number, unit: string, mark: string, color: string, soft: string): HTMLElement {
  const ratio = total > 0 ? Math.min(1, used / total) : 0
  const full = ratio >= 1
  return h(
    'article.card',
    { style: { padding: '16px 18px' } },
    h(
      'div.row',
      h('div.kpi-icon', { style: { background: soft, color, width: '30px', height: '30px' } }, icon(mark, 14)),
      h('span', { style: { fontSize: '13px', fontWeight: '650' } }, label),
    ),
    h(
      'div',
      { style: { margin: '12px 0 8px', display: 'flex', alignItems: 'baseline', gap: '6px' } },
      h('span', { style: { fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '650', color: full ? 'var(--red)' : color } }, String(used)),
      h('span.muted', { style: { fontSize: '12.5px' } }, '/ ' + total + ' ' + unit),
    ),
    h('div.progress', h('span', { style: { width: ratio * 100 + '%', background: full ? 'var(--red)' : color } })),
    h(
      'div.row',
      { style: { marginTop: '8px' } },
      h('span.faint', { style: { fontSize: '11.5px', flex: '1' } }, percent(ratio * 100) + ' usado'),
      full ? h('span', { style: { color: 'var(--red)', fontSize: '13px' } }, '⚠') : null,
    ),
  )
}

export async function render(host: HTMLElement): Promise<void> {
  const [members, invites, businessUnits] = await Promise.all([team(), invitations(), units()])
  const plan = planOf()
  const active = members.filter((member) => member.active)
  const pending = invites.filter((invite) => invite.status === 'pending')

  const pendings = businessUnits.flatMap((unit) => fiscalPending(unit).map((item) => ({ unit: unit.name, item })))

  const alerts = [
    active.length >= plan.users ? 'Usuários: Limite atingido! (' + active.length + '/' + plan.users + ' usuários)' : null,
    businessUnits.length >= plan.units ? 'Unidades de Negócio: Limite atingido! (' + businessUnits.length + '/' + plan.units + ' unidades)' : null,
  ].filter((value): value is string => value !== null)

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
      card(
        {
          title: 'Dashboard de Uso de Recursos',
          tools: [h('span.badge', { style: { color: 'var(--accent)', background: 'var(--accent-soft)', borderColor: 'rgba(246,166,35,.4)' } }, 'Plano: ' + plan.name)],
        },
        gridCols(
          3,
          usageBar('Usuários', active.length, plan.users, 'usuários', KPI_ICONS.users, '#f6a623', 'rgba(246,166,35,.14)'),
          usageBar('Unidades de Negócio', businessUnits.length, plan.units, 'unidades', KPI_ICONS.building, '#22c55e', 'rgba(34,197,94,.14)'),
          usageBar('Convites em aberto', pending.length, plan.users, 'convites', KPI_ICONS.file, '#38bdf8', 'rgba(56,189,248,.14)'),
        ),
        alerts.length
          ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' } }, alerts.map((text) => banner('danger', text)))
          : null,
      ),
    ),
  )
}
