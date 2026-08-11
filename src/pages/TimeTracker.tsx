import { useEffect, useState } from 'react'
import { Play, Square, Timer } from 'lucide-react'
import { getRunningEntry, startTimer, stopTimer, listMyEntries, totalSeconds, type TimeEntry } from '../lib/api/timeTracking'
import { useAuthStore } from '../store/authStore'
import { format } from 'date-fns'
import { PageHeader, Card, Button, Input, LoadingState } from '../components/ui'

export default function TimeTracker() {
  const user = useAuthStore((s) => s.user)
  const [running, setRunning] = useState<TimeEntry | null>(null)
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [note, setNote] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    Promise.all([getRunningEntry(user.id), listMyEntries(user.id)]).then(([r, e]) => {
      setRunning(r)
      setEntries(e)
      setLoading(false)
    })
  }, [user])

  useEffect(() => {
    if (!running) return
    const tick = () => setElapsed((Date.now() - new Date(running.started_at).getTime()) / 1000)
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [running])

  async function handleStart() {
    if (!user) return
    const entry = await startTimer(user.id, { note: note || undefined })
    setRunning(entry)
    setNote('')
  }

  async function handleStop() {
    if (!running) return
    const updated = await stopTimer(running.id)
    setRunning(null)
    setEntries((prev) => [updated, ...prev])
  }

  if (loading) return <div className="p-6"><LoadingState fullHeight label="Loading your timer…" /></div>

  const todayTotal = totalSeconds(entries.filter((e) => format(new Date(e.started_at), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')))
  const allTotal = totalSeconds(entries) + (running ? elapsed : 0)

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <PageHeader title="Time tracker" backTo="/" />

      <Card accent className="text-center">
        <Timer className="mx-auto mb-2 text-cyan" size={28} />
        <p className="text-4xl font-mono font-bold neon-gradient-text">{formatDuration(running ? elapsed : 0)}</p>
        {running && (
          <p className="mt-1.5 flex items-center justify-center gap-1.5 text-xs text-success">
            <span className="status-dot status-dot-success" /> Running{running.note ? ` — ${running.note}` : ''}
          </p>
        )}
        {!running ? (
          <div className="mt-4 flex gap-2 max-w-sm mx-auto items-start">
            <div className="flex-1">
              <Input placeholder="What are you working on?" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <Button variant="primary" onClick={handleStart}>
              <Play size={14} /> Start
            </Button>
          </div>
        ) : (
          <Button variant="danger" onClick={handleStop} className="mt-4">
            <Square size={14} /> Stop
          </Button>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card className="text-center">
          <p className="text-xl font-mono font-bold text-cyan">{formatDuration(todayTotal)}</p>
          <p className="text-xs text-secondary mt-1">Today</p>
        </Card>
        <Card className="text-center">
          <p className="text-xl font-mono font-bold text-violet">{formatDuration(allTotal)}</p>
          <p className="text-xs text-secondary mt-1">All logged time</p>
        </Card>
      </div>

      <Card noPadding>
        <h3 className="px-5 py-3 border-b border-white/10 font-medium text-sm">History</h3>
        <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
          {entries.length === 0 && <p className="px-5 py-4 text-sm text-secondary">No entries yet — start the timer above to log your first session.</p>}
          {entries.map((e) => (
            <div key={e.id} className="px-5 py-2.5 text-sm flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate">{e.note || 'Untitled session'}</p>
                <p className="text-xs text-secondary">{format(new Date(e.started_at), 'MMM d, HH:mm')}</p>
              </div>
              <span className="text-xs text-secondary font-mono shrink-0">
                {e.ended_at ? formatDuration((new Date(e.ended_at).getTime() - new Date(e.started_at).getTime()) / 1000) : 'running'}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function formatDuration(totalSecondsValue: number) {
  const s = Math.floor(totalSecondsValue)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}
