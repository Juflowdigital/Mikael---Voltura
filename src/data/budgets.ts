/** Repositorio de dimensionamentos (tabela budgets). */
import { insert, list } from './db'
import type { Budget } from '../core/types'

const SELECT =
  'id,client_id,lead_id,monthly_consumption_kwh,system_power_kwp,module_count,module_power_w,inverter_power_kw,estimated_generation_kwh,roof_area_m2,estimated_price,payback_years,assumptions,created_at'

export type SystemKind = 'ongrid' | 'hibrido' | 'offgrid' | 'bess'

export const KIND_LABEL: Record<SystemKind, string> = {
  ongrid: 'On-grid',
  hibrido: 'Híbrido',
  offgrid: 'Off-grid',
  bess: 'BESS',
}

export interface BudgetInput {
  client_id: string
  monthly_consumption_kwh: number
  system_power_kwp: number
  module_count: number
  module_power_w: number
  inverter_power_kw: number
  estimated_generation_kwh: number
  roof_area_m2: number
  assumptions: Record<string, unknown>
}

export function findAll(): Promise<Budget[]> {
  return list<Budget>('budgets', { select: SELECT, orderBy: 'created_at' })
}

export function create(input: BudgetInput): Promise<Budget> {
  return insert<Budget>('budgets', { ...input })
}

export function kindOf(budget: Budget): SystemKind {
  const kind = (budget.assumptions?.system_kind as SystemKind | undefined) ?? 'ongrid'
  return kind in KIND_LABEL ? kind : 'ongrid'
}

export function scenarioOf(budget: Budget): string {
  return String(budget.assumptions?.scenario ?? 'Cenário ideal')
}

export function cityOf(budget: Budget): string {
  return String(budget.assumptions?.city ?? '—')
}

/** Um dimensionamento vira "convertido" quando ja gerou proposta. */
export function isConverted(budget: Budget, budgetIdsWithProposal: Set<string>): boolean {
  return budgetIdsWithProposal.has(budget.id)
}
