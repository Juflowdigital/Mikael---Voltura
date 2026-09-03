/** Repositorio de pos-vendas: chamados, ordens de servico, O&M, garantias e NPS. */
import { insert, list, update } from './db'
import type {
  EnergyGeneration,
  NpsResponse,
  OmContract,
  Priority,
  ServiceOrder,
  ServiceOrderKind,
  ServiceOrderStatus,
  ServiceTicket,
  TicketStatus,
  Warranty,
} from '../core/types'
import type { Tone } from '../ui/components/badge'

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
}

export const PRIORITY_TONE: Record<Priority, Tone> = {
  low: 'gray',
  medium: 'blue',
  high: 'amber',
  critical: 'red',
}

/** SLA por prioridade, em horas. */
export const SLA_HOURS: Record<Priority, number> = { low: 120, medium: 72, high: 24, critical: 8 }

export const TICKET_LABEL: Record<TicketStatus, string> = {
  open: 'Aberto',
  in_progress: 'Em atendimento',
  waiting_client: 'Aguardando cliente',
  resolved: 'Resolvido',
  cancelled: 'Cancelado',
}

export const TICKET_TONE: Record<TicketStatus, Tone> = {
  open: 'amber',
  in_progress: 'blue',
  waiting_client: 'purple',
  resolved: 'green',
  cancelled: 'gray',
}

export const TICKET_FLOW: TicketStatus[] = ['open', 'in_progress', 'waiting_client', 'resolved', 'cancelled']

export function isOpen(ticket: ServiceTicket): boolean {
  return ticket.status !== 'resolved' && ticket.status !== 'cancelled'
}

/** SLA estourado: prazo passou e o chamado ainda nao foi resolvido. */
export function isSlaBreached(ticket: ServiceTicket): boolean {
  if (!isOpen(ticket) || !ticket.sla_due_at) return false
  return new Date(ticket.sla_due_at).getTime() < Date.now()
}

export function slaDueFor(priority: Priority, from = new Date()): string {
  return new Date(from.getTime() + SLA_HOURS[priority] * 3600000).toISOString()
}

export function tickets(): Promise<ServiceTicket[]> {
  return list<ServiceTicket>('service_tickets', {
    select: 'id,ticket_number,client_id,work_id,title,description,priority,status,assigned_to,sla_due_at,resolved_at,created_at',
    orderBy: 'created_at',
  })
}

export interface TicketInput {
  ticket_number: string
  client_id: string
  work_id: string | null
  title: string
  description: string | null
  priority: Priority
  status: TicketStatus
  assigned_to: string | null
  sla_due_at: string
}

export function createTicket(input: TicketInput): Promise<ServiceTicket> {
  return insert<ServiceTicket>('service_tickets', { ...input })
}

export function setTicketStatus(id: string, status: TicketStatus): Promise<ServiceTicket> {
  return update<ServiceTicket>('service_tickets', id, {
    status,
    resolved_at: status === 'resolved' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  })
}

export function assignTicket(id: string, userId: string | null): Promise<ServiceTicket> {
  return update<ServiceTicket>('service_tickets', id, { assigned_to: userId, updated_at: new Date().toISOString() })
}

/* ---------- Ordens de servico ---------- */

export const ORDER_KIND_LABEL: Record<ServiceOrderKind, string> = {
  corretiva: 'Corretiva',
  preventiva: 'Preventiva',
  garantia: 'Garantia',
  instalacao: 'Instalação',
}

export const ORDER_STATUS_LABEL: Record<ServiceOrderStatus, string> = {
  scheduled: 'Agendada',
  in_progress: 'Em execução',
  done: 'Concluída',
  cancelled: 'Cancelada',
}

export const ORDER_STATUS_TONE: Record<ServiceOrderStatus, Tone> = {
  scheduled: 'blue',
  in_progress: 'amber',
  done: 'green',
  cancelled: 'gray',
}

