import { supabase } from '../supabase'
import type { Database } from '../../types/database'

export type AllowlistEntry = Database['public']['Tables']['ip_allowlist']['Row']

export async function listAllowlist() {
  const { data, error } = await supabase.from('ip_allowlist').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function addAllowlistEntry(ip: string, note: string | null, createdBy: string) {
  const { data, error } = await supabase.from('ip_allowlist').insert({ ip, note, created_by: createdBy }).select().single()
  if (error) throw error
  return data
}

export async function removeAllowlistEntry(id: string) {
  const { error } = await supabase.from('ip_allowlist').delete().eq('id', id)
  if (error) throw error
}
