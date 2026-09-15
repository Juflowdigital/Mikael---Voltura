/**
 * Regressão do bug relatado na Gestão de Negociações: a lista era um beco sem
 * saída — não havia como abrir a negociação nem gerar a proposta para o cliente.
 */
import { test, expect } from '@playwright/test'
import { createTenant, destroyTenant, goto, login, must, type Tenant } from './support/tenant'

let tenant: Tenant
let proposalNumber: string

test.beforeAll(async () => {
  tenant = await createTenant('proposta')
  proposalNumber = `PR-E2E-${Date.now().toString().slice(-6)}`

  const client = await must(
    tenant.admin
      .from('clients')
      .insert({
        organization_id: tenant.organizationId,
        name: 'Cliente Proposta E2E',
        person_type: 'individual',
        city: 'Cuiabá',
        state: 'MT',
        monthly_consumption_kwh: 600,
      })
      .select('id')
      .single(),
  )

  const budget = await must(
    tenant.admin
      .from('budgets')
      .insert({
        organization_id: tenant.organizationId,
        client_id: client.data.id,
        monthly_consumption_kwh: 600,
        system_power_kwp: 5.13,
        module_count: 9,
        module_power_w: 570,
        inverter_power_kw: 8,
        estimated_generation_kwh: 616,
        roof_area_m2: 24,
        assumptions: { system_kind: 'ongrid', scenario: 'Cenário ideal', city: 'Cuiabá' },
      })
      .select('id')
      .single(),
  )

  await must(
    tenant.admin.from('proposals').insert({
      organization_id: tenant.organizationId,
      client_id: client.data.id,
      budget_id: budget.data.id,
      proposal_number: proposalNumber,
      title: 'Usina 5,13 kWp — E2E',
      status: 'draft',
      total_value: 32000,
      valid_until: '2099-12-31',
      metadata: { utility_company: 'Energisa MT', address: 'Rua de Teste, 100' },
    }),
  )
})

test.afterAll(async () => {
  await destroyTenant(tenant)
})

test('a negociação abre a proposta, gera o documento e muda de situação', async ({ page }) => {
  const erros: string[] = []
  page.on('pageerror', (error) => erros.push(error.message))

  await login(page, tenant)
  await goto(page, 'comercial', '/comercial/negociacoes')
  await expect(page.locator('.page-title')).toContainText('Gestão de Negociações')

  /* O sintoma central: a linha precisa oferecer um caminho para a proposta. */
  const row = page.locator('table.data tbody tr', { hasText: proposalNumber })
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: 'Ver proposta' }).click()

  await expect(page.locator('.page-title')).toContainText('Usina 5,13 kWp')

  /* O documento é gerado com os dados reais da negociação, pronto para imprimir. */
  const sheet = page.frameLocator('iframe[title="Pré-visualização da proposta"]').locator('.sheet')
  await expect(sheet).toContainText(proposalNumber)
  await expect(sheet).toContainText('Cliente Proposta E2E')
  await expect(sheet).toContainText('5,13 kWp')
  await expect(sheet).toContainText('R$ 32.000,00')
  await expect(sheet).toContainText('Energisa MT')

  /* Depois de enviar ao cliente, a negociação anda no funil. */
  await page.getByRole('button', { name: 'Enviada', exact: true }).click()
  await expect(page.locator('.badge', { hasText: 'Enviada' })).toBeVisible()

  await page.getByRole('button', { name: 'Aceita', exact: true }).click()
  await expect(page.locator('.badge', { hasText: 'Aceita' })).toBeVisible()

  const saved = await must(
    tenant.admin.from('proposals').select('status').eq('proposal_number', proposalNumber).single(),
  )
  expect(saved.data.status).toBe('accepted')

  expect(erros, 'a tela de proposta lançou erros no console').toEqual([])
})
