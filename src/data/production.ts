/** Repositorio de ordens de producao, requisicoes e apontamentos logisticos. */
import { insert, insertMany, list, update } from './db'
import type {
  FlowStatus,
  LogisticsEntry,
  LogisticsKind,
  MaterialRequisition,
  ProductionOrder,
  ProductionStage,
  RequisitionItem,
  RequisitionStatus,
} from '../core/types'
import type { Tone } from '../ui/components/badge'

export const STAGE_LABEL: Record<ProductionStage, string> = {
  'a-produzir': 'A Produzir',
  'em-producao': 'Em Produção',
  concluida: 'Produção Concluída',
  cancelada: 'Cancelada',
}

export const STAGE_TONE: Record<ProductionStage, Tone> = {
  'a-produzir': 'amber',
  'em-producao': 'blue',
  concluida: 'green',
  cancelada: 'red',
}

export const FLOW_LABEL: Record<FlowStatus, string> = {
  'nao-iniciado': 'Não iniciado',
  'em-andamento': 'Em andamento',
  concluido: 'Concluído',
}

export const FLOW_TONE: Record<FlowStatus, Tone> = {
  'nao-iniciado': 'gray',
  'em-andamento': 'amber',
  concluido: 'green',
}

const ORDER_SELECT =
  'id,code,client_id,contract_id,business_unit_id,manager_id,stage,purchase_flow,shipping_flow,conflicts,started_at,finished_at,created_at,updated_at'

export function orders(): Promise<ProductionOrder[]> {
  return list<ProductionOrder>('production_orders', { select: ORDER_SELECT, orderBy: 'created_at' })
}

export interface OrderInput {
  code: string
  client_id: string
  contract_id: string | null
  business_unit_id: string | null
  manager_id: string | null
  stage: ProductionStage
}

export function createOrder(input: OrderInput): Promise<ProductionOrder> {
  return insert<ProductionOrder>('production_orders', { ...input })
}

export function setStage(id: string, stage: ProductionStage): Promise<ProductionOrder> {
  const patch: Record<string, unknown> = { stage, updated_at: new Date().toISOString() }
  if (stage === 'em-producao') patch.started_at = new Date().toISOString()
  if (stage === 'concluida') patch.finished_at = new Date().toISOString()
  return update<ProductionOrder>('production_orders', id, patch)
}

export function setFlow(id: string, field: 'purchase_flow' | 'shipping_flow', value: FlowStatus): Promise<ProductionOrder> {
  return update<ProductionOrder>('production_orders', id, { [field]: value, updated_at: new Date().toISOString() })
}

/* ---------- Requisicoes de material ---------- */

export const REQUISITION_LABEL: Record<RequisitionStatus, string> = {
  open: 'Em aberto',
  approved: 'Aprovada',
  separated: 'Separada',
  delivered: 'Entregue',
  cancelled: 'Cancelada',
}

export const REQUISITION_TONE: Record<RequisitionStatus, Tone> = {
  open: 'amber',
  approved: 'blue',
  separated: 'purple',
  delivered: 'green',
  cancelled: 'gray',
}

export function requisitions(): Promise<MaterialRequisition[]> {
  return list<MaterialRequisition>('material_requisitions', {
    select: 'id,number,work_id,production_order_id,requested_by,status,notes,created_at',
    orderBy: 'created_at',
  })
}

export function requisitionItems(): Promise<RequisitionItem[]> {
  return list<RequisitionItem>('material_requisition_items', {
    select: 'id,requisition_id,inventory_item_id,quantity,delivered_quantity',
    orderBy: 'created_at',
    ascending: true,
  })
}

export interface RequisitionInput {
  number: string
  work_id: string | null
  production_order_id: string | null
  requested_by: string | null
  status: RequisitionStatus
  notes: string | null
}

export interface RequisitionLine {
  inventory_item_id: string
  quantity: number
}

export async function createRequisition(input: RequisitionInput, lines: RequisitionLine[]): Promise<MaterialRequisition> {
  const requisition = await insert<MaterialRequisition>('material_requisitions', { ...input })
  if (lines.length) {
    await insertMany<RequisitionItem>(
      'material_requisition_items',
      lines.map((line) => ({ ...line, requisition_id: requisition.id })),
    )
  }
  return requisition
}

export function setRequisitionStatus(id: string, status: RequisitionStatus): Promise<MaterialRequisition> {
  return update<MaterialRequisition>('material_requisitions', id, { status, updated_at: new Date().toISOString() })
}

/* ---------- Apontamentos logisticos ---------- */

export const LOGISTICS_LABEL: Record<LogisticsKind, string> = {
  expedicao: 'Expedição',
  entrega: 'Entrega',
  coleta: 'Coleta',
  devolucao: 'Devolução',
}

export const LOGISTICS_TONE: Record<LogisticsKind, Tone> = {
  expedicao: 'blue',
  entrega: 'green',
  coleta: 'amber',
  devolucao: 'red',
}

export function logistics(): Promise<LogisticsEntry[]> {
  return list<LogisticsEntry>('logistics_entries', {
    select: 'id,work_id,production_order_id,kind,occurred_at,vehicle,driver,notes,created_at',
    orderBy: 'occurred_at',
  })
}

export interface LogisticsInput {
  work_id: string | null
  production_order_id: string | null
  kind: LogisticsKind
  occurred_at: string
  vehicle: string | null
  driver: string | null
  notes: string | null
}

export function createLogistics(input: LogisticsInput): Promise<LogisticsEntry> {
  return insert<LogisticsEntry>('logistics_entries', { ...input })
}
