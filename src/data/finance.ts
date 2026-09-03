/** Repositorio financeiro: contas, lancamentos, centros de custo, NF e conciliacao. */
import { insert, list, remove, update } from './db'
import type {
  CostCenter,
  FinanceDirection,
  FinancialAccount,
  FinancialTransaction,
  Installment,
  Invoice,
  InvoiceStatus,
  PaymentStatus,
  StatementEntry,
} from '../core/types'
import type { Tone } from '../ui/components/badge'

export const STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: 'Em aberto',
  paid: 'Pago',
  overdue: 'Vencido',
  cancelled: 'Cancelado',
}

export const STATUS_TONE: Record<PaymentStatus, Tone> = {
  pending: 'amber',
  paid: 'green',
  overdue: 'red',
  cancelled: 'gray',
}

export const DIRECTION_LABEL: Record<FinanceDirection, string> = {
  income: 'Receita',
  expense: 'Despesa',
}

export const CATEGORIES: Record<FinanceDirection, string[]> = {
  income: ['Venda de sistema', 'Parcela de contrato', 'Serviço avulso', 'Manutenção', 'Outros'],
  expense: ['Compra de equipamento', 'Mão de obra', 'Frete', 'Impostos', 'Comissão', 'Despesa administrativa', 'Outros'],
}

/** Vencido = em aberto com data passada. Calculado, nao depende de rotina. */
export function effectiveStatus(row: { status: PaymentStatus; due_date: string }): PaymentStatus {
  if (row.status !== 'pending') return row.status
  return row.due_date < new Date().toISOString().slice(0, 10) ? 'overdue' : 'pending'
}

/* ---------- Contas ---------- */

export function accounts(): Promise<FinancialAccount[]> {
  return list<FinancialAccount>('financial_accounts', {
    select: 'id,name,bank_name,account_type,opening_balance,active,created_at',
    orderBy: 'name',
    ascending: true,
  })
}

export interface AccountInput {
  name: string
  bank_name: string | null
  account_type: string | null
  opening_balance: number
  active: boolean
}

export function createAccount(input: AccountInput): Promise<FinancialAccount> {
  return insert<FinancialAccount>('financial_accounts', { ...input })
}

export function saveAccount(id: string, input: AccountInput): Promise<FinancialAccount> {
  return update<FinancialAccount>('financial_accounts', id, { ...input, updated_at: new Date().toISOString() })
}

/** Saldo = abertura + receitas pagas - despesas pagas. */
export function balanceOf(account: FinancialAccount, rows: FinancialTransaction[]): number {
  const own = rows.filter((row) => row.account_id === account.id && row.status === 'paid')
  const income = own.filter((row) => row.direction === 'income').reduce((sum, row) => sum + Number(row.amount), 0)
  const expense = own.filter((row) => row.direction === 'expense').reduce((sum, row) => sum + Number(row.amount), 0)
  return Number(account.opening_balance) + income - expense
}

/* ---------- Lancamentos ---------- */

const TX_SELECT =
  'id,account_id,client_id,supplier_id,work_id,contract_id,cost_center_id,direction,category,description,amount,due_date,paid_at,status,payment_method,created_at'

export function transactions(): Promise<FinancialTransaction[]> {
  return list<FinancialTransaction>('financial_transactions', { select: TX_SELECT, orderBy: 'due_date' })
}

export interface TransactionInput {
  account_id: string | null
  client_id: string | null
  supplier_id: string | null
  contract_id: string | null
  cost_center_id: string | null
  direction: FinanceDirection
  category: string
  description: string
  amount: number
  due_date: string
  status: PaymentStatus
  payment_method: string | null
}

export function createTransaction(input: TransactionInput): Promise<FinancialTransaction> {
  return insert<FinancialTransaction>('financial_transactions', { ...input })
}

export function settle(id: string, paid: boolean): Promise<FinancialTransaction> {
  return update<FinancialTransaction>('financial_transactions', id, {
    status: paid ? 'paid' : 'pending',
    paid_at: paid ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  })
}

export function removeTransaction(id: string): Promise<void> {
  return remove('financial_transactions', id)
}

