import { test, expect, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

function localEnv(): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) result[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '')
  }
  return result
}

const env = localEnv()
const stamp = `${Date.now()}`
const email = `audit-${stamp}@example.invalid`
const password = `Audit-${stamp}-Aa9!`

let admin: SupabaseClient
let userId = ''
let organizationId = ''
let clientId = ''

async function must<T extends { error: unknown }>(promise: PromiseLike<T>): Promise<T> {
  const result = await promise
  if (result.error) throw result.error
  return result
}

/** Navega pelo menu usando a rota, sem depender de rótulos ambíguos. */
async function goto(page: Page, group: string, path: string): Promise<void> {
  const item = page.locator(`.sidebar-sub-item[data-path="${path}"]`)
  if (!(await item.isVisible().catch(() => false))) {
    await page.locator(`.sidebar-group[data-group="${group}"]`).click()
  }
  await item.click()
  await page.waitForTimeout(300)
}

async function login(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByPlaceholder('voce@empresa.com.br').fill(email)
  await page.getByPlaceholder('Digite sua senha').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.locator('.app-sidebar').waitFor({ timeout: 20_000 })
}

test.beforeAll(async () => {
  expect(env.VITE_SUPABASE_URL).toBeTruthy()
  expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeTruthy()
  admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (created.error || !created.data.user) throw created.error ?? new Error('Usuário de auditoria não criado')
  userId = created.data.user.id
  await must(admin.from('profiles').upsert({ id: userId, full_name: 'Auditor E2E' }))

  const org = await must(
    admin
      .from('organizations')
      .insert({ name: `Organização Auditoria ${stamp}`, city: 'Cuiabá', state: 'MT', utility_company: 'Energisa MT' })
      .select('id')
      .single(),
  )
  organizationId = org.data.id

  await must(admin.from('organization_members').insert({ organization_id: organizationId, user_id: userId, role: 'admin', active: true }))
  await must(admin.from('organization_settings').insert({ organization_id: organizationId, calculation: { module_power_w: 570 }, alerts: {}, integrations: {} }))

  const client = await must(
    admin
      .from('clients')
      .insert({ organization_id: organizationId, name: `Cliente Auditoria ${stamp}`, person_type: 'company', city: 'Cuiabá', state: 'MT', owner_id: userId })
      .select('id')
      .single(),
  )
  clientId = client.data.id
})

test.afterAll(async () => {
  if (organizationId) await admin.from('organizations').delete().eq('id', organizationId)
  if (userId) await admin.auth.admin.deleteUser(userId)
})

test('login, navegação e persistência funcionam de ponta a ponta', async ({ page }) => {
  const consoleErrors: string[] = []
  const badResponses: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => consoleErrors.push(error.message))
  page.on('response', (response) => {
    if (response.status() >= 400 && !/fonts\.googleapis|fonts\.gstatic/.test(response.url())) {
      badResponses.push(`${response.status()} ${response.url()}`)
    }
  })

  await login(page)

  /* O painel inicial carrega com o nome de quem entrou. */
  await expect(page.locator('.page-title')).toContainText('AUDITOR')

  /* Os 11 módulos do padrão ASTER estão no menu. */
  await expect(page.locator('.sidebar-group')).toHaveCount(11)

  /* Cliente semeado aparece na lista. */
  await goto(page, 'comercial', '/comercial/clientes')
  await expect(page.getByText(`Cliente Auditoria ${stamp}`)).toBeVisible()

  /* Cadastro grava no banco. */
  const novoCliente = `Cliente Criado ${stamp}`
  await page.getByRole('button', { name: '+ Novo Cliente' }).click()
  const modal = page.locator('.modal')
  await modal.locator('.field', { hasText: 'Nome' }).locator('input').fill(novoCliente)
  await modal.locator('.field', { hasText: 'Cidade' }).locator('input').fill('Sinop')
  await modal.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByText('Cliente cadastrado.')).toBeVisible()

  const gravado = await admin.from('clients').select('id').eq('organization_id', organizationId).eq('name', novoCliente)
  expect(gravado.data).toHaveLength(1)

  /* O dado sobrevive ao reload. */
  await page.reload()
  await expect(page.getByText(novoCliente)).toBeVisible({ timeout: 20_000 })

  /* Dimensionamento calcula os cenários a partir do consumo. */
  await goto(page, 'comercial', '/comercial/dimensionamentos')
  await page.getByRole('button', { name: '+ Novo Dimensionamento' }).click()
  await page.locator('.modal').getByText('On-grid', { exact: true }).click()
  await page.locator('.modal').locator('.field', { hasText: 'Consumo mensal' }).locator('input').fill('1000')
  await expect(page.locator('.modal')).toContainText('15 módulos de 570 W')
  await page.locator('.modal-close').click()

  /* Cada módulo abre sua própria tela, sem aviso de migração. */
  const rotas: [string, string, string][] = [
    ['comercial', '/comercial/funil-de-vendas', 'Funil de vendas'],
    ['contratos', '/contratos/gestao-de-contratos', 'Gestão de Contratos'],
    ['projetos', '/projetos/gestao-de-projetos', 'Gestão de Projetos'],
    ['producao', '/producao/produtos', 'Produtos'],
    ['obras', '/obras/gestao-de-obras', 'Gestão de Obras'],
    ['pos-vendas', '/pos-vendas/chamados', 'Chamados'],
    ['financeiro', '/financeiro/lancamentos', 'Lançamentos'],
    ['suprimentos', '/suprimentos/patrimonio-e-frota', 'Patrimônio e Frota'],
    ['vendas-avulsas', '/vendas-avulsas/gestao-de-vendas', 'Gestão de Vendas'],
    ['recursos-humanos', '/recursos-humanos/colaboradores', 'Colaboradores'],
    ['administracao', '/administracao/minha-empresa', 'Minha Empresa'],
  ]
  for (const [group, path, titulo] of rotas) {
    await goto(page, group, path)
    await expect(page.locator('.page-title')).toContainText(titulo)
    await expect(page.locator('.app-content')).not.toContainText('Tela em migração')
  }

  /* Busca global leva à tela escolhida. */
  await page.keyboard.press('Control+k')
  const busca = page.getByPlaceholder('Buscar tela, módulo ou página…')
  await busca.waitFor()
  await busca.fill('conciliação')
  await page.locator('.palette-item').first().click()
  await expect(page.locator('.page-title')).toContainText('Conciliação')

  /* Sair volta para a tela de acesso. */
  await page.locator('.sidebar-user').getByText('Sair').click()
  await expect(page.getByText('Bem-vindo de volta')).toBeVisible()

  expect(consoleErrors, consoleErrors.join('\n')).toEqual([])
  expect(badResponses, badResponses.join('\n')).toEqual([])
})
