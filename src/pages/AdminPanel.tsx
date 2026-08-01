import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ShieldCheck, Upload, Plus, Trash2, Mail } from 'lucide-react'
import { listTeamMembers, updateMemberRole, removeMember, listPendingSignups, approveSignup, type TeamMember } from '../lib/api/admin'
import { listActivity } from '../lib/api/activity'
import { listProjects } from '../lib/api/projects'
import { uploadLogo } from '../lib/api/branding'
import { listAllowlist, addAllowlistEntry, removeAllowlistEntry, type AllowlistEntry } from '../lib/api/ipAllowlist'
import { useAuthStore } from '../store/authStore'
import { useBrandingStore } from '../store/brandingStore'
import { formatDistanceToNow } from 'date-fns'
import type { Database } from '../types/database'

type ActivityRow = Database['public']['Tables']['activity_log']['Row']

export default function AdminPanel() {
  const profile = useAuthStore((s) => s.profile)
  const user = useAuthStore((s) => s.user)
  const { appName, logoUrl, load, update } = useBrandingStore()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [pending, setPending] = useState<TeamMember[]>([])
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [activity, setActivity] = useState<ActivityRow[]>([])
  const [projectCount, setProjectCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const [nameDraft, setNameDraft] = useState('')
  const [savingBranding, setSavingBranding] = useState(false)
  const [brandingSaved, setBrandingSaved] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [allowlist, setAllowlist] = useState<AllowlistEntry[]>([])
  const [newIp, setNewIp] = useState('')
  const [newIpNote, setNewIpNote] = useState('')

  useEffect(() => {
    Promise.all([listTeamMembers(), listActivity(50), listProjects(), load(), listAllowlist(), listPendingSignups()]).then(([m, a, p, , al, pd]) => {
      setMembers(m)
      setActivity(a)
      setProjectCount(p.length)
      setAllowlist(al)
      setPending(pd)
      setLoading(false)
    })
  }, [load])

  useEffect(() => {
    setNameDraft(appName)
  }, [appName])

  const isAllowed = profile?.role === 'owner' || profile?.role === 'admin'

  async function handleApprove(m: TeamMember) {
    setApprovingId(m.id)
    try {
      await approveSignup(m.id)
      setPending((prev) => prev.filter((p) => p.id !== m.id))
      setMembers((prev) => [...prev, { ...m, is_active: true, approved_at: new Date().toISOString() }])
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to approve')
    } finally {
      setApprovingId(null)
    }
  }

  async function handleReject(m: TeamMember) {
    if (!window.confirm(`Reject the signup from ${m.full_name ?? m.email}? They won't be able to log in.`)) return
    try {
      await removeMember(m.id)
      setPending((prev) => prev.filter((p) => p.id !== m.id))
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to reject')
    }
  }

  async function handleRoleChange(id: string, role: 'owner' | 'admin' | 'member') {
    await updateMemberRole(id, role)
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role } : m)))
  }

  async function handleRemoveMember(m: TeamMember) {
    if (!window.confirm(`Remove ${m.full_name ?? m.email} from the team? They won't be able to log in anymore, but their projects/files stay intact.`)) return
    try {
      await removeMember(m.id)
      setMembers((prev) => prev.map((p) => (p.id === m.id ? { ...p, is_active: false } : p)))
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to remove member')
    }
  }

  async function handleAddIp(e: FormEvent) {
    e.preventDefault()
    if (!user || !newIp.trim()) return
    const entry = await addAllowlistEntry(newIp.trim(), newIpNote || null, user.id)
    setAllowlist((prev) => [entry, ...prev])
    setNewIp('')
    setNewIpNote('')
  }

  async function handleRemoveIp(id: string) {
    await removeAllowlistEntry(id)
    setAllowlist((prev) => prev.filter((e) => e.id !== id))
  }

  async function handleSaveBranding(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setSavingBranding(true)
    setBrandingSaved(false)
    try {
      await update(nameDraft, logoUrl, user.id)
      setBrandingSaved(true)
      setTimeout(() => setBrandingSaved(false), 2000)
    } finally {
      setSavingBranding(false)
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploadingLogo(true)
    try {
      const url = await uploadLogo(file)
      await update(nameDraft || appName, url, user.id)
    } finally {
      setUploadingLogo(false)
    }
  }

  if (loading) return <div className="p-6 text-gray-400 text-sm">Loading…</div>

  if (!isAllowed) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="glass-panel p-8 text-center text-gray-400">
          <ShieldCheck className="mx-auto mb-3 text-magenta/60" size={32} />
          Admin access required. Ask an owner to promote your account.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/" className="text-gray-400 hover:text-cyan"><ArrowLeft size={18} /></Link>
        <h2 className="text-lg font-semibold">Admin panel</h2>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Team members" value={members.filter((m) => m.approved_at && m.is_active).length} />
        <StatCard label="Pending approval" value={pending.length} />
        <StatCard label="Projects" value={projectCount} />
        <StatCard label="Logged actions" value={activity.length} />
      </div>

      {pending.length > 0 && (
        <section className="glass-panel">
          <h3 className="px-5 py-3 border-b border-white/10 font-medium text-sm flex items-center gap-2">
            <Mail size={14} className="text-cyan" /> Pending approval
          </h3>
          <div className="divide-y divide-white/5">
            {pending.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm truncate">{p.full_name ?? p.email}</p>
                  <p className="text-xs text-gray-500 truncate">{p.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleApprove(p)}
                    disabled={approvingId === p.id}
                    className="btn-primary text-xs px-3 py-1.5"
                  >
                    {approvingId === p.id ? 'Approving…' : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleReject(p)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-gray-400 hover:text-magenta hover:border-magenta/40"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="glass-panel p-6">
        <h3 className="font-medium text-sm mb-4">Branding</h3>
        <form onSubmit={handleSaveBranding} className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingLogo}
            className="relative h-16 w-16 rounded-xl overflow-hidden glass-panel glow-border group shrink-0"
          >
            {logoUrl ? (
              <img src={logoUrl} alt="App logo" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-xs text-gray-500">No logo</div>
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Upload size={16} className="text-cyan" />
            </div>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />

          <div className="flex-1 space-y-1.5">
            <label className="text-xs uppercase tracking-wide text-gray-400">App name</label>
            <input className="input-field w-full max-w-xs" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} />
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button type="submit" disabled={savingBranding} className="btn-primary text-sm">
              {savingBranding ? 'Saving…' : 'Save'}
            </button>
            {brandingSaved && <span className="text-xs text-cyan">Saved</span>}
          </div>
        </form>
        {uploadingLogo && <p className="text-xs text-violet mt-2">Uploading logo…</p>}
      </section>

      <section className="glass-panel p-6">
        <h3 className="font-medium text-sm mb-1">IP allowlist</h3>
        <p className="text-xs text-gray-500 mb-4">
          Opt-in: while this list is empty, access is unrestricted. Add at least one IP to start enforcing — enforced by the Vercel Edge Middleware at <code className="text-gray-400">middleware.ts</code>, not just this table.
        </p>
        <form onSubmit={handleAddIp} className="flex gap-2 mb-4">
          <input required className="input-field flex-1" placeholder="203.0.113.42" value={newIp} onChange={(e) => setNewIp(e.target.value)} />
          <input className="input-field flex-1" placeholder="Note (optional)" value={newIpNote} onChange={(e) => setNewIpNote(e.target.value)} />
          <button type="submit" className="btn-primary text-sm px-3 flex items-center gap-1"><Plus size={14} /> Add</button>
        </form>
        <div className="divide-y divide-white/5">
          {allowlist.length === 0 && <p className="text-xs text-gray-500">No entries — access is currently unrestricted.</p>}
          {allowlist.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="font-mono">{entry.ip}</p>
                {entry.note && <p className="text-xs text-gray-500">{entry.note}</p>}
              </div>
              <button onClick={() => handleRemoveIp(entry.id)} className="text-gray-500 hover:text-magenta"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-panel">
        <h3 className="px-5 py-3 border-b border-white/10 font-medium text-sm">Team members</h3>
        <div className="divide-y divide-white/5">
          {members.filter((m) => m.approved_at && m.is_active).map((m) => (
            <div key={m.id} className="flex items-center justify-between px-5 py-3">
              <div className="min-w-0">
                <p className="text-sm truncate">{m.full_name ?? m.email}</p>
                <p className="text-xs text-gray-500 truncate">{m.email}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={m.role}
                  onChange={(e) => handleRoleChange(m.id, e.target.value as 'owner' | 'admin' | 'member')}
                  disabled={m.id === profile?.id && m.role === 'owner'}
                  className="input-field text-xs py-1"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                </select>
                {m.id !== profile?.id && (
                  <button
                    onClick={() => handleRemoveMember(m)}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-magenta hover:bg-white/5"
                    title="Remove member"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {members.filter((m) => m.approved_at && !m.is_active).length > 0 && (
            <p className="px-5 py-2 text-xs text-gray-600">
              {members.filter((m) => m.approved_at && !m.is_active).length} removed member(s) — hidden here, still shown as author on their past work.
            </p>
          )}
        </div>
      </section>

      <section className="glass-panel">
        <h3 className="px-5 py-3 border-b border-white/10 font-medium text-sm">Recent activity</h3>
        <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
          {activity.length === 0 && <p className="px-5 py-4 text-sm text-gray-500">No activity logged yet.</p>}
          {activity.map((a) => (
            <div key={a.id} className="px-5 py-2.5 text-sm flex items-center justify-between">
              <span className="text-gray-300">{a.action} <span className="text-gray-500">{a.entity_type}</span></span>
              <span className="text-xs text-gray-500">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass-panel p-4">
      <p className="text-2xl font-bold neon-gradient-text">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  )
}
