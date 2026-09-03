/** Repositorio de propostas comerciais. */
import { list } from './db'
import type { Proposal, ProposalStatus } from '../core/types'
import type { Tone } from '../ui/components/badge'

const SELECT =
  'id,client_id,budget_id,proposal_number,status,total_value,valid_until,created_at,clients(name,city,state),budgets(system_power_kwp)'

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
