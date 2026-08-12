import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Kanban as KanbanIcon } from 'lucide-react'
import { listBoards, createBoard, type Board } from '../lib/api/kanban'
import { useAuthStore } from '../store/authStore'
import { formatDistanceToNow } from 'date-fns'
import { PageHeader, Card, Button, EmptyState, LoadingState, Modal, Input } from '../components/ui'

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

  if (loading) return <div className="p-6"><LoadingState fullHeight label="Loading boards…" /></div>

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Kanban boards"
        backTo="/"
        actions={
          <Button variant="primary" size="sm" onClick={() => setShowModal(true)}>
            <Plus size={16} /> New board
          </Button>
        }
      />

      {boards.length === 0 ? (
        <EmptyState
          icon={KanbanIcon}
          title="No boards yet"
          description="Create one to start tracking tasks."
          action={
            <Button variant="primary" size="sm" onClick={() => setShowModal(true)}>
              <Plus size={14} /> New board
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {boards.map((b) => (
            <Link key={b.id} to={`/boards/${b.id}`} className="block">
              <Card hover className="h-full">
                <div className="flex items-center gap-2.5">
                  <span className="h-8 w-8 rounded-lg bg-cyan/10 flex items-center justify-center shrink-0">
                    <KanbanIcon size={15} className="text-cyan" />
                  </span>
                  <h3 className="font-medium truncate">{b.name}</h3>
                </div>
                <p className="text-xs text-secondary mt-3">
                  Created {formatDistanceToNow(new Date(b.created_at), { addSuffix: true })}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}

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
    <Modal
      open
      onClose={onClose}
      title="New board"
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" size="sm" type="submit" form="board-form" loading={submitting}>Create</Button>
        </>
      }
    >
      <form id="board-form" onSubmit={handleSubmit}>
        <Input required autoFocus label="Board name" placeholder="e.g. Sprint 12" value={name} onChange={(e) => setName(e.target.value)} />
      </form>
    </Modal>
  )
}
