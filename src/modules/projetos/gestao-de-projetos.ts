/** Projetos › Gestão de Projetos — lista, filtros e projeto avulso (tela M18). */
import { h, mount } from '../../ui/dom'
import { card } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { dataTable, type Column } from '../../ui/components/table'
import { badge } from '../../ui/components/badge'
import { openModal } from '../../ui/components/modal'
import { formRow, selectField, textAreaField, textField } from '../../ui/components/form'
import { banner, guard, toast } from '../../ui/components/feedback'
import { date, initials, power } from '../../core/format'
import { setQuery, type RouteContext } from '../../core/router'
import { app } from '../../core/session'
import { create, findAll, nameOf, powerKwp, STAGES, STAGE_LABEL, STAGE_TONE } from '../../data/projects'
import { findAll as findClients } from '../../data/clients'
import { members, nameOf as memberName, type Member } from '../../data/team'
import type { Client, Homologation, HomologationStatus } from '../../core/types'

function standaloneForm(clients: Client[], team: Member[], onSaved: () => Promise<void>): void {
  let name = ''
  let clientId = ''
  let responsible = ''
  let description = ''

  const handle = openModal({
    title: 'Novo Projeto Avulso',
    width: '560px',
    body: h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      banner(
        'info',
        'Projeto avulso é gerenciado sem contrato. As ações "Liberar para Produção" e "Liberar para Obra" ficam desabilitadas. Você pode vincular um contrato depois, se desejar.',
      ),
      textField({ label: 'Nome do projeto', required: true, onInput: (value) => (name = value) }),
      selectField({
        label: 'Cliente',
        placeholder: 'Selecione o cliente',
        options: clients.map((client) => ({ value: client.id, label: client.name })),
        onChange: (value) => (clientId = value),
      }),
      selectField({
        label: 'Responsável (opcional)',
        placeholder: 'Sem responsável',
        options: team.map((member) => ({ value: member.userId, label: member.name })),
        onChange: (value) => (responsible = value),
      }),
      textAreaField({ label: 'Descrição (opcional)', onInput: (value) => (description = value) }),
    ),
    footer: [
      h('button.btn.btn-ghost', { onClick: () => handle.close() }, 'Cancelar'),
      h(
        'button.btn.btn-primary',
        {
          onClick: async () => {
            if (!name.trim()) {
              toast('Informe o nome do projeto.', 'error')
              return
            }
            if (!clientId) {
              toast('Selecione o cliente do projeto.', 'error')
              return
            }
            const ok = await guard(async () => {
              await create({
                client_id: clientId,
                contract_id: null,
                utility_company: app.get().organization?.utility_company || 'Não informada',
                protocol: null,
                status: 'documents',
                responsible_id: responsible || null,
                metadata: { name: name.trim(), description: description.trim() || null, standalone: true },
              })
              await onSaved()
            }, 'Projeto criado.')
            if (ok) handle.close()
          },
        },
        'Criar Projeto',
      ),
    ],
  })
}

export async function render(host: HTMLElement, ctx: RouteContext): Promise<void> {
  async function draw(): Promise<void> {
    const [projects, clients, team] = await Promise.all([findAll(), findClients(), members()])
    const clientName = (id: string) => clients.find((client: Client) => client.id === id)?.name ?? '—'

    const stage = ctx.query.get('etapa') ?? ''
    const manager = ctx.query.get('gestor') ?? ''
    const rows = projects.filter((project) => {
      if (stage && project.status !== stage) return false
      if (manager && project.responsible_id !== manager) return false
      return true
    })

    const columns: Column<Homologation>[] = [
      {
        key: 'client',
        label: 'Cliente',
        sortable: true,
        value: (row) => clientName(row.client_id),
        render: (row) =>
          h(
            'div.row',
            h(
              'div.avatar',
              { style: { width: '26px', height: '26px', fontSize: '10.5px', background: 'var(--blue-soft)', color: 'var(--blue)' } },
              initials(clientName(row.client_id)),
            ),
            h('b', clientName(row.client_id)),
          ),
      },
      {
        key: 'project',
        label: 'Projeto',
        sortable: true,
        value: (row) => nameOf(row),
        render: (row) =>
          h(
            'div',
            h('div', nameOf(row)),
            h('div.faint', { style: { fontSize: '11.5px' } }, row.contract_id ? 'Vinculado a contrato' : 'Projeto avulso'),
          ),
      },
      { key: 'utility', label: 'Concessionária', sortable: true, value: (row) => row.utility_company },
      {
        key: 'power',
        label: 'Potência (kW)',
        align: 'right',
        sortable: true,
        value: (row) => powerKwp(row) ?? 0,
        render: (row) => h('b', { style: { color: 'var(--accent)' } }, power(powerKwp(row))),
      },
      {
        key: 'responsible',
        label: 'Responsável',
        value: (row) => memberName(team, row.responsible_id),
        render: (row) => memberName(team, row.responsible_id),
      },
      {
        key: 'status',
        label: 'Etapa',
        value: (row) => STAGE_LABEL[row.status],
        render: (row) => badge(STAGE_LABEL[row.status], STAGE_TONE[row.status]),
      },
      { key: 'created_at', label: 'Criado em', sortable: true, render: (row) => date(row.created_at) },
    ]

    mount(
      host,
      pageHead({
        title: 'Gestão de Projetos',
        crumbs: [{ label: 'Projetos', path: '/projetos/visao-geral' }, { label: 'Gestão de Projetos' }],
        actions: [h('button.btn.btn-primary', { onClick: () => standaloneForm(clients, team, draw) }, '+ Novo Projeto')],
      }),
      card(
        { flush: true },
        h(
          'div.filter-bar',
          { style: { padding: '14px 16px 0', margin: '0' } },
          selectField({
            label: 'Etapas',
            value: stage,
            placeholder: 'Todas',
            options: STAGES.map((entry) => ({ value: entry.id, label: entry.label })),
            onChange: (value) => setQuery({ etapa: value || null }),
          }),
          selectField({
            label: 'Gestor',
            value: manager,
            placeholder: 'Todos',
            options: team.map((member) => ({ value: member.userId, label: member.name })),
            onChange: (value) => setQuery({ gestor: value || null }),
          }),
          h('button.btn.btn-ghost', { style: { alignSelf: 'flex-end' }, onClick: () => setQuery({ etapa: null, gestor: null }) }, 'Limpar Filtros'),
        ),
        dataTable({
          columns,
          rows,
          searchable: true,
          searchPlaceholder: 'Buscar por Título ou Cliente',
          pageSize: 10,
          initialSort: { key: 'created_at', ascending: false },
          emptyTitle: 'Nenhum projeto encontrado',
          emptyHint: 'Crie um projeto avulso ou libere um contrato assinado para projeto.',
          totalLabel: (total) => `${total} registro(s)`,
        }),
      ),
    )
  }

  await draw()
}
