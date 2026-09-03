/** Repositorio de vendas avulsas e metas comerciais. */
import { insert, insertMany, list, update } from './db'
import type { DirectSale, DirectSaleItem, DirectSaleStatus, SalesGoal } from '../core/types'
import type { Tone } from '../ui/components/badge'

export const SALE_LABEL: Record<DirectSaleStatus, string> = {
  draft: 'Rascunho',
  confirmed: 'Confirmada',
  delivered: 'Entregue',
  cancelled: 'Cancelada',
}

export const SALE_TONE: Record<DirectSaleStatus, Tone> = {
  draft: 'gray',
  confirmed: 'blue',
  delivered: 'green',
  cancelled: 'red',
}

export const SALE_FLOW: DirectSaleStatus[] = ['draft', 'confirmed', 'delivered', 'cancelled']

export function sales(): Promise<DirectSale[]> {
  return list<DirectSale>('direct_sales', {
    select: 'id,sale_number,client_id,seller_id,status,sold_at,total_value,payment_method,notes,created_at',
    orderBy: 'sold_at',
  })
}

export function saleItems(): Promise<DirectSaleItem[]> {
  return list<DirectSaleItem>('direct_sale_items', {
    select: 'id,sale_id,inventory_item_id,description,quantity,unit_price',
    orderBy: 'created_at',
    ascending: true,
  })
}

export interface SaleInput {
  sale_number: string
  client_id: string | null
  seller_id: string | null
  status: DirectSaleStatus
  sold_at: string
  total_value: number
  payment_method: string | null
  notes: string | null
}

export interface SaleLine {
  inventory_item_id: string | null
  description: string
  quantity: number
  unit_price: number
}

export async function createSale(input: SaleInput, lines: SaleLine[]): Promise<DirectSale> {
  const sale = await insert<DirectSale>('direct_sales', { ...input })
  if (lines.length) {
    await insertMany<DirectSaleItem>(
      'direct_sale_items',
      lines.map((line) => ({ ...line, sale_id: sale.id })),
    )
  }
  return sale
}

export function setSaleStatus(id: string, status: DirectSaleStatus): Promise<DirectSale> {
  return update<DirectSale>('direct_sales', id, { status, updated_at: new Date().toISOString() })
}

/** Uma venda so conta como receita quando confirmada ou entregue. */
export function countsAsRevenue(sale: DirectSale): boolean {
  return sale.status === 'confirmed' || sale.status === 'delivered'
}

export function totalOf(lines: SaleLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity * line.unit_price, 0)
}

export function nextNumber(existing: string[]): string {
  const base = 'VA-' + new Date().toISOString().slice(0, 7).replace('-', '')
  const used = existing.filter((code) => code.startsWith(base)).map((code) => Number(code.split('-')[2]) || 0)
  return base + '-' + String((used.length ? Math.max(...used) : 0) + 1).padStart(3, '0')
}

/* ---------- Metas ---------- */

export function goals(): Promise<SalesGoal[]> {
  return list<SalesGoal>('sales_goals', {
    select: 'id,user_id,reference_month,target_kwp,target_revenue',
    orderBy: 'reference_month',
  })
}

export interface GoalInput {
  user_id: string
  reference_month: string
  target_kwp: number | null
  target_revenue: number | null
}

export function createGoal(input: GoalInput): Promise<SalesGoal> {
  return insert<SalesGoal>('sales_goals', { ...input })
}

export function saveGoal(id: string, input: Partial<GoalInput>): Promise<SalesGoal> {
  return update<SalesGoal>('sales_goals', id, { ...input, updated_at: new Date().toISOString() })
}

/** Primeiro dia do mes, formato aceito pela coluna date. */
export function monthStart(value = new Date()): string {
  return value.toISOString().slice(0, 7) + '-01'
}
