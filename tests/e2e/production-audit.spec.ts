import { test, expect, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

function localEnv() {
  const result: Record<string, string> = {}
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) result[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '')
  }
  return result
}

const env = localEnv()
const appPath = '/Voltua%20ERP.dc.html'
const stamp = `${Date.now()}`
const email = `audit-${stamp}@example.invalid`
const password = `Audit-${stamp}-Aa9!`
const clientName = `Cliente Auditoria ${stamp}`
let admin: SupabaseClient
let userId = ''
let organizationId = ''

async function nav(page: Page, group: string, item: string) {
  const sidebar = page.locator('.app-sidebar')
  const link = sidebar.getByText(item, { exact: true })
  if (!(await link.isVisible())) await sidebar.getByText(group, { exact: true }).click()
  await link.click()
}

async function must<T extends { error: unknown }>(promise: PromiseLike<T>) {
  const result = await promise
  if (result.error) throw result.error
  return result
}

test.beforeAll(async () => {
  expect(env.VITE_SUPABASE_URL).toBeTruthy()
  expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeTruthy()
  admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (created.error || !created.data.user) throw created.error || new Error('Usuário de auditoria não criado')
  userId = created.data.user.id
  await must(admin.from('profiles').upsert({ id: userId, full_name: 'Auditor E2E' }))
  const org = await must(admin.from('organizations').insert({ name: `Organização Auditoria ${stamp}`, legal_name: `Organização Auditoria ${stamp} LTDA`, city: 'Fortaleza', state: 'CE', utility_company: 'Enel CE' }).select('id').single())
  organizationId = org.data.id
  await must(admin.from('organization_members').insert({ organization_id: organizationId, user_id: userId, role: 'admin', active: true }))
  await must(admin.from('organization_settings').insert({ organization_id: organizationId, calculation: { margin: 10, loss_factor: 15, irradiation: '5.7', module_power_w: 570 }, alerts: {}, integrations: {} }))
  const client = await must(admin.from('clients').insert({ organization_id: organizationId, name: `Cliente Inicial ${stamp}`, person_type: 'company', tax_id: `99${stamp.slice(-12)}`.slice(0,14), email: `initial-${stamp}@example.invalid`, phone: '85999999999', city: 'Fortaleza', state: 'CE', utility_company: 'Enel CE', monthly_consumption_kwh: 800, owner_id: userId }).select('id').single())
  const lead = await must(admin.from('leads').insert({ organization_id: organizationId, name: `Lead Inicial ${stamp}`, email: `lead-${stamp}@example.invalid`, phone: '85888888888', city: 'Caucaia', customer_type: 'Comercial', source: 'Indicação', stage: 'lead', estimated_value: 15000 }).select('id').single())
  await must(admin.from('crm_activities').insert({ organization_id: organizationId, lead_id: lead.data.id, kind: 'created', subject: 'Negociação inicial', description: JSON.stringify({ email: `lead-${stamp}@example.invalid`, phone: '85888888888' }), created_by: userId }))
  await must(admin.from('notifications').insert({ organization_id: organizationId, user_id: userId, title: 'Alerta real de auditoria', body: 'Registro criado exclusivamente para o teste isolado', severity: 'info' }))
  await must(admin.from('service_tickets').insert({ organization_id: organizationId, ticket_number: `CH-${stamp.slice(-6)}`, client_id: client.data.id, title: 'Chamado real de auditoria', priority: 'medium', status: 'open' }))
})

test.afterAll(async () => {
  if (organizationId) await admin.from('organizations').delete().eq('id', organizationId)
  if (userId) await admin.auth.admin.deleteUser(userId)
})

