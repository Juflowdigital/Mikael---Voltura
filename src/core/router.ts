/** Router por hash: `#/comercial/clientes?tab=todos`. */
import { DEFAULT_PATH, findLocation, type NavLocation } from '../shell/navigation'

export interface RouteContext {
  /** Caminho sem query, ex.: `/comercial/clientes`. */
  path: string
  location: NavLocation
  query: URLSearchParams
}

export type ScreenRender = (host: HTMLElement, ctx: RouteContext) => void | Promise<void>
export type ScreenLoader = () => Promise<{ render: ScreenRender }>

function parseHash(hash: string): { path: string; query: URLSearchParams } {
  const raw = hash.replace(/^#/, '') || DEFAULT_PATH
  const [path, search = ''] = raw.split('?')
  return { path: path.startsWith('/') ? path : '/' + path, query: new URLSearchParams(search) }
}

export function currentRoute(): RouteContext {
  const { path, query } = parseHash(location.hash)
  const found = findLocation(path) ?? findLocation(DEFAULT_PATH)
  if (!found) throw new Error('Rota padrão não encontrada na navegação.')
  return { path: found.path, location: found, query }
}

export function navigate(path: string, query?: Record<string, string>): void {
  const search = query && Object.keys(query).length ? '?' + new URLSearchParams(query).toString() : ''
  const next = '#' + path + search
  if (location.hash === next) window.dispatchEvent(new HashChangeEvent('hashchange'))
  else location.hash = next
}

/** Troca apenas parametros da query, preservando a tela atual. */
export function setQuery(patch: Record<string, string | null>): void {
  const { path, query } = currentRoute()
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === '') query.delete(key)
    else query.set(key, value)
  }
  const search = query.toString()
  location.hash = '#' + path + (search ? '?' + search : '')
}

export function onRouteChange(handler: (route: RouteContext) => void): () => void {
  const listener = () => handler(currentRoute())
  window.addEventListener('hashchange', listener)
  return () => window.removeEventListener('hashchange', listener)
}

export function ensureHash(): void {
  if (!location.hash || location.hash === '#') location.replace('#' + DEFAULT_PATH)
}
