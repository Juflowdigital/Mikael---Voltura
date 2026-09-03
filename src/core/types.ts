/** Tipos compartilhados entre modulos. Espelham as colunas reais do Supabase. */

export type Role = 'admin' | 'commercial' | 'engineering' | 'installer' | 'finance' | 'viewer'

export interface Organization {
  id: string
  name: string | null
  legal_name: string | null
  tax_id: string | null
  city: string | null
  state: string | null
  utility_company: string | null
  logo_path: string | null
  address: string | null
  /** Campo de texto livre herdado do app anterior; as unidades reais vivem em business_units. */
  branches: string | null
}

export interface BusinessUnit {
  id: string
  name: string
  tax_id: string | null
  address: string | null
  city: string | null
  state: string | null
  utility_company: string | null
  is_primary: boolean
  fiscal_pending: string[]
  created_at: string
  updated_at: string
}

export interface OrganizationSettings {
  calculation: Record<string, unknown>
  alerts: Record<string, unknown>
  integrations: Record<string, unknown>
  document_models: unknown[]
  approval_rules: unknown[]
}

export interface SessionUser {
  id: string
  name: string
  email: string
  role: Role
  roleLabel: string
}

export interface AppState {
  status: 'loading' | 'login' | 'ready'
  user: SessionUser | null
  organizationId: string | null
  organization: Organization | null
  settings: OrganizationSettings | null
  logoUrl: string
  sidebarCollapsed: boolean
  sidebarOpenGroup: string | null
  mobileMenuOpen: boolean
  authEmail: string
  authError: string
  authLoading: boolean
}

