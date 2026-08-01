import { supabase } from '../supabase'
import type { Json } from '../../types/database'

export async function listNotifications(userId: string) {
  const { data, error } = await supabase.from('notifications').select('*').eq('user_id', userId).eq('is_read', false).order('created_at', { ascending: false }).limit(50)
  if (error) throw error
  return data
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id)
  if (error) throw error
}

export async function markAllRead(userId: string) {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false)
  if (error) throw error
}

export async function notifyUser(userId: string, message: string, link?: string) {
  const { error } = await supabase.from('notifications').insert({ user_id: userId, message, link: link ?? null })
  if (error) throw error
}

export async function logActivity(actorId: string, action: string, entityType: string, entityId?: string, meta?: Record<string, unknown>) {
  const { error } = await supabase.from('activity_log').insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    meta: (meta ?? null) as Json,
  })
  if (error) throw error
}

export async function listActivity(limit = 100) {
  const { data, error } = await supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return data
}
