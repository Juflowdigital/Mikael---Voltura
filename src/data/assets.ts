/** Repositorio de patrimonio e frota. */
import { insert, list, update } from './db'
import type { Asset, AssetMaintenance, MaintenanceStatus } from '../core/types'
import type { Tone } from '../ui/components/badge'

export const ASSET_STATUS: { id: string; label: string; tone: Tone }[] = [
  { id: 'available', label: 'Disponível', tone: 'green' },
  { id: 'in_use', label: 'Em uso', tone: 'blue' },
  { id: 'maintenance', label: 'Em manutenção', tone: 'amber' },
  { id: 'retired', label: 'Baixado', tone: 'gray' },
]

export function statusLabel(status: string): string {
  return ASSET_STATUS.find((entry) => entry.id === status)?.label ?? status
}

export function statusTone(status: string): Tone {
  return ASSET_STATUS.find((entry) => entry.id === status)?.tone ?? 'gray'
}

export const CATEGORIES = ['Veículo', 'Ferramenta', 'Equipamento', 'Andaime', 'EPI', 'Informática', 'Outro']

export function assets(): Promise<Asset[]> {
  return list<Asset>('assets', {
    select:
      'id,asset_tag,name,category,serial_number,status,responsible_id,work_id,location,acquisition_date,acquisition_value,next_maintenance_at,metadata,created_at',
    orderBy: 'asset_tag',
    ascending: true,
  })
}

export function maintenances(): Promise<AssetMaintenance[]> {
  return list<AssetMaintenance>('asset_maintenances', {
    select: 'id,asset_id,description,status,scheduled_at,completed_at,cost,provider,created_at',
    orderBy: 'scheduled_at',
    ascending: true,
  })
}

export interface AssetInput {
  asset_tag: string
  name: string
  category: string
  serial_number: string | null
  status: string
  responsible_id: string | null
  location: string | null
  acquisition_date: string | null
  acquisition_value: number | null
  next_maintenance_at: string | null
}

export function createAsset(input: AssetInput): Promise<Asset> {
  return insert<Asset>('assets', { ...input })
}

export function saveAsset(id: string, input: Partial<AssetInput>): Promise<Asset> {
  return update<Asset>('assets', id, { ...input, updated_at: new Date().toISOString() })
}

export interface MaintenanceInput {
  asset_id: string
  description: string
  status: MaintenanceStatus
  scheduled_at: string | null
  cost: number | null
  provider: string | null
}

export function createMaintenance(input: MaintenanceInput): Promise<AssetMaintenance> {
  return insert<AssetMaintenance>('asset_maintenances', { ...input })
}

export function completeMaintenance(id: string): Promise<AssetMaintenance> {
  return update<AssetMaintenance>('asset_maintenances', id, {
    status: 'completed',
    completed_at: new Date().toISOString().slice(0, 10),
    updated_at: new Date().toISOString(),
  })
}

/** Manutencao vencida: agendada para data passada e ainda nao concluida. */
export function isMaintenanceLate(row: AssetMaintenance): boolean {
  if (!row.scheduled_at || row.status === 'completed' || row.status === 'cancelled') return false
  return row.scheduled_at < new Date().toISOString().slice(0, 10)
}

/** Ativo com revisao vencida ou nos proximos 30 dias. */
export function needsMaintenance(asset: Asset): boolean {
  if (!asset.next_maintenance_at) return false
  const limit = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  return asset.next_maintenance_at <= limit
}

export function nextTag(existing: string[]): string {
  const used = existing.filter((tag) => tag.startsWith('PAT-')).map((tag) => Number(tag.split('-')[1]) || 0)
  return 'PAT-' + String((used.length ? Math.max(...used) : 0) + 1).padStart(4, '0')
}
