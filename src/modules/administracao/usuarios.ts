/** Administração › Usuários — equipe, perfis e convites. */
import { h, mount } from '../../ui/dom'
import { card } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { tabs } from '../../ui/components/tabs'
import { dataTable, type Column } from '../../ui/components/table'
import { badge, type Tone } from '../../ui/components/badge'
import { confirmModal, openModal } from '../../ui/components/modal'
import { formRow, selectField, textField } from '../../ui/components/form'
import { guard, toast } from '../../ui/components/feedback'
import { date, initials, orDash } from '../../core/format'
import { setQuery, type RouteContext } from '../../core/router'
import { app, ROLE_LABEL } from '../../core/session'
import { invitations, invite, revokeInvitation, setMemberActive, setMemberRole, team, type Invitation, type TeamRow } from '../../data/organization'
import type { Role } from '../../core/types'

const ROLES: Role[] = ['admin', 'commercial', 'engineering', 'installer', 'finance', 'viewer']

const ROLE_HINT: Record<Role, string> = {
  admin: 'Acesso total: módulos, financeiro e configurações',
  commercial: 'Clientes, funil, orçamentos e propostas',
  engineering: 'Obras, homologações e documentação técnica',
  installer: 'Execução em campo e apontamentos',
  finance: 'Contas, fluxo de caixa e cobranças',
  viewer: 'Dashboards e relatórios (somente leitura)',
}

const INVITE_TONE: Record<Invitation['status'], Tone> = {
  pending: 'amber',
  accepted: 'green',
  revoked: 'gray',
  expired: 'red',
}

const INVITE_LABEL: Record<Invitation['status'], string> = {
  pending: 'Pendente',
  accepted: 'Aceito',
  revoked: 'Revogado',
  expired: 'Expirado',
}

function inviteForm(onSaved: () => Promise<void>): void {
  let email = ''
  let fullName = ''
  let role: Role = 'viewer'
  let jobTitle = ''

  const handle = openModal({
    title: 'Convidar usuário',
    subtitle: 'O convidado recebe um link e entra na equipe ao aceitar.',
    width: '580px',
    body: h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      formRow(
        '1fr 1fr',
        textField({ label: 'E-mail', type: 'email', required: true, onInput: (value) => (email = value) }),
        textField({ label: 'Nome completo', onInput: (value) => (fullName = value) }),
      ),
      formRow(
        '1fr 1fr',
        selectField({
          label: 'Perfil de acesso',
          value: 'viewer',
          options: ROLES.map((entry) => ({ value: entry, label: ROLE_LABEL[entry] })),
          onChange: (value) => (role = value as Role),
        }),
        textField({ label: 'Cargo', onInput: (value) => (jobTitle = value) }),
      ),
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
        ROLES.map((entry) =>
          h(
            'div.row',
            { style: { gap: '10px', fontSize: '12px' } },
            badge(ROLE_LABEL[entry], entry === 'admin' ? 'amber' : 'gray'),
            h('span.faint', ROLE_HINT[entry]),
          ),
        ),
      ),
    ),
    footer: [
      h('button.btn.btn-ghost', { onClick: () => handle.close() }, 'Cancelar'),
      h(
        'button.btn.btn-primary',
        {
          onClick: async () => {
            if (!email.includes('@')) {
              toast('Informe um e-mail válido.', 'error')
              return
            }
            const ok = await guard(async () => {
              await invite({ email: email.trim().toLowerCase(), full_name: fullName.trim() || null, role, job_title: jobTitle.trim() || null })
              await onSaved()
            }, 'Convite criado.')
            if (ok) handle.close()
          },
        },
        'Enviar convite',
      ),
    ],
  })
}

