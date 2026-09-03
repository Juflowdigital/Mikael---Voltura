/** Estados vazios, banners, carregamento e toasts. */
import { h, icon, mount, type Child } from '../dom'

const ICON_INBOX =
  '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>'

export interface EmptyOptions {
  title?: string
  hint?: string
  action?: Child
}

export function emptyState(options: EmptyOptions = {}): HTMLElement {
  return h(
    'div.empty',
    h('div.empty-icon', icon(ICON_INBOX, 22)),
    h('div', { style: { fontSize: '13.5px', fontWeight: '600' } }, options.title ?? 'Sem conteúdo'),
    options.hint ? h('div.faint', { style: { fontSize: '12.5px', maxWidth: '360px' } }, options.hint) : null,
    options.action ?? null,
  )
}

export function loadingState(label = 'Carregando…'): HTMLElement {
  return h(
    'div.empty',
    h('div.empty-icon', h('span', { style: { fontSize: '16px' } }, '◌')),
    h('div.muted', { style: { fontSize: '13px' } }, label),
  )
}

/** Linhas cinza animadas, como o painel de analise do ASTER. */
export function skeleton(widths: string[] = ['100%', '84%', '92%']): HTMLElement {
  return h(
    'div',
    { style: { display: 'flex', flexDirection: 'column', gap: '9px' } },
    widths.map((width) =>
      h('div', {
        style: {
          height: '13px',
          width,
          borderRadius: '99px',
          background: 'linear-gradient(90deg,var(--surface-2),var(--surface-3),var(--surface-2))',
          backgroundSize: '200% 100%',
          animation: 'volt-shimmer 1.4s ease infinite',
        },
      }),
    ),
  )
}

export type BannerKind = 'info' | 'warn' | 'danger'

export function banner(kind: BannerKind, ...content: Child[]): HTMLElement {
  const marks: Record<BannerKind, string> = { info: 'ⓘ', warn: '⚠', danger: '⚠' }
  return h('div', { class: 'banner banner-' + kind }, h('span', { style: { fontSize: '15px' } }, marks[kind]), h('div', content))
}

let host: HTMLElement | null = null

function toastHost(): HTMLElement {
  if (!host) {
    host = h('div.toast-host')
    document.body.appendChild(host)
  }
  return host
}

/** Quantos avisos ficam visiveis ao mesmo tempo antes de descartar os mais antigos. */
const MAX_TOASTS = 3

export function toast(message: string, kind: 'info' | 'success' | 'error' = 'info'): void {
  const host = toastHost()
  const node = h('div', { class: 'toast' + (kind === 'info' ? '' : ' is-' + kind) }, message)
  host.appendChild(node)

  while (host.childElementCount > MAX_TOASTS) host.firstElementChild?.remove()

  setTimeout(() => node.remove(), kind === 'error' ? 6500 : 4000)
}

/** Executa uma acao mostrando erro em toast. Retorna true quando concluiu. */
export async function guard(action: () => Promise<void>, successMessage?: string): Promise<boolean> {
  try {
    await action()
    if (successMessage) toast(successMessage, 'success')
    return true
  } catch (error) {
    toast((error as Error).message, 'error')
    return false
  }
}

/** Renderiza um estado de erro dentro do host informado. */
export function errorState(container: HTMLElement, error: unknown, retry?: () => void): void {
  mount(
    container,
    h(
      'div.empty',
      h('div.empty-icon', { style: { color: 'var(--red)', borderColor: 'var(--red)' } }, '!'),
      h('div', { style: { fontSize: '13.5px', fontWeight: '600' } }, 'Não foi possível carregar esta tela'),
      h('div.faint', { style: { fontSize: '12.5px', maxWidth: '460px' } }, (error as Error).message),
      retry ? h('button.btn', { onClick: retry }, 'Tentar novamente') : null,
    ),
  )
}
