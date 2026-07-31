import { supabase } from '../supabase'
import type { Project } from '../../types/vault'

export async function listProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('is_deleted', false)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data as Project[]
}

export async function createProject(input: { name: string; description: string | null; language: string; created_by: string }) {
  const { data, error } = await supabase.from('projects').insert(input).select().single()
  if (error) throw error
  return data as Project
}

export async function getProject(id: string) {
  const { data, error } = await supabase.from('projects').select('*').eq('id', id).single()
  if (error) throw error
  return data as Project
}

export async function softDeleteProject(id: string) {
  const { error } = await supabase.from('projects').update({ is_deleted: true }).eq('id', id)
  if (error) throw error
}
