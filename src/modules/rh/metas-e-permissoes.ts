/** Recursos Humanos › Metas e Permissões — metas mensais e alçadas por perfil. */
import { h, mount } from '../../ui/dom'
import { card } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { tabs } from '../../ui/components/tabs'
import { dataTable, type Column } from '../../ui/components/table'
import { badge } from '../../ui/components/badge'
import { openModal } from '../../ui/components/modal'
import { formRow, selectField, textField } from '../../ui/components/form'
import { banner, guard, toast } from '../../ui/components/feedback'
import { decimal, money, parseMoney, percent } from '../../core/format'
import { setQuery, type RouteContext } from '../../core/router'
import { ROLE_LABEL } from '../../core/session'
import { createGoal, goals, monthStart, saveGoal, type GoalInput } from '../../data/sales'
import { findAll as findLeads } from '../../data/leads'
import { members, nameOf, type Member } from '../../data/team'
import type { Role, SalesGoal } from '../../core/types'

/** Alçadas por perfil, iguais às aplicadas na navegação e nas políticas do banco. */
const PERMISSIONS: { role: Role; scope: string; write: string }[] = [
  { role: 'admin', scope: 'Todos os módulos, incluindo financeiro e configurações', write: 'Cria, edita e exclui em tudo' },
  { role: 'commercial', scope: 'Comercial, contratos e clientes', write: 'Cria e edita propostas, contratos e produtos' },
  { role: 'engineering', scope: 'Projetos, obras, produção e estoque', write: 'Cria e edita projetos, obras e produções' },
  { role: 'installer', scope: 'Obras e requisições de material', write: 'Atualiza execução em campo e requisita material' },
  { role: 'finance', scope: 'Financeiro, notas fiscais e conciliação', write: 'Cria e edita lançamentos, contas e centros de custo' },
  { role: 'viewer', scope: 'Painéis e relatórios', write: 'Somente leitura' },
]

function goalForm(initial: SalesGoal | null, team: Member[], onSaved: () => Promise<void>): void {
  let draft: GoalInput = {
    user_id: initial ? initial.user_id : team[0]?.userId ?? '',
    reference_month: initial ? initial.reference_month : monthStart(),
    target_kwp: initial ? initial.target_kwp : null,
    target_revenue: initial ? initial.target_revenue : null,
  }
  const patch = (part: Partial<GoalInput>) => {
    draft = { ...draft, ...part }
  }

  const handle = openModal({
    title: initial ? 'Editar meta' : 'Nova meta',
    subtitle: 'A meta é mensal e comparada com os leads ganhos do período.',
    width: '580px',
    body: h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      formRow(
        '2fr 1fr',
        selectField({
          label: 'Colaborador',
          value: draft.user_id,
          options: team.map((member) => ({ value: member.userId, label: member.name })),
          onChange: (value) => patch({ user_id: value }),
        }),
        textField({
          label: 'Mês de referência',
          type: 'month',
          value: draft.reference_month.slice(0, 7),
          onInput: (value) => patch({ reference_month: value ? value + '-01' : monthStart() }),
        }),
      ),
      formRow(
        '1fr 1fr',
        textField({
          label: 'Meta de receita (R$)',
          value: draft.target_revenue ? String(draft.target_revenue) : '',
          onInput: (value) => patch({ target_revenue: value.trim() ? parseMoney(value) : null }),
        }),
        textField({
          label: 'Meta de potência (kWp)',
          value: draft.target_kwp ? String(draft.target_kwp) : '',
          onInput: (value) => patch({ target_kwp: value.trim() ? parseMoney(value) : null }),
        }),
      ),
    ),
    footer: [
      h('button.btn.btn-ghost', { onClick: () => handle.close() }, 'Cancelar'),
      h(
        'button.btn.btn-primary',
        {
          onClick: async () => {
            if (!draft.user_id) {
              toast('Selecione o colaborador.', 'error')
              return
            }
            if (!draft.target_revenue && !draft.target_kwp) {
              toast('Informe ao menos uma meta: receita ou potência.', 'error')
              return
            }
            const ok = await guard(async () => {
              if (initial) await saveGoal(initial.id, draft)
              else await createGoal(draft)
              await onSaved()
            }, initial ? 'Meta atualizada.' : 'Meta criada.')
            if (ok) handle.close()
          },
        },
        'Salvar meta',
      ),
    ],
  })
}

