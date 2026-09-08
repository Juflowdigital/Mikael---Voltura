/**
 * Cria e destrói um tenant descartável (usuário + organização) para os testes E2E.
 * Nenhum dado real é tocado: tudo nasce com um carimbo de tempo e é apagado no fim.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'

export function localEnv(): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) result[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '')
  }
  return result
}

export async function must<T extends { error: unknown }>(promise: PromiseLike<T>): Promise<T> {
  const result = await promise
  if (result.error) throw result.error
  return result
}

export interface Tenant {
  admin: SupabaseClient
  stamp: string
  email: string
  password: string
  userId: string
  organizationId: string
}

/** Sobe um usuário admin de uma organização nova, pronto para o login pela interface. */
export async function createTenant(label: string): Promise<Tenant> {
  const env = localEnv()
  if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios em .env.local')
  }

  const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const stamp = `${Date.now()}`
  const email = `${label}-${stamp}@example.invalid`
  const password = `Teste-${stamp}-Aa9!`

  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (created.error || !created.data.user) throw created.error ?? new Error('Usuário de teste não criado')
  const userId = created.data.user.id
  await must(admin.from('profiles').upsert({ id: userId, full_name: 'Auditor E2E' }))

  const org = await must(
    admin
      .from('organizations')
      .insert({ name: `Organização ${label} ${stamp}`, city: 'Cuiabá', state: 'MT', utility_company: 'Energisa MT' })
      .select('id')
      .single(),
  )
  const organizationId = org.data.id

  await must(
    admin.from('organization_members').insert({ organization_id: organizationId, user_id: userId, role: 'admin', active: true }),
  )
  await must(
    admin
      .from('organization_settings')
      .insert({ organization_id: organizationId, calculation: { module_power_w: 570 }, alerts: {}, integrations: {} }),
  )

  return { admin, stamp, email, password, userId, organizationId }
}

/** Apaga tudo que o teste criou. Seguro de chamar mesmo se o setup falhou no meio. */
export async function destroyTenant(tenant: Tenant | null): Promise<void> {
  if (!tenant) return
  if (tenant.organizationId) await tenant.admin.from('organizations').delete().eq('id', tenant.organizationId)
  if (tenant.userId) await tenant.admin.auth.admin.deleteUser(tenant.userId)
}

/** Entra pela tela de acesso e espera o menu lateral aparecer. */
export async function login(page: Page, tenant: Tenant): Promise<void> {
  await page.goto('/')
  await page.getByPlaceholder('voce@empresa.com.br').fill(tenant.email)
  await page.getByPlaceholder('Digite sua senha').fill(tenant.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.locator('.app-sidebar').waitFor({ timeout: 20_000 })
}

/** Navega pelo menu usando a rota, sem depender de rótulos ambíguos. */
export async function goto(page: Page, group: string, path: string): Promise<void> {
  const item = page.locator(`.sidebar-sub-item[data-path="${path}"]`)
  if (!(await item.isVisible().catch(() => false))) {
    await page.locator(`.sidebar-group[data-group="${group}"]`).click()
  }
  await item.click()
  await page.waitForTimeout(300)
}
