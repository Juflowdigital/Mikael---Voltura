/** Topbar com busca global (Ctrl+K) e cluster de acoes a direita. */
import { h, icon, mount } from '../ui/dom'
import { initials } from '../core/format'
import { app } from '../core/session'
import { navigate } from '../core/router'
import { flatItems, type NavLocation } from './navigation'

const I = {
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><line x1="12" x2="12.01" y1="17" y2="17"/>',
  chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/>',
  spark: '<path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6 2.1-2.1"/><circle cx="12" cy="12" r="3"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  menu: '<line x1="3" x2="21" y1="6" y2="6"/><line x1="3" x2="21" y1="12" y2="12"/><line x1="3" x2="21" y1="18" y2="18"/>',
}

function iconButton(path: string, title: string, tint: string, soft: string, badge?: string): HTMLElement {
  return h(
    'div.topbar-icon',
    { title, style: { background: soft, color: tint } },
    icon(path, 15),
    badge ? h('span.topbar-badge', badge) : null,
  )
}

/** Paleta de busca aberta com Ctrl+K. */
function openPalette(): void {
  const results = h('div', { style: { maxHeight: '340px', overflowY: 'auto', padding: '6px' } })
  const input = h('input.input', { placeholder: 'Buscar tela, módulo ou página…', style: { border: '0', background: 'transparent', fontSize: '15px' } }) as HTMLInputElement

  const panel = h(
    'div.palette',
    {
      style: {
        width: 'min(560px,92vw)',
        background: 'var(--surface)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow)',
        overflow: 'hidden',
      },
      onClick: (event: MouseEvent) => event.stopPropagation(),
    },
    h('div.row', { style: { padding: '12px 16px', borderBottom: '1px solid var(--border)' } }, h('span.faint', icon(I.search, 16)), input),
    results,
  )

  const backdrop = h(
    'div',
    {
      style: { position: 'fixed', inset: '0', background: 'rgba(3,8,14,.7)', display: 'grid', placeItems: 'start center', paddingTop: '14vh', zIndex: '110' },
      onClick: () => close(),
    },
    panel,
  )

  function close(): void {
    document.removeEventListener('keydown', onKey)
    backdrop.remove()
  }

  function onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') close()
  }

  function draw(term: string): void {
    const query = term.trim().toLowerCase()
    const items: NavLocation[] = query
      ? flatItems().filter((entry) =>
          (entry.group.label + ' ' + entry.item.label).toLowerCase().includes(query),
        )
      : flatItems().slice(0, 8)

    mount(
      results,
      items.length
        ? items.slice(0, 40).map((entry) =>
            h(
              'div.palette-item',
              {
                style: { padding: '9px 12px', borderRadius: '8px', cursor: 'pointer' },
                onMouseEnter: (event: MouseEvent) => ((event.currentTarget as HTMLElement).style.background = 'var(--surface-2)'),
                onMouseLeave: (event: MouseEvent) => ((event.currentTarget as HTMLElement).style.background = 'transparent'),
                onClick: () => {
                  close()
                  navigate(entry.path)
                },
              },
              h('div', { style: { fontSize: '13.5px', fontWeight: '600' } }, entry.item.label),
              h('div.faint', { style: { fontSize: '11.5px' } }, entry.group.label),
            ),
          )
        : h('div.faint', { style: { padding: '18px', fontSize: '13px', textAlign: 'center' } }, 'Nada encontrado para esta busca'),
    )
  }

  input.addEventListener('input', () => draw(input.value))
  document.addEventListener('keydown', onKey)
  document.body.appendChild(backdrop)
  draw('')
  input.focus()
}

export function renderTopbar(host: HTMLElement): void {
  const state = app.get()

  mount(
    host,
    h(
      'button.btn.btn-ghost.btn-icon',
      {
        class: 'btn btn-ghost btn-icon mobile-only',
        style: { display: 'none' },
        'aria-label': 'Abrir menu',
        onClick: () => app.set({ mobileMenuOpen: !state.mobileMenuOpen }),
      },
      icon(I.menu, 17),
    ),
    h(
      'div.topbar-search',
      { onClick: openPalette },
      h('span', icon(I.search, 15)),
      h('span', { style: { flex: '1', fontSize: '13px' } }, 'Pesquisar'),
      h('span.topbar-kbd', 'Ctrl+K'),
    ),
    h('span.spacer'),
    h(
      'div.topbar-actions',
      iconButton(I.help, 'Ajuda', '#38bdf8', 'rgba(56,189,248,.16)'),
      iconButton(I.chat, 'Enviar feedback', '#f472b6', 'rgba(244,114,182,.16)'),
      iconButton(I.spark, 'Assistente', '#a78bfa', 'rgba(167,139,250,.16)'),
      iconButton(I.bell, 'Notificações', '#f6a623', 'rgba(246,166,35,.16)'),
      h(
        'div.avatar',
        {
          title: state.user?.name ?? '',
          style: {
            width: '32px',
            height: '32px',
            fontSize: '12.5px',
            background: 'var(--green-soft)',
            color: 'var(--green)',
            border: '2px solid var(--green)',
          },
        },
        initials(state.user?.name),
      ),
    ),
  )
}

export function bindPaletteShortcut(): void {
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault()
      openPalette()
    }
  })
}
