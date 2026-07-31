import { supabase } from '../supabase'
import type { Folder } from '../../types/vault'

export async function listFolders(projectId: string) {
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_deleted', false)
    .order('name', { ascending: true })
  if (error) throw error
  return data as Folder[]
}

export async function createFolder(input: { project_id: string; parent_id: string | null; name: string }) {
  const { data, error } = await supabase.from('folders').insert(input).select().single()
  if (error) throw error
  return data as Folder
}

export async function renameFolder(id: string, name: string) {
  const { error } = await supabase.from('folders').update({ name }).eq('id', id)
  if (error) throw error
}

export async function softDeleteFolder(id: string) {
  const { error } = await supabase.from('folders').update({ is_deleted: true }).eq('id', id)
  if (error) throw error
}
