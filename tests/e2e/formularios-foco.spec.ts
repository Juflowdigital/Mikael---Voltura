/**
 * Regressão do bug relatado nos formulários: a cada tecla o formulário era
 * remontado inteiro, o campo perdia o foco e a tela voltava ao topo.
 */
import { test, expect, type Locator } from '@playwright/test'
import { createTenant, destroyTenant, goto, login, type Tenant } from './support/tenant'

let tenant: Tenant

/** Digita tecla a tecla — `fill` mascararia o bug, que só aparece caractere a caractere. */
async function typeSlowly(input: Locator, text: string): Promise<void> {
  await input.click()
  await input.pressSequentially(text, { delay: 30 })
}

/** Verdadeiro se o elemento ainda é o que tem o foco do documento. */
function isFocused(input: Locator): Promise<boolean> {
  return input.evaluate((node) => node === document.activeElement)
}

function fieldInput(scope: Locator, label: string): Locator {
  return scope.locator('.field', { hasText: label }).first().locator('input')
}

test.beforeAll(async () => {
  tenant = await createTenant('formularios')
})

test.afterAll(async () => {
  await destroyTenant(tenant)
})

test('cadastro de kit gerador mantém foco, texto e rolagem a cada tecla', async ({ page }) => {
  const erros: string[] = []
  page.on('pageerror', (error) => erros.push(error.message))

  await login(page, tenant)
  await goto(page, 'producao', '/producao/produtos')
  await expect(page.locator('.page-title')).toContainText('Produtos')

  await page.getByRole('button', { name: '+ Cadastrar Produto' }).click()
  const modal = page.locator('.modal')
  await expect(modal).toBeVisible()

  await modal.getByRole('button', { name: '+ Adicionar Painel Solar' }).click()
  const painel = modal.locator('.field', { hasText: 'Potência (W)' }).first().locator('..').locator('..')

  /* O sintoma central: digitar a potência inteira sem perder o foco nem os caracteres. */
  const potencia = fieldInput(painel, 'Potência (W)')
  await typeSlowly(potencia, '550')
  await expect(potencia).toHaveValue('550')
  expect(await isFocused(potencia), 'o campo Potência perdeu o foco ao digitar').toBe(true)

  /* Texto livre também: antes, cada letra reiniciava o formulário. */
  const marca = fieldInput(painel, 'Marca')
  await typeSlowly(marca, 'Canadian Solar')
  await expect(marca).toHaveValue('Canadian Solar')
  expect(await isFocused(marca), 'o campo Marca perdeu o foco ao digitar').toBe(true)

  const modelo = fieldInput(painel, 'Modelo')
  await typeSlowly(modelo, 'CS7N-550MS')
  await expect(modelo).toHaveValue('CS7N-550MS')

  /* A quantidade recalcula a potência total sem remontar a tela. */
  const quantidade = fieldInput(painel, 'Qtd.')
  await quantidade.fill('')
  await typeSlowly(quantidade, '12')
  await expect(quantidade).toHaveValue('12')
  await expect(modal).toContainText('6,60 kWp')

  /* A rolagem do modal precisa ficar onde o usuário deixou. */
  const corpo = modal.locator('.modal-body')
  await corpo.evaluate((node) => node.scrollTo(0, node.scrollHeight))
  const antes = await corpo.evaluate((node) => node.scrollTop)
  test.skip(antes === 0, 'o modal não tem rolagem nesta viewport')
  await typeSlowly(marca, ' X')
  const depois = await corpo.evaluate((node) => node.scrollTop)
  expect(depois, 'o modal voltou ao topo ao digitar').toBe(antes)

  /* Os valores digitados sobrevivem à troca de abas. */
  await modal.locator('.tab').filter({ hasText: /^Preço$/ }).click()
  const preco = fieldInput(modal, 'Preço do Kit (R$)')
  await typeSlowly(preco, '25000')
  await expect(preco).toHaveValue('25000')
  await expect(modal).toContainText('R$ 3.787,88')

  await modal.locator('.tab').filter({ hasText: /^Características$/ }).click()
  await expect(fieldInput(painel, 'Modelo')).toHaveValue('CS7N-550MS')

  /* E o registro grava a potência calculada. */
  const nome = `Kit Regressão ${tenant.stamp}`
  await fieldInput(modal, 'Nome').fill(nome)
  await modal.getByRole('button', { name: 'Salvar produto' }).click()
  await expect(page.getByText('Produto cadastrado.')).toBeVisible()

  const gravado = await tenant.admin
    .from('products')
    .select('id,total_power_wp,kit_price')
    .eq('organization_id', tenant.organizationId)
    .eq('name', nome)
  expect(gravado.data).toHaveLength(1)
  expect(Number(gravado.data?.[0].total_power_wp)).toBe(6600)
  expect(Number(gravado.data?.[0].kit_price)).toBe(25000)

  /* Limpa o registro criado por este teste. */
  await tenant.admin.from('products').delete().eq('id', gravado.data?.[0].id)

  expect(erros, erros.join('\n')).toEqual([])
})

