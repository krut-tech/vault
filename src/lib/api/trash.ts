import { supabase } from '../supabase'

export interface TrashedItem {
  type: 'project' | 'folder' | 'file'
  id: string
  name: string
  projectId: string | null
}

export async function listTrash(): Promise<TrashedItem[]> {
  const [projects, folders, files] = await Promise.all([
    supabase.from('projects').select('id, name').eq('is_deleted', true),
    supabase.from('folders').select('id, name, project_id').eq('is_deleted', true),
    supabase.from('files').select('id, name, project_id').eq('is_deleted', true),
  ])

  const items: TrashedItem[] = []
  for (const p of projects.data ?? []) items.push({ type: 'project', id: p.id, name: p.name, projectId: p.id })
  for (const f of folders.data ?? []) items.push({ type: 'folder', id: f.id, name: f.name, projectId: f.project_id })
  for (const f of files.data ?? []) items.push({ type: 'file', id: f.id, name: f.name, projectId: f.project_id })
  return items
}

export async function restoreItem(item: TrashedItem) {
  const table = item.type === 'project' ? 'projects' : item.type === 'folder' ? 'folders' : 'files'
  const { error } = await supabase.from(table).update({ is_deleted: false }).eq('id', item.id)
  if (error) throw error
}

export async function permanentlyDelete(item: TrashedItem) {
  const table = item.type === 'project' ? 'projects' : item.type === 'folder' ? 'folders' : 'files'
  const { error } = await supabase.from(table).delete().eq('id', item.id)
  if (error) throw error
}
