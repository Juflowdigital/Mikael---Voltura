/**
 * Catalogo de relatorios. Todos os modulos usam o mesmo cartao e o mesmo
 * fluxo de geracao de CSV, entao a montagem fica em um lugar so.
 */
import { h, icon, mount } from '../dom'
import { pageHead, type Crumb } from './page'
import { guard } from './feedback'
import { downloadCsv, toCsv } from '../../core/csv'
import { isoDay } from '../../core/format'

export interface ReportDef {
  id: string
  title: string
  description: string
  mark: string
  color: string
  soft: string
  build: () => Promise<{ headers: string[]; rows: unknown[][] }>
}

function reportCard(report: ReportDef): HTMLElement {
  const button = h('button.btn.btn-primary', { style: { marginTop: '14px' } }, 'Gerar CSV') as HTMLButtonElement

  button.addEventListener('click', async () => {
    button.disabled = true
    button.textContent = 'Gerando…'
    await guard(async () => {
      const { headers, rows } = await report.build()
      downloadCsv(report.id + '-' + isoDay(), toCsv(headers, rows))
    }, 'Relatório gerado. O download começou.')
    button.disabled = false
    button.textContent = 'Gerar CSV'
  })

  return h(
    'article.card',
    { style: { padding: '20px' } },
    h('div.kpi-icon', { style: { background: report.soft, color: report.color, width: '38px', height: '38px' } }, icon(report.mark, 17)),
    h('div', { style: { fontSize: '15px', fontWeight: '650', marginTop: '14px' } }, report.title),
    h('div.muted', { style: { fontSize: '12.5px', marginTop: '6px', lineHeight: '1.55' } }, report.description),
    button,
  )
}

/** Monta a tela de relatorios de um modulo. */
export function renderReports(host: HTMLElement, crumbs: Crumb[], reports: ReportDef[]): void {
  mount(
    host,
    pageHead({ title: 'Relatórios', crumbs }),
    h('div.grid', { style: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' } }, reports.map(reportCard)),
  )
}

/** Icones reutilizados pelos catalogos de relatorio. */
export const REPORT_ICONS = {
  box: '<path d="M21 8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5"/>',
  truck: '<path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.3a4 4 0 0 0-1.1-2.8L19 9h-5v8h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  money: '<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>',
  chart: '<line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M18 2H6v7a6 6 0 0 0 12 0z"/>',
} as const
