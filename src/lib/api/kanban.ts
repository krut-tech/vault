import { supabase } from '../supabase'
import type { Database } from '../../types/database'

export type Board = Database['public']['Tables']['boards']['Row']
export type BoardColumn = Database['public']['Tables']['board_columns']['Row']
export type Task = Database['public']['Tables']['tasks']['Row']

export async function listBoards(projectId?: string) {
  let query = supabase.from('boards').select('*').order('created_at', { ascending: false })
  if (projectId) query = query.eq('project_id', projectId)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createBoard(input: { name: string; project_id: string | null; created_by: string }) {
  const { data: board, error } = await supabase.from('boards').insert(input).select().single()
  if (error) throw error

  const defaults = ['To Do', 'In Progress', 'Done']
  const { error: colErr } = await supabase.from('board_columns').insert(defaults.map((name, i) => ({ board_id: board.id, name, position: i })))
  if (colErr) throw colErr
  return board
}

export async function getBoard(id: string) {
  const { data, error } = await supabase.from('boards').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function listColumns(boardId: string) {
  const { data, error } = await supabase.from('board_columns').select('*').eq('board_id', boardId).order('position')
  if (error) throw error
  return data
}

export async function createColumn(boardId: string, name: string, position: number) {
  const { data, error } = await supabase.from('board_columns').insert({ board_id: boardId, name, position }).select().single()
  if (error) throw error
  return data
}

export async function listTasksForBoard(columnIds: string[]) {
  if (columnIds.length === 0) return []
  const { data, error } = await supabase.from('tasks').select('*').in('column_id', columnIds).order('position')
  if (error) throw error
  return data
}

export async function createTask(input: { column_id: string; title: string; description?: string | null; position: number }) {
  const { data, error } = await supabase.from('tasks').insert(input).select().single()
  if (error) throw error
  return data
}

export async function moveTask(taskId: string, columnId: string, position: number) {
  const { error } = await supabase.from('tasks').update({ column_id: columnId, position }).eq('id', taskId)
  if (error) throw error
}

export async function deleteTask(taskId: string) {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId)
  if (error) throw error
}
