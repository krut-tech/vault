import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, Activity, Trash2, RefreshCw } from 'lucide-react'
import { listMonitors, createMonitor, deleteMonitor, listChecks, runManualCheck, uptimePercentage, type Monitor, type MonitorCheck } from '../lib/api/monitoring'
import { useAuthStore } from '../store/authStore'
import { formatDistanceToNow } from 'date-fns'

export default function Monitors() {
  const user = useAuthStore((s) => s.user)
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [checksByMonitor, setChecksByMonitor] = useState<Record<string, MonitorCheck[]>>({})
  const [showForm, setShowForm] = useState(false)
  const [checking, setChecking] = useState(false)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)
    const list = await listMonitors()
    setMonitors(list)
    const entries = await Promise.all(list.map(async (m) => [m.id, await listChecks(m.id)] as const))
    setChecksByMonitor(Object.fromEntries(entries))
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])

  async function handleRunCheck() {
    setChecking(true)
    try {
      await runManualCheck()
      await refresh()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Check failed — is the check-monitors function deployed?')
    } finally {
      setChecking(false)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Remove this monitor?')) return
    await deleteMonitor(id)
    setMonitors((prev) => prev.filter((m) => m.id !== id))
  }

  if (loading) return <div className="p-6 text-gray-400 text-sm">Loading…</div>

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-gray-400 hover:text-cyan"><ArrowLeft size={18} /></Link>
          <h2 className="text-lg font-semibold">Site monitoring</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRunCheck} disabled={checking} className="text-sm px-3 py-1.5 rounded-lg border border-white/10 hover:border-cyan/50 hover:text-cyan flex items-center gap-1.5">
            <RefreshCw size={14} className={checking ? 'animate-spin' : ''} /> Check now
          </button>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus size={16} /> Add monitor
          </button>
        </div>
      </div>

      {monitors.length === 0 && (
        <div className="glass-panel p-10 text-center text-gray-500">
          <Activity className="mx-auto mb-3 text-cyan/50" size={32} />
          No monitors yet. Add a URL to start tracking uptime.
        </div>
      )}

      <div className="space-y-3">
        {monitors.map((m) => {
          const checks = checksByMonitor[m.id] ?? []
          const latest = checks[0]
          const uptime = uptimePercentage(checks)
          return (
            <div key={m.id} className="glass-panel p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${latest ? (latest.is_up ? 'bg-cyan' : 'bg-magenta') : 'bg-gray-600'}`} />
                  <div className="min-w-0">
                    <p className="text-sm truncate">{m.name}</p>
                    <p className="text-xs text-gray-500 truncate">{m.url}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  {uptime !== null && <span className="text-xs text-gray-400">{uptime}% uptime</span>}
                  {latest?.response_ms != null && <span className="text-xs text-gray-400">{latest.response_ms}ms</span>}
                  <button onClick={() => handleDelete(m.id)} className="text-gray-500 hover:text-magenta"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="flex gap-0.5 mt-2">
                {checks.slice(0, 30).reverse().map((c) => (
                  <div key={c.id} title={`${c.is_up ? 'Up' : 'Down'} · ${formatDistanceToNow(new Date(c.checked_at), { addSuffix: true })}`} className={`h-6 flex-1 rounded-sm ${c.is_up ? 'bg-cyan/60' : 'bg-magenta/60'}`} />
                ))}
                {checks.length === 0 && <p className="text-xs text-gray-600">No checks recorded yet — click "Check now".</p>}
              </div>
            </div>
          )
        })}
      </div>

      {showForm && user && (
        <MonitorForm userId={user.id} onCreated={() => { setShowForm(false); refresh() }} onCancel={() => setShowForm(false)} />
      )}
    </div>
  )
}

function MonitorForm({ userId, onCreated, onCancel }: { userId: string; onCreated: () => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [interval, setInterval_] = useState(5)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await createMonitor({ name, url, interval_minutes: interval, created_by: userId })
      onCreated()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="glass-panel glow-border w-full max-w-sm p-6 space-y-4">
        <h3 className="font-semibold">New monitor</h3>
        <input required className="input-field w-full" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input required type="url" className="input-field w-full" placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} />
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wide text-gray-400">Check interval (minutes)</label>
          <input type="number" min={1} className="input-field w-full" value={interval} onChange={(e) => setInterval_(Number(e.target.value))} />
        </div>
        <p className="text-xs text-gray-500">
          Automatic scheduling requires a one-time pg_cron setup (see supabase/migrations/0003_vault_and_cron.sql). You can always trigger a check manually with "Check now".
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm rounded-xl border border-white/10 hover:border-white/30">Cancel</button>
          <button type="submit" disabled={submitting} className="btn-primary text-sm">{submitting ? 'Adding…' : 'Add monitor'}</button>
        </div>
      </form>
    </div>
  )
}
