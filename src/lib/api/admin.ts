import { supabase } from '../supabase'

export interface TeamMember {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: 'owner' | 'admin' | 'member'
  created_at: string
  is_active: boolean
  approved_at: string | null
  deleted_at: string | null
}

export async function listTeamMembers() {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: true })
  if (error) throw error
  return data as TeamMember[]
}

/** Signups waiting on an owner/admin to approve them before they can log in. */
export async function listPendingSignups() {
  const { data, error } = await supabase.from('profiles').select('*').is('approved_at', null).order('created_at', { ascending: true })
  if (error) throw error
  return data as TeamMember[]
}

/** Grants a pending signup access to the app. */
export async function approveSignup(id: string) {
  const { error } = await supabase.from('profiles').update({ is_active: true, approved_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

/**
 * Changes an admin's/member's role between 'admin' and 'member'. Cannot
 * be used to grant 'owner' — that only happens via transferOwnership(),
 * since there must always be exactly one owner.
 */
export async function updateMemberRole(id: string, role: 'admin' | 'member') {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
  if (error) throw error
}

/**
 * Hands ownership to an existing admin and demotes the caller (must be
 * the current owner) to admin, atomically. The one-owner invariant is
 * also enforced at the DB level by a unique index, so this can never
 * result in two owners or zero owners.
 */
export async function transferOwnership(newOwnerId: string) {
  const { error } = await supabase.rpc('transfer_ownership', { new_owner_id: newOwnerId })
  if (error) throw error
}

/** Revokes a member's access (bans their login) without deleting anything they created. Also used to reject a pending signup outright. */
export async function removeMember(memberId: string) {
  const { data, error } = await supabase.functions.invoke('remove-team-member', { body: { memberId } })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
}

/** Undoes removeMember: lifts the login ban and reactivates the profile. */
export async function restoreMember(memberId: string) {
  const { data, error } = await supabase.functions.invoke('restore-team-member', { body: { memberId } })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
}

/**
 * Permanently deletes a removed member. Returns which outcome actually
 * happened: 'deleted' if their auth user + profile row are both gone
 * (they never authored anything), or 'anonymized' if their profile row
 * had to be kept for FK integrity — in that case their email/name/avatar
 * are scrubbed instead.
 */
export async function deleteMemberPermanently(memberId: string): Promise<{ mode: 'deleted' | 'anonymized' }> {
  const { data, error } = await supabase.functions.invoke('delete-team-member', { body: { memberId } })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return { mode: data.mode }
}

export interface LoginHistoryRow {
  id: string
  email: string
  success: boolean
  created_at: string
}

/** Owner/admin only (RLS: "admin reads login attempts"). Every login attempt, success or failure, by email — not linked to a profile id since a failed attempt may not match any real account. */
export async function listLoginHistory(limit = 300): Promise<LoginHistoryRow[]> {
  const { data, error } = await supabase.from('login_attempts').select('id, email, success, created_at').order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return data
}
