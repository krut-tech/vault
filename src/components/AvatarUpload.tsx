import { useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'

export default function AvatarUpload() {
  const { user, profile, refreshProfile } = useAuthStore()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return

    if (!file.type.startsWith('image/')) { setError('Please choose an image file'); return }
    if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5MB'); return }

    setUploading(true)
    setError(null)
    try {
      const ext = file.name.split('.').pop()
      const path = `${user.id}/avatar.${ext}`
      const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, cacheControl: '3600' })
      if (uploadErr) throw uploadErr

      const { data: publicUrl } = supabase.storage.from('avatars').getPublicUrl(path)
      const bustedUrl = `${publicUrl.publicUrl}?t=${Date.now()}`

      const { error: updateErr } = await supabase.from('profiles').update({ avatar_url: bustedUrl }).eq('id', user.id)
      if (updateErr) throw updateErr

      await refreshProfile()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button onClick={() => inputRef.current?.click()} disabled={uploading} className="relative h-20 w-20 rounded-full overflow-hidden glass-panel glow-border group" aria-label="Change avatar">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="Your avatar" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-lg font-bold neon-gradient-text">
            {(profile?.full_name ?? profile?.email ?? '?').charAt(0).toUpperCase()}
          </div>
        )}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <Camera size={18} className="text-cyan" />
        </div>
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      {uploading && <p className="text-xs text-violet">Uploading…</p>}
      {error && <p className="text-xs text-magenta">{error}</p>}
    </div>
  )
}
