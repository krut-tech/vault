// supabase/functions/remove-team-member/index.ts
// Revokes a member's access: marks their profile inactive (so they drop out
// of the active list but stay attributed as author on past work) and bans
// their auth login so they can't sign back in.

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

    const { data: callerProfile } = await userClient.from('profiles').select('role').eq('id', userData.user.id).single()
    if (!callerProfile || !['owner', 'admin'].includes(callerProfile.role)) {
      return json({ error: 'Admin access required to remove a team member' }, 403)
    }

    const { memberId } = await req.json()
    if (typeof memberId !== 'string' || memberId.length === 0) return json({ error: 'Missing memberId' }, 400)

    if (memberId === userData.user.id) {
      return json({ error: 'You cannot remove your own access' }, 400)
    }

    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: targetProfile } = await adminClient.from('profiles').select('role').eq('id', memberId).single()
    if (targetProfile?.role === 'owner') {
      return json({ error: 'Owners cannot be removed' }, 400)
    }

    const { error: banErr } = await adminClient.auth.admin.updateUserById(memberId, { ban_duration: '876000h' })
    if (banErr) return json({ error: banErr.message }, 500)

    const { error: updateErr } = await adminClient.from('profiles').update({ is_active: false }).eq('id', memberId)
    if (updateErr) return json({ error: updateErr.message }, 500)

    return json({ ok: true })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
