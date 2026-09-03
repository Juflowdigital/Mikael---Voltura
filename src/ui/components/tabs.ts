/** Abas com contador, no padrao das telas de Contratos e Modelos do ASTER. */
import { h, type Child } from '../dom'

export interface TabDef {
  id: string
  label: string
  count?: number
  mark?: Child
}

export interface TabsOptions {
  tabs: TabDef[]
  active: string
  onChange: (id: string) => void
}

export function tabs(options: TabsOptions): HTMLElement {
  return h(
    'div.tabs',
    options.tabs.map((tab) =>
      h(
        'div',
        {
          class: 'tab' + (tab.id === options.active ? ' is-active' : ''),
          onClick: () => tab.id !== options.active && options.onChange(tab.id),
        },
        tab.mark ?? null,
        tab.label,
        tab.count === undefined ? null : h('span.tab-count', String(tab.count)),
      ),
    ),
  )
}
