/** Repositorio de propostas comerciais. */
import { insert, list } from './db'
import type { Proposal, ProposalStatus } from '../core/types'
import type { Tone } from '../ui/components/badge'

const SELECT =
  'id,client_id,budget_id,proposal_number,title,status,total_value,valid_until,business_unit_id,seller_id,manager_id,metadata,created_at,clients(name,city,state),budgets(system_power_kwp)'

export const PROPOSAL_LABEL: Record<ProposalStatus, string> = {
  draft: 'Rascunho',
  sent: 'Enviada',
  viewed: 'Visualizada',
  accepted: 'Aceita',
  rejected: 'Rejeitada',
  expired: 'Expirada',
}

export const PROPOSAL_TONE: Record<ProposalStatus, Tone> = {
  draft: 'gray',
  sent: 'blue',
  viewed: 'amber',
  accepted: 'green',
  rejected: 'red',
  expired: 'gray',
}

export function findAll(): Promise<Proposal[]> {
  return list<Proposal>('proposals', { select: SELECT, orderBy: 'created_at' })
}


export interface ProposalInput {
  proposal_number: string
  title: string | null
  client_id: string
  budget_id: string | null
  status: ProposalStatus
  total_value: number | null
  valid_until: string | null
  business_unit_id: string | null
  seller_id: string | null
  manager_id: string | null
  metadata: Record<string, unknown>
}

export function create(input: ProposalInput): Promise<Proposal> {
  return insert<Proposal>('proposals', { ...input })
}

/** Numeracao sequencial por mes, no mesmo padrao dos contratos (PR-AAAAMM-000). */
export function nextNumber(existing: Proposal[]): string {
  const prefix = 'PR-' + new Date().toISOString().slice(0, 7).replace('-', '')
  const used = existing
    .map((proposal) => proposal.proposal_number)
    .filter((number) => number.startsWith(prefix))
    .map((number) => Number(number.split('-')[2]) || 0)
  const next = (used.length ? Math.max(...used) : 0) + 1
  return prefix + '-' + String(next).padStart(3, '0')
}

export function clientName(proposal: Proposal): string {
  return proposal.clients?.name || 'Cliente'
}

export function powerKwp(proposal: Proposal): number | null {
  return proposal.budgets?.system_power_kwp ?? null
}

/** Serie diaria de valor para o grafico de produtividade. */
export function dailySeries(proposals: Proposal[], days: number): { label: string; value: number }[] {
  const points: { label: string; value: number }[] = []
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date()
    day.setDate(day.getDate() - offset)
    const key = day.toISOString().slice(0, 10)
    const total = proposals
      .filter((proposal) => proposal.created_at.slice(0, 10) === key)
      .reduce((sum, proposal) => sum + (proposal.total_value ?? 0), 0)
    points.push({ label: key.slice(8, 10) + '/' + key.slice(5, 7), value: total })
  }
  return points
}

export function clientCity(proposal: Proposal): string {
  const city = proposal.clients?.city
  const state = proposal.clients?.state
  if (city && state) return city + ', ' + state
  return city || state || '—'
}

/** Agrupamento dos cartoes-filtro da tela de Negociacoes. */
export type DealBucket = 'todas' | 'andamento' | 'aceitas' | 'perdidas' | 'arquivadas'

export function dealBucket(proposal: Proposal): Exclude<DealBucket, 'todas'> {
  if (proposal.status === 'accepted') return 'aceitas'
  if (proposal.status === 'rejected') return 'perdidas'
  if (proposal.status === 'expired') return 'arquivadas'
  return 'andamento'
}
