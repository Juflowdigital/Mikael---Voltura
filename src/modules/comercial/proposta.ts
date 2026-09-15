/**
 * Comercial › Proposta — documento da negociação, pronto para imprimir, salvar
 * em PDF ou enviar ao cliente. Alcançada pela coluna de ações da Gestão de
 * Negociações (`/comercial/proposta?id=<negociação>`).
 */
import { h, mount } from '../../ui/dom'
import { card } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { badge } from '../../ui/components/badge'
import { emptyState, guard, loadingState, toast } from '../../ui/components/feedback'
import { date, money } from '../../core/format'
import { navigate, type RouteContext } from '../../core/router'
import { app } from '../../core/session'
import { findOne, setStatus, PROPOSAL_LABEL, PROPOSAL_TONE } from '../../data/proposals'
import { findAll as findClients } from '../../data/clients'
import { findAll as findBudgets } from '../../data/budgets'
import { units } from '../../data/organization'
import { members, nameOf } from '../../data/team'
import { buildProposalHtml } from './proposta-documento'
import type { ProposalStatus } from '../../core/types'

/** Modelos cadastrados em Administração › Modelos. */
interface StoredModel {
  kind: string
  name: string
  isDefault: boolean
  unitId: string | null
  body: string
}

/** Folha A4 em pixels de CSS (96 dpi): 210mm x 297mm. */
const PAGE_WIDTH = 794
const PAGE_HEIGHT = 1123

const NEXT_STATUS: { status: ProposalStatus; label: string; hint: string }[] = [
  { status: 'draft', label: 'Rascunho', hint: 'Voltar para edição interna' },
  { status: 'sent', label: 'Enviada', hint: 'Documento entregue ao cliente' },
  { status: 'accepted', label: 'Aceita', hint: 'Cliente aprovou a proposta' },
  { status: 'rejected', label: 'Perdida', hint: 'Cliente recusou a proposta' },
]

/** Escolhe o modelo de texto da unidade, caindo no padrão da empresa. */
function templateFor(unitId: string | null): string | null {
  const raw = app.get().settings?.document_models
  const models = (Array.isArray(raw) ? raw : []) as StoredModel[]
  const usable = models.filter((model) => model.kind === 'proposta-texto' || model.kind === 'proposta')
  const scoped = usable.filter((model) => !model.unitId || model.unitId === unitId)
  const chosen = scoped.find((model) => model.isDefault) ?? scoped[0]
  return chosen?.body?.trim() ? chosen.body : null
}

function summaryRow(label: string, value: string): HTMLElement {
  return h(
    'div.row',
    { style: { padding: '7px 0', borderBottom: '1px solid var(--border)' } },
    h('span.muted', { style: { flex: '1', fontSize: '12.5px' } }, label),
    h('b', { style: { fontSize: '12.5px' } }, value),
  )
}

