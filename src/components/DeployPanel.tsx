import { useEffect, useState, type FormEvent } from 'react'
import { Rocket, Plus, Trash2, X } from 'lucide-react'
import { listDeployTargets, createDeployTarget, deleteDeployTarget, triggerDeploy, listDeployments, type DeployTarget, type Deployment } from '../lib/api/deploy'
import { useAuthStore } from '../store/authStore'
import { formatDistanceToNow } from 'date-fns'

export default function DeployPanel({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const user = useAuthStore((s) => s.user)
  const [targets, setTargets] = useState<DeployTarget[]>([])
  const [selected, setSelected] = useState<DeployTarget | null>(null)
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [showForm, setShowForm] = useState(false)
  const [deploying, setDeploying] = useState(false)

  useEffect(() => { listDeployTargets(projectId).then(setTargets) }, [projectId])
  useEffect(() => { if (selected) listDeployments(selected.id).then(setDeployments) }, [selected])

  async function handleDeploy() {
    if (!selected) return
    setDeploying(true)
    try {
      await triggerDeploy(selected.id)
      setDeployments(await listDeployments(selected.id))
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Deployment failed to start')
    } finally {
      setDeploying(false)
    }
  }

  async function handleDelete(target: DeployTarget) {
    if (!window.confirm(`Remove deploy target "${target.name}"?`)) return
    await deleteDeployTarget(target.id)
    setTargets((prev) => prev.filter((t) => t.id !== target.id))
    if (selected?.id === target.id) setSelected(null)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-panel glow-border w-full max-w-3xl max-h-[90vh] sm:max-h-[85vh] flex flex-col sm:flex-row overflow-hidden">
        <div className="sm:w-64 max-h-40 sm:max-h-none shrink-0 border-b sm:border-b-0 sm:border-r border-white/10 overflow-y-auto">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <h2 className="font-semibold text-sm flex items-center gap-1.5"><Rocket size={14} /> Deploy targets</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-magenta"><X size={16} /></button>
          </div>
          <div className="p-2">
            <button onClick={() => setShowForm(true)} className="w-full flex items-center justify-center gap-1.5 text-xs text-cyan py-2 hover:bg-white/5 rounded-lg">
              <Plus size={13} /> Add target
            </button>
          </div>
          {targets.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelected(t)}
              className={`w-full text-left px-4 py-2.5 text-xs border-t border-white/5 hover:bg-white/5 flex items-center justify-between ${
                selected?.id === t.id ? 'bg-cyan/10 text-cyan' : 'text-gray-300'
              }`}
            >
              <span className="truncate">{t.name}</span>
              <span className="text-[10px] uppercase text-gray-500">{t.protocol}</span>
            </button>
          ))}
          {targets.length === 0 && <p className="px-4 py-3 text-xs text-gray-500">No deploy targets configured.</p>}
        </div>

        <div className="flex-1 min-w-0 overflow-y-auto p-4">
          {showForm && (
            <DeployTargetForm
              projectId={projectId}
              userId={user?.id ?? ''}
              onCreated={(t) => { setTargets((prev) => [...prev, t]); setShowForm(false) }}
              onCancel={() => setShowForm(false)}
            />
          )}

          {!showForm && !selected && <p className="text-sm text-gray-500">Select a deploy target, or add a new one.</p>}

          {!showForm && selected && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-medium text-sm truncate">{selected.name}</h3>
                  <p className="text-xs text-gray-500 truncate">{selected.username}@{selected.host}:{selected.port}{selected.remote_path}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={handleDeploy} disabled={deploying} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
                    <Rocket size={12} /> {deploying ? 'Deploying…' : 'Deploy now'}
                  </button>
                  <button onClick={() => handleDelete(selected)} className="text-gray-400 hover:text-magenta"><Trash2 size={14} /></button>
                </div>
              </div>

              <div className="glass-panel divide-y divide-white/5">
                {deployments.length === 0 && <p className="px-4 py-3 text-xs text-gray-500">No deployments yet.</p>}
                {deployments.map((d) => (
                  <div key={d.id} className="px-4 py-2.5 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <StatusBadge status={d.status} />
                      <span className="text-gray-500">{formatDistanceToNow(new Date(d.started_at), { addSuffix: true })}</span>
                    </div>
                    {d.log && <pre className="text-gray-400 whitespace-pre-wrap font-mono text-[11px] mt-1 max-h-24 overflow-y-auto">{d.log}</pre>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: Deployment['status'] }) {
  const map = {
    queued: 'text-gray-400 bg-gray-400/10',
    running: 'text-violet bg-violet/10 animate-pulse',
    success: 'text-cyan bg-cyan/10',
    failed: 'text-magenta bg-magenta/10',
  }
  return <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide ${map[status]}`}>{status}</span>
}

function DeployTargetForm({ projectId, userId, onCreated, onCancel }: {
  projectId: string
  userId: string
  onCreated: (t: DeployTarget) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [protocol, setProtocol] = useState<'ftp' | 'sftp'>('sftp')
  const [host, setHost] = useState('')
  const [port, setPort] = useState(22)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remotePath, setRemotePath] = useState('/')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const target = await createDeployTarget({ project_id: projectId, name, protocol, host, port, username, password, remote_path: remotePath, created_by: userId })
      onCreated(target)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save deploy target')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-md">
      <h3 className="font-medium text-sm mb-2">New deploy target</h3>
      <input required className="input-field w-full" placeholder="Name (e.g. Production)" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <select className="input-field" value={protocol} onChange={(e) => { setProtocol(e.target.value as 'ftp' | 'sftp'); setPort(e.target.value === 'sftp' ? 22 : 21) }}>
          <option value="sftp">SFTP</option>
          <option value="ftp">FTP</option>
        </select>
        <input type="number" required className="input-field" placeholder="Port" value={port} onChange={(e) => setPort(Number(e.target.value))} />
      </div>
      <input required className="input-field w-full" placeholder="Host" value={host} onChange={(e) => setHost(e.target.value)} />
      <input required className="input-field w-full" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
      <input required type="password" className="input-field w-full" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <input required className="input-field w-full" placeholder="Remote path (e.g. /public_html)" value={remotePath} onChange={(e) => setRemotePath(e.target.value)} />
      <p className="text-xs text-gray-500">Password is stored encrypted in Supabase Vault — never saved in plaintext.</p>
      {error && <p className="text-sm text-magenta">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm rounded-xl border border-white/10 hover:border-white/30">Cancel</button>
        <button type="submit" disabled={submitting} className="btn-primary text-sm">{submitting ? 'Saving…' : 'Save target'}</button>
      </div>
    </form>
  )
}
