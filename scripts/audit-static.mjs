import { readFileSync } from 'node:fs'

const files = ['Voltua ERP.dc.html', 'src/bootstrap.ts', 'src/lib/supabase.ts', 'map.html']
const rules = [
  [/href\s*=\s*["']#["']/g, 'link sem destino (href="#")'],
  [/<button(?![^>]*onClick)[^>]*>/g, 'botão sem ação'],
  [/catch\s*\([^)]*\)\s*\{\s*\}/g, 'catch vazio'],
  [/\b(?:TODO|FIXME)\b/g, 'implementação pendente'],
  [/(?:mock|fake)Data\b/gi, 'dados simulados ativos'],
]
const failures = []
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  for (const [pattern, message] of rules) {
    const matches = [...text.matchAll(pattern)]
    for (const match of matches) failures.push(`${file}:${text.slice(0, match.index).split('\n').length}: ${message}`)
  }
}
if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log(`Auditoria estática OK (${files.length} arquivos críticos)`)
