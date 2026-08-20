import { supabase } from '../supabase'

export interface SearchResult {
  type: 'project' | 'folder' | 'file'
  id: string
  title: string
  subtitle: string
  projectId: string
  folderId?: string | null
  snippet?: string
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
  const q = query.trim()
  if (!q) return []

  const [projects, folders, files] = await Promise.all([
    supabase.from('projects').select('id, name, languages').eq('is_deleted', false).ilike('name', `%${q}%`).limit(10),
    supabase.from('folders').select('id, name, project_id').eq('is_deleted', false).ilike('name', `%${q}%`).limit(10),
    supabase.from('files').select('id, name, language, project_id').eq('is_deleted', false).ilike('name', `%${q}%`).limit(20),
  ])

  const results: SearchResult[] = []
  for (const p of projects.data ?? []) results.push({ type: 'project', id: p.id, title: p.name, subtitle: p.languages.join(', '), projectId: p.id })
  for (const f of folders.data ?? []) results.push({ type: 'folder', id: f.id, title: f.name, subtitle: 'Folder', projectId: f.project_id })
  for (const f of files.data ?? []) results.push({ type: 'file', id: f.id, title: f.name, subtitle: f.language, projectId: f.project_id })
  return results
}

export interface AdvancedSearchFilters {
  projectId?: string | null
  folderId?: string | null
  language?: string | null
  favoritesOnly?: boolean
  tagId?: string | null
}

export interface FileSearchHit {
  type: 'file'
  id: string
  projectId: string
  folderId: string | null
  name: string
  language: string
  isFavorite: boolean
  updatedAt: string
  snippet: string
  rank: number
}

/**
 * Real content+name search, ranked server-side via Postgres full-text
 * search (see migration 0014). Only fetches the matched rows + a short
 * highlighted snippet per file — never pulls whole file bodies into
 * the browser to search client-side.
 */
export async function searchFileContents(query: string, filters: AdvancedSearchFilters = {}, limit = 30): Promise<FileSearchHit[]> {
  const q = query.trim()
  if (!q) return []

  const { data, error } = await supabase.rpc('search_files', {
    query: q,
    p_project_id: filters.projectId ?? null,
    p_folder_id: filters.folderId ?? null,
    p_language: filters.language ?? null,
    p_favorites_only: filters.favoritesOnly ?? false,
    p_tag_id: filters.tagId ?? null,
    p_limit: limit,
  })
  if (error) throw error

  return (data ?? []).map((row) => ({
    type: 'file' as const,
    id: row.id,
    projectId: row.project_id,
    folderId: row.folder_id,
    name: row.name,
    language: row.language,
    isFavorite: row.is_favorite,
    updatedAt: row.updated_at,
    snippet: row.snippet,
    rank: row.rank,
  }))
}

export interface ProjectOrFolderHit {
  type: 'project' | 'folder'
  id: string
  title: string
  subtitle: string
  projectId: string
}

/** Project/folder name matches, filtered by the same project/language scope as the file search. */
export async function searchProjectsAndFolders(query: string, filters: AdvancedSearchFilters = {}): Promise<ProjectOrFolderHit[]> {
  const q = query.trim()
  if (!q) return []

  const results: ProjectOrFolderHit[] = []

  if (!filters.folderId) {
    let projectQuery = supabase.from('projects').select('id, name, languages').eq('is_deleted', false).ilike('name', `%${q}%`).limit(8)
    if (filters.projectId) projectQuery = projectQuery.eq('id', filters.projectId)
    if (filters.language) projectQuery = projectQuery.overlaps('languages', [filters.language])
    const { data } = await projectQuery
    for (const p of data ?? []) results.push({ type: 'project', id: p.id, title: p.name, subtitle: p.languages.join(', '), projectId: p.id })
  }

  let folderQuery = supabase.from('folders').select('id, name, project_id').eq('is_deleted', false).ilike('name', `%${q}%`).limit(8)
  if (filters.projectId) folderQuery = folderQuery.eq('project_id', filters.projectId)
  const { data: folderData } = await folderQuery
  for (const f of folderData ?? []) results.push({ type: 'folder', id: f.id, title: f.name, subtitle: 'Folder', projectId: f.project_id })

  return results
}

