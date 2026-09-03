/** Cartoes de indicador e cartoes-filtro clicaveis. */
import { h, icon, type Child } from '../dom'

export interface KpiOptions {
  label: string
  value: Child
  hint?: string
  /** Path SVG do icone. */
  mark?: string
  color?: string
  soft?: string
  onClick?: () => void
}

export function kpiCard(options: KpiOptions): HTMLElement {
  const color = options.color ?? 'var(--blue)'
  const soft = options.soft ?? 'rgba(56,189,248,.13)'
  return h(
    'article.kpi',
    { style: options.onClick ? { cursor: 'pointer' } : {}, onClick: options.onClick },
    options.mark
      ? h('div.kpi-icon', { style: { background: soft, color } }, icon(options.mark, 17))
      : null,
    h(
      'div',
      { style: { minWidth: '0' } },
      h('div.kpi-label', options.label),
      h('div.kpi-value', options.value),
      options.hint ? h('div.kpi-hint', options.hint) : null,
    ),
  )
}

/** Placeholder "EM BREVE" usado pelo ASTER em indicadores ainda nao ligados. */
export function kpiSoon(label: string, mark?: string, color?: string, soft?: string): HTMLElement {
  return kpiCard({
    label,
    value: h('span.faint', { style: { fontSize: '12px', fontWeight: '700', letterSpacing: '.08em' } }, 'EM BREVE'),
    mark,
    color,
    soft,
  })
}

export interface StatFilterOptions {
  label: string
  value: Child
  hint?: string
  active?: boolean
  tone?: string
  mark?: string
  onClick?: () => void
}

export function statFilter(options: StatFilterOptions): HTMLElement {
  return h(
    'article',
    {
      class: 'stat-filter' + (options.active ? ' is-active' : ''),
      onClick: options.onClick,
    },
    h(
      'div.stat-filter-label',
      options.mark ? h('span', { style: { color: options.tone ?? 'var(--text-muted)' } }, icon(options.mark, 13)) : null,
      options.label,
    ),
    h('div.stat-filter-value', options.value),
    options.hint ? h('div.stat-filter-hint', options.hint) : null,
  )
}

/** Icones usados com frequencia nos indicadores. */
export const KPI_ICONS = {
  money: '<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  check: '<path d="M21.8 10A10 10 0 1 1 17 3.3"/><path d="m9 11 3 3L22 4"/>',
  chart: '<line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5"/>',
  building: '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/>',
  box: '<path d="M21 8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
  alert: '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>',
  calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.7V17c0 .6-.1 1.2-.5 1.6L8 20h8l-1.5-1.4c-.4-.4-.5-1-.5-1.6v-2.3"/><path d="M18 2H6v7a6 6 0 0 0 12 0z"/>',
  archive: '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
} as const
