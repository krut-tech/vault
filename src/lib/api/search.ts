import { supabase } from '../supabase'

export interface SearchResult {
  type: 'project' | 'folder' | 'file'
  id: string
  title: string
  subtitle: string
  projectId: string
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
  const q = query.trim()
  if (!q) return []

  const [projects, folders, files] = await Promise.all([
    supabase.from('projects').select('id, name, language').eq('is_deleted', false).ilike('name', `%${q}%`).limit(10),
    supabase.from('folders').select('id, name, project_id').eq('is_deleted', false).ilike('name', `%${q}%`).limit(10),
    supabase.from('files').select('id, name, language, project_id').eq('is_deleted', false).ilike('name', `%${q}%`).limit(20),
  ])

  const results: SearchResult[] = []
  for (const p of projects.data ?? []) results.push({ type: 'project', id: p.id, title: p.name, subtitle: p.language, projectId: p.id })
  for (const f of folders.data ?? []) results.push({ type: 'folder', id: f.id, title: f.name, subtitle: 'Folder', projectId: f.project_id })
  for (const f of files.data ?? []) results.push({ type: 'file', id: f.id, title: f.name, subtitle: f.language, projectId: f.project_id })
  return results
}
