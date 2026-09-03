/**
 * Rede de seguranca do router: uma rota valida no menu que ainda nao tenha
 * tela registrada cai aqui. Em condicao normal isso nunca aparece — o
 * `npm run check` falha antes, exigindo tela propria para todo item de menu.
 */
import { h, mount } from '../ui/dom'
import { card } from '../ui/components/card'
import { pageHead } from '../ui/components/page'
import { banner } from '../ui/components/feedback'
import { navigate, type RouteContext } from '../core/router'

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
        'warn',
        h(
          'div',
          h('div', { style: { fontWeight: '650', marginBottom: '3px' } }, 'Tela indisponível'),
          h(
            'div.muted',
            { style: { fontSize: '12.5px' } },
            'Esta página existe no menu mas ainda não tem tela registrada. Avise o suporte informando o endereço ' + ctx.path + '.',
          ),
        ),
      ),
      h(
        'div',
        { style: { marginTop: '16px' } },
        h('button.btn.btn-primary', { onClick: () => navigate('/inicio/painel') }, 'Voltar ao painel'),
      ),
    ),
  )
}
