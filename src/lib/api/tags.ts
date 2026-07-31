import { supabase } from '../supabase'

export async function listAllTags() {
  const { data, error } = await supabase.from('tags').select('*').order('name')
  if (error) throw error
  return data
}

export async function getOrCreateTag(name: string) {
  const normalized = name.trim().toLowerCase()
  const { data: existing, error: findErr } = await supabase.from('tags').select('*').eq('name', normalized).maybeSingle()
  if (findErr) throw findErr
  if (existing) return existing
  const { data, error } = await supabase.from('tags').insert({ name: normalized }).select().single()
  if (error) throw error
  return data
}

export async function tagFile(fileId: string, tagId: string) {
  const { error } = await supabase.from('file_tags').insert({ file_id: fileId, tag_id: tagId })
  if (error && error.code !== '23505') throw error
}

export async function untagFile(fileId: string, tagId: string) {
  const { error } = await supabase.from('file_tags').delete().eq('file_id', fileId).eq('tag_id', tagId)
  if (error) throw error
}

export async function getFileTags(fileId: string) {
  const { data: links, error: linkErr } = await supabase.from('file_tags').select('tag_id').eq('file_id', fileId)
  if (linkErr) throw linkErr
  const tagIds = (links ?? []).map((l) => l.tag_id)
  if (tagIds.length === 0) return []
  const { data: tags, error: tagErr } = await supabase.from('tags').select('*').in('id', tagIds)
  if (tagErr) throw tagErr
  return tags ?? []
}
