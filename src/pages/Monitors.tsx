import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Activity, Trash2, RefreshCw } from 'lucide-react'
import { listMonitors, createMonitor, deleteMonitor, listChecks, runManualCheck, uptimePercentage, type Monitor, type MonitorCheck } from '../lib/api/monitoring'
import { useAuthStore } from '../store/authStore'
import { formatDistanceToNow } from 'date-fns'
import { PageHeader, Card, Button, Badge, EmptyState, LoadingState, Modal, Input, ConfirmDialog } from '../components/ui'

// Real data only — is_up is the only signal the DB actually stores, so
// "warning" is derived from a genuinely-captured field (response_ms),
// not invented. down -> danger; up and slow (>2000ms) -> warning;
// up and fast -> success; nothing checked yet -> unknown.
const SLOW_THRESHOLD_MS = 2000

type MonitorStatus = 'success' | 'warning' | 'danger' | 'unknown'

function monitorStatus(latest: MonitorCheck | undefined): MonitorStatus {
  if (!latest) return 'unknown'
  if (!latest.is_up) return 'danger'
  if (latest.response_ms != null && latest.response_ms > SLOW_THRESHOLD_MS) return 'warning'
  return 'success'
}

const statusLabel: Record<MonitorStatus, string> = { success: 'Up', warning: 'Slow', danger: 'Down', unknown: 'No data' }
const statusDotClass: Record<MonitorStatus, string> = {
  success: 'status-dot-success',
  warning: 'status-dot-warning',
  danger: 'status-dot-danger',
  unknown: 'bg-gray-600',
}
const statusBadgeVariant: Record<MonitorStatus, 'success' | 'warning' | 'danger' | 'default'> = {
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  unknown: 'default',
}
function statusBarClass(isUp: boolean): string {
  return isUp ? 'bg-success/60' : 'bg-danger/60'
}

export default function Monitors() {
  const user = useAuthStore((s) => s.user)
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [checksByMonitor, setChecksByMonitor] = useState<Record<string, MonitorCheck[]>>({})
  const [showForm, setShowForm] = useState(false)
  const [checking, setChecking] = useState(false)
  const [checkError, setCheckError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [deletingMonitor, setDeletingMonitor] = useState<Monitor | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

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
    setCheckError(null)
    try {
      await runManualCheck()
      await refresh()
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : 'Check failed — is the check-monitors function deployed?')
    } finally {
      setChecking(false)
    }
  }

  async function confirmDeleteMonitor() {
    if (!deletingMonitor) return
    setDeleteLoading(true)
    try {
      await deleteMonitor(deletingMonitor.id)
      setMonitors((prev) => prev.filter((m) => m.id !== deletingMonitor.id))
      setDeletingMonitor(null)
    } finally {
      setDeleteLoading(false)
    }
  }

  if (loading) return <div className="p-6"><LoadingState fullHeight label="Loading monitors…" /></div>

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Site monitoring"
        backTo="/"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={handleRunCheck} disabled={checking}>
              <RefreshCw size={14} className={checking ? 'animate-spin' : ''} /> Check now
            </Button>
            <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
              <Plus size={16} /> Add monitor
            </Button>
          </>
        }
      />

      {checkError && (
        <div className="glass-panel border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger flex items-center justify-between gap-3">
          <span>{checkError}</span>
          <button onClick={() => setCheckError(null)} className="text-danger/70 hover:text-danger shrink-0">Dismiss</button>
        </div>
      )}

      {monitors.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No monitors yet"
          description="Add a URL to start tracking uptime."
          action={
            <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
              <Plus size={14} /> Add monitor
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {monitors.map((m) => {
            const checks = checksByMonitor[m.id] ?? []
            const latest = checks[0]
            const uptime = uptimePercentage(checks)
            const status = monitorStatus(latest)
            return (
              <Card key={m.id}>
                <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 status-dot ${statusDotClass[status]}`} />
                    <div className="min-w-0">
                      <p className="text-sm truncate">{m.name}</p>
                      <p className="text-xs text-secondary truncate">{m.url}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant={statusBadgeVariant[status]}>{statusLabel[status]}</Badge>
                    {uptime !== null && <span className="text-xs text-secondary">{uptime}% uptime</span>}
                    {latest?.response_ms != null && <span className="text-xs text-secondary">{latest.response_ms}ms</span>}
                    {latest && (
                      <span className="text-xs text-muted hidden sm:inline">
                        checked {formatDistanceToNow(new Date(latest.checked_at), { addSuffix: true })}
                      </span>
                    )}
                    <button onClick={() => setDeletingMonitor(m)} className="text-gray-500 hover:text-danger" title="Remove monitor" aria-label={`Remove ${m.name}`}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="flex gap-0.5 mt-2">
                  {checks.slice(0, 30).reverse().map((c) => (
                    <div
                      key={c.id}
                      title={`${c.is_up ? 'Up' : 'Down'} · ${formatDistanceToNow(new Date(c.checked_at), { addSuffix: true })}`}
                      className={`h-6 flex-1 rounded-sm ${statusBarClass(c.is_up)}`}
                    />
                  ))}
                  {checks.length === 0 && <p className="text-xs text-muted">No checks recorded yet — click "Check now".</p>}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {showForm && user && (
        <MonitorForm userId={user.id} onCreated={() => { setShowForm(false); refresh() }} onCancel={() => setShowForm(false)} />
      )}

      <ConfirmDialog
        open={Boolean(deletingMonitor)}
        onClose={() => setDeletingMonitor(null)}
        onConfirm={confirmDeleteMonitor}
        title={`Remove "${deletingMonitor?.name}"?`}
        description="This stops tracking uptime for this URL. Past check history is also removed."
        confirmLabel="Remove monitor"
        danger
        loading={deleteLoading}
      />
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
    <Modal
      open
      onClose={onCancel}
      title="New monitor"
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={submitting}>Cancel</Button>
          <Button variant="primary" size="sm" type="submit" form="monitor-form" loading={submitting}>Add monitor</Button>
        </>
      }
    >
      <form id="monitor-form" onSubmit={handleSubmit} className="space-y-4">
        <Input required label="Name" placeholder="My website" value={name} onChange={(e) => setName(e.target.value)} />
        <Input required type="url" label="URL" placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} />
        <Input
          type="number"
          min={1}
          label="Check interval (minutes)"
          value={interval}
          onChange={(e) => setInterval_(Number(e.target.value))}
        />
        <p className="text-xs text-muted">
          Automatic scheduling requires a one-time pg_cron setup (see supabase/migrations/0003_vault_and_cron.sql). You can always trigger a check manually with "Check now".
        </p>
      </form>
    </Modal>
  )
}
