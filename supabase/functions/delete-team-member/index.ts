// supabase/functions/delete-team-member/index.ts
// Permanently deletes a team member. Two possible outcomes, decided
// deterministically (not by parsing a Postgres error string):
//
//   - "deleted": the member has zero authored rows anywhere in the
//     schema, so their auth.users row is deleted outright. profiles.id
//     references auth.users(id) on delete cascade, so the profile row
//     disappears with it. Nothing of theirs is left in the database.
//
//   - "anonymized": the member authored at least one row in a table
//     that references profiles(id) WITHOUT cascade (projects, files,
//     file_versions, collections, comments, activity_log, notes,
//     quick_tasks, boards, time_entries, deploy_targets, monitors).
//     Hard-deleting their profile would either fail outright or, if
//     forced, orphan/destroy that history for the whole team. Instead
//     their email/full_name/avatar_url/totp_secret are scrubbed and
//     deleted_at is stamped — the account is gone, the row stays only
//     as an attribution placeholder.
//
// Only ever runs on a member who has already been removed
// (is_active = false), so they can't be logged in mid-deletion.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// [table, column] pairs for every FK into profiles(id) that is NOT
// on delete cascade. If a member has any row across these, their
// profile can't be hard-deleted without breaking that history.
const AUTHORED_CHECKS: Array<[string, string]> = [
  ['projects', 'created_by'],
  ['files', 'created_by'],
  ['file_versions', 'created_by'],
  ['collections', 'created_by'],
  ['comments', 'author_id'],
  ['activity_log', 'actor_id'],
  ['notes', 'created_by'],
  ['quick_tasks', 'created_by'],
  ['boards', 'created_by'],
  ['tasks', 'assignee_id'],
  ['time_entries', 'user_id'],
  ['deploy_targets', 'created_by'],
  ['monitors', 'created_by'],
]

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
      return json({ error: 'Admin access required to delete a team member' }, 403)
    }

    const { memberId } = await req.json()
    if (typeof memberId !== 'string' || memberId.length === 0) return json({ error: 'Missing memberId' }, 400)
    if (memberId === userData.user.id) return json({ error: 'You cannot delete your own account' }, 400)

    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: targetProfile } = await adminClient.from('profiles').select('role, is_active, deleted_at, full_name, email').eq('id', memberId).single()
    if (!targetProfile) return json({ error: 'Member not found' }, 404)
    if (targetProfile.role === 'owner') return json({ error: 'Owners cannot be deleted' }, 400)
    if (targetProfile.deleted_at) return json({ error: 'This member was already deleted' }, 400)
    if (targetProfile.is_active) return json({ error: 'Remove this member before deleting them permanently' }, 400)

    // Count authored rows across every FK-protected table in parallel.
    const counts = await Promise.all(
      AUTHORED_CHECKS.map(async ([table, column]) => {
        const { count, error } = await adminClient.from(table).select('id', { count: 'exact', head: true }).eq(column, memberId)
        if (error) throw new Error(`Checking ${table}.${column} failed: ${error.message}`)
        return count ?? 0
      }),
    )
    const hasAuthoredContent = counts.some((c) => c > 0)

    let mode: 'deleted' | 'anonymized'

    if (!hasAuthoredContent) {
      const { error: deleteErr } = await adminClient.auth.admin.deleteUser(memberId)
      if (deleteErr) return json({ error: deleteErr.message }, 500)
      mode = 'deleted'
    } else {
      const placeholder = `deleted-${memberId.slice(0, 8)}@removed.invalid`
      const { error: scrubErr } = await adminClient
        .from('profiles')
        .update({
          email: placeholder,
          full_name: 'Deleted member',
          avatar_url: null,
          totp_secret: null,
          deleted_at: new Date().toISOString(),
        })
        .eq('id', memberId)
      if (scrubErr) return json({ error: scrubErr.message }, 500)
      // Auth login was already banned by remove-team-member; ban again
      // defensively in case this member was force-inactivated some
      // other way and never actually got banned.
      await adminClient.auth.admin.updateUserById(memberId, { ban_duration: '876000h' })
      mode = 'anonymized'
    }

    const deletedName = targetProfile.full_name || targetProfile.email || 'a member'
    const { data: callerFullProfile } = await adminClient.from('profiles').select('full_name, email').eq('id', userData.user.id).single()
    const callerName = callerFullProfile?.full_name || callerFullProfile?.email || 'Someone'
    const { data: allProfiles } = await adminClient.from('profiles').select('id').neq('id', userData.user.id)
    if (allProfiles?.length) {
      const note =
        mode === 'deleted'
          ? `${callerName} permanently deleted ${deletedName}'s account`
          : `${callerName} permanently deleted ${deletedName}'s account (their past work stays attributed to a placeholder)`
      await adminClient.from('notifications').insert(
        allProfiles.map((p) => ({
          user_id: p.id,
          message: note,
          link: '/admin',
        })),
      )
    }

    return json({ ok: true, mode })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
