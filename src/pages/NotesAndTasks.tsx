import { useEffect, useState } from 'react'
import { Plus, Trash2, StickyNote, ListChecks } from 'lucide-react'
import { listNotes, createNote, updateNote, deleteNote, listQuickTasks, createQuickTask, toggleQuickTask, deleteQuickTask, type Note, type QuickTask } from '../lib/api/notes'
import { useAuthStore } from '../store/authStore'
import { useDebouncedCallback } from '../lib/useDebouncedCallback'
import { formatDistanceToNow } from 'date-fns'
import { PageHeader, Card, Button, EmptyState, LoadingState } from '../components/ui'

export default function NotesAndTasks() {
  const user = useAuthStore((s) => s.user)
  const [notes, setNotes] = useState<Note[]>([])
  const [tasks, setTasks] = useState<QuickTask[]>([])
  const [activeNote, setActiveNote] = useState<Note | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([listNotes(), listQuickTasks()]).then(([n, t]) => {
      setNotes(n)
      setTasks(t)
      setLoading(false)
    })
  }, [])

  const debouncedSave = useDebouncedCallback(async (id: string, title: string, body: string) => {
    await updateNote(id, { title, body })
  }, 800)

  async function handleCreateNote() {
    if (!user) return
    const note = await createNote({ project_id: null, created_by: user.id })
    setNotes((prev) => [note, ...prev])
    setActiveNote(note)
  }

  function handleNoteChange(field: 'title' | 'body', value: string) {
    if (!activeNote) return
    const updated = { ...activeNote, [field]: value }
    setActiveNote(updated)
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
    debouncedSave(updated.id, updated.title, updated.body)
  }

  async function handleDeleteNote(id: string) {
    if (!window.confirm('Delete this note?')) return
    await deleteNote(id)
    setNotes((prev) => prev.filter((n) => n.id !== id))
    if (activeNote?.id === id) setActiveNote(null)
  }

  async function handleAddTask() {
    if (!user || !newTaskTitle.trim()) return
    const task = await createQuickTask({ project_id: null, title: newTaskTitle.trim(), created_by: user.id })
    setTasks((prev) => [...prev, task])
    setNewTaskTitle('')
  }

  async function handleToggleTask(task: QuickTask) {
    const next = !task.is_done
    await toggleQuickTask(task.id, next)
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, is_done: next } : t)))
  }

  async function handleDeleteTask(id: string) {
    await deleteQuickTask(id)
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  if (loading) return <div className="p-6"><LoadingState fullHeight label="Loading your notes…" /></div>

  const doneCount = tasks.filter((t) => t.is_done).length

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader title="Notes & Quick Tasks" backTo="/" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium flex items-center gap-1.5 text-gray-300"><StickyNote size={15} /> Notes</h3>
            <Button variant="tertiary" size="sm" onClick={handleCreateNote}>
              <Plus size={13} /> New note
            </Button>
          </div>

          {activeNote ? (
            <Card className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <input
                  className="input-field flex-1 font-medium"
                  value={activeNote.title}
                  onChange={(e) => handleNoteChange('title', e.target.value)}
                />
                <button onClick={() => handleDeleteNote(activeNote.id)} className="text-gray-500 hover:text-magenta shrink-0" title="Delete note">
                  <Trash2 size={14} />
                </button>
              </div>
              <textarea
                className="input-field w-full min-h-[240px] resize-y"
                placeholder="Write freely…"
                value={activeNote.body}
                onChange={(e) => handleNoteChange('body', e.target.value)}
              />
              <button onClick={() => setActiveNote(null)} className="text-xs text-gray-500 hover:text-cyan transition-colors duration-150">← Back to notes</button>
            </Card>
          ) : notes.length === 0 ? (
            <EmptyState icon={StickyNote} title="No notes yet" description="Jot something down whenever you need to." />
          ) : (
            <div className="space-y-2">
              {notes.map((n) => (
                <button key={n.id} onClick={() => setActiveNote(n)} className="w-full text-left block">
                  <Card hover noPadding className="p-3">
                    <p className="text-sm font-medium truncate">{n.title}</p>
                    <p className="text-xs text-secondary truncate mt-0.5">{n.body || 'Empty note'}</p>
                    <p className="text-[10px] text-muted mt-1">Updated {formatDistanceToNow(new Date(n.updated_at), { addSuffix: true })}</p>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium flex items-center gap-1.5 text-gray-300"><ListChecks size={15} /> Quick tasks</h3>
            {tasks.length > 0 && <span className="text-xs text-muted">{doneCount}/{tasks.length} done</span>}
          </div>
          <Card noPadding className="divide-y divide-white/5">
            {tasks.length === 0 && <p className="p-4 text-sm text-secondary">No tasks yet.</p>}
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 group">
                <input type="checkbox" checked={t.is_done} onChange={() => handleToggleTask(t)} className="accent-cyan h-4 w-4" aria-label={`Mark "${t.title}" as ${t.is_done ? 'not done' : 'done'}`} />
                <span className={`flex-1 text-sm ${t.is_done ? 'line-through text-muted' : 'text-gray-200'}`}>{t.title}</span>
                <button onClick={() => handleDeleteTask(t.id)} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-magenta transition-colors duration-150" aria-label={`Delete "${t.title}"`}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            <div className="flex gap-2 p-3">
              <input
                className="input-field flex-1 text-sm"
                placeholder="Add a task…"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                aria-label="New task title"
              />
              <button onClick={handleAddTask} className="text-cyan hover:text-cyan/80 text-xs px-2 transition-colors duration-150">Add</button>
            </div>
          </Card>
        </section>
      </div>
    </div>
  )
}
