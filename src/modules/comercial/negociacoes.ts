/** Comercial › Gestão de Negociações — cartoes-filtro e lista agrupada (tela M10). */
import { h, mount } from '../../ui/dom'
import { card, gridCols } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { statFilter, KPI_ICONS } from '../../ui/components/kpi'
import { dataTable, type Column } from '../../ui/components/table'
import { badge } from '../../ui/components/badge'
import { date, money, power } from '../../core/format'
import { navigate, setQuery, type RouteContext } from '../../core/router'
import {
  clientCity,
  clientName,
  dealBucket,
  findAll,
  powerKwp,
  PROPOSAL_LABEL,
  PROPOSAL_TONE,
  type DealBucket,
} from '../../data/proposals'
import type { Proposal } from '../../core/types'

const BUCKETS: { id: DealBucket; label: string; mark: string; tone: string }[] = [
  { id: 'todas', label: 'Total geral', mark: KPI_ICONS.chart, tone: 'var(--accent)' },
  { id: 'andamento', label: 'Em andamento', mark: KPI_ICONS.clock, tone: '#f6a623' },
  { id: 'aceitas', label: 'Aceitas', mark: KPI_ICONS.check, tone: '#22c55e' },
  { id: 'perdidas', label: 'Perdidas', mark: KPI_ICONS.alert, tone: '#ef4444' },
  { id: 'arquivadas', label: 'Arquivadas', mark: KPI_ICONS.archive, tone: '#8ba0b8' },
]

const BUCKET_TITLE: Record<DealBucket, string> = {
  todas: 'Todas as negociações',
  andamento: 'Em Andamento',
  aceitas: 'Aceitas',
  perdidas: 'Perdidas',
  arquivadas: 'Arquivadas',
}

export async function render(host: HTMLElement, ctx: RouteContext): Promise<void> {
  const all = await findAll()
  const bucket = (ctx.query.get('filtro') as DealBucket | null) ?? 'andamento'
  const rows = bucket === 'todas' ? all : all.filter((proposal) => dealBucket(proposal) === bucket)

  const counts: Record<DealBucket, number> = {
    todas: all.length,
    andamento: all.filter((p) => dealBucket(p) === 'andamento').length,
    aceitas: all.filter((p) => dealBucket(p) === 'aceitas').length,
    perdidas: all.filter((p) => dealBucket(p) === 'perdidas').length,
    arquivadas: all.filter((p) => dealBucket(p) === 'arquivadas').length,
  }

  const columns: Column<Proposal>[] = [
    {
      key: 'title',
      label: 'Título',
      sortable: true,
      value: (row) => '#' + row.proposal_number,
      render: (row) => h('b', 'Proposta #' + row.proposal_number),
    },
    { key: 'client', label: 'Cliente', sortable: true, value: clientName, render: clientName },
    { key: 'city', label: 'Cidade/Estado', value: clientCity, render: clientCity },
    { key: 'created_at', label: 'Data de criação', sortable: true, render: (row) => date(row.created_at) },
    {
      key: 'power',
      label: 'Potência (kWp)',
      align: 'right',
      sortable: true,
      value: (row) => powerKwp(row) ?? 0,
      render: (row) => power(powerKwp(row)),
    },
    {
      key: 'total_value',
      label: 'Preço',
      align: 'right',
      sortable: true,
      value: (row) => row.total_value ?? 0,
      render: (row) => (row.total_value ? money(row.total_value) : '—'),
    },
    {
      key: 'status',
      label: 'Status',
      value: (row) => PROPOSAL_LABEL[row.status],
      render: (row) => badge(PROPOSAL_LABEL[row.status], PROPOSAL_TONE[row.status]),
    },
  ]

  mount(
    host,
    pageHead({
      title: 'Gestão de Negociações',
      crumbs: [{ label: 'Comercial' }, { label: 'Gestão de Negociações' }],
      actions: [
        h('button.btn', { onClick: () => navigate('/comercial/funil-de-vendas') }, 'Funil de Vendas'),
        h('button.btn.btn-primary', { onClick: () => navigate('/comercial/dimensionamentos') }, '+ Nova Negociação'),
      ],
    }),
    h(
      'div.stack',
      gridCols(
        5,
        ...BUCKETS.map((entry) =>
          statFilter({
            label: entry.label,
            value: String(counts[entry.id]),
            hint: counts[entry.id] === 1 ? 'negociação' : 'negociações',
            mark: entry.mark,
            tone: entry.tone,
            active: bucket === entry.id,
            onClick: () => setQuery({ filtro: entry.id }),
          }),
        ),
      ),
      card(
        { title: BUCKET_TITLE[bucket], tools: [h('span.faint', { style: { fontSize: '12px' } }, `Mostrando ${rows.length} de ${all.length}`)], flush: true },
        dataTable({
          columns,
          rows,
          searchable: true,
          searchPlaceholder: 'Buscar…',
          initialSort: { key: 'created_at', ascending: false },
          emptyTitle: 'Nenhuma negociação nesta situação',
          emptyHint: 'Crie um dimensionamento e converta-o em negociação.',
          totalLabel: (total) => `Todas as ${total} negociações carregadas`,
        }),
      ),
    ),
  )
}
