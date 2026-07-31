import { supabase } from '../supabase'
import type { Database } from '../../types/database'

export type Note = Database['public']['Tables']['notes']['Row']
export type QuickTask = Database['public']['Tables']['quick_tasks']['Row']

export async function listNotes(projectId?: string) {
  let query = supabase.from('notes').select('*').order('updated_at', { ascending: false })
  if (projectId) query = query.eq('project_id', projectId)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createNote(input: { project_id: string | null; created_by: string }) {
  const { data, error } = await supabase.from('notes').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updateNote(id: string, fields: { title?: string; body?: string }) {
  const { error } = await supabase.from('notes').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function deleteNote(id: string) {
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) throw error
}

export async function listQuickTasks(projectId?: string) {
  let query = supabase.from('quick_tasks').select('*').order('created_at', { ascending: true })
  if (projectId) query = query.eq('project_id', projectId)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createQuickTask(input: { project_id: string | null; title: string; created_by: string }) {
  const { data, error } = await supabase.from('quick_tasks').insert(input).select().single()
  if (error) throw error
  return data
}

export async function toggleQuickTask(id: string, isDone: boolean) {
  const { error } = await supabase.from('quick_tasks').update({ is_done: isDone }).eq('id', id)
  if (error) throw error
}

export async function deleteQuickTask(id: string) {
  const { error } = await supabase.from('quick_tasks').delete().eq('id', id)
  if (error) throw error
}