export function installments(): Promise<Installment[]> {
  return list<Installment>('installments', {
    select: 'id,contract_id,transaction_id,installment_number,total_installments,amount,due_date,paid_at,status,payment_method',
    orderBy: 'due_date',
    ascending: true,
  })
}

/* ---------- Centros de custo ---------- */

export function costCenters(): Promise<CostCenter[]> {
  return list<CostCenter>('cost_centers', {
    select: 'id,code,name,kind,monthly_budget,active,created_at',
    orderBy: 'code',
    ascending: true,
  })
}

export interface CostCenterInput {
  code: string
  name: string
  kind: CostCenter['kind']
  monthly_budget: number
  active: boolean
}

export function createCostCenter(input: CostCenterInput): Promise<CostCenter> {
  return insert<CostCenter>('cost_centers', { ...input })
}

export function saveCostCenter(id: string, input: CostCenterInput): Promise<CostCenter> {
  return update<CostCenter>('cost_centers', id, { ...input, updated_at: new Date().toISOString() })
}

/* ---------- Notas fiscais ---------- */

export const INVOICE_LABEL: Record<InvoiceStatus, string> = {
  draft: 'Rascunho',
  issued: 'Emitida',
  cancelled: 'Cancelada',
  error: 'Erro na emissão',
}

export const INVOICE_TONE: Record<InvoiceStatus, Tone> = {
  draft: 'gray',
  issued: 'green',
  cancelled: 'red',
  error: 'amber',
}

export function invoices(): Promise<Invoice[]> {
  return list<Invoice>('invoices', {
    select: 'id,number,series,kind,client_id,contract_id,issue_date,total_value,status,access_key,notes,created_at',
    orderBy: 'issue_date',
  })
}

export interface InvoiceInput {
  number: string
  series: string | null
  kind: Invoice['kind']
  client_id: string | null
  contract_id: string | null
  issue_date: string
  total_value: number
  status: InvoiceStatus
  notes: string | null
}

export function createInvoice(input: InvoiceInput): Promise<Invoice> {
  return insert<Invoice>('invoices', { ...input })
}

export function setInvoiceStatus(id: string, status: InvoiceStatus): Promise<Invoice> {
  return update<Invoice>('invoices', id, { status, updated_at: new Date().toISOString() })
}

/* ---------- Conciliacao ---------- */

export function statement(): Promise<StatementEntry[]> {
  return list<StatementEntry>('bank_statement_entries', {
    select: 'id,account_id,occurred_at,description,amount,direction,bank_reference,matched_transaction_id,reconciled_at,created_at',
    orderBy: 'occurred_at',
  })
}

export interface StatementInput {
  account_id: string
  occurred_at: string
  description: string
  amount: number
  direction: FinanceDirection
  bank_reference: string | null
}

export function addStatementEntry(input: StatementInput): Promise<StatementEntry> {
  return insert<StatementEntry>('bank_statement_entries', { ...input })
}

export function reconcile(entryId: string, transactionId: string | null): Promise<StatementEntry> {
  return update<StatementEntry>('bank_statement_entries', entryId, {
    matched_transaction_id: transactionId,
    reconciled_at: transactionId ? new Date().toISOString() : null,
  })
}

/**
 * Sugere o lancamento correspondente a uma linha do extrato: mesma conta,
 * mesmo sentido, mesmo valor e data proxima. Nao concilia sozinho.
 */
export function suggestMatch(entry: StatementEntry, rows: FinancialTransaction[], usedIds: Set<string>): FinancialTransaction | null {
  const candidates = rows.filter(
    (row) =>
      !usedIds.has(row.id) &&
      row.account_id === entry.account_id &&
      row.direction === entry.direction &&
      Math.abs(Number(row.amount) - Number(entry.amount)) < 0.01,
  )
  if (!candidates.length) return null

  const target = new Date(entry.occurred_at).getTime()
  return candidates
    .map((row) => ({ row, gap: Math.abs(new Date(row.due_date).getTime() - target) }))
    .sort((left, right) => left.gap - right.gap)[0].row
}

export function nextInvoiceNumber(existing: string[]): string {
  const used = existing.map((value) => Number(value) || 0)
  return String((used.length ? Math.max(...used) : 0) + 1).padStart(6, '0')
}