export async function render(host: HTMLElement, ctx: RouteContext): Promise<void> {
  async function draw(): Promise<void> {
    const [members, invites] = await Promise.all([team(), invitations()])
    const activeTab = ctx.query.get('aba') ?? 'equipe'
    const currentUserId = app.get().user?.id

    const memberColumns: Column<TeamRow>[] = [
      {
        key: 'name',
        label: 'Nome',
        sortable: true,
        render: (row) =>
          h(
            'div.row',
            h(
              'div.avatar',
              { style: { width: '28px', height: '28px', fontSize: '11px', background: 'var(--accent-soft)', color: 'var(--accent)' } },
              initials(row.name),
            ),
            h('div', h('b', row.name), row.userId === currentUserId ? h('span.faint', { style: { fontSize: '11px', marginLeft: '6px' } }, '(você)') : null),
          ),
      },
      {
        key: 'role',
        label: 'Perfil',
        sortable: true,
        value: (row) => ROLE_LABEL[row.role],
        render: (row) =>
          h(
            'select.page-size',
            {
              disabled: row.userId === currentUserId,
              title: row.userId === currentUserId ? 'Você não pode alterar o próprio perfil.' : 'Alterar perfil',
              onChange: (event: Event) => {
                const value = (event.target as HTMLSelectElement).value as Role
                void guard(async () => {
                  await setMemberRole(row.userId, value)
                  await draw()
                }, 'Perfil atualizado.')
              },
            },
            ROLES.map((entry) => h('option', { value: entry, selected: entry === row.role }, ROLE_LABEL[entry])),
          ),
      },
      { key: 'hint', label: 'Permissões', value: (row) => ROLE_HINT[row.role], render: (row) => h('span.faint', { style: { fontSize: '12px' } }, ROLE_HINT[row.role]) },
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
        width: '120px',
        render: (row) =>
          row.userId === currentUserId
            ? h('span.faint', { style: { fontSize: '12px' } }, '—')
            : h(
                'button.btn.btn-ghost',
                {
                  style: { fontSize: '12px', padding: '4px 10px' },
                  onClick: () =>
                    confirmModal(
                      row.active ? 'Desativar acesso' : 'Reativar acesso',
                      row.active
                        ? `Desativar o acesso de "${row.name}"? Ele deixa de entrar no sistema, mas o histórico é preservado.`
                        : `Reativar o acesso de "${row.name}"?`,
                      () => {
                        void guard(async () => {
                          await setMemberActive(row.userId, !row.active)
                          await draw()
                        }, row.active ? 'Acesso desativado.' : 'Acesso reativado.')
                      },
                    ),
                },
                row.active ? 'Desativar' : 'Reativar',
              ),
      },
    ]

    const inviteColumns: Column<Invitation>[] = [
      { key: 'email', label: 'E-mail', sortable: true, render: (row) => h('b', row.email) },
      { key: 'full_name', label: 'Nome', render: (row) => orDash(row.full_name) },
      { key: 'role', label: 'Perfil', value: (row) => ROLE_LABEL[row.role], render: (row) => ROLE_LABEL[row.role] },
      { key: 'job_title', label: 'Cargo', render: (row) => orDash(row.job_title) },
      {
        key: 'status',
        label: 'Situação',
        value: (row) => INVITE_LABEL[row.status],
        render: (row) => badge(INVITE_LABEL[row.status], INVITE_TONE[row.status]),
      },
      { key: 'expires_at', label: 'Expira em', sortable: true, render: (row) => date(row.expires_at) },
      {
        key: 'actions',
        label: 'Ações',
        align: 'right',
        width: '110px',
        render: (row) =>
          row.status === 'pending'
            ? h(
                'button.btn.btn-ghost',
                {
                  style: { fontSize: '12px', padding: '4px 10px' },
                  onClick: () =>
                    confirmModal('Revogar convite', `Revogar o convite de ${row.email}?`, () => {
                      void guard(async () => {
                        await revokeInvitation(row.id)
                        await draw()
                      }, 'Convite revogado.')
                    }),
                },
                'Revogar',
              )
            : h('span.faint', { style: { fontSize: '12px' } }, '—'),
      },
    ]

    mount(
      host,
      pageHead({
        title: 'Usuários',
        crumbs: [{ label: 'Administração', path: '/administracao/visao-geral' }, { label: 'Usuários' }],
        actions: [h('button.btn.btn-primary', { onClick: () => inviteForm(draw) }, '+ Novo usuário')],
      }),
      h(
        'div',
        { style: { marginBottom: '18px' } },
        tabs({
          tabs: [
            { id: 'equipe', label: 'Equipe', count: members.length },
            { id: 'convites', label: 'Convites', count: invites.filter((row) => row.status === 'pending').length },
          ],
          active: activeTab,
          onChange: (id) => setQuery({ aba: id === 'equipe' ? null : id }),
        }),
      ),
      activeTab === 'convites'
        ? card(
            { flush: true },
            dataTable({
              columns: inviteColumns,
              rows: invites,
              searchable: true,
              searchPlaceholder: 'Buscar convite',
              initialSort: { key: 'expires_at', ascending: false },
              emptyTitle: 'Nenhum convite enviado',
              emptyHint: 'Convide alguém pelo botão "+ Novo usuário".',
              totalLabel: (total) => `${total} convite(s)`,
            }),
          )
        : card(
            { flush: true },
            dataTable({
              columns: memberColumns,
              rows: members,
              searchable: true,
              searchPlaceholder: 'Buscar usuário',
              initialSort: { key: 'name', ascending: true },
              emptyTitle: 'Nenhum usuário na equipe',
              totalLabel: (total) => `${total} usuário(s)`,
            }),
          ),
    )
  }

  await draw()
}
