import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { getBoard, listColumns, listTasksForBoard, createColumn, createTask, moveTask, deleteTask, type Board, type BoardColumn, type Task } from '../lib/api/kanban'
import { supabase } from '../lib/supabase'

export default function BoardView() {
  const { id } = useParams<{ id: string }>()
  const [board, setBoard] = useState<Board | null>(null)
  const [columns, setColumns] = useState<BoardColumn[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    if (!id) return
    Promise.all([getBoard(id), listColumns(id)]).then(async ([b, cols]) => {
      setBoard(b)
      setColumns(cols)
      setTasks(await listTasksForBoard(cols.map((c) => c.id)))
      setLoading(false)
    })
  }, [id])

  useEffect(() => {
    if (!id) return
    const channel = supabase
      .channel(`board-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setTasks((prev) => prev.filter((t) => t.id !== (payload.old as Task).id))
          return
        }
        const row = payload.new as Task
        setTasks((prev) => {
          const exists = prev.some((t) => t.id === row.id)
          return exists ? prev.map((t) => (t.id === row.id ? row : t)) : [...prev, row]
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id])

  const tasksByColumn = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const col of columns) map.set(col.id, [])
    for (const t of tasks) map.get(t.column_id)?.push(t)
    return map
  }, [columns, tasks])

  async function handleAddColumn() {
    if (!id) return
    const name = window.prompt('Column name')
    if (!name) return
    const col = await createColumn(id, name, columns.length)
    setColumns((prev) => [...prev, col])
  }

  async function handleAddTask(columnId: string, title: string) {
    const position = tasksByColumn.get(columnId)?.length ?? 0
    const task = await createTask({ column_id: columnId, title, position })
    setTasks((prev) => [...prev, task])
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveTask(tasks.find((t) => t.id === e.active.id) ?? null)
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActiveTask(null)
    const taskId = e.active.id as string
    const targetColumnId = e.over?.id as string | undefined
    if (!targetColumnId) return
    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.column_id === targetColumnId) return

    const newPosition = tasksByColumn.get(targetColumnId)?.length ?? 0
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, column_id: targetColumnId, position: newPosition } : t)))
    await moveTask(taskId, targetColumnId, newPosition)
  }

  async function handleDeleteTask(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    await deleteTask(taskId)
  }

  if (loading) return <div className="p-6 text-gray-400 text-sm">Loading…</div>
  if (!board) return <div className="p-6 text-gray-400">Board not found.</div>

  return (
    <div className="p-6 h-screen flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link to="/boards" className="text-gray-400 hover:text-cyan"><ArrowLeft size={18} /></Link>
          <h2 className="text-lg font-semibold">{board.name}</h2>
        </div>
        <button onClick={handleAddColumn} className="text-sm text-cyan hover:underline flex items-center gap-1">
          <Plus size={14} /> Column
        </button>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex-1 flex gap-4 overflow-x-auto">
          {columns.map((col) => (
            <KanbanColumn key={col.id} column={col} tasks={tasksByColumn.get(col.id) ?? []} onAddTask={handleAddTask} onDeleteTask={handleDeleteTask} />
          ))}
        </div>
        <DragOverlay>{activeTask && <TaskCard task={activeTask} onDelete={() => {}} dragging />}</DragOverlay>
      </DndContext>
    </div>
  )
}

function KanbanColumn({ column, tasks, onAddTask, onDeleteTask }: {
  column: BoardColumn
  tasks: Task[]
  onAddTask: (columnId: string, title: string) => void
  onDeleteTask: (taskId: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const [newTitle, setNewTitle] = useState('')

  function submit() {
    if (!newTitle.trim()) return
    onAddTask(column.id, newTitle.trim())
    setNewTitle('')
  }

  return (
    <div ref={setNodeRef} className={`glass-panel w-72 shrink-0 flex flex-col transition-colors ${isOver ? 'ring-1 ring-cyan/60' : ''}`}>
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <h3 className="text-sm font-medium">{column.name}</h3>
        <span className="text-xs text-gray-500">{tasks.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[100px]">
        {tasks.map((t) => <TaskCard key={t.id} task={t} onDelete={() => onDeleteTask(t.id)} />)}
      </div>
      <div className="p-2 border-t border-white/10 flex gap-1.5">
        <input
          className="input-field flex-1 text-xs py-1.5"
          placeholder="Add task…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <button onClick={submit} className="text-cyan hover:text-cyan/80 text-xs px-2">Add</button>
      </div>
    </div>
  )
}

function TaskCard({ task, onDelete, dragging }: { task: Task; onDelete: () => void; dragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: task.id })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`group bg-abyss/70 border border-white/10 rounded-lg p-2.5 text-sm cursor-grab active:cursor-grabbing ${dragging ? 'glow-border' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="break-words">{task.title}</p>
        <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-magenta shrink-0">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}
