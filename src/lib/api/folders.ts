import { supabase } from '../supabase'
import type { Folder } from '../../types/vault'

export async function listFolders(projectId: string) {
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_deleted', false)
    .order('name', { ascending: true })
  if (error) throw error
  return data as Folder[]
}

export async function createFolder(input: { project_id: string; parent_id: string | null; name: string }) {
  const { data, error } = await supabase.from('folders').insert(input).select().single()
  if (error) throw error
  return data as Folder
}

export async function renameFolder(id: string, name: string) {
  const { error } = await supabase.from('folders').update({ name }).eq('id', id)
  if (error) throw error
}

export async function moveFolder(id: string, parentId: string | null) {
  const { error } = await supabase.from('folders').update({ parent_id: parentId }).eq('id', id)
  if (error) throw error
}

export async function softDeleteFolder(id: string) {
  const { error } = await supabase.from('folders').update({ is_deleted: true }).eq('id', id)
  if (error) throw error
}

/**
 * Soft-deletes a folder AND everything inside it (subfolders + files,
 * any depth). softDeleteFolder() alone only flips is_deleted on the
 * one row — since the file tree renders by walking parent_id from
 * root, that silently orphans everything underneath (still
 * is_deleted=false in the DB, but unreachable in the UI since their
 * parent no longer renders). This computes the full descendant set
 * client-side from already-loaded state and soft-deletes it all in two
 * batched requests.
 */
export async function softDeleteFolderCascade(
  folderId: string,
  allFolders: Folder[],
  allFileFolderIds: { id: string; folder_id: string | null }[],
): Promise<{ folderIds: string[]; fileIds: string[] }> {
  const folderIds = [folderId]
  const queue = [folderId]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const f of allFolders) {
      if (f.parent_id === current && !folderIds.includes(f.id)) {
        folderIds.push(f.id)
        queue.push(f.id)
      }
    }
  }
  const folderIdSet = new Set(folderIds)
  const fileIds = allFileFolderIds.filter((f) => f.folder_id && folderIdSet.has(f.folder_id)).map((f) => f.id)

  const { error: folderErr } = await supabase.from('folders').update({ is_deleted: true }).in('id', folderIds)
  if (folderErr) throw folderErr

  if (fileIds.length > 0) {
    const { error: fileErr } = await supabase.from('files').update({ is_deleted: true }).in('id', fileIds)
    if (fileErr) throw fileErr
  }

  return { folderIds, fileIds }
}
