/** Card padrao com cabecalho, ferramentas e corpo. */
import { h, type Child } from '../dom'
import { navigate } from '../../core/router'

export interface CardOptions {
  title?: string
  subtitle?: string
  /** Icone SVG inline exibido antes do titulo. */
  mark?: Child
  tools?: Child[]
  /** Link "Ver todos →" no rodape. */
  footerLink?: { label: string; path: string }
  /** Remove o padding do corpo (util para tabelas coladas na borda). */
  flush?: boolean
}

export function card(options: CardOptions, ...body: Child[]): HTMLElement {
  const hasHead = options.title || options.tools?.length
  return h(
    'section.card',
    hasHead
      ? h(
          'div.card-head',
          options.mark ?? null,
          h('div', h('div', options.title ?? ''), options.subtitle ? h('div.card-sub', options.subtitle) : null),
          options.tools?.length ? h('div.card-tools', options.tools) : null,
        )
      : null,
    options.flush ? h('div', body) : h('div.card-body', body),
    options.footerLink
      ? h(
          'div',
          { style: { padding: '0 18px 15px', textAlign: 'right' } },
          h(
            'span',
            {
              style: { color: 'var(--accent)', fontSize: '12.5px', fontWeight: '650', cursor: 'pointer' },
              onClick: () => navigate(options.footerLink!.path),
            },
            options.footerLink.label + ' →',
          ),
        )
      : null,
  )
}

/** Grade responsiva de colunas iguais. */
export function gridCols(columns: number, ...children: Child[]): HTMLElement {
  return h(
    'div.grid',
    { style: { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } },
    children,
  )
}

/** Grade com proporcoes livres, ex.: `gridTemplate('1.6fr 1fr', a, b)`. */
export function gridTemplate(template: string, ...children: Child[]): HTMLElement {
  return h('div.grid', { style: { gridTemplateColumns: template } }, children)
}
