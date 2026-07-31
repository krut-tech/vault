import { supabase } from '../supabase'

export async function listComments(fileId: string) {
  const { data, error } = await supabase.from('comments').select('*').eq('file_id', fileId).order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function addComment(fileId: string, authorId: string, body: string) {
  const { data, error } = await supabase.from('comments').insert({ file_id: fileId, author_id: authorId, body }).select().single()
  if (error) throw error
  return data
}

export async function deleteComment(id: string) {
  const { error } = await supabase.from('comments').delete().eq('id', id)
  if (error) throw error
}