export interface Client {
  id: string
  name: string
  person_type: 'individual' | 'company'
  tax_id: string | null
  email: string | null
  phone: string | null
  address: Record<string, unknown> | null
  city: string | null
  state: string | null
  utility_company: string | null
  service_voltage: string | null
  monthly_consumption_kwh: number | null
  owner_id: string | null
  birth_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type LeadStage = 'lead' | 'qualified' | 'site_visit' | 'proposal_sent' | 'negotiation' | 'won' | 'lost'

export interface Lead {
  id: string
  client_id: string | null
  name: string
  email: string | null
  phone: string | null
  city: string | null
  customer_type: string | null
  source: string | null
  stage: LeadStage
  estimated_value: number | null
  loss_reason: string | null
  assigned_to: string | null
  next_action_at: string | null
  created_at: string
  updated_at: string
}

export type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired'

export interface Proposal {
  id: string
  client_id: string | null
  budget_id: string | null
  proposal_number: string
  status: ProposalStatus
  total_value: number | null
  valid_until: string | null
  created_at: string
  clients?: { name: string | null; city: string | null; state: string | null } | null
  budgets?: { system_power_kwp: number | null } | null
}

export type ContractStatus = 'draft' | 'sent' | 'partially_signed' | 'signed' | 'cancelled'

export interface Contract {
  id: string
  contract_number: string
  client_id: string
  proposal_id: string | null
  title: string | null
  status: ContractStatus
  total_value: number
  signed_at: string | null
  document_path: string | null
  seller_id: string | null
  manager_id: string | null
  payment_terms: string | null
  installment_count: number | null
  execution_days: number | null
  commission_percent: number | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface ContractItem {
  id: string
  contract_id: string
  item_type: string
  name: string
  quantity: number
  unit_price: number
  warranty_months: number | null
  created_at: string
}

export interface Budget {
  id: string
  client_id: string
  lead_id: string | null
  monthly_consumption_kwh: number | null
  system_power_kwp: number | null
  module_count: number | null
  module_power_w: number | null
  inverter_power_kw: number | null
  estimated_generation_kwh: number | null
  roof_area_m2: number | null
  estimated_price: number | null
  payback_years: number | null
  assumptions: Record<string, unknown> | null
  created_at: string
}

export type HomologationStatus = 'documents' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'connected'

export interface Homologation {
  id: string
  client_id: string
  contract_id: string | null
  utility_company: string
  protocol: string | null
  status: HomologationStatus
  deadline: string | null
  access_opinion_expires_at: string | null
  responsible_id: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type WorkStatus =
  | 'planning' | 'separation' | 'mobilization' | 'installation'
  | 'commissioning' | 'delivery' | 'completed' | 'paused' | 'cancelled'

export interface Work {
  id: string
  work_number: string
  client_id: string
  contract_id: string | null
  name: string
  status: WorkStatus
  system_power_kwp: number | null
  address: Record<string, unknown>
  latitude: number | null
  longitude: number | null
  planned_start: string | null
  planned_end: string | null
  actual_start: string | null
  actual_end: string | null
  budgeted_cost: number | null
  actual_cost: number
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  full_name: string | null
  email?: string | null
}

export interface OrganizationMember {
  user_id: string
  organization_id: string
  role: Role
  active: boolean
}

/* ---------- Produção e Estoque ---------- */

export type GeneratorType = 'ongrid' | 'hibrido' | 'offgrid'
export type ProductKind = 'gerador' | 'componente' | 'servico'
export type ComponentType = 'painel' | 'inversor' | 'estrutura' | 'stringbox' | 'otimizador' | 'servico'

export interface Product {
  id: string
  kind: ProductKind
  generator_type: GeneratorType | null
  name: string
  unit: string
  category: string | null
  active: boolean
  total_power_wp: number
  kit_price: number
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface ProductComponent {
  id: string
  product_id: string
  component_type: ComponentType
  brand: string | null
  model: string | null
  quantity: number
  power: number | null
  attributes: Record<string, unknown>
  created_at: string
}

export interface Supplier {
  id: string
  name: string
  tax_id: string | null
  email: string | null
  phone: string | null
  lead_time_days: number | null
  rating: number | null
  created_at: string
}

export interface InventoryItem {
  id: string
  sku: string
  name: string
  category: string | null
  unit: string
  barcode: string | null
  quantity: number
  minimum_quantity: number
  average_cost: number
  location: string | null
  active: boolean
  created_at: string
}

export type MovementType = 'in' | 'out' | 'reserve' | 'release' | 'adjustment' | 'transfer'

export interface InventoryMovement {
  id: string
  inventory_item_id: string
  work_id: string | null
  purchase_order_id: string | null
  movement_type: MovementType
  quantity: number
  unit_cost: number | null
  notes: string | null
  occurred_at: string
}

export type PurchaseStatus = 'draft' | 'quoted' | 'approved' | 'ordered' | 'partially_received' | 'received' | 'cancelled'

export interface PurchaseOrder {
  id: string
  order_number: string
  supplier_id: string
  work_id: string | null
  status: PurchaseStatus
  total_value: number
  expected_at: string | null
  created_at: string
}

export type ProductionStage = 'a-produzir' | 'em-producao' | 'concluida' | 'cancelada'
export type FlowStatus = 'nao-iniciado' | 'em-andamento' | 'concluido'

export interface ProductionOrder {
  id: string
  code: string
  client_id: string
  contract_id: string | null
  business_unit_id: string | null
  manager_id: string | null
  stage: ProductionStage
  purchase_flow: FlowStatus
  shipping_flow: FlowStatus
  conflicts: string[]
  started_at: string | null
  finished_at: string | null
  created_at: string
  updated_at: string
}

export type RequisitionStatus = 'open' | 'approved' | 'separated' | 'delivered' | 'cancelled'

export interface MaterialRequisition {
  id: string
  number: string
  work_id: string | null
  production_order_id: string | null
  requested_by: string | null
  status: RequisitionStatus
  notes: string | null
  created_at: string
}

export interface RequisitionItem {
  id: string
  requisition_id: string
  inventory_item_id: string
  quantity: number
  delivered_quantity: number
}

export type LogisticsKind = 'expedicao' | 'entrega' | 'coleta' | 'devolucao'

export interface LogisticsEntry {
  id: string
  work_id: string | null
  production_order_id: string | null
  kind: LogisticsKind
  occurred_at: string
  vehicle: string | null
  driver: string | null
  notes: string | null
  created_at: string
}

/* ---------- Obras ---------- */

export interface WorkAssignment {
  id: string
  work_id: string
  user_id: string
  assignment_role: string
  starts_at: string | null
  ends_at: string | null
  created_at: string
}

export interface WorkChecklistItem {
  id: string
  work_id: string
  title: string
  stage: string
  position: number
  completed: boolean
  completed_by: string | null
  completed_at: string | null
  created_at: string
}

export interface WorkPhoto {
  id: string
  work_id: string
  checklist_item_id: string | null
  stage: string
  storage_path: string
  captured_at: string
}

export interface FieldCheckin {
  id: string
  work_id: string
  user_id: string
  kind: 'checkin' | 'checkout'
  latitude: number
  longitude: number
  occurred_at: string
}
