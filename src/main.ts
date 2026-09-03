/** Entrada do novo Voltura ERP (padrao ASTER). */
import './ui/tokens.css'
import { ensureHash } from './core/router'
import { restoreSession } from './core/session'
import { startLayout } from './shell/layout'

ensureHash()
startLayout()
void restoreSession()

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined)
  })
}
