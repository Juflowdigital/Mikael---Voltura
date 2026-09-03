/** Geracao e download de CSV no padrao pt-BR (separador ponto e virgula). */

function escapeCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  return /[";\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escapeCell).join(';'), ...rows.map((row) => row.map(escapeCell).join(';'))]
  return lines.join('\r\n')
}

/** Dispara o download com BOM para o Excel abrir acentos corretamente. */
export function downloadCsv(fileName: string, content: string): void {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName.endsWith('.csv') ? fileName : fileName + '.csv'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Numero em texto pt-BR para planilha (virgula decimal, sem simbolo). */
export function csvNumber(value: unknown): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return ''
  return n.toFixed(2).replace('.', ',')
}