test('fluxos críticos persistem no Supabase e sobrevivem ao reload', async ({ page }) => {
  const consoleErrors: string[] = []
  const badResponses: string[] = []
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  page.on('pageerror', error => consoleErrors.push(error.message))
  page.on('response', response => { if (response.status() >= 400 && !/fonts\.googleapis|fonts\.gstatic|tile\.openstreetmap/.test(response.url())) badResponses.push(`${response.status()} ${response.url()}`) })

  await page.goto(appPath)
  await page.getByPlaceholder('voce@empresa.com.br').fill(email)
  await page.getByPlaceholder('Digite sua senha').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText('Dashboard', { exact: true })).toBeVisible()
  await expect(page.getByText('Cliente Inicial ' + stamp, { exact: false })).toHaveCount(0)
  await expect(page.getByText('Ana Rocha', { exact: false })).toHaveCount(0)

  await nav(page, 'Comercial', 'Clientes')
  await expect(page.getByText(`Cliente Inicial ${stamp}`, { exact: true })).toBeVisible()
  await page.getByText(`Cliente Inicial ${stamp}`, { exact: true }).click()
  await expect(page.getByText(`initial-${stamp}@example.invalid`, { exact: true })).toBeVisible()
  await nav(page, 'Comercial', 'Clientes')
  await page.getByText('+ Novo cliente', { exact: true }).click()
  await page.getByPlaceholder('Nome do lead ou empresa').fill(clientName)
  await page.getByPlaceholder('CPF / CNPJ').fill(`88${stamp.slice(-12)}`.slice(0,14))
  await page.getByPlaceholder('E-mail').fill(`client-${stamp}@example.invalid`)
  await page.getByPlaceholder('Telefone / WhatsApp').fill('85777777777')
  await page.getByPlaceholder('Endereço da instalação').fill('Rua de Auditoria, 100')
  await page.getByPlaceholder('Cidade').fill('Sobral')
  await page.getByPlaceholder('Concessionária').fill('Enel CE')
  await page.getByText('Salvar cliente', { exact: true }).click()
  await expect(page.getByText('Cliente salvo com sucesso', { exact: true })).toBeVisible()
  expect((await must(admin.from('clients').select('id,email').eq('organization_id', organizationId).eq('name', clientName).single())).data.email).toBe(`client-${stamp}@example.invalid`)
  await page.reload()
  await expect(page.getByText('Dashboard', { exact: true })).toBeVisible()
  await nav(page, 'Comercial', 'Clientes')
  await expect(page.getByText(clientName, { exact: true })).toBeVisible()

  await nav(page, 'Comercial', 'Leads')
  await page.getByText('+ Novo lead', { exact: true }).click()
  await page.getByPlaceholder('Título da negociação *').fill(`Negociação ${stamp}`)
  await page.getByPlaceholder('Nome do lead ou empresa').fill(`Lead Criado ${stamp}`)
  await page.getByPlaceholder('E-mail').fill(`newlead-${stamp}@example.invalid`)
  await page.getByPlaceholder('Telefone / WhatsApp').fill('85666666666')
  await page.getByPlaceholder('Cidade').fill('Fortaleza')
  await page.getByText('Salvar negociação', { exact: true }).click()
  await expect(page.getByText('Negociação cadastrada no funil comercial', { exact: true })).toBeVisible()
  expect((await must(admin.from('leads').select('phone').eq('organization_id', organizationId).eq('name', `Lead Criado ${stamp}`).single())).data.phone).toBe('85666666666')

  await nav(page, 'Comercial', 'Dimensionamentos')
  await page.getByText('+ Novo orçamento', { exact: true }).click()
  await page.getByPlaceholder('Nome / Razão social *').fill(`Orçamento ${stamp}`)
  await page.getByPlaceholder('Cidade / UF *').fill('Fortaleza / CE')
  await page.getByPlaceholder('Média kWh/mês *').fill('1000')
  await page.getByText('Salvar e dimensionar', { exact: true }).click()
  await expect(page.getByText('Orçamento salvo e dimensionado com sucesso', { exact: true })).toBeVisible()
  const budget = await must(admin.from('budgets').select('monthly_consumption_kwh,estimated_price').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(1).single())
  expect(Number(budget.data.monthly_consumption_kwh)).toBe(1000)
  expect(budget.data.estimated_price).toBeNull()

  await nav(page, 'Contratos', 'Gestão de Contratos')
  await page.getByText('Criar contrato', { exact: true }).click()
  await page.getByPlaceholder('Título do contrato *').fill(`Contrato Auditoria ${stamp}`)
  await page.getByPlaceholder('Cliente *').fill(clientName)
  await page.getByPlaceholder('Painel solar (marca/modelo)').fill('Painel 570 W auditado')
  await page.getByPlaceholder('Qtd.').first().fill('10')
  await page.getByPlaceholder('R$', { exact: true }).first().fill('500')
  await page.getByPlaceholder('Mão de obra (descrição)').fill('Instalação e comissionamento')
  await page.getByPlaceholder('Qtd.').last().fill('1')
  await page.getByPlaceholder('R$', { exact: true }).last().fill('4500')
  await page.getByPlaceholder('Valor final (R$) *').fill('10000')
  await page.getByPlaceholder('Parcelas (1 a 120)').fill('3')
  await page.getByText('Criar contrato', { exact: true }).last().click()
  await expect(page.getByText(/Contrato CT-.* criado com produtos e condições/)).toBeVisible()
  const contract = await must(admin.from('contracts').select('id,total_value').eq('organization_id', organizationId).eq('title', `Contrato Auditoria ${stamp}`).single())
  expect(Number(contract.data.total_value)).toBe(10000)
  const installments = await must(admin.from('installments').select('amount').eq('contract_id', contract.data.id))
  expect(installments.data).toHaveLength(3)
  expect(installments.data.reduce((sum: number, row: { amount: number }) => sum + Number(row.amount), 0)).toBe(10000)
  const contractItems = await must(admin.from('contract_items').select('item_type,name,quantity,unit_price').eq('contract_id', contract.data.id).order('item_type'))
  expect(contractItems.data.map((row: { item_type: string }) => row.item_type)).toEqual(['Mão de obra', 'Painel solar'])
  expect(Number(contractItems.data[0].unit_price)).toBe(4500)

  await nav(page, 'Financeiro', 'Lançamentos')
  await page.getByText('Novo lançamento', { exact: true }).click()
  await page.getByPlaceholder('Descrição / cliente / fornecedor').fill(`Receita Auditoria ${stamp}`)
  await page.getByPlaceholder('Valor (opcional)').fill('1234,56')
  await page.getByText('Salvar', { exact: true }).click()
  await expect(page.getByText('Registro salvo com sucesso', { exact: true })).toBeVisible()
  expect(Number((await must(admin.from('financial_transactions').select('amount').eq('organization_id', organizationId).eq('description', `Receita Auditoria ${stamp}`).single())).data.amount)).toBe(1234.56)

  for (const viewport of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    const report = await page.evaluate(() => {
      const limit = window.innerWidth
      const offenders = [...document.querySelectorAll('body *')]
        .map(el => ({ right: el.getBoundingClientRect().right, tag: el.tagName, cls: el.className || '', text: (el.textContent || '').slice(0, 40) }))
        .filter(item => item.right > limit + 2)
        .sort((a, b) => b.right - a.right)
        .slice(0, 5)
      return { overflow: document.documentElement.scrollWidth - limit, offenders }
    })
    expect(report.overflow, `overflow horizontal em ${viewport.width}x${viewport.height}: ${JSON.stringify(report.offenders)}`).toBeLessThanOrEqual(2)
  }

  expect(consoleErrors, consoleErrors.join('\n')).toEqual([])
  expect(badResponses, badResponses.join('\n')).toEqual([])
})
