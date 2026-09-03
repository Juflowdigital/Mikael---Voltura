/** Repositorio de empresa, unidades de negocio, equipe e configuracoes. */
import { supabase } from '../lib/supabase'
import { insert, list, organizationId, remove, update, upsert } from './db'
import type { BusinessUnit, Organization, OrganizationSettings, Role } from '../core/types'

const UNIT_SELECT =
  'id,name,tax_id,address,city,state,utility_company,is_primary,fiscal_pending,created_at,updated_at'

/** Campos exigidos para emitir documento fiscal por unidade. */
export const FISCAL_FIELDS: { key: keyof BusinessUnit; label: string }[] = [
  { key: 'tax_id', label: 'CNPJ' },
  { key: 'address', label: 'Endereço' },
  { key: 'city', label: 'Cidade' },
  { key: 'state', label: 'UF' },
  { key: 'utility_company', label: 'Concessionária' },
]

/** Pendencias calculadas do proprio cadastro, sem depender de campo manual. */
export function fiscalPending(unit: BusinessUnit): string[] {
  const missing = FISCAL_FIELDS.filter((field) => !String(unit[field.key] ?? '').trim()).map((field) => field.label)
  const declared = Array.isArray(unit.fiscal_pending) ? unit.fiscal_pending.map(String) : []
  return [...new Set([...missing, ...declared])]
}

export function units(): Promise<BusinessUnit[]> {
  return list<BusinessUnit>('business_units', { select: UNIT_SELECT, orderBy: 'created_at', ascending: true })
}

export interface UnitInput {
  name: string
  tax_id: string | null
  address: string | null
  city: string | null
  state: string | null
  utility_company: string | null
  is_primary: boolean
}

export function createUnit(input: UnitInput): Promise<BusinessUnit> {
  return insert<BusinessUnit>('business_units', { ...input })
}

export function saveUnit(id: string, input: UnitInput): Promise<BusinessUnit> {
  return update<BusinessUnit>('business_units', id, { ...input, updated_at: new Date().toISOString() })
}

export function removeUnit(id: string): Promise<void> {
  return remove('business_units', id)
}

export interface CompanyInput {
  name: string
  legal_name: string | null
  tax_id: string | null
  city: string | null
  state: string | null
  utility_company: string | null
  address: string | null
}

export async function saveCompany(input: CompanyInput): Promise<Organization> {
  const { data, error } = await supabase
    .from('organizations')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', organizationId())
    .select()
    .single()
  if (error) throw new Error('Falha ao salvar a empresa: ' + error.message)
  return data as Organization
}

export async function uploadLogo(file: File): Promise<string> {
  const org = organizationId()
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${org}/branding/logo-${Date.now()}-${safe}`
  const upload = await supabase.storage.from('documents').upload(path, file, { upsert: true })
  if (upload.error) throw new Error('Falha ao enviar o logo: ' + upload.error.message)

  const { error } = await supabase.from('organizations').update({ logo_path: path }).eq('id', org)
  if (error) throw new Error('Falha ao registrar o logo: ' + error.message)
  return path
}

export function saveSettings(patch: Partial<OrganizationSettings>): Promise<OrganizationSettings> {
  return upsert<OrganizationSettings>('organization_settings', { ...patch }, 'organization_id')
}

/* ---------- Equipe e convites ---------- */

export interface TeamRow {
  userId: string
  name: string
  email: string | null
  role: Role
  active: boolean
  lastSeen: string | null
}

export async function team(): Promise<TeamRow[]> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('user_id,role,active,profiles(full_name)')
    .eq('organization_id', organizationId())
  if (error) throw new Error('Falha ao carregar a equipe: ' + error.message)

  return (data ?? []).map((row) => {
    const profile = row.profiles as { full_name: string | null } | { full_name: string | null }[] | null
    const name = Array.isArray(profile) ? profile[0]?.full_name : profile?.full_name
    return {
      userId: row.user_id as string,
      name: name || 'Sem nome',
      email: null,
      role: row.role as Role,
      active: Boolean(row.active),
      lastSeen: null,
    }
  })
}

export interface Invitation {
  id: string
  email: string
  full_name: string | null
  role: Role
  job_title: string | null
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
  expires_at: string
  created_at: string
}

export function invitations(): Promise<Invitation[]> {
  return list<Invitation>('organization_invitations', {
    select: 'id,email,full_name,role,job_title,status,expires_at,created_at',
    orderBy: 'created_at',
  })
}

export function invite(input: { email: string; full_name: string | null; role: Role; job_title: string | null }): Promise<Invitation> {
  return insert<Invitation>('organization_invitations', { ...input })
}

export function revokeInvitation(id: string): Promise<Invitation> {
  return update<Invitation>('organization_invitations', id, { status: 'revoked' })
}

export async function setMemberRole(userId: string, role: Role): Promise<void> {
  const { error } = await supabase
    .from('organization_members')
    .update({ role })
    .eq('organization_id', organizationId())
    .eq('user_id', userId)
  if (error) throw new Error('Falha ao alterar o perfil: ' + error.message)
}

export async function setMemberActive(userId: string, active: boolean): Promise<void> {
  const { error } = await supabase
    .from('organization_members')
    .update({ active })
    .eq('organization_id', organizationId())
    .eq('user_id', userId)
  if (error) throw new Error('Falha ao alterar o acesso: ' + error.message)
}
