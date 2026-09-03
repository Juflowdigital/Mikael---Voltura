/** Repositorio de projetos (tabela homologations). */
import { insert, list, update } from './db'
import type { Homologation, HomologationStatus } from '../core/types'
import type { Tone } from '../ui/components/badge'

const SELECT =
  'id,client_id,contract_id,utility_company,protocol,status,deadline,access_opinion_expires_at,responsible_id,metadata,created_at,updated_at'

export const STAGES: { id: HomologationStatus; label: string }[] = [
  { id: 'documents', label: 'Documentação' },
  { id: 'submitted', label: 'Protocolado' },
  { id: 'under_review', label: 'Em análise' },
  { id: 'approved', label: 'Aprovado' },
  { id: 'connected', label: 'Concluído' },
  { id: 'rejected', label: 'Reprovado' },
]

export const STAGE_LABEL: Record<HomologationStatus, string> = STAGES.reduce(
  (acc, stage) => ({ ...acc, [stage.id]: stage.label }),
  {} as Record<HomologationStatus, string>,
)

export const STAGE_TONE: Record<HomologationStatus, Tone> = {
  documents: 'gray',
  submitted: 'blue',
  under_review: 'amber',
  approved: 'green',
  connected: 'green',
  rejected: 'red',
}

/** Marcos usados no grafico "Tempo médio por etapa". */
export const MILESTONES: { key: string; label: string }[] = [
  { key: 'submitted_at', label: 'Orçamento de Conexão' },
  { key: 'reviewed_at', label: 'Projeto Executivo' },
  { key: 'approved_at', label: 'Liberação de Produção' },
  { key: 'connected_at', label: 'Liberação Total de Obra' },
]

export function nameOf(project: Homologation): string {
  return String(project.metadata?.name ?? project.protocol ?? 'Projeto sem título')
}

export function powerKwp(project: Homologation): number | null {
  const value = Number(project.metadata?.system_power_kwp)
  return Number.isFinite(value) && value > 0 ? value : null
}

export function isStandalone(project: Homologation): boolean {
  return !project.contract_id
}

export function hasPendency(project: Homologation): boolean {
  return Boolean(project.metadata?.pendency)
}

export function findAll(): Promise<Homologation[]> {
  return list<Homologation>('homologations', { select: SELECT, orderBy: 'created_at' })
}

export interface ProjectInput {
  client_id: string
  contract_id: string | null
  utility_company: string
  protocol: string | null
  status: HomologationStatus
  responsible_id: string | null
  metadata: Record<string, unknown>
}

export function create(input: ProjectInput): Promise<Homologation> {
  return insert<Homologation>('homologations', { ...input })
}

export function setStatus(id: string, status: HomologationStatus): Promise<Homologation> {
  return update<Homologation>('homologations', id, { status, updated_at: new Date().toISOString() })
}

/** Dias entre a criacao e o marco, quando o marco existe. */
export function daysToMilestone(project: Homologation, key: string): number | null {
  const raw = project.metadata?.[key]
  if (!raw) return null
  const value = new Date(String(raw)).getTime()
  const start = new Date(project.created_at).getTime()
  if (!Number.isFinite(value)) return null
  return Math.max(0, Math.round((value - start) / 86400000))
}

export function median(values: number[]): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function average(values: number[]): number {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}
