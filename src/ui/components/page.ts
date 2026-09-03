/** Cabecalho padrao de pagina: titulo, breadcrumb e acoes a direita. */
import { h, type Child } from '../dom'
import { navigate } from '../../core/router'

export interface Crumb {
  label: string
  path?: string
}

export function breadcrumb(crumbs: Crumb[]): HTMLElement {
  const nodes: Child[] = []
  crumbs.forEach((crumb, index) => {
    if (index > 0) nodes.push(h('span.crumb-sep', '●'))
    const isLast = index === crumbs.length - 1
    nodes.push(
      crumb.path && !isLast
        ? h('span.crumb-link', { onClick: () => navigate(crumb.path as string) }, crumb.label)
        : h(isLast ? 'span.crumb-current' : 'span', crumb.label),
    )
  })
  return h('nav.breadcrumb', nodes)
}

export interface PageHeadOptions {
  title: string
  crumbs?: Crumb[]
  subtitle?: string
  actions?: Child[]
}

export function pageHead(options: PageHeadOptions): HTMLElement {
  return h(
    'header.page-head',
    h(
      'div',
      h('h1.page-title', options.title),
      options.crumbs?.length ? breadcrumb(options.crumbs) : null,
      options.subtitle ? h('p.muted', { style: { margin: '6px 0 0', fontSize: '13px' } }, options.subtitle) : null,
    ),
    options.actions?.length ? h('div.page-head-actions', options.actions) : null,
  )
}

/** Texto explicativo em bloco, como o cabecalho de Dimensionamentos no ASTER. */
export function pageNote(text: string): HTMLElement {
  return h('p.muted', { style: { margin: '-8px 0 18px', fontSize: '13px', maxWidth: '900px' } }, text)
}
