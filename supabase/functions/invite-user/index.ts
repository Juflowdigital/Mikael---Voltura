import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const auth = req.headers.get('Authorization') || ''
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const caller = createClient(url, anon, { global: { headers: { Authorization: auth } } })
    const admin = createClient(url, service)
    const { data: { user }, error: userError } = await caller.auth.getUser()
    if (userError || !user) throw new Error('Sessão inválida')
    const { email, fullName, role = 'viewer', jobTitle, organizationId, redirectTo } = await req.json()
    const { data: membership } = await admin.from('organization_members').select('role').eq('organization_id', organizationId).eq('user_id', user.id).eq('active', true).single()
    if (membership?.role !== 'admin') throw new Error('Somente administradores podem convidar colaboradores')
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName || email }, redirectTo })
    if (error) throw error
    if (!data.user) throw new Error('Não foi possível criar o usuário convidado')
    await admin.from('profiles').upsert({ id: data.user.id, full_name: fullName || email })
    const member = await admin.from('organization_members').upsert({ organization_id: organizationId, user_id: data.user.id, role, job_title: jobTitle || null, active: true })
    if (member.error) throw member.error
    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
