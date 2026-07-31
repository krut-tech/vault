// supabase/functions/save-deploy-secret/index.ts
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)

    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData.user) return json({ error: 'Unauthorized' }, 401)

    const { data: profile } = await userClient.from('profiles').select('role').eq('id', userData.user.id).single()
    if (!profile || !['owner', 'admin'].includes(profile.role)) {
      return json({ error: 'Admin access required to configure deploy credentials' }, 403)
    }

    const { password } = await req.json()
    if (typeof password !== 'string' || password.length === 0) return json({ error: 'Missing password/key' }, 400)

    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const secretName = `deploy_target_secret_${crypto.randomUUID()}`
    const { data: secretId, error: vaultErr } = await adminClient.rpc('vault_upsert_secret', { secret_name: secretName, secret_value: password })
    if (vaultErr) return json({ error: vaultErr.message }, 500)

    return json({ secretRef: secretId })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
