// supabase/functions/restore-team-member/index.ts
// Undoes remove-team-member: lifts the auth ban and flips is_active back
// on, so the member can log in again. Refuses if the member was
// permanently deleted (deleted_at set / PII scrubbed) — there's nothing
// left to restore them to at that point.

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
      return json({ error: 'Admin access required to restore a team member' }, 403)
    }

    const { memberId } = await req.json()
    if (typeof memberId !== 'string' || memberId.length === 0) return json({ error: 'Missing memberId' }, 400)

    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: targetProfile } = await adminClient.from('profiles').select('is_active, deleted_at, full_name, email').eq('id', memberId).single()
    if (!targetProfile) return json({ error: 'Member not found' }, 404)
    if (targetProfile.deleted_at) return json({ error: 'This member was permanently deleted and can no longer be restored' }, 400)
    if (targetProfile.is_active) return json({ error: 'This member is not removed' }, 400)

    const { error: unbanErr } = await adminClient.auth.admin.updateUserById(memberId, { ban_duration: 'none' })
    if (unbanErr) return json({ error: unbanErr.message }, 500)

    const { error: updateErr } = await adminClient.from('profiles').update({ is_active: true }).eq('id', memberId)
    if (updateErr) return json({ error: updateErr.message }, 500)

    const restoredName = targetProfile.full_name || targetProfile.email || 'a member'
    const { data: callerFullProfile } = await adminClient.from('profiles').select('full_name, email').eq('id', userData.user.id).single()
    const callerName = callerFullProfile?.full_name || callerFullProfile?.email || 'Someone'
    const { data: allProfiles } = await adminClient.from('profiles').select('id').neq('id', userData.user.id)
    if (allProfiles?.length) {
      await adminClient.from('notifications').insert(
        allProfiles.map((p) => ({
          user_id: p.id,
          message: `${callerName} restored ${restoredName}'s access`,
          link: '/admin',
        })),
      )
    }

    return json({ ok: true })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
