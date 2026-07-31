import { supabase } from '../supabase'

export async function uploadLogo(file: File): Promise<string> {
  const ext = file.name.split('.').pop()
  const path = `logo-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('branding').upload(path, file, { upsert: true, cacheControl: '3600' })
  if (error) throw error
  const { data } = supabase.storage.from('branding').getPublicUrl(path)
  return `${data.publicUrl}?t=${Date.now()}`
}
