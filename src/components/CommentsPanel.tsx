import { useEffect, useState, type FormEvent } from 'react'
import { listComments, addComment, deleteComment } from '../lib/api/comments'
import { formatDistanceToNow } from 'date-fns'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

type Comment = Database['public']['Tables']['comments']['Row']

export default function CommentsPanel({ fileId, onClose }: { fileId: string; onClose: () => void }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)

  useEffect(() => {
    let cancelled = false
    listComments(fileId).then((c) => !cancelled && setComments(c)).finally(() => !cancelled && setLoading(false))

    const channel = supabase
      .channel(`comments-${fileId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `file_id=eq.${fileId}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setComments((prev) => (prev.some((c) => c.id === (payload.new as Comment).id) ? prev : [...prev, payload.new as Comment]))
        } else if (payload.eventType === 'DELETE') {
          setComments((prev) => prev.filter((c) => c.id !== (payload.old as Comment).id))
        }
      })
      .subscribe()

    return () => { cancelled = true; supabase.removeChannel(channel) }
  }, [fileId])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user || !body.trim()) return
    const text = body
    setBody('')
    await addComment(fileId, user.id, text)
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-80 max-w-[calc(100vw-1.5rem)] glass-panel glow-border m-3 sm:m-4 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h3 className="font-semibold text-sm">Comments</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-magenta" aria-label="Close comments">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {loading && <p className="text-xs text-gray-500">Loading…</p>}
        {!loading && comments.length === 0 && <p className="text-xs text-gray-500">No comments yet.</p>}
        {comments.map((c) => (
          <div key={c.id} className="group bg-abyss/60 rounded-lg p-2.5 text-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
              {c.author_id === user?.id && (
                <button onClick={() => deleteComment(c.id)} className="opacity-0 group-hover:opacity-100 text-xs text-gray-500 hover:text-magenta">Delete</button>
              )}
            </div>
            <p className="text-gray-200 whitespace-pre-wrap break-words">{c.body}</p>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-white/10 flex gap-2">
        <input className="input-field flex-1" placeholder={`Comment as ${profile?.full_name ?? 'you'}…`} value={body} onChange={(e) => setBody(e.target.value)} />
        <button type="submit" className="btn-primary text-xs px-3">Post</button>
      </form>
    </div>
  )
}
