/** Comercial › Leads — cartoes-filtro, filtros e lista (tela M8). */
import { h, mount } from '../../ui/dom'
import { card, gridCols } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { statFilter, KPI_ICONS } from '../../ui/components/kpi'
import { dataTable, type Column } from '../../ui/components/table'
import { badge, type Tone } from '../../ui/components/badge'
import { openModal } from '../../ui/components/modal'
import { formRow, selectField, textField } from '../../ui/components/form'
import { guard, toast } from '../../ui/components/feedback'
import { date, daysSince, money, orDash, parseMoney, phone as fmtPhone } from '../../core/format'
import { setQuery, type RouteContext } from '../../core/router'
import { bucketOf, create, findAll, STAGES, STAGE_LABEL, type LeadBucket, type LeadInput } from '../../data/leads'
import { members, nameOf, type Member } from '../../data/team'
import type { Lead, LeadStage } from '../../core/types'

const BUCKETS: { id: LeadBucket; label: string; mark: string; tone: string }[] = [
  { id: 'todos', label: 'Todos', mark: KPI_ICONS.users, tone: 'var(--accent)' },
  { id: 'novos', label: 'Novos', mark: KPI_ICONS.flag, tone: '#f6a623' },
  { id: 'funil', label: 'Em funil', mark: KPI_ICONS.chart, tone: '#38bdf8' },
  { id: 'convertidos', label: 'Convertidos', mark: KPI_ICONS.check, tone: '#22c55e' },
  { id: 'descartados', label: 'Descartados', mark: KPI_ICONS.archive, tone: '#8ba0b8' },
]

const STAGE_TONE: Record<LeadStage, Tone> = {
  lead: 'amber',
  qualified: 'blue',
  site_visit: 'blue',
  proposal_sent: 'purple',
  negotiation: 'purple',
  won: 'green',
  lost: 'red',
}

const SOURCES = ['Indicação', 'Site', 'Instagram', 'Google', 'WhatsApp', 'Feira', 'Prospecção ativa', 'Outro']
const TYPES = ['Residencial', 'Comercial', 'Industrial', 'Rural', 'Poder público']

function leadForm(team: Member[], onSaved: () => Promise<void>): void {
  let draft: LeadInput = {
    name: '',
    email: null,
    phone: null,
    city: null,
    customer_type: null,
    source: null,
    stage: 'lead',
    estimated_value: null,
    assigned_to: null,
  }
  const patch = (part: Partial<LeadInput>) => {
    draft = { ...draft, ...part }
  }
  const clean = (value: string) => (value.trim() ? value.trim() : null)

  const handle = openModal({
    title: 'Novo lead',
    subtitle: 'Registre a oportunidade para acompanhá-la no funil de vendas.',
    width: '640px',
    body: h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      textField({ label: 'Nome do lead ou empresa', required: true, onInput: (v) => patch({ name: v }) }),
      formRow(
        '1fr 1fr',
        textField({ label: 'E-mail', type: 'email', onInput: (v) => patch({ email: clean(v) }) }),
        textField({ label: 'Telefone / WhatsApp', onInput: (v) => patch({ phone: clean(v) }) }),
      ),
      formRow(
        '1fr 1fr',
        textField({ label: 'Cidade', onInput: (v) => patch({ city: clean(v) }) }),
        selectField({
          label: 'Tipo de cliente',
          placeholder: 'Selecione',
          options: TYPES.map((t) => ({ value: t, label: t })),
          onChange: (v) => patch({ customer_type: v || null }),
        }),
      ),
      formRow(
        '1fr 1fr',
        selectField({
          label: 'Origem',
          placeholder: 'Selecione',
          options: SOURCES.map((s) => ({ value: s, label: s })),
          onChange: (v) => patch({ source: v || null }),
        }),
        textField({ label: 'Valor estimado (R$)', onInput: (v) => patch({ estimated_value: v.trim() ? parseMoney(v) : null }) }),
      ),
      formRow(
        '1fr 1fr',
        selectField({
          label: 'Estágio',
          value: 'lead',
          options: STAGES.map((s) => ({ value: s.key, label: s.label })),
          onChange: (v) => patch({ stage: v as LeadStage }),
        }),
        selectField({
          label: 'Responsável',
          placeholder: 'Sem responsável',
          options: team.map((m) => ({ value: m.userId, label: m.name })),
          onChange: (v) => patch({ assigned_to: v || null }),
        }),
      ),
    ),
    footer: [
      h('button.btn.btn-ghost', { onClick: () => handle.close() }, 'Cancelar'),
      h(
        'button.btn.btn-primary',
        {
          onClick: async () => {
            if (!draft.name.trim()) {
              toast('Informe o nome do lead.', 'error')
              return
            }
            const ok = await guard(async () => {
              await create(draft)
              await onSaved()
            }, 'Lead cadastrado.')
            if (ok) handle.close()
          },
        },
        'Salvar lead',
      ),
    ],
  })
}

