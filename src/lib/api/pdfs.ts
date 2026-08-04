import { supabase } from '../supabase'
import type { PdfFile } from '../../types/vault'

const BUCKET = 'pdfs'

export async function listPdfs(projectId: string) {
  const { data, error } = await supabase
    .from('pdf_files')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as PdfFile[]
}

export async function uploadPdf(input: {
  project_id: string
  folder_id?: string | null
  file: File
  uploaded_by: string
}) {
  const { project_id, folder_id = null, file, uploaded_by } = input

  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Only PDF files can be uploaded here.')
  }

  const storagePath = `${project_id}/${crypto.randomUUID()}-${file.name}`

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { cacheControl: '3600', upsert: false })
  if (uploadErr) throw uploadErr

  const { data, error: insertErr } = await supabase
    .from('pdf_files')
    .insert({
      project_id,
      folder_id,
      name: file.name,
      storage_path: storagePath,
      size_bytes: file.size,
      uploaded_by,
    })
    .select()
    .single()

  if (insertErr) {
    // Roll back the uploaded object so we don't leave orphaned files in storage
    await supabase.storage.from(BUCKET).remove([storagePath])
    throw insertErr
  }

  return data as PdfFile
}

export function getPdfUrl(storagePath: string) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
  return data.publicUrl
}

export async function deletePdf(pdf: PdfFile) {
  const { error: storageErr } = await supabase.storage.from(BUCKET).remove([pdf.storage_path])
  if (storageErr) throw storageErr

  const { error: dbErr } = await supabase.from('pdf_files').delete().eq('id', pdf.id)
  if (dbErr) throw dbErr
}
