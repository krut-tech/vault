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

export async function updateMemberRole(id: string, role: 'owner' | 'admin' | 'member') {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
  if (error) throw error
}

/** Revokes a member's access (bans their login) without deleting anything they created. Also used to reject a pending signup outright. */
export async function removeMember(memberId: string) {
  const { data, error } = await supabase.functions.invoke('remove-team-member', { body: { memberId } })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
}
