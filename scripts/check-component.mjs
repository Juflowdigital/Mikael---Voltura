import { existsSync, readFileSync } from 'node:fs'

const problems = []

/**
 * As expressoes abaixo dependem de '\n'. Num checkout Windows com autocrlf o
 * arquivo chega com '\r\n' e nada casa — o verificador acusaria todas as rotas
 * como quebradas sem nenhuma delas estar. Normaliza antes de procurar.
 */
const source = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n')

const navigation = source('src/shell/navigation.ts')
const registry = source('src/modules/registry.ts')

/* 1. Toda rota registrada precisa existir na navegacao e ter arquivo em disco. */
const groupSlugs = [...navigation.matchAll(/slug: '([a-z-]+)',\n\s+icon:/g)].map((m) => m[1])
const routes = [...registry.matchAll(/'(\/[a-z0-9-]+\/[a-z0-9-]+)':\s*\(\)\s*=>\s*import\('([^']+)'\)/g)]

if (!routes.length) problems.push('Nenhuma tela registrada em src/modules/registry.ts')

const registered = new Set()
for (const [, path, specifier] of routes) {
  registered.add(path)
  const group = path.split('/')[1]
  if (group !== 'inicio' && !groupSlugs.includes(group)) {
    problems.push(`Rota ${path} não corresponde a nenhum módulo da navegação`)
  }
  const file = `src/modules/${specifier.replace(/^\.\//, '')}.ts`
  if (!existsSync(file)) problems.push(`Rota ${path} aponta para arquivo inexistente: ${file}`)
}

/* 2. Todo item de menu precisa ter tela propria. */
const groups = [...navigation.matchAll(/slug: '([a-z-]+)',\n\s+icon:[\s\S]*?items: \[([\s\S]*?)\],\n {2}\}/g)]
const menuPaths = []
for (const [, slug, block] of groups) {
  for (const [, itemSlug] of block.matchAll(/slug: '([a-z0-9-]+)'/g)) menuPaths.push(`/${slug}/${itemSlug}`)
}

const missing = menuPaths.filter((path) => !registered.has(path))
if (missing.length) problems.push(`Itens de menu sem tela própria: ${missing.join(', ')}`)

/* 3. Entrada da aplicacao precisa estar ligada e o app antigo nao pode voltar. */
if (!readFileSync('index.html', 'utf8').includes('/src/main.ts')) {
  problems.push('index.html não carrega src/main.ts')
}
for (const legado of ['Voltua ERP.dc.html', 'support.js', 'src/bootstrap.ts']) {
  if (existsSync(legado)) problems.push(`Arquivo do app antigo voltou ao projeto: ${legado}`)
}

if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}
console.log(`Estrutura OK (${groupSlugs.length} módulos, ${routes.length} telas, ${menuPaths.length}/${menuPaths.length} itens de menu cobertos)`)
