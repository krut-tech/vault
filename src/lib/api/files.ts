import { supabase } from '../supabase'
import type { VaultFile, FileVersion } from '../../types/vault'

export async function listFiles(projectId: string) {
  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_deleted', false)
    .order('name', { ascending: true })
  if (error) throw error
  return data as VaultFile[]
}

export async function getFile(id: string) {
  const { data, error } = await supabase.from('files').select('*').eq('id', id).single()
  if (error) throw error
  return data as VaultFile
}

export async function createFile(input: {
  project_id: string
  folder_id: string | null
  name: string
  language: string
  content: string
  created_by: string
}) {
  const { data, error } = await supabase.from('files').insert(input).select().single()
  if (error) throw error
  return data as VaultFile
}

export async function renameFile(id: string, name: string) {
  const { error } = await supabase.from('files').update({ name }).eq('id', id)
  if (error) throw error
}

export async function moveFile(id: string, folderId: string | null) {
  const { error } = await supabase.from('files').update({ folder_id: folderId }).eq('id', id)
  if (error) throw error
}

export async function duplicateFile(file: VaultFile, createdBy: string): Promise<VaultFile> {
  const { data, error } = await supabase
    .from('files')
    .insert({
      project_id: file.project_id,
      folder_id: file.folder_id,
      name: nextCopyName(file.name),
      language: file.language,
      content: file.content,
      created_by: createdBy,
    })
    .select()
    .single()
  if (error) throw error
  return data as VaultFile
}

function nextCopyName(name: string): string {
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  return `${base} copy${ext}`
}

export async function toggleFavorite(id: string, isFavorite: boolean) {
  const { error } = await supabase.from('files').update({ is_favorite: isFavorite }).eq('id', id)
  if (error) throw error
}

export async function softDeleteFile(id: string) {
  const { error } = await supabase.from('files').update({ is_deleted: true }).eq('id', id)
  if (error) throw error
}

export async function restoreFile(id: string) {
  const { error } = await supabase.from('files').update({ is_deleted: false }).eq('id', id)
  if (error) throw error
}

export async function saveFileContent(id: string, content: string, userId: string) {
  const { error: updateErr } = await supabase
    .from('files')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (updateErr) throw updateErr

  const { error: versionErr } = await supabase
    .from('file_versions')
    .insert({ file_id: id, content, created_by: userId })
  if (versionErr) throw versionErr
}

export async function listVersions(fileId: string) {
  const { data, error } = await supabase
    .from('file_versions')
    .select('*')
    .eq('file_id', fileId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data as FileVersion[]
}

export async function restoreVersion(fileId: string, versionContent: string, userId: string) {
  await saveFileContent(fileId, versionContent, userId)
}
