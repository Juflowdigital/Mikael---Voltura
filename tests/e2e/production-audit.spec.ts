/** Auditoria de produção: login, navegação pelos 11 módulos e persistência real no banco. */
import { test, expect } from '@playwright/test'
import { createTenant, destroyTenant, goto, login, must, type Tenant } from './support/tenant'

let tenant: Tenant

test.beforeAll(async () => {
  tenant = await createTenant('audit')

  /* Um cliente semeado, para conferir que a lista lê do banco. */
  await must(
    tenant.admin.from('clients').insert({
      organization_id: tenant.organizationId,
      name: `Cliente Auditoria ${tenant.stamp}`,
      person_type: 'company',
      city: 'Cuiabá',
      state: 'MT',
      owner_id: tenant.userId,
    }),
  )
})

test.afterAll(async () => {
  await destroyTenant(tenant)
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

  await login(page, tenant)

  /* O painel inicial carrega com o nome de quem entrou. */
  await expect(page.locator('.page-title')).toContainText('AUDITOR')

  /* Os 11 módulos do padrão ASTER estão no menu. */
  await expect(page.locator('.sidebar-group')).toHaveCount(11)

  /* Cliente semeado aparece na lista. */
  await goto(page, 'comercial', '/comercial/clientes')
  await expect(page.getByText(`Cliente Auditoria ${tenant.stamp}`)).toBeVisible()

  /* Cadastro grava no banco. */
  const novoCliente = `Cliente Criado ${tenant.stamp}`
  await page.getByRole('button', { name: '+ Novo Cliente' }).click()
  const modal = page.locator('.modal')
  await modal.locator('.field', { hasText: 'Nome' }).locator('input').fill(novoCliente)
  await modal.locator('.field', { hasText: 'Cidade' }).locator('input').fill('Sinop')
  await modal.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByText('Cliente cadastrado.')).toBeVisible()

  const gravado = await tenant.admin.from('clients').select('id').eq('organization_id', tenant.organizationId).eq('name', novoCliente)
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