export function orders(): Promise<ServiceOrder[]> {
  return list<ServiceOrder>('service_orders', {
    select: 'id,order_number,ticket_id,client_id,work_id,kind,status,scheduled_for,technician_id,started_at,finished_at,notes,created_at',
    orderBy: 'created_at',
  })
}

export interface OrderInput {
  order_number: string
  ticket_id: string | null
  client_id: string
  work_id: string | null
  kind: ServiceOrderKind
  status: ServiceOrderStatus
  scheduled_for: string | null
  technician_id: string | null
  notes: string | null
}

export function createOrder(input: OrderInput): Promise<ServiceOrder> {
  return insert<ServiceOrder>('service_orders', { ...input })
}

export function setOrderStatus(id: string, status: ServiceOrderStatus): Promise<ServiceOrder> {
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (status === 'in_progress') patch.started_at = new Date().toISOString()
  if (status === 'done') patch.finished_at = new Date().toISOString()
  return update<ServiceOrder>('service_orders', id, patch)
}

/** OS atrasada: agendada para uma data passada e ainda nao concluida. */
export function isOrderLate(order: ServiceOrder): boolean {
  if (!order.scheduled_for || order.status === 'done' || order.status === 'cancelled') return false
  return order.scheduled_for < new Date().toISOString().slice(0, 10)
}

/* ---------- O&M, garantias, geracao e NPS ---------- */

export function omContracts(): Promise<OmContract[]> {
  return list<OmContract>('om_contracts', {
    select: 'id,client_id,work_id,plan_name,frequency,amount,starts_on,ends_on,active',
    orderBy: 'starts_on',
  })
}

export function warranties(): Promise<Warranty[]> {
  return list<Warranty>('warranties', {
    select: 'id,client_id,work_id,kind,manufacturer,serial_number,starts_on,ends_on',
    orderBy: 'ends_on',
    ascending: true,
  })
}

export function generation(): Promise<EnergyGeneration[]> {
  return list<EnergyGeneration>('energy_generation', {
    select: 'id,work_id,reference_month,projected_kwh,generated_kwh,source',
    orderBy: 'reference_month',
  })
}

export function npsResponses(): Promise<NpsResponse[]> {
  return list<NpsResponse>('nps_responses', {
    select: 'id,client_id,work_id,score,comment,responded_at',
    orderBy: 'responded_at',
  })
}

export interface NpsInput {
  client_id: string
  work_id: string | null
  score: number
  comment: string | null
}

export function createNps(input: NpsInput): Promise<NpsResponse> {
  return insert<NpsResponse>('nps_responses', { ...input })
}

export type NpsGroup = 'promoter' | 'passive' | 'detractor'

export function npsGroup(score: number): NpsGroup {
  if (score >= 9) return 'promoter'
  if (score >= 7) return 'passive'
  return 'detractor'
}

export const NPS_LABEL: Record<NpsGroup, string> = {
  promoter: 'Promotor',
  passive: 'Neutro',
  detractor: 'Detrator',
}

export const NPS_TONE: Record<NpsGroup, Tone> = {
  promoter: 'green',
  passive: 'amber',
  detractor: 'red',
}

/** NPS = % promotores - % detratores, arredondado. */
export function npsScore(rows: NpsResponse[]): number {
  if (!rows.length) return 0
  const promoters = rows.filter((row) => npsGroup(row.score) === 'promoter').length
  const detractors = rows.filter((row) => npsGroup(row.score) === 'detractor').length
  return Math.round(((promoters - detractors) / rows.length) * 100)
}

/** Garantia vencendo: termina nos proximos N dias. */
export function isExpiringSoon(warranty: Warranty, days = 90): boolean {
  const limit = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)
  return warranty.ends_on >= today && warranty.ends_on <= limit
}

export function nextCode(prefix: string, existing: string[]): string {
  const base = prefix + '-' + new Date().toISOString().slice(0, 7).replace('-', '')
  const used = existing.filter((code) => code.startsWith(base)).map((code) => Number(code.split('-')[2]) || 0)
  return base + '-' + String((used.length ? Math.max(...used) : 0) + 1).padStart(3, '0')
}
