import { readFileSync } from 'node:fs'

const source = readFileSync('Voltua ERP.dc.html', 'utf8')
const start = source.indexOf('class Component extends DCLogic')
const end = source.indexOf('</script>', start)

if (start < 0 || end < 0) throw new Error('Componente DC não encontrado')

new Function('DCLogic', `${source.slice(start, end)}; return Component`)
console.log('Component syntax OK')
