/** Autenticacao e carregamento do tenant (organizacao ativa). */
import { supabase } from '../lib/supabase'
import { setOrganization, signedUrl } from '../data/db'
import { createStore } from './store'
import type { AppState, Organization, OrganizationSettings, Role, SessionUser } from './types'

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrador',
  commercial: 'Comercial / Vendedor',
  engineering: 'Engenharia / Projetos',
  installer: 'Instalador',
  finance: 'Financeiro',
  viewer: 'Visualizador',
}

const EMPTY_SETTINGS: OrganizationSettings = {
  calculation: {},
  alerts: {},
  integrations: {},
  document_models: [],
  approval_rules: [],
}

export const app = createStore<AppState>({
  status: 'loading',
  user: null,
  organizationId: null,
  organization: null,
  settings: null,
  logoUrl: '',
  sidebarCollapsed: false,
  sidebarOpenGroup: null,
  mobileMenuOpen: false,
  authEmail: '',
  authError: '',
  authLoading: true,
})

async function loadTenant(organizationId: string): Promise<void> {
  const [orgResult, settingsResult] = await Promise.all([
    supabase
      .from('organizations')
      .select('id,name,legal_name,tax_id,city,state,utility_company,logo_path,address,branches')
      .eq('id', organizationId)
      .single(),
    supabase
      .from('organization_settings')
      .select('calculation,alerts,integrations,document_models,approval_rules')
      .eq('organization_id', organizationId)
      .maybeSingle(),
  ])

  if (orgResult.error) throw new Error('Falha ao carregar a empresa: ' + orgResult.error.message)
  if (settingsResult.error) throw new Error('Falha ao carregar as configurações: ' + settingsResult.error.message)

  const organization = orgResult.data as unknown as Organization
  const logoUrl = organization.logo_path ? await signedUrl(organization.logo_path) : ''

  app.set({
    organization,
    settings: (settingsResult.data as OrganizationSettings | null) ?? EMPTY_SETTINGS,
    logoUrl,
  })
}

/**
 * Le o nome do perfil. Logo apos o login o token as vezes ainda nao esta
 * propagado e a primeira leitura volta 401 — nesse caso tenta uma vez mais,
 * senao a saudacao cairia no e-mail sem nenhum aviso.
 */
async function profileName(userId: string): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data, error } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle()
    if (!error) return data?.full_name ?? ''
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  return ''
}

async function enterSession(userId: string, email: string): Promise<void> {
  const membershipResult = await supabase
    .from('organization_members')
    .select('role,organization_id')
    .eq('user_id', userId)
    .eq('active', true)
    .limit(1)
    .maybeSingle()

  if (membershipResult.error) throw new Error('Falha ao verificar o acesso: ' + membershipResult.error.message)
  if (!membershipResult.data) {
    throw new Error('Usuário sem acesso a uma organização. Peça ao administrador para adicioná-lo à equipe.')
  }

  const role = membershipResult.data.role as Role
  const user: SessionUser = {
    id: userId,
    email,
    name: (await profileName(userId)) || email,
    role,
    roleLabel: ROLE_LABEL[role] ?? 'Visualizador',
  }

  setOrganization(membershipResult.data.organization_id)
  app.set({
    status: 'ready',
    user,
    organizationId: membershipResult.data.organization_id,
    authLoading: false,
    authError: '',
  })

  await loadTenant(membershipResult.data.organization_id)
}

/** Aceita um convite quando `?invite=` esta na URL. */
async function consumeInvitation(): Promise<boolean> {
  const token = new URLSearchParams(location.search).get('invite')
  if (!token) return false

  const { error } = await supabase.rpc('accept_organization_invitation', { invitation_token: token })
  if (error) throw new Error('Não foi possível aceitar o convite: ' + error.message)
  history.replaceState({}, '', location.pathname + location.hash)
  return true
}

export async function restoreSession(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      app.set({ status: 'login', authLoading: false })
      return false
    }
    await consumeInvitation()
    await enterSession(data.session.user.id, data.session.user.email ?? '')
    return true
  } catch (error) {
    app.set({ status: 'login', authLoading: false, authError: (error as Error).message })
    return false
  }
}

export async function signIn(email: string, password: string): Promise<boolean> {
  if (!email || !password) {
    app.set({ authError: 'Informe e-mail e senha.', authLoading: false })
    return false
  }

  app.set({ authLoading: true, authError: '' })
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw error
    await consumeInvitation()
    await enterSession(data.session.user.id, data.session.user.email ?? email)
    return true
  } catch (error) {
    const message = (error as Error).message
    app.set({
      status: 'login',
      authLoading: false,
      authError: message === 'Invalid login credentials' ? 'E-mail ou senha inválidos.' : message,
    })
    return false
  }
}

export async function signOut(): Promise<void> {
  try {
    await supabase.auth.signOut()
  } finally {
    setOrganization(null)
    app.set({
      status: 'login',
      user: null,
      organizationId: null,
      organization: null,
      settings: null,
      logoUrl: '',
      authLoading: false,
      authError: '',
    })
  }
}

/** Recarrega empresa e configuracoes apos uma edicao em Administracao. */
export async function refreshTenant(): Promise<void> {
  const { organizationId } = app.get()
  if (organizationId) await loadTenant(organizationId)
}
