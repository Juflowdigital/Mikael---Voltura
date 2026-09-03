import { existsSync, readFileSync } from 'node:fs'

const problems = []

/* 1. Enquanto o app antigo existir, seu componente precisa continuar valido. */
const legacyPath = 'Voltua ERP.dc.html'
if (existsSync(legacyPath)) {
  const source = readFileSync(legacyPath, 'utf8')
  const start = source.indexOf('class Component extends DCLogic')
  const end = source.indexOf('</script>', start)
  if (start < 0 || end < 0) problems.push('Componente DC legado não encontrado')
  else {
    try {
      new Function('DCLogic', `${source.slice(start, end)}; return Component`)
    } catch (error) {
      problems.push(`Componente DC legado com erro de sintaxe: ${error.message}`)
    }
  }
}

/* 2. Toda rota registrada precisa existir na navegacao e ter arquivo em disco. */
const navigation = readFileSync('src/shell/navigation.ts', 'utf8')
const registry = readFileSync('src/modules/registry.ts', 'utf8')

const subpages = [...navigation.matchAll(/groupSlug: .([a-z-]+)., label: .[^.]+., slug: .([a-z0-9-]+)./g)].map((m) => m[1] + '/' + m[2])
const groupSlugs = [...navigation.matchAll(/slug: '([a-z-]+)',\n\s+icon:/g)].map((m) => m[1])
const routes = [...registry.matchAll(/'(\/[a-z0-9-]+\/[a-z0-9-]+)':\s*\(\)\s*=>\s*import\('([^']+)'\)/g)]

if (!routes.length) problems.push('Nenhuma tela registrada em src/modules/registry.ts')

for (const [, path, specifier] of routes) {
  const group = path.split('/')[1]
  if (group !== 'inicio' && !groupSlugs.includes(group)) {
    problems.push(`Rota ${path} não corresponde a nenhum módulo da navegação`)
  }
  const file = `src/modules/${specifier.replace(/^\.\//, '')}.ts`
  if (!existsSync(file)) problems.push(`Rota ${path} aponta para arquivo inexistente: ${file}`)
}

/* 3. Entrada nova precisa estar ligada. */
if (!readFileSync('app.html', 'utf8').includes('/src/main.ts')) {
  problems.push('app.html não carrega src/main.ts')
}

if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}
console.log(`Estrutura OK (${groupSlugs.length} módulos, ${routes.length} tela(s) registrada(s))`)
