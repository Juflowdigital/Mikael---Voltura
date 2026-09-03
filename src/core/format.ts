/** Formatadores pt-BR compartilhados por todos os modulos. */

const MONEY = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const DECIMAL = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const INTEGER = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

export function money(value: unknown): string {
  const n = Number(value)
  return MONEY.format(Number.isFinite(n) ? n : 0)
}

export function decimal(value: unknown, suffix = ''): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return DECIMAL.format(n) + suffix
}

export function integer(value: unknown): string {
  const n = Number(value)
  return INTEGER.format(Number.isFinite(n) ? n : 0)
}

export function power(kwp: unknown): string {
  const n = Number(kwp)
  if (!Number.isFinite(n) || n === 0) return '—'
  return DECIMAL.format(n) + ' kWp'
}

export function percent(value: unknown, digits = 1): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0%'
  return n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }) + '%'
}

/** Converte "R$ 1.234,56" ou "1234,56" em number. Retorna 0 quando invalido. */
export function parseMoney(input: unknown): number {
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0
  const clean = String(input ?? '')
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.')
  const n = Number(clean)
  return Number.isFinite(n) ? n : 0
}

const DATE_ONLY = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/

/**
 * Datas puras (tipo `date` no Postgres) chegam como "AAAA-MM-DD" e o construtor
 * Date as interpreta como meia-noite UTC. No fuso do Brasil isso volta um dia,
 * entao formatamos direto a partir do texto.
 */
export function date(value: unknown): string {
  if (!value) return '—'
  const text = String(value)
  const parts = DATE_ONLY.exec(text)
  if (parts) return parts[3] + "/" + parts[2] + "/" + parts[1]
  const d = new Date(text)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR')
}

export function dateTime(value: unknown): string {
  if (!value) return '—'
  const d = new Date(String(value))
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/** "Quinta-feira, 3 de setembro de 2026" com a inicial maiuscula. */
export function longDate(d = new Date()): string {
  const text = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function greeting(d = new Date()): string {
  const hour = d.getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

/** Iniciais para avatar: "Neide Oliveira da Silva" -> "NS". */
export function initials(name: unknown): string {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Dias corridos entre a data informada e hoje. */
export function daysSince(value: unknown): number {
  if (!value) return 0
  const d = new Date(String(value))
  if (Number.isNaN(d.getTime())) return 0
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000))
}

export function isoDay(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

/** Texto de documento: formata CNPJ e CPF quando o tamanho bate. */
export function taxId(value: unknown): string {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (digits.length === 14) return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  return String(value ?? '') || '—'
}

export function phone(value: unknown): string {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (digits.length === 11) return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  if (digits.length === 10) return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  return String(value ?? '') || 'Não informado.'
}

export function orDash(value: unknown, fallback = '—'): string {
  const text = String(value ?? '').trim()
  return text || fallback
}
