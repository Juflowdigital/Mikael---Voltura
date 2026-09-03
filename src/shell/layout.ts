/** Monta o shell da aplicacao e conecta router, store e telas. */
import { h, mount } from '../ui/dom'
import { errorState, loadingState } from '../ui/components/feedback'
import { app } from '../core/session'
import { currentRoute, onRouteChange, type RouteContext } from '../core/router'
import { NAV } from './navigation'
import { screenLoader } from '../modules/registry'
import { renderPending } from '../modules/pending'
import { renderSidebar } from './sidebar'
import { bindPaletteShortcut, renderTopbar } from './topbar'
import { renderLogin } from './login'

const root = document.getElementById('app')
if (!root) throw new Error('Elemento #app não encontrado no HTML.')

const sidebar = h('aside.app-sidebar')
const topbar = h('header.app-topbar')
const content = h('main.app-content')
const shell = h('div.app-root', sidebar, h('div.app-main', topbar, content))

let renderToken = 0

async function renderScreen(route: RouteContext): Promise<void> {
  const token = ++renderToken
  mount(content, loadingState())

  const loader = screenLoader(route.path)
  if (!loader) {
    renderPending(content, route)
    return
  }

  try {
    const module = await loader()
    if (token !== renderToken) return
    content.replaceChildren()
    await module.render(content, route)
  } catch (error) {
    if (token !== renderToken) return
    errorState(content, error, () => void renderScreen(route))
  }
}

/** Mantem aberto no menu o grupo da tela atual, como faz o ASTER. */
function syncOpenGroup(route: RouteContext): void {
  const group = NAV.find((entry) => route.path.startsWith('/' + entry.slug + '/'))
  if (group && app.get().sidebarOpenGroup !== group.label) app.set({ sidebarOpenGroup: group.label })
}

function renderShell(): void {
  const state = app.get()

  if (state.status === 'loading') {
    mount(root!, loadingState('Carregando o Voltura…'))
    return
  }

  if (state.status === 'login') {
    mount(root!, h('div'))
    renderLogin(root!)
    return
  }

  if (root!.firstChild !== shell) mount(root!, shell)
  renderSidebar(sidebar)
  renderTopbar(topbar)
}

export function startLayout(): void {
  bindPaletteShortcut()

  let lastStatus = ''

  app.subscribe(() => {
    const state = app.get()
    renderShell()
    if (state.status === 'ready' && lastStatus !== 'ready') {
      lastStatus = 'ready'
      syncOpenGroup(currentRoute())
      void renderScreen(currentRoute())
    }
    if (state.status !== 'ready') lastStatus = state.status
  })

  onRouteChange((route) => {
    if (app.get().status !== 'ready') return
    syncOpenGroup(route)
    renderSidebar(sidebar)
    void renderScreen(route)
  })

  renderShell()
}
