import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const roots = ['src']
const extraFiles = ['Voltua ERP.dc.html', 'map.html', 'index.html', 'app.html']

function walk(dir) {
  const found = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) found.push(...walk(full))
    else if (/\.(ts|css|html|mjs)$/.test(entry)) found.push(full)
  }
  return found
}

const files = [...roots.flatMap(walk), ...extraFiles]

const rules = [
  [/href\s*=\s*["']#["']/g, 'link sem destino (href="#")'],
  [/<button(?![^>]*onClick)[^>]*>/g, 'botão sem ação'],
  [/catch\s*\([^)]*\)\s*\{\s*\}/g, 'catch vazio'],
  [/\b(?:TODO|FIXME|XXX)\b/g, 'implementação pendente'],
  [/(?:mock|fake|dummy)Data\b/gi, 'dados simulados ativos'],
  [/console\.log\(/g, 'console.log esquecido'],
]

const failures = []
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  for (const [pattern, message] of rules) {
    for (const match of text.matchAll(pattern)) {
      failures.push(`${file}:${text.slice(0, match.index).split('\n').length}: ${message}`)
    }
  }
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log(`Auditoria estática OK (${files.length} arquivos)`)
