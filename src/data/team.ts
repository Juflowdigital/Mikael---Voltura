/** Membros da organizacao — usados como Gestor/Vendedor/Responsavel. */
import { supabase } from '../lib/supabase'
import { organizationId } from './db'
import type { Role } from '../core/types'

export interface Member {
  userId: string
  name: string
  role: Role
}

export async function members(): Promise<Member[]> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('user_id,role,profiles(full_name)')
    .eq('organization_id', organizationId())
    .eq('active', true)
  if (error) throw new Error('Falha ao carregar a equipe: ' + error.message)

  return (data ?? []).map((row) => {
    const profile = row.profiles as { full_name: string | null } | { full_name: string | null }[] | null
    const name = Array.isArray(profile) ? profile[0]?.full_name : profile?.full_name
    return { userId: row.user_id as string, name: name || 'Sem nome', role: row.role as Role }
  })
}

export function nameOf(list: Member[], userId: string | null): string {
  if (!userId) return '—'
  return list.find((member) => member.userId === userId)?.name ?? '—'
}
