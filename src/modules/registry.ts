/**
 * Registro de telas. Cada rota carrega seu modulo sob demanda (code splitting).
 * Rotas ausentes caem no fallback `pending`, que aponta para o sistema atual
 * enquanto a migracao por fases nao alcanca aquele modulo.
 */
import type { ScreenLoader } from '../core/router'

export const SCREENS: Record<string, ScreenLoader> = {
  '/inicio/painel': () => import('./inicio/painel'),
  '/comercial/visao-geral': () => import('./comercial/visao-geral'),
  '/comercial/clientes': () => import('./comercial/clientes'),
  '/comercial/leads': () => import('./comercial/leads'),
  '/comercial/dimensionamentos': () => import('./comercial/dimensionamentos'),
  '/comercial/negociacoes': () => import('./comercial/negociacoes'),
  '/comercial/funil-de-vendas': () => import('./comercial/funil-de-vendas'),
  '/comercial/relatorios': () => import('./comercial/relatorios'),
}

export function screenLoader(path: string): ScreenLoader | null {
  return SCREENS[path] ?? null
}
