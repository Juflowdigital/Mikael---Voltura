/** Repositorio de obras, equipes, checklist e apontamentos de campo. */
import { insert, insertMany, list, update } from './db'
import type { FieldCheckin, Work, WorkAssignment, WorkChecklistItem, WorkPhoto, WorkStatus } from '../core/types'
import type { Tone } from '../ui/components/badge'

export const STAGES: { id: WorkStatus; label: string }[] = [
  { id: 'planning', label: 'Planejamento' },
  { id: 'separation', label: 'Separação' },
  { id: 'mobilization', label: 'Mobilização' },
  { id: 'installation', label: 'Instalação' },
  { id: 'commissioning', label: 'Comissionamento' },
  { id: 'delivery', label: 'Aguardando vistoria' },
  { id: 'completed', label: 'Concluída' },
  { id: 'paused', label: 'Pausada' },
  { id: 'cancelled', label: 'Cancelada' },
]

export const STAGE_LABEL: Record<WorkStatus, string> = STAGES.reduce(
  (acc, stage) => ({ ...acc, [stage.id]: stage.label }),
  {} as Record<WorkStatus, string>,
)

export const STAGE_TONE: Record<WorkStatus, Tone> = {
  planning: 'gray',
  separation: 'gray',
  mobilization: 'blue',
  installation: 'amber',
  commissioning: 'purple',
  delivery: 'blue',
  completed: 'green',
  paused: 'amber',
  cancelled: 'red',
}

/** Etapas em que a obra esta efetivamente rodando. */
export const RUNNING: WorkStatus[] = ['separation', 'mobilization', 'installation', 'commissioning']

/** Checklist padrao aplicado a toda obra nova. */
export const DEFAULT_CHECKLIST: { title: string; stage: WorkStatus }[] = [
  { title: 'Conferir kit e separar material', stage: 'separation' },
  { title: 'Agendar equipe e transporte', stage: 'mobilization' },
  { title: 'Instalar estrutura de fixação', stage: 'installation' },
  { title: 'Instalar módulos fotovoltaicos', stage: 'installation' },
  { title: 'Instalar inversor e string box', stage: 'installation' },
  { title: 'Executar comissionamento e testes', stage: 'commissioning' },
  { title: 'Registrar fotos e documentação', stage: 'commissioning' },
  { title: 'Solicitar vistoria da concessionária', stage: 'delivery' },
]

const WORK_SELECT =
  'id,work_number,client_id,contract_id,name,status,system_power_kwp,address,latitude,longitude,planned_start,planned_end,actual_start,actual_end,budgeted_cost,actual_cost,created_at,updated_at'

export function findAll(): Promise<Work[]> {
  return list<Work>('works', { select: WORK_SELECT, orderBy: 'created_at' })
}

export function assignments(): Promise<WorkAssignment[]> {
  return list<WorkAssignment>('work_assignments', {
    select: 'id,work_id,user_id,assignment_role,starts_at,ends_at,created_at',
    orderBy: 'created_at',
  })
}

export function checklist(): Promise<WorkChecklistItem[]> {
  return list<WorkChecklistItem>('work_checklist_items', {
    select: 'id,work_id,title,stage,position,completed,completed_by,completed_at,created_at',
    orderBy: 'position',
    ascending: true,
  })
}

export function photos(): Promise<WorkPhoto[]> {
  return list<WorkPhoto>('work_photos', {
    select: 'id,work_id,checklist_item_id,stage,storage_path,captured_at',
    orderBy: 'captured_at',
  })
}

export function checkins(): Promise<FieldCheckin[]> {
  return list<FieldCheckin>('field_checkins', {
    select: 'id,work_id,user_id,kind,latitude,longitude,occurred_at',
    orderBy: 'occurred_at',
  })
}

export interface WorkInput {
  work_number: string
  client_id: string
  contract_id: string | null
  name: string
  status: WorkStatus
  system_power_kwp: number | null
  address: Record<string, unknown>
  planned_start: string | null
  planned_end: string | null
  budgeted_cost: number | null
}

export async function create(input: WorkInput): Promise<Work> {
  const work = await insert<Work>('works', { ...input })
  await insertMany<WorkChecklistItem>(
    'work_checklist_items',
    DEFAULT_CHECKLIST.map((entry, index) => ({ work_id: work.id, title: entry.title, stage: entry.stage, position: index })),
  )
  return work
}

export function setStatus(id: string, status: WorkStatus): Promise<Work> {
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (status === 'installation') patch.actual_start = new Date().toISOString().slice(0, 10)
  if (status === 'completed') patch.actual_end = new Date().toISOString().slice(0, 10)
  return update<Work>('works', id, patch)
}

export function toggleChecklistItem(item: WorkChecklistItem, userId: string | null): Promise<WorkChecklistItem> {
  return update<WorkChecklistItem>('work_checklist_items', item.id, {
    completed: !item.completed,
    completed_by: item.completed ? null : userId,
    completed_at: item.completed ? null : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
}

export function assign(workId: string, userId: string, role: string): Promise<WorkAssignment> {
  return insert<WorkAssignment>('work_assignments', { work_id: workId, user_id: userId, assignment_role: role })
}

export function addressOf(work: Work): string {
  const address = work.address ?? {}
  const parts = [address.full, address.city, address.state].filter(Boolean)
  return parts.length ? parts.join(', ') : '—'
}

/** Percentual de conclusao pelo checklist. */
export function progressOf(items: WorkChecklistItem[]): number {
  if (!items.length) return 0
  return (items.filter((item) => item.completed).length / items.length) * 100
}

/** Obra atrasada: passou do fim previsto e nao foi concluida. */
export function isLate(work: Work): boolean {
  if (!work.planned_end || work.status === 'completed' || work.status === 'cancelled') return false
  return work.planned_end < new Date().toISOString().slice(0, 10)
}

export function nextNumber(existing: string[]): string {
  const base = 'OB-' + new Date().toISOString().slice(0, 7).replace('-', '')
  const used = existing.filter((code) => code.startsWith(base)).map((code) => Number(code.split('-')[2]) || 0)
  return base + '-' + String((used.length ? Math.max(...used) : 0) + 1).padStart(3, '0')
}
