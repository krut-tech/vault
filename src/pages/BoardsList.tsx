import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, Kanban as KanbanIcon } from 'lucide-react'
import { listBoards, createBoard, type Board } from '../lib/api/kanban'
import { useAuthStore } from '../store/authStore'

export default function BoardsList() {
  const [boards, setBoards] = useState<Board[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const user = useAuthStore((s) => s.user)

  async function refresh() {
    setLoading(true)
    try {
      setBoards(await listBoards())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-gray-400 hover:text-cyan"><ArrowLeft size={18} /></Link>
          <h2 className="text-lg font-semibold">Kanban boards</h2>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-1.5 text-sm">
          <Plus size={16} /> New board
        </button>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {!loading && boards.length === 0 && (
        <div className="glass-panel p-10 text-center text-gray-500">
          <KanbanIcon className="mx-auto mb-3 text-cyan/50" size={32} />
          No boards yet. Create one to start tracking tasks.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {boards.map((b) => (
          <Link key={b.id} to={`/boards/${b.id}`} className="glass-panel p-5 hover:glow-border transition-shadow block">
            <h3 className="font-medium">{b.name}</h3>
          </Link>
        ))}
      </div>

      {showModal && user && (
        <CreateBoardModal userId={user.id} onClose={() => setShowModal(false)} onCreated={() => { setShowModal(false); refresh() }} />
      )}
    </div>
  )
}

function CreateBoardModal({ userId, onClose, onCreated }: { userId: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await createBoard({ name, project_id: null, created_by: userId })
      onCreated()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="glass-panel glow-border w-full max-w-sm p-6 space-y-4">
        <h3 className="font-semibold">New board</h3>
        <input required autoFocus className="input-field w-full" placeholder="Board name" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-xl border border-white/10 hover:border-white/30">Cancel</button>
          <button type="submit" disabled={submitting} className="btn-primary text-sm">{submitting ? 'Creating…' : 'Create'}</button>
        </div>
      </form>
    </div>
  )
}
