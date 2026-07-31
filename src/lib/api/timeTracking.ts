import { supabase } from '../supabase'
import type { Database } from '../../types/database'

export type TimeEntry = Database['public']['Tables']['time_entries']['Row']

export async function getRunningEntry(userId: string) {
  const { data, error } = await supabase.from('time_entries').select('*').eq('user_id', userId).is('ended_at', null).maybeSingle()
  if (error) throw error
  return data
}

export async function startTimer(userId: string, opts: { taskId?: string | null; projectId?: string | null; note?: string }) {
  const { data, error } = await supabase
    .from('time_entries')
    .insert({ user_id: userId, task_id: opts.taskId ?? null, project_id: opts.projectId ?? null, note: opts.note ?? null })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function stopTimer(entryId: string) {
  const { data, error } = await supabase.from('time_entries').update({ ended_at: new Date().toISOString() }).eq('id', entryId).select().single()
  if (error) throw error
  return data
}

export async function listMyEntries(userId: string, limit = 50) {
  const { data, error } = await supabase.from('time_entries').select('*').eq('user_id', userId).order('started_at', { ascending: false }).limit(limit)
  if (error) throw error
  return data
}

export function totalSeconds(entries: TimeEntry[]) {
  return entries.reduce((sum, e) => {
    const end = e.ended_at ? new Date(e.ended_at).getTime() : Date.now()
    return sum + (end - new Date(e.started_at).getTime()) / 1000
  }, 0)
}
