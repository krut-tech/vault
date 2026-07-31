import { supabase } from '../supabase'

export interface TeamMember {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: 'owner' | 'admin' | 'member'
  created_at: string
  is_active: boolean
}

export async function listTeamMembers() {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: true })
  if (error) throw error
  return data as TeamMember[]
}

export async function updateMemberRole(id: string, role: 'owner' | 'admin' | 'member') {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
  if (error) throw error
}

/** Revokes a member's access (bans their login) without deleting anything they created. */
export async function removeMember(memberId: string) {
  const { data, error } = await supabase.functions.invoke('remove-team-member', { body: { memberId } })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
}