test('criar contrato mantém foco, valores e rolagem ao ajustar preço', async ({ page }) => {
  const erros: string[] = []
  page.on('pageerror', (error) => erros.push(error.message))

  /* Janela baixa para garantir que a tela role — é a rolagem que o bug reiniciava. */
  await page.setViewportSize({ width: 1280, height: 620 })

  await login(page, tenant)
  /* Criar Contrato é subpágina: chega-se por botão, não pelo menu lateral. */
  await goto(page, 'contratos', '/contratos/gestao-de-contratos')
  await page.getByRole('button', { name: '+ Criar Contrato' }).click()
  await expect(page.locator('.page-title')).toContainText('Criar Contrato')

  /* Um item de produto dá base de cálculo para os totais. */
  await fieldInput(page, 'Nome do produto').fill('Painel de Teste')
  await fieldInput(page, 'Qtd.').fill('10')
  await fieldInput(page, 'Valor unitário (R$)').fill('1000')
  await page.getByRole('button', { name: 'Adicionar' }).click()
  await expect(page.locator('.app-content')).toContainText('R$ 10.000,00')

  /* Ajustar a margem tecla a tecla: sem perder foco e recalculando ao vivo. */
  const margem = fieldInput(page, 'Margem Adicional (%)')
  await typeSlowly(margem, '10')
  await expect(margem).toHaveValue('10')
  expect(await isFocused(margem), 'o campo Margem Adicional perdeu o foco ao digitar').toBe(true)
  await expect(page.locator('.app-content')).toContainText('R$ 11.000,00')

  const comissao = fieldInput(page, 'Comissão (%)')
  await typeSlowly(comissao, '5')
  await expect(comissao).toHaveValue('5')
  await expect(page.locator('.app-content')).toContainText('R$ 550,00')

  /* A rolagem da página precisa ficar onde o usuário deixou. Aqui quem rola é o
     documento: o `.app-root` usa min-height, então `.app-content` não transborda. */
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  const antes = await page.evaluate(() => window.scrollY)
  expect(antes, 'a tela precisa rolar para este teste valer').toBeGreaterThan(0)
  await typeSlowly(fieldInput(page, 'Prazo de Execução (Dias)'), '45')
  expect(await page.evaluate(() => window.scrollY), 'a tela voltou ao topo ao digitar').toBe(antes)

  /* Campos preenchidos sobrevivem a um redesenho disparado por outra ação. */
  await fieldInput(page, 'Condição de Pagamento').fill('30/60/90 dias')
  await fieldInput(page, 'Nome do produto').fill('Inversor de Teste')
  await fieldInput(page, 'Valor unitário (R$)').fill('500')
  await page.getByRole('button', { name: 'Adicionar' }).click()

  await expect(fieldInput(page, 'Condição de Pagamento')).toHaveValue('30/60/90 dias')
  await expect(fieldInput(page, 'Margem Adicional (%)')).toHaveValue('10')
  await expect(fieldInput(page, 'Prazo de Execução (Dias)')).toHaveValue('45')

  expect(erros, erros.join('\n')).toEqual([])
})