export async function render(host: HTMLElement, ctx: RouteContext): Promise<void> {
  const team = await members()

  async function draw(): Promise<void> {
    const all = await findAll()
    const bucket = (ctx.query.get('filtro') as LeadBucket | null) ?? 'todos'
    const source = ctx.query.get('origem') ?? ''
    const owner = ctx.query.get('responsavel') ?? ''
    const from = ctx.query.get('de') ?? ''
    const to = ctx.query.get('ate') ?? ''

    const counts = {
      todos: all.length,
      novos: all.filter((lead) => bucketOf(lead) === 'novos').length,
      funil: all.filter((lead) => bucketOf(lead) === 'funil').length,
      convertidos: all.filter((lead) => bucketOf(lead) === 'convertidos').length,
      descartados: all.filter((lead) => bucketOf(lead) === 'descartados').length,
    }

    const rows = all.filter((lead) => {
      if (bucket !== 'todos' && bucketOf(lead) !== bucket) return false
      if (source && lead.source !== source) return false
      if (owner && lead.assigned_to !== owner) return false
      const day = lead.created_at.slice(0, 10)
      if (from && day < from) return false
      if (to && day > to) return false
      return true
    })

    const columns: Column<Lead>[] = [
      { key: 'name', label: 'Nome', sortable: true, render: (row) => h('b', row.name) },
      {
        key: 'contact',
        label: 'Contato',
        value: (row) => `${row.email ?? ''} ${row.phone ?? ''}`,
        render: (row) =>
          h(
            'div',
            h('div', orDash(row.email, 'Não informado.')),
            row.phone ? h('div.faint', { style: { fontSize: '11.5px' } }, fmtPhone(row.phone)) : null,
          ),
      },
      { key: 'source', label: 'Origem', sortable: true, render: (row) => orDash(row.source, 'Não informada') },
      {
        key: 'stage',
        label: 'Estágio',
        sortable: true,
        value: (row) => STAGE_LABEL[row.stage],
        render: (row) => badge(STAGE_LABEL[row.stage], STAGE_TONE[row.stage]),
      },
      {
        key: 'assigned_to',
        label: 'Responsável',
        value: (row) => nameOf(team, row.assigned_to),
        render: (row) => nameOf(team, row.assigned_to),
      },
      {
        key: 'estimated_value',
        label: 'Valor estimado',
        align: 'right',
        sortable: true,
        value: (row) => row.estimated_value ?? 0,
        render: (row) => (row.estimated_value ? money(row.estimated_value) : '—'),
      },
      {
        key: 'created_at',
        label: 'Criado em',
        sortable: true,
        render: (row) =>
          h(
            'div',
            h('div', date(row.created_at)),
            h('div.faint', { style: { fontSize: '11.5px' } }, `há ${daysSince(row.created_at)} dia(s)`),
          ),
      },
    ]

    mount(
      host,
      pageHead({
        title: 'Leads',
        crumbs: [{ label: 'Comercial' }, { label: 'Leads' }],
        actions: [h('button.btn.btn-primary', { onClick: () => leadForm(team, draw) }, '+ Novo Lead')],
      }),
      h(
        'div.stack',
        gridCols(
          5,
          ...BUCKETS.map((entry) =>
            statFilter({
              label: entry.label,
              value: String(counts[entry.id]),
              mark: entry.mark,
              tone: entry.tone,
              active: bucket === entry.id,
              onClick: () => setQuery({ filtro: entry.id === 'todos' ? null : entry.id }),
            }),
          ),
        ),
        card(
          { flush: true },
          h(
            'div.filter-bar',
            { style: { padding: '14px 16px 0', margin: '0' } },
            selectField({
              label: 'Origem',
              value: source,
              placeholder: 'Todas',
              options: SOURCES.map((s) => ({ value: s, label: s })),
              onChange: (v) => setQuery({ origem: v || null }),
            }),
            selectField({
              label: 'Responsável',
              value: owner,
              placeholder: 'Todos',
              options: team.map((m) => ({ value: m.userId, label: m.name })),
              onChange: (v) => setQuery({ responsavel: v || null }),
            }),
            textField({ label: 'Período de', type: 'date', value: from, onInput: (v) => setQuery({ de: v || null }) }),
            textField({ label: 'até', type: 'date', value: to, onInput: (v) => setQuery({ ate: v || null }) }),
            h(
              'button.btn.btn-ghost',
              { style: { alignSelf: 'flex-end' }, onClick: () => setQuery({ filtro: null, origem: null, responsavel: null, de: null, ate: null }) },
              'Limpar filtros',
            ),
          ),
          dataTable({
            columns,
            rows,
            searchable: true,
            searchPlaceholder: 'Buscar por nome ou contato…',
            pageSize: 10,
            initialSort: { key: 'created_at', ascending: false },
            emptyTitle: 'Sem conteúdo',
            emptyHint: 'Nenhum lead corresponde aos filtros selecionados.',
          }),
        ),
      ),
    )
  }

  await draw()
}
