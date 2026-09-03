/** Tela exibida enquanto um modulo ainda nao foi migrado nesta fase. */
import { h, mount } from '../ui/dom'
import { card } from '../ui/components/card'
import { pageHead } from '../ui/components/page'
import { banner } from '../ui/components/feedback'
import type { RouteContext } from '../core/router'

const LEGACY_URL = './Voltua%20ERP.dc.html'

export function renderPending(host: HTMLElement, ctx: RouteContext): void {
  mount(
    host,
    pageHead({
      title: ctx.location.item.label,
      crumbs: [{ label: ctx.location.group.label }, { label: ctx.location.item.label }],
    }),
    card(
      {},
      banner(
        'info',
        h('div', { style: { fontWeight: '650', marginBottom: '3px' } }, 'Tela em migração'),
        h(
          'div.muted',
          { style: { fontSize: '12.5px' } },
          'Esta página está sendo reconstruída no novo padrão. Enquanto isso, ela continua disponível e funcional no sistema atual.',
        ),
      ),
      h(
        'div',
        { style: { marginTop: '16px' } },
        h(
          'a.btn.btn-primary',
          { href: LEGACY_URL, target: '_blank', rel: 'noopener' },
          'Abrir no sistema atual',
        ),
      ),
    ),
  )
}
