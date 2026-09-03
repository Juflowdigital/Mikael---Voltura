/** Repositorio de clientes. */
import { insert, list, remove, update } from './db'
import type { Client } from '../core/types'

const SELECT =
  'id,name,person_type,tax_id,email,phone,address,city,state,utility_company,service_voltage,monthly_consumption_kwh,owner_id,birth_date,notes,created_at,updated_at'

export interface ClientInput {
  name: string
  person_type: 'individual' | 'company'
  tax_id: string | null
  email: string | null
  phone: string | null
  city: string | null
  state: string | null
  birth_date: string | null
  utility_company: string | null
  monthly_consumption_kwh: number | null
  notes: string | null
}

export function findAll(): Promise<Client[]> {
  return list<Client>('clients', { select: SELECT, orderBy: 'created_at' })
}

export function create(input: ClientInput): Promise<Client> {
  return insert<Client>('clients', { ...input })
}

export function save(id: string, input: ClientInput): Promise<Client> {
  return update<Client>('clients', id, { ...input, updated_at: new Date().toISOString() })
}

export function destroy(id: string): Promise<void> {
  return remove('clients', id)
}

export function cityState(client: Client): string {
  if (client.city && client.state) return `${client.city}, ${client.state}`
  return client.city || client.state || '—'
}
