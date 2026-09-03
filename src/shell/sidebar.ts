/** Barra lateral com grupos colapsaveis e icones coloridos por modulo. */
import { h, icon, mount } from '../ui/dom'
import { initials } from '../core/format'
import { app, signOut } from '../core/session'
import { currentRoute, navigate } from '../core/router'
import { NAV, type NavGroup } from './navigation'

const LOGO =
  '<circle cx="24" cy="9.5" r="4.5" fill="currentColor" stroke="none"/>' +
  '<path d="M8 15 L16 15 L26.5 42 L20 42 Z" fill="currentColor" stroke="none"/>' +
  '<path d="M40 15 L32 15 L21.5 42 L28 42 Z" fill="currentColor" stroke="none" opacity="0.8"/>'

function brandMark(size = 18): HTMLElement {
  const svg = h('svg', { width: size, height: size, viewBox: '0 0 48 48' })
  svg.innerHTML = LOGO
  svg.style.color = 'var(--on-accent)'
  return svg
}

function groupNode(group: NavGroup, activePath: string, openGroup: string | null): HTMLElement {
  const isCurrent = activePath.startsWith('/' + group.slug + '/')
  const isOpen = openGroup === group.label

  const head = h(
    'div',
    {
      class: 'sidebar-group' + (isCurrent ? ' is-active' : ''),
      'data-group': group.slug,
      title: group.label,
      onClick: () => app.set({ sidebarOpenGroup: isOpen ? null : group.label }),
    },
    h('span.sidebar-icon', { style: { background: group.soft, color: group.color } }, icon(group.icon, 14)),
    h('span.sidebar-label', group.label),
    h('span.sidebar-chevron', isOpen ? '▾' : '▸'),
  )

  if (!isOpen) return h('div', head)

  return h(
    'div',
    head,
    h(
      'div.sidebar-sub',
      group.items.map((item) => {
        const path = '/' + group.slug + '/' + item.slug
        return h(
          'div',
          {
            class: 'sidebar-sub-item' + (path === activePath ? ' is-active' : ''),
            'data-path': path,
            onClick: () => navigate(path),
          },
          item.label,
        )
      }),
    ),
  )
}

export function renderSidebar(host: HTMLElement): void {
  const state = app.get()
  const activePath = currentRoute().path

  host.className =
    'app-sidebar' + (state.sidebarCollapsed ? ' is-collapsed' : '') + (state.mobileMenuOpen ? ' is-open' : '')

  mount(
    host,
    h(
      'div.sidebar-brand',
      h(
        'div.row',
        { style: { gap: '10px', cursor: 'pointer' }, title: 'Ir para o painel', onClick: () => navigate('/inicio/painel') },
        h('div.sidebar-brand-mark', brandMark()),
        h('div.sidebar-brand-text', 'VOLTURA'),
      ),
      h(
        'div.sidebar-collapse',
        {
          title: state.sidebarCollapsed ? 'Expandir menu' : 'Recolher menu',
          onClick: () => app.set({ sidebarCollapsed: !state.sidebarCollapsed }),
        },
        state.sidebarCollapsed ? '›' : '‹',
      ),
    ),
    h('nav.sidebar-nav', NAV.map((group) => groupNode(group, activePath, state.sidebarOpenGroup))),
    h(
      'div.sidebar-user',
      h(
        'div.avatar',
        { style: { width: '30px', height: '30px', background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: '12px' } },
        initials(state.user?.name),
      ),
      h(
        'div.sidebar-user-info',
        { style: { flex: '1', minWidth: '0' } },
        h('div', { style: { fontSize: '12.5px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, state.user?.name ?? '—'),
        h('div.faint', { style: { fontSize: '11px' } }, state.user?.roleLabel ?? ''),
      ),
      h(
        'div.sidebar-user-info',
        {
          title: 'Sair',
          style: { cursor: 'pointer', fontSize: '11px', color: 'var(--text-faint)', border: '1px solid var(--border)', borderRadius: '7px', padding: '4px 8px' },
          onClick: () => void signOut(),
        },
        'Sair',
      ),
    ),
  )
}

export { brandMark }
