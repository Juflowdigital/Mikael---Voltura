/** Repositorio de contratos e seus itens. */
import { insert, insertMany, list, update } from './db'
import type { Contract, ContractItem, ContractStatus } from '../core/types'
import type { Tone } from '../ui/components/badge'

const SELECT =
  'id,contract_number,client_id,proposal_id,title,status,total_value,signed_at,document_path,seller_id,manager_id,payment_terms,installment_count,execution_days,commission_percent,metadata,created_at,updated_at'

export const STATUS_LABEL: Record<ContractStatus, string> = {
  draft: 'Rascunho',
  sent: 'Enviado',
  partially_signed: 'Parcialmente assinado',
  signed: 'Assinado',
  cancelled: 'Cancelado',
}

export const STATUS_TONE: Record<ContractStatus, Tone> = {
  draft: 'gray',
  sent: 'blue',
  partially_signed: 'amber',
  signed: 'green',
  cancelled: 'red',
}

/**
 * Etapas operacionais do ASTER. Ficam em `metadata.stage` porque o status
 * do banco cobre apenas o ciclo de assinatura.
 */
export type Stage = 'a-emitir' | 'a-formalizar' | 'a-faturar' | 'em-execucao' | 'em-finalizacao' | 'finalizado'

export const STAGES: { id: Stage; label: string }[] = [
  { id: 'a-emitir', label: 'A Emitir' },
  { id: 'a-formalizar', label: 'A Formalizar' },
  { id: 'a-faturar', label: 'A Faturar' },
  { id: 'em-execucao', label: 'Em Execução' },
  { id: 'em-finalizacao', label: 'Em Finalização' },
  { id: 'finalizado', label: 'Finalizado' },
]

export const STAGE_LABEL: Record<Stage, string> = STAGES.reduce(
  (acc, stage) => ({ ...acc, [stage.id]: stage.label }),
  {} as Record<Stage, string>,
)

export const STAGE_TONE: Record<Stage, Tone> = {
  'a-emitir': 'gray',
  'a-formalizar': 'blue',
  'a-faturar': 'amber',
  'em-execucao': 'amber',
  'em-finalizacao': 'purple',
  finalizado: 'green',
}

/** Deduz a etapa a partir de `metadata.stage`, caindo no status quando ausente. */
export function stageOf(contract: Contract): Stage {
  const stored = contract.metadata?.stage as Stage | undefined
  if (stored && stored in STAGE_LABEL) return stored
  if (contract.status === 'signed') return 'em-execucao'
  if (contract.status === 'sent' || contract.status === 'partially_signed') return 'a-formalizar'
  return 'a-emitir'
}

export function powerKwp(contract: Contract): number | null {
  const value = Number(contract.metadata?.system_power_kwp)
  return Number.isFinite(value) && value > 0 ? value : null
}

export function findAll(): Promise<Contract[]> {
  return list<Contract>('contracts', { select: SELECT, orderBy: 'created_at' })
}

export function items(contractId: string): Promise<ContractItem[]> {
  return list<ContractItem>('contract_items', {
    select: 'id,contract_id,item_type,name,quantity,unit_price,warranty_months,created_at',
    eq: { contract_id: contractId },
    orderBy: 'created_at',
    ascending: true,
  })
}

export interface ContractInput {
  contract_number: string
  client_id: string
  title: string | null
  status: ContractStatus
  total_value: number
  seller_id: string | null
  manager_id: string | null
  payment_terms: string | null
  installment_count: number | null
  execution_days: number | null
  commission_percent: number | null
  metadata: Record<string, unknown>
}

export interface ItemInput {
  item_type: string
  name: string
  quantity: number
  unit_price: number
  warranty_months: number | null
}

export async function create(input: ContractInput, lines: ItemInput[]): Promise<Contract> {
  const contract = await insert<Contract>('contracts', { ...input })
  if (lines.length) {
    await insertMany<ContractItem>(
      'contract_items',
      lines.map((line) => ({ ...line, contract_id: contract.id })),
    )
  }
  return contract
}

export function setStage(id: string, stage: Stage): Promise<Contract> {
  return update<Contract>('contracts', id, { metadata: { stage } })
}

/** Numero sequencial legivel: CT-AAAAMM-NNN. */
export function nextNumber(existing: Contract[]): string {
  const prefix = 'CT-' + new Date().toISOString().slice(0, 7).replace('-', '')
  const used = existing
    .map((contract) => contract.contract_number)
    .filter((number) => number.startsWith(prefix))
    .map((number) => Number(number.split('-')[2]) || 0)
  const next = (used.length ? Math.max(...used) : 0) + 1
  return prefix + '-' + String(next).padStart(3, '0')
}
