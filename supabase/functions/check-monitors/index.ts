// supabase/functions/check-monitors/index.ts
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: monitors, error } = await adminClient.from('monitors').select('*')
  if (error) return json({ error: error.message }, 500)

  const results = await Promise.all(
    (monitors ?? []).map(async (m) => {
      const start = performance.now()
      try {
        const res = await fetch(m.url, { method: 'GET', signal: AbortSignal.timeout(10000) })
        const responseMs = Math.round(performance.now() - start)
        await adminClient.from('monitor_checks').insert({ monitor_id: m.id, is_up: res.ok, status_code: res.status, response_ms: responseMs })
        return { monitor: m.name, up: res.ok, status: res.status, responseMs }
      } catch (err) {
        await adminClient.from('monitor_checks').insert({ monitor_id: m.id, is_up: false, status_code: null, response_ms: null })
        return { monitor: m.name, up: false, error: err instanceof Error ? err.message : 'timeout/unreachable' }
      }
    }),
  )

  return json({ checked: results.length, results })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
