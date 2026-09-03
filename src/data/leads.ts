/** Repositorio de leads e estagios do funil. */
import { insert, list, remove, update } from './db'
import type { Lead, LeadStage } from '../core/types'

const SELECT =
  'id,client_id,name,email,phone,city,customer_type,source,stage,estimated_value,loss_reason,assigned_to,next_action_at,created_at,updated_at'

export const STAGES: { key: LeadStage; label: string; zone: 'pre' | 'venda' }[] = [
  { key: 'lead', label: 'Novos Leads', zone: 'pre' },
  { key: 'qualified', label: 'Cliente Novo', zone: 'venda' },
  { key: 'site_visit', label: 'Visita Técnica', zone: 'venda' },
  { key: 'proposal_sent', label: 'Proposta Enviada', zone: 'venda' },
  { key: 'negotiation', label: 'Em Negociação', zone: 'venda' },
  { key: 'won', label: 'Ganhos', zone: 'venda' },
  { key: 'lost', label: 'Perdidos', zone: 'venda' },
]

export const STAGE_LABEL: Record<LeadStage, string> = STAGES.reduce(
  (acc, stage) => ({ ...acc, [stage.key]: stage.label }),
  {} as Record<LeadStage, string>,
)

/** Agrupamento usado nos cartoes-filtro da tela de Leads. */
export type LeadBucket = 'todos' | 'novos' | 'funil' | 'convertidos' | 'descartados'

export function bucketOf(lead: Lead): Exclude<LeadBucket, 'todos'> {
  if (lead.stage === 'lead') return 'novos'
  if (lead.stage === 'won') return 'convertidos'
  if (lead.stage === 'lost') return 'descartados'
  return 'funil'
}

export interface LeadInput {
  name: string
  email: string | null
  phone: string | null
  city: string | null
  customer_type: string | null
  source: string | null
  stage: LeadStage
  estimated_value: number | null
  assigned_to: string | null
}

export function findAll(): Promise<Lead[]> {
  return list<Lead>('leads', { select: SELECT, orderBy: 'created_at' })
}

export function create(input: LeadInput): Promise<Lead> {
  return insert<Lead>('leads', { ...input })
}

export function save(id: string, input: Partial<LeadInput>): Promise<Lead> {
  return update<Lead>('leads', id, { ...input, updated_at: new Date().toISOString() })
}

export function moveToStage(id: string, stage: LeadStage): Promise<Lead> {
  return update<Lead>('leads', id, { stage, updated_at: new Date().toISOString() })
}

export function destroy(id: string): Promise<void> {
  return remove('leads', id)
}
