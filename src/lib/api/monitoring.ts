import { supabase } from '../supabase'
import type { Database } from '../../types/database'

export type Monitor = Database['public']['Tables']['monitors']['Row']
export type MonitorCheck = Database['public']['Tables']['monitor_checks']['Row']

export async function listMonitors() {
  const { data, error } = await supabase.from('monitors').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createMonitor(input: { name: string; url: string; interval_minutes: number; created_by: string }) {
  const { data, error } = await supabase.from('monitors').insert(input).select().single()
  if (error) throw error
  return data
}

export async function deleteMonitor(id: string) {
  const { error } = await supabase.from('monitors').delete().eq('id', id)
  if (error) throw error
}

export async function listChecks(monitorId: string, limit = 50) {
  const { data, error } = await supabase.from('monitor_checks').select('*').eq('monitor_id', monitorId).order('checked_at', { ascending: false }).limit(limit)
  if (error) throw error
  return data
}

export async function runManualCheck() {
  const { data, error } = await supabase.functions.invoke('check-monitors', { body: {} })
  if (error) throw new Error(error.message)
  return data
}

export function uptimePercentage(checks: MonitorCheck[]) {
  if (checks.length === 0) return null
  const up = checks.filter((c) => c.is_up).length
  return Math.round((up / checks.length) * 1000) / 10
}
