/** Comercial › Funil de Vendas — kanban de duas zonas (tela M11). */
import { h, mount } from '../../ui/dom'
import { pageHead } from '../../ui/components/page'
import { guard, toast } from '../../ui/components/feedback'
import { initials, money, orDash } from '../../core/format'
import { navigate } from '../../core/router'
import { findAll, moveToStage, STAGES } from '../../data/leads'
import { members, nameOf, type Member } from '../../data/team'
import type { Lead, LeadStage } from '../../core/types'

const PRE = STAGES.filter((stage) => stage.zone === 'pre')
const VENDA = STAGES.filter((stage) => stage.zone === 'venda')

function leadCard(lead: Lead, team: Member[]): HTMLElement {
  const node = h(
    'article.kanban-card',
    { draggable: 'true', 'data-lead': lead.id },
    h('div.kanban-card-title', lead.name),
    h('div.kanban-card-sub', orDash(lead.city, 'Cidade não informada')),
    h(
      'div.kanban-card-foot',
      h(
        'div',
        { style: { flex: '1', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '3px' } },
        h('span.kanban-meta', '⚡ ' + (lead.customer_type ? lead.customer_type : 'Não definido')),
        h('span.kanban-meta', '$ ' + (lead.estimated_value ? money(lead.estimated_value) : 'Não definido')),
      ),
      h(
        'div.avatar',
        {
          title: nameOf(team, lead.assigned_to),
          style: { width: '26px', height: '26px', fontSize: '10.5px', background: 'var(--green-soft)', color: 'var(--green)' },
        },
        initials(nameOf(team, lead.assigned_to)),
      ),
    ),
  )

  node.addEventListener('dragstart', (event) => {
    ;(event as DragEvent).dataTransfer?.setData('text/plain', lead.id)
    node.classList.add('is-dragging')
  })
  node.addEventListener('dragend', () => node.classList.remove('is-dragging'))
  return node
}

function column(
  stage: { key: LeadStage; label: string },
  leads: Lead[],
  team: Member[],
  onDrop: (leadId: string, stage: LeadStage) => Promise<void>,
  systemNote = false,
): HTMLElement {
  const body = h('div.kanban-column-body', leads.map((lead) => leadCard(lead, team)))
  const node = h(
    'section.kanban-column',
    h('header.kanban-column-head', stage.label, h('span.kanban-column-count', String(leads.length))),
    systemNote ? h('div.kanban-system-note', 'Coluna do sistema') : null,
    body,
  )

  node.addEventListener('dragover', (event) => {
    event.preventDefault()
    node.classList.add('is-drop')
  })
  node.addEventListener('dragleave', () => node.classList.remove('is-drop'))
  node.addEventListener('drop', (event) => {
    event.preventDefault()
    node.classList.remove('is-drop')
    const leadId = (event as DragEvent).dataTransfer?.getData('text/plain')
    if (leadId) void onDrop(leadId, stage.key)
  })

  return node
}

export async function render(host: HTMLElement): Promise<void> {
  const team = await members()

  async function draw(): Promise<void> {
    const leads = await findAll()
    const byStage = (stage: LeadStage) => leads.filter((lead) => lead.stage === stage)

    async function onDrop(leadId: string, stage: LeadStage): Promise<void> {
      const lead = leads.find((entry) => entry.id === leadId)
      if (!lead || lead.stage === stage) return
      await guard(async () => {
        await moveToStage(leadId, stage)
        await draw()
      })
      toast(`"${lead.name}" movido para ${STAGES.find((s) => s.key === stage)?.label}.`, 'success')
    }

    const totalValue = leads
      .filter((lead) => lead.stage !== 'lost')
      .reduce((sum, lead) => sum + (lead.estimated_value ?? 0), 0)

    mount(
      host,
      pageHead({
        title: 'Funil de vendas',
        crumbs: [
          { label: 'Comercial' },
          { label: 'Gestão de Negociações', path: '/comercial/negociacoes' },
          { label: 'Funil de vendas' },
        ],
        actions: [
          h('button.btn.btn-primary', { onClick: () => navigate('/comercial/leads') }, '+ Novo Lead'),
          h('button.btn', { onClick: () => navigate('/comercial/negociacoes') }, '+ Nova Negociação'),
        ],
      }),
      h(
        'div.card',
        { style: { padding: '14px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' } },
        h(
          'div',
          h('div.field-label', 'Funil'),
          h('div', { style: { fontSize: '14px', fontWeight: '650' } }, 'Novas Oportunidades'),
        ),
        h('span.spacer'),
        h(
          'div',
          { style: { textAlign: 'right' } },
          h('div.field-label', 'Total em aberto · ' + leads.length + ' card(s)'),
          h('div', { style: { fontSize: '15px', fontWeight: '700', color: 'var(--accent)' } }, money(totalValue)),
        ),
      ),
      h(
        'div.kanban',
        h(
          'div.kanban-zone',
          h('div.kanban-zone-title', 'Pré-venda · Leads'),
          h(
            'div.kanban-zone-body',
            PRE.map((stage) => column(stage, byStage(stage.key), team, onDrop, true)),
          ),
        ),
        h('div.kanban-divider', h('span', 'Conversão')),
        h(
          'div.kanban-zone',
          h('div.kanban-zone-title', 'Venda · Negociações'),
          h(
            'div.kanban-zone-body',
            VENDA.map((stage) => column(stage, byStage(stage.key), team, onDrop)),
          ),
        ),
      ),
    )
  }

  await draw()
}
