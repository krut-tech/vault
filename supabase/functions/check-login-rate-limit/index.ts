// supabase/functions/check-login-rate-limit/index.ts
// Called before every sign-in attempt. Counts recent failed attempts for the
// given email using the service role (login_attempts is admin-only to read
// from the client, by design) and blocks further tries past a threshold.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const MAX_ATTEMPTS = 5
const WINDOW_MINUTES = 15

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { email } = await req.json()
  if (typeof email !== 'string') return json({ error: 'Missing email' }, 400)

  const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString()

  const { data, error } = await adminClient
    .from('login_attempts')
    .select('id, success')
    .eq('email', email.toLowerCase())
    .eq('success', false)
    .gte('created_at', since)

  if (error) return json({ error: error.message }, 500)

  const failedCount = data?.length ?? 0
  const allowed = failedCount < MAX_ATTEMPTS

  return json({ allowed, failedCount, maxAttempts: MAX_ATTEMPTS, windowMinutes: WINDOW_MINUTES })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
