import { supabase } from '../supabase'

export interface TeamMember {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: 'owner' | 'admin' | 'member'
  created_at: string
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
