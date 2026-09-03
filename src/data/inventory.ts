/** Repositorio de produtos, estoque, fornecedores e compras. */
import { insert, insertMany, list, remove, update } from './db'
import type {
  ComponentType,
  InventoryItem,
  InventoryMovement,
  Product,
  ProductComponent,
  PurchaseOrder,
  PurchaseStatus,
  Supplier,
} from '../core/types'
import type { Tone } from '../ui/components/badge'

const PRODUCT_SELECT =
  'id,kind,generator_type,name,unit,category,active,total_power_wp,kit_price,metadata,created_at,updated_at'

export const GENERATOR_LABEL = { ongrid: 'OnGrid', hibrido: 'Híbrido', offgrid: 'OffGrid' } as const

export const COMPONENT_LABEL: Record<ComponentType, string> = {
  painel: 'Painel Solar',
  inversor: 'Inversor',
  estrutura: 'Estrutura',
  stringbox: 'String Box',
  otimizador: 'Otimizador',
  servico: 'Serviço',
}

export function products(): Promise<Product[]> {
  return list<Product>('products', { select: PRODUCT_SELECT, orderBy: 'created_at' })
}

export function allComponents(): Promise<ProductComponent[]> {
  return list<ProductComponent>('product_components', {
    select: 'id,product_id,component_type,brand,model,quantity,power,attributes,created_at',
    orderBy: 'created_at',
    ascending: true,
  })
}

export interface ProductInput {
  kind: Product['kind']
  generator_type: Product['generator_type']
  name: string
  unit: string
  category: string | null
  active: boolean
  total_power_wp: number
  kit_price: number
  metadata: Record<string, unknown>
}

export interface ComponentInput {
  component_type: ComponentType
  brand: string | null
  model: string | null
  quantity: number
  power: number | null
  attributes: Record<string, unknown>
}

export async function createProduct(input: ProductInput, lines: ComponentInput[]): Promise<Product> {
  const product = await insert<Product>('products', { ...input })
  if (lines.length) {
    await insertMany<ProductComponent>(
      'product_components',
      lines.map((line) => ({ ...line, product_id: product.id })),
    )
  }
  return product
}

export function saveProduct(id: string, input: Partial<ProductInput>): Promise<Product> {
  return update<Product>('products', id, { ...input, updated_at: new Date().toISOString() })
}

export function removeProduct(id: string): Promise<void> {
  return remove('products', id)
}

/** Potencia total do gerador: soma dos paineis (W) convertida em kWp. */
export function kitPowerKwp(lines: { component_type: ComponentType; quantity: number; power: number | null }[]): number {
  const watts = lines
    .filter((line) => line.component_type === 'painel')
    .reduce((sum, line) => sum + line.quantity * (line.power ?? 0), 0)
  return watts / 1000
}

const ITEM_SELECT =
  'id,sku,name,category,unit,barcode,quantity,minimum_quantity,average_cost,location,active,created_at'

export function items(): Promise<InventoryItem[]> {
  return list<InventoryItem>('inventory_items', { select: ITEM_SELECT, orderBy: 'name', ascending: true })
}

export interface ItemInput {
  sku: string
  name: string
  category: string | null
  unit: string
  quantity: number
  minimum_quantity: number
  average_cost: number
  location: string | null
  active: boolean
}

export function createItem(input: ItemInput): Promise<InventoryItem> {
  return insert<InventoryItem>('inventory_items', { ...input })
}

export function saveItem(id: string, input: Partial<ItemInput>): Promise<InventoryItem> {
  return update<InventoryItem>('inventory_items', id, { ...input, updated_at: new Date().toISOString() })
}

export function movements(): Promise<InventoryMovement[]> {
  return list<InventoryMovement>('inventory_movements', {
    select: 'id,inventory_item_id,work_id,purchase_order_id,movement_type,quantity,unit_cost,notes,occurred_at',
    orderBy: 'occurred_at',
  })
}

