/**
 * Acesso a dados. Toda consulta e escrita e escopada por organization_id,
 * espelhando o padrao ja usado no app anterior (.eq('organization_id', org)).
 */
import { supabase } from '../lib/supabase'
import type { PostgrestError } from '@supabase/supabase-js'

let currentOrgId: string | null = null

export function setOrganization(id: string | null): void {
  currentOrgId = id
}

export function organizationId(): string {
  if (!currentOrgId) throw new Error('Organização não carregada. Refaça o login.')
  return currentOrgId
}

/** Tabelas globais (nao possuem organization_id). */
const GLOBAL_TABLES = new Set(['profiles'])

function fail(table: string, action: string, error: PostgrestError): never {
  throw new Error(`Falha ao ${action} ${table}: ${error.message}`)
}

export interface ListOptions {
  select?: string
  orderBy?: string
  ascending?: boolean
  limit?: number
  eq?: Record<string, unknown>
  in?: Record<string, readonly unknown[]>
}

export async function list<T>(table: string, options: ListOptions = {}): Promise<T[]> {
  let query = supabase.from(table).select(options.select ?? '*')
  if (!GLOBAL_TABLES.has(table)) query = query.eq('organization_id', organizationId())
  for (const [column, value] of Object.entries(options.eq ?? {})) query = query.eq(column, value)
  for (const [column, values] of Object.entries(options.in ?? {})) query = query.in(column, values as unknown[])
  if (options.orderBy) query = query.order(options.orderBy, { ascending: options.ascending ?? false })
  if (options.limit) query = query.limit(options.limit)

  const { data, error } = await query
  if (error) fail(table, 'carregar', error)
  return (data ?? []) as T[]
}

export async function findById<T>(table: string, id: string, select = '*'): Promise<T | null> {
  let query = supabase.from(table).select(select).eq('id', id)
  if (!GLOBAL_TABLES.has(table)) query = query.eq('organization_id', organizationId())

  const { data, error } = await query.maybeSingle()
  if (error) fail(table, 'carregar', error)
  return (data ?? null) as T | null
}

export async function insert<T>(table: string, payload: Record<string, unknown>): Promise<T> {
  const body = GLOBAL_TABLES.has(table) ? payload : { ...payload, organization_id: organizationId() }
  const { data, error } = await supabase.from(table).insert(body).select().single()
  if (error) fail(table, 'salvar em', error)
  return data as T
}

export async function insertMany<T>(table: string, rows: Record<string, unknown>[]): Promise<T[]> {
  if (!rows.length) return []
  const org = organizationId()
  const body = rows.map((row) => (GLOBAL_TABLES.has(table) ? row : { ...row, organization_id: org }))
  const { data, error } = await supabase.from(table).insert(body).select()
  if (error) fail(table, 'salvar em', error)
  return (data ?? []) as T[]
}

export async function update<T>(table: string, id: string, patch: Record<string, unknown>): Promise<T> {
  let query = supabase.from(table).update(patch).eq('id', id)
  if (!GLOBAL_TABLES.has(table)) query = query.eq('organization_id', organizationId())

  const { data, error } = await query.select().single()
  if (error) fail(table, 'atualizar', error)
  return data as T
}

export async function upsert<T>(table: string, payload: Record<string, unknown>, onConflict?: string): Promise<T> {
  const body = GLOBAL_TABLES.has(table) ? payload : { ...payload, organization_id: organizationId() }
  const { data, error } = await supabase.from(table).upsert(body, onConflict ? { onConflict } : undefined).select().single()
  if (error) fail(table, 'salvar em', error)
  return data as T
}

export async function remove(table: string, id: string): Promise<void> {
  let query = supabase.from(table).delete().eq('id', id)
  if (!GLOBAL_TABLES.has(table)) query = query.eq('organization_id', organizationId())

  const { error } = await query
  if (error) fail(table, 'excluir de', error)
}

export async function count(table: string, filters: Record<string, unknown> = {}): Promise<number> {
  let query = supabase.from(table).select('id', { count: 'exact', head: true })
  if (!GLOBAL_TABLES.has(table)) query = query.eq('organization_id', organizationId())
  for (const [column, value] of Object.entries(filters)) query = query.eq(column, value)

  const { count: total, error } = await query
  if (error) fail(table, 'contar', error)
  return total ?? 0
}

/** URL assinada para um arquivo do bucket `documents`. */
export async function signedUrl(path: string, seconds = 3600): Promise<string> {
  const { data } = await supabase.storage.from('documents').createSignedUrl(path, seconds)
  return data?.signedUrl ?? ''
}