export async function render(host: HTMLElement, ctx: RouteContext): Promise<void> {
  async function draw(): Promise<void> {
    const [rows, team, leads] = await Promise.all([goals(), members(), findLeads()])
    const activeTab = ctx.query.get('aba') ?? 'metas'

    /** Realizado: leads ganhos do vendedor no mês da meta. */
    const realizedOf = (goal: SalesGoal) =>
      leads
        .filter(
          (lead) =>
            lead.stage === 'won' &&
            lead.assigned_to === goal.user_id &&
            lead.created_at.slice(0, 7) === goal.reference_month.slice(0, 7),
        )
        .reduce((sum, lead) => sum + Number(lead.estimated_value ?? 0), 0)

    const goalColumns: Column<SalesGoal>[] = [
      {
        key: 'user',
        label: 'Colaborador',
        sortable: true,
        value: (row) => nameOf(team, row.user_id),
        render: (row) => h('b', nameOf(team, row.user_id)),
      },
      {
        key: 'reference_month',
        label: 'Mês',
        sortable: true,
        render: (row) => row.reference_month.slice(0, 7).split('-').reverse().join('/'),
      },
      {
        key: 'target_revenue',
        label: 'Meta de receita',
        align: 'right',
        value: (row) => Number(row.target_revenue ?? 0),
        render: (row) => (row.target_revenue ? money(row.target_revenue) : h('span.faint', '—')),
      },
      {
        key: 'realized',
        label: 'Realizado',
        align: 'right',
        sortable: true,
        value: (row) => realizedOf(row),
        render: (row) => h('b', { style: { color: 'var(--green)' } }, money(realizedOf(row))),
      },
      {
        key: 'progress',
        label: 'Atingimento',
        align: 'right',
        value: (row) => (Number(row.target_revenue ?? 0) > 0 ? (realizedOf(row) / Number(row.target_revenue)) * 100 : 0),
        render: (row) => {
          const target = Number(row.target_revenue ?? 0)
          if (target <= 0) return h('span.faint', '—')
          const ratio = (realizedOf(row) / target) * 100
          return h(
            'div',
            { style: { minWidth: '120px' } },
            h(
              'div.row',
              { style: { justifyContent: 'flex-end', fontSize: '12px', marginBottom: '4px', color: ratio >= 100 ? 'var(--green)' : 'var(--text)' } },
              percent(ratio, 0),
            ),
            h('div.progress', h('span', { style: { width: Math.min(100, ratio) + '%', background: ratio >= 100 ? 'var(--green)' : 'var(--accent)' } })),
          )
        },
      },
      {
        key: 'target_kwp',
        label: 'Meta de potência',
        align: 'right',
        value: (row) => Number(row.target_kwp ?? 0),
        render: (row) => (row.target_kwp ? decimal(row.target_kwp, ' kWp') : h('span.faint', '—')),
      },
      {
        key: 'actions',
        label: 'Ações',
        align: 'right',
        width: '100px',
        render: (row) => h('button.btn.btn-ghost', { style: { fontSize: '12px', padding: '4px 10px' }, onClick: () => goalForm(row, team, draw) }, 'Editar'),
      },
    ]

    const permissionsCard = card(
      { title: 'Alçadas por perfil', subtitle: 'Estas regras valem na navegação e também nas políticas do banco.', flush: true },
      h(
        'div.table-wrap',
        h(
          'table.data',
          h('thead', h('tr', h('th', 'Perfil'), h('th', 'Acessa'), h('th', 'Pode alterar'), h('th.col-right', 'Pessoas'))),
          h(
            'tbody',
            PERMISSIONS.map((entry) =>
              h(
                'tr',
                h('td', badge(ROLE_LABEL[entry.role], entry.role === 'admin' ? 'amber' : 'blue')),
                h('td.muted', entry.scope),
                h('td.muted', entry.write),
                h('td.col-right', h('b', String(team.filter((member) => member.role === entry.role).length))),
              ),
            ),
          ),
        ),
      ),
    )

    mount(
      host,
      pageHead({
        title: 'Metas e Permissões',
        crumbs: [{ label: 'Recursos Humanos' }, { label: 'Metas e Permissões' }],
        actions: [
          h(
            'button.btn.btn-primary',
            {
              onClick: () => {
                if (!team.length) {
                  toast('Cadastre colaboradores antes de definir metas.', 'error')
                  return
                }
                goalForm(null, team, draw)
              },
            },
            '+ Nova meta',
          ),
        ],
      }),
      h(
        'div.stack',
        h(
          'div',
          tabs({
            tabs: [
              { id: 'metas', label: 'Metas', count: rows.length },
              { id: 'permissoes', label: 'Permissões', count: PERMISSIONS.length },
            ],
            active: activeTab,
            onChange: (id) => setQuery({ aba: id === 'metas' ? null : id }),
          }),
        ),
        activeTab === 'permissoes'
          ? h(
              'div.stack',
              banner('info', 'A troca de perfil de cada pessoa é feita em Administração › Usuários. Aqui você confere o que cada perfil pode fazer.'),
              permissionsCard,
            )
          : card(
              { flush: true },
              dataTable({
                columns: goalColumns,
                rows,
                searchable: true,
                searchPlaceholder: 'Buscar meta',
                pageSize: 10,
                initialSort: { key: 'reference_month', ascending: false },
                emptyTitle: 'Nenhuma meta definida',
                emptyHint: 'Defina metas mensais de receita e potência por vendedor.',
                totalLabel: (total) => `${total} meta(s)`,
              }),
            ),
      ),
    )
  }

  await draw()
}