export async function render(host: HTMLElement, ctx: RouteContext): Promise<void> {
  const id = ctx.query.get('id')
  if (!id) {
    mount(
      host,
      pageHead({ title: 'Proposta', crumbs: [{ label: 'Comercial' }, { label: 'Proposta' }] }),
      card({}, emptyState({ title: 'Nenhuma negociação selecionada', hint: 'Abra a proposta pela Gestão de Negociações.' })),
    )
    return
  }

  const proposalId: string = id
  mount(host, loadingState())

  const [proposal, clients, budgets, businessUnits, team] = await Promise.all([
    findOne(proposalId),
    findClients(),
    findBudgets(),
    units(),
    members(),
  ])

  if (!proposal) {
    mount(
      host,
      pageHead({ title: 'Proposta', crumbs: [{ label: 'Comercial' }, { label: 'Proposta' }] }),
      card({}, emptyState({ title: 'Negociação não encontrada', hint: 'Ela pode ter sido removida por outro usuário.' })),
    )
    return
  }

  const client = clients.find((entry) => entry.id === proposal.client_id) ?? null
  const budget = budgets.find((entry) => entry.id === proposal.budget_id) ?? null
  const unit = businessUnits.find((entry) => entry.id === proposal.business_unit_id) ?? businessUnits[0] ?? null
  const documentName = proposal.proposal_number

  const html = buildProposalHtml({
    proposal,
    client,
    budget,
    organization: app.get().organization,
    unit,
    sellerName: nameOf(team, proposal.seller_id),
    managerName: nameOf(team, proposal.manager_id),
    templateBody: templateFor(unit?.id ?? null),
    logoUrl: app.get().logoUrl,
  })

  const frame = h('iframe', {
    title: 'Pré-visualização da proposta',
    srcdoc: html,
    style: { width: PAGE_WIDTH + 'px', height: PAGE_HEIGHT + 'px', border: '0', display: 'block', transformOrigin: 'top left' },
  }) as HTMLIFrameElement

  // A previa mostra a folha A4 inteira: reduz a escala ate caber na coluna.
  const stage = h('div', { style: { overflow: 'hidden', background: '#eef2f7' } }, frame)

  function fitPreview(): void {
    const sheet = frame.contentDocument?.body
    const height = Math.max(sheet?.scrollHeight ?? 0, PAGE_HEIGHT)
    const scale = Math.min(1, (stage.clientWidth || PAGE_WIDTH) / PAGE_WIDTH)
    frame.style.height = height + 'px'
    frame.style.transform = 'scale(' + scale + ')'
    stage.style.height = Math.ceil(height * scale) + 'px'
  }

  frame.addEventListener('load', fitPreview)
  const observer = new ResizeObserver(() => {
    if (!stage.isConnected) {
      observer.disconnect()
      return
    }
    fitPreview()
  })
  observer.observe(stage)

  function printDocument(): void {
    const view = frame.contentWindow
    if (!view) {
      toast('Não foi possível abrir a impressão. Recarregue a página.', 'error')
      return
    }
    view.focus()
    view.print()
  }

  function documentUrl(): string {
    return URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
  }

  function openInNewTab(): void {
    const url = documentUrl()
    const opened = window.open(url, '_blank')
    if (!opened) toast('O navegador bloqueou a nova aba. Libere os pop-ups para este site.', 'error')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  function downloadDocument(): void {
    const url = documentUrl()
    const link = h('a', { href: url, download: documentName + '.html' }) as HTMLAnchorElement
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  async function changeStatus(status: ProposalStatus): Promise<void> {
    const ok = await guard(() => setStatus(proposalId, status).then(() => undefined), 'Situação atualizada.')
    if (ok) await render(host, ctx)
  }

  mount(
    host,
    pageHead({
      title: proposal.title || 'Proposta ' + proposal.proposal_number,
      crumbs: [
        { label: 'Comercial', path: '/comercial/visao-geral' },
        { label: 'Gestão de Negociações', path: '/comercial/negociacoes' },
        { label: proposal.proposal_number },
      ],
      actions: [
        h('button.btn.btn-ghost', { onClick: () => navigate('/comercial/negociacoes') }, 'Voltar'),
        h('button.btn', { onClick: openInNewTab }, 'Abrir em nova aba'),
        h('button.btn', { onClick: downloadDocument }, 'Baixar arquivo'),
        h('button.btn.btn-primary', { onClick: printDocument }, 'Imprimir / Salvar PDF'),
      ],
    }),
    h(
      'div.grid',
      { style: { gridTemplateColumns: 'minmax(0, 1fr) 320px', alignItems: 'start', gap: '18px' } },
      card({ title: 'Documento da proposta', flush: true }, stage),
      h(
        'div.stack',
        card(
          { title: 'Situação' },
          h('div', { style: { marginBottom: '12px' } }, badge(PROPOSAL_LABEL[proposal.status], PROPOSAL_TONE[proposal.status])),
          h(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
            NEXT_STATUS.map((entry) =>
              h(
                'button',
                {
                  class: 'btn' + (entry.status === proposal.status ? ' btn-primary' : ''),
                  title: entry.hint,
                  disabled: entry.status === proposal.status ? 'disabled' : null,
                  onClick: () => void changeStatus(entry.status),
                },
                entry.label,
              ),
            ),
          ),
        ),
        card(
          { title: 'Resumo' },
          summaryRow('Número', proposal.proposal_number),
          summaryRow('Cliente', client?.name ?? '—'),
          summaryRow('Valor', proposal.total_value ? money(proposal.total_value) : '—'),
          summaryRow('Validade', proposal.valid_until ? date(proposal.valid_until) : '—'),
          summaryRow('Vendedor', nameOf(team, proposal.seller_id)),
          summaryRow('Unidade', unit?.name ?? '—'),
        ),
        card(
          { title: 'Como enviar' },
          h(
            'p.muted',
            { style: { margin: '0', fontSize: '12.5px', lineHeight: '1.6' } },
            'Use "Imprimir / Salvar PDF" e escolha "Salvar como PDF" no destino da impressão. O arquivo sai em A4 e pode ser anexado no e-mail ou no WhatsApp do cliente. Depois de enviar, marque a negociação como Enviada.',
          ),
          templateFor(unit?.id ?? null)
            ? null
            : h(
                'p.muted',
                { style: { margin: '10px 0 0', fontSize: '12px' } },
                'Nenhum modelo cadastrado — o texto padrão está sendo usado. Cadastre o seu em Administração › Modelos.',
              ),
        ),
      ),
    ),
  )
}