/** Registra a movimentacao e atualiza o saldo do item. */
export async function moveStock(
  item: InventoryItem,
  movementType: InventoryMovement['movement_type'],
  quantity: number,
  notes: string | null,
): Promise<void> {
  const signed = movementType === 'out' || movementType === 'reserve' ? -Math.abs(quantity) : Math.abs(quantity)
  await insert<InventoryMovement>('inventory_movements', {
    inventory_item_id: item.id,
    movement_type: movementType,
    quantity: signed,
    unit_cost: item.average_cost,
    notes,
  })
  await update<InventoryItem>('inventory_items', item.id, {
    quantity: Math.max(0, Number(item.quantity) + signed),
    updated_at: new Date().toISOString(),
  })
}

export function isBelowMinimum(item: InventoryItem): boolean {
  return Number(item.quantity) <= Number(item.minimum_quantity)
}

/** Curva ABC por valor imobilizado: A ate 80%, B ate 95%, C o restante. */
export function abcCurve(rows: InventoryItem[]): { a: number; b: number; c: number; total: number } {
  const valued = rows
    .map((item) => Number(item.quantity) * Number(item.average_cost))
    .sort((left, right) => right - left)
  const total = valued.reduce((sum, value) => sum + value, 0)
  if (total <= 0) return { a: 0, b: 0, c: valued.length, total: valued.length }

  let running = 0
  let a = 0
  let b = 0
  let c = 0
  for (const value of valued) {
    running += value
    const share = running / total
    if (share <= 0.8) a += 1
    else if (share <= 0.95) b += 1
    else c += 1
  }
  return { a, b, c, total: valued.length }
}

export function suppliers(): Promise<Supplier[]> {
  return list<Supplier>('suppliers', {
    select: 'id,name,tax_id,email,phone,lead_time_days,rating,created_at',
    orderBy: 'name',
    ascending: true,
  })
}

export interface SupplierInput {
  name: string
  tax_id: string | null
  email: string | null
  phone: string | null
  lead_time_days: number | null
  rating: number | null
}

export function createSupplier(input: SupplierInput): Promise<Supplier> {
  return insert<Supplier>('suppliers', { ...input })
}

export function saveSupplier(id: string, input: SupplierInput): Promise<Supplier> {
  return update<Supplier>('suppliers', id, { ...input, updated_at: new Date().toISOString() })
}

export const PURCHASE_LABEL: Record<PurchaseStatus, string> = {
  draft: 'Rascunho',
  quoted: 'Cotado',
  approved: 'Aprovado',
  ordered: 'Pedido enviado',
  partially_received: 'Recebido parcial',
  received: 'Recebido',
  cancelled: 'Cancelado',
}

export const PURCHASE_TONE: Record<PurchaseStatus, Tone> = {
  draft: 'gray',
  quoted: 'blue',
  approved: 'purple',
  ordered: 'amber',
  partially_received: 'amber',
  received: 'green',
  cancelled: 'red',
}

export function purchaseOrders(): Promise<PurchaseOrder[]> {
  return list<PurchaseOrder>('purchase_orders', {
    select: 'id,order_number,supplier_id,work_id,status,total_value,expected_at,created_at',
    orderBy: 'created_at',
  })
}

export function setPurchaseStatus(id: string, status: PurchaseStatus): Promise<PurchaseOrder> {
  return update<PurchaseOrder>('purchase_orders', id, { status, updated_at: new Date().toISOString() })
}

/** Numero sequencial legivel para pedidos e requisicoes: PREFIXO-AAAAMM-NNN. */
export function nextCode(prefix: string, existing: string[]): string {
  const base = prefix + '-' + new Date().toISOString().slice(0, 7).replace('-', '')
  const used = existing
    .filter((code) => code.startsWith(base))
    .map((code) => Number(code.split('-')[2]) || 0)
  return base + '-' + String((used.length ? Math.max(...used) : 0) + 1).padStart(3, '0')
}
