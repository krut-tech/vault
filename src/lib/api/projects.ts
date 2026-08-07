import { supabase } from '../supabase'
import type { Project, ProjectAccessEntry } from '../../types/vault'

export async function listProjects() {
  // RLS already scopes this to: public projects, projects the user created,
  // projects they've been granted access to, and (if they're an owner) everything.
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('is_deleted', false)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data as Project[]
}

export async function createProject(input: {
  name: string
  description: string | null
  language: string
  created_by: string
  is_private?: boolean
}) {
  const { data, error } = await supabase.from('projects').insert(input).select().single()
  if (error) throw error
  return data as Project
}

/** Only an owner/admin creator can flip this; enforced by RLS as well. */
export async function updateProjectPrivacy(id: string, isPrivate: boolean) {
  const { error } = await supabase.from('projects').update({ is_private: isPrivate, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function listProjectAccess(projectId: string) {
  const { data, error } = await supabase.from('project_access').select('*').eq('project_id', projectId)
  if (error) throw error
  return data as ProjectAccessEntry[]
}

export async function grantProjectAccess(projectId: string, userId: string, grantedBy: string) {
  const { error } = await supabase.from('project_access').insert({ project_id: projectId, user_id: userId, granted_by: grantedBy })
  if (error) throw error
}

export async function revokeProjectAccess(projectId: string, userId: string) {
  const { error } = await supabase.from('project_access').delete().eq('project_id', projectId).eq('user_id', userId)
  if (error) throw error
}

export async function getProject(id: string) {
  const { data, error } = await supabase.from('projects').select('*').eq('id', id).single()
  if (error) throw error
  return data as Project
}

export async function renameProject(id: string, name: string) {
  const { error } = await supabase.from('projects').update({ name, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function softDeleteProject(id: string) {
  const { error } = await supabase.from('projects').update({ is_deleted: true }).eq('id', id)
  if (error) throw error
}
