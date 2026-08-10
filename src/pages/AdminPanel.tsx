import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ShieldCheck, Upload, Plus, Trash2, Mail, RotateCcw, Lock } from 'lucide-react'
import { listTeamMembers, updateMemberRole, transferOwnership, removeMember, restoreMember, deleteMemberPermanently, listPendingSignups, approveSignup, sendApprovalEmail, listLoginHistory, type TeamMember, type LoginHistoryRow } from '../lib/api/admin'
import { listActivity } from '../lib/api/activity'
import { listProjects, listProjectAccess } from '../lib/api/projects'
import { uploadLogo } from '../lib/api/branding'
import { listAllowlist, addAllowlistEntry, removeAllowlistEntry, type AllowlistEntry } from '../lib/api/ipAllowlist'
import { useAuthStore } from '../store/authStore'
import { useBrandingStore } from '../store/brandingStore'
import { formatDistanceToNow } from 'date-fns'
import type { Database } from '../types/database'
import type { Project, ProjectAccessEntry } from '../types/vault'

type ActivityRow = Database['public']['Tables']['activity_log']['Row']

export default function AdminPanel() {
  const profile = useAuthStore((s) => s.profile)
  const user = useAuthStore((s) => s.user)
  const refreshProfile = useAuthStore((s) => s.refreshProfile)
  const { appName, logoUrl, load, update } = useBrandingStore()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [pending, setPending] = useState<TeamMember[]>([])
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [memberActionId, setMemberActionId] = useState<string | null>(null)
  const [activity, setActivity] = useState<ActivityRow[]>([])
  const [loginHistory, setLoginHistory] = useState<LoginHistoryRow[]>([])
  const [activityPersonFilter, setActivityPersonFilter] = useState<'all' | string>('all')
  const [activityExcludedIds, setActivityExcludedIds] = useState<Set<string>>(new Set())
  const [activityActionFilter, setActivityActionFilter] = useState<'all' | string>('all')
  const [projects, setProjects] = useState<Project[]>([])
  const [privateAccess, setPrivateAccess] = useState<Record<string, ProjectAccessEntry[]>>({})
  const [loading, setLoading] = useState(true)

  const [nameDraft, setNameDraft] = useState('')
  const [savingBranding, setSavingBranding] = useState(false)
  const [brandingSaved, setBrandingSaved] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [allowlist, setAllowlist] = useState<AllowlistEntry[]>([])
  const [newIp, setNewIp] = useState('')
  const [newIpNote, setNewIpNote] = useState('')

  const [tab, setTab] = useState<'overview' | 'team' | 'security' | 'activity'>('overview')

  useEffect(() => {
    Promise.all([listTeamMembers(), listActivity(500), listProjects(), load(), listAllowlist(), listPendingSignups(), listLoginHistory(300)]).then(([m, a, p, , al, pd, lh]) => {
      setMembers(m)
      setActivity(a)
      setProjects(p)
      setAllowlist(al)
      setPending(pd)
      setLoginHistory(lh)
      setLoading(false)

      const privateIds = p.filter((proj) => proj.is_private).map((proj) => proj.id)
      if (privateIds.length > 0) {
        Promise.all(privateIds.map((id) => listProjectAccess(id).then((entries) => [id, entries] as const)))
          .then((pairs) => setPrivateAccess(Object.fromEntries(pairs)))
          .catch(() => {})
      }
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
      try {
        await sendApprovalEmail({ email: m.email, name: m.full_name, appName })
      } catch (emailErr) {
        // The approval itself succeeded — only the notification email failed.
        window.alert(
          `${m.email} was approved, but the notification email failed to send: ${emailErr instanceof Error ? emailErr.message : 'Unknown error'}`
        )
      }
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
    if (role === 'owner') {
      const target = members.find((m) => m.id === id)
      if (!window.confirm(`Make ${target?.full_name ?? target?.email} the owner? You'll be demoted to admin — there can only be one owner.`)) return
      try {
        await transferOwnership(id)
        setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role: 'owner' } : m.id === profile?.id ? { ...m, role: 'admin' } : m)))
        await refreshProfile()
      } catch (err) {
        window.alert(err instanceof Error ? err.message : 'Failed to transfer ownership')
      }
      return
    }
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

  async function handleRestoreMember(m: TeamMember) {
    if (!window.confirm(`Restore ${m.full_name ?? m.email}'s access? They'll be able to log in again.`)) return
    setMemberActionId(m.id)
    try {
      await restoreMember(m.id)
      setMembers((prev) => prev.map((p) => (p.id === m.id ? { ...p, is_active: true } : p)))
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to restore member')
    } finally {
      setMemberActionId(null)
    }
  }

  async function handleDeleteMemberPermanently(m: TeamMember) {
    if (
      !window.confirm(
        `Permanently delete ${m.full_name ?? m.email}?\n\nThis cannot be undone. If they never created anything, their account is deleted outright. If they authored projects/files/tasks, their row is kept as "Deleted member" only so that past work stays attributed — but their email, name, and avatar are wiped from the database.`,
      )
    )
      return
    setMemberActionId(m.id)
    try {
      const { mode } = await deleteMemberPermanently(m.id)
      if (mode === 'deleted') {
        setMembers((prev) => prev.filter((p) => p.id !== m.id))
      } else {
        setMembers((prev) => prev.map((p) => (p.id === m.id ? { ...p, deleted_at: new Date().toISOString() } : p)))
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to delete member')
    } finally {
      setMemberActionId(null)
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

  const memberLookup = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])
  const memberByEmail = useMemo(() => new Map(members.map((m) => [m.email.toLowerCase(), m])), [members])

  interface TimelineEntry {
    id: string
    actorId: string | null
    actorLabel: string
    action: string
    detail: string
    timestamp: string
  }

  const timeline = useMemo<TimelineEntry[]>(() => {
    const fromActivity: TimelineEntry[] = activity.map((a) => {
      const actor = a.actor_id ? memberLookup.get(a.actor_id) : undefined
      const meta = (a.meta ?? {}) as { name?: string }
      return {
        id: `act-${a.id}`,
        actorId: a.actor_id,
        actorLabel: actor?.full_name ?? actor?.email ?? 'Unknown / removed member',
        action: a.action,
        detail: meta.name ? `${meta.name} (${a.entity_type})` : a.entity_type,
        timestamp: a.created_at,
      }
    })
    const fromLogins: TimelineEntry[] = loginHistory.map((l) => {
      const match = memberByEmail.get(l.email.toLowerCase())
      return {
        id: `login-${l.id}`,
        actorId: match?.id ?? null,
        actorLabel: match?.full_name ?? l.email,
        action: l.success ? 'logged in' : 'failed login',
        detail: l.email,
        timestamp: l.created_at,
      }
    })
    return [...fromActivity, ...fromLogins].sort((x, y) => new Date(y.timestamp).getTime() - new Date(x.timestamp).getTime())
  }, [activity, loginHistory, memberLookup, memberByEmail])

  const activityActionOptions = useMemo(() => Array.from(new Set(timeline.map((t) => t.action))).sort(), [timeline])

  const filteredTimeline = useMemo(() => {
    return timeline.filter((t) => {
      if (activityActionFilter !== 'all' && t.action !== activityActionFilter) return false
      if (activityPersonFilter !== 'all') return t.actorId === activityPersonFilter
      if (t.actorId && activityExcludedIds.has(t.actorId)) return false
      return true
    })
  }, [timeline, activityPersonFilter, activityExcludedIds, activityActionFilter])

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

  const removedCount = members.filter((m) => m.approved_at && !m.is_active && !m.deleted_at).length
  const privateProjects = projects.filter((p) => p.is_private)

  return (
    <div className="p-3 sm:p-6 max-w-5xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/" className="text-gray-400 hover:text-cyan"><ArrowLeft size={18} /></Link>
        <h2 className="text-lg font-semibold">Admin panel</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <StatCard label="Team members" value={members.filter((m) => m.approved_at && m.is_active).length} />
        <StatCard label="Pending approval" value={pending.length} />
        <StatCard label="Projects" value={projects.length} />
        <StatCard label="Private projects" value={privateProjects.length} />
        <StatCard label="Logged actions" value={activity.length} />
      </div>

      <div className="flex glass-panel p-1 gap-1 text-xs sm:text-sm overflow-x-auto">
        {([
          ['overview', 'Overview', pending.length],
          ['team', 'Team', removedCount],
          ['security', 'Security', 0],
          ['activity', 'Activity', 0],
        ] as const).map(([key, label, badge]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 min-w-fit px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center justify-center gap-1.5 ${
              tab === key ? 'bg-cyan/15 text-cyan' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {label}
            {badge > 0 && (
              <span className="text-[10px] leading-none px-1.5 py-0.5 rounded-full bg-magenta/20 text-magenta">{badge}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-4 sm:space-y-6">
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

          <section className="glass-panel p-4 sm:p-6">
            <h3 className="font-medium text-sm mb-4">Branding</h3>
            <form onSubmit={handleSaveBranding} className="flex flex-wrap items-center gap-4 sm:gap-6">
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

              <div className="flex-1 min-w-[160px] space-y-1.5">
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
        </div>
      )}

      {tab === 'security' && (
        <section className="glass-panel p-4 sm:p-6">
          <h3 className="font-medium text-sm mb-1">IP allowlist</h3>
          <p className="text-xs text-gray-500 mb-4">
            Opt-in: while this list is empty, access is unrestricted. Add at least one IP to start enforcing — enforced by the Vercel Edge Middleware at <code className="text-gray-400">middleware.ts</code>, not just this table.
          </p>
          <form onSubmit={handleAddIp} className="flex flex-col sm:flex-row gap-2 mb-4">
            <input required className="input-field flex-1 min-w-0" placeholder="203.0.113.42" value={newIp} onChange={(e) => setNewIp(e.target.value)} />
            <input className="input-field flex-1 min-w-0" placeholder="Note (optional)" value={newIpNote} onChange={(e) => setNewIpNote(e.target.value)} />
            <button type="submit" className="btn-primary text-sm px-3 flex items-center justify-center gap-1 shrink-0"><Plus size={14} /> Add</button>
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
      )}

      {tab === 'team' && (
        <div className="space-y-4 sm:space-y-6">
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
                      disabled={m.role === 'owner'}
                      className="input-field text-xs py-1"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                      {/* Owner is only assignable by the current owner, only onto an existing admin
                         (transferOwnership requires the target to already be 'admin'), and it always
                         shows as the target's own current role so an owner row still renders correctly. */}
                      {(m.role === 'owner' || (profile?.role === 'owner' && m.role === 'admin')) && <option value="owner">Owner</option>}
                    </select>
                    {m.id !== profile?.id && m.role !== 'owner' && (
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
            </div>
          </section>

          {privateProjects.length > 0 && (
            <section className="glass-panel">
              <h3 className="px-5 py-3 border-b border-white/10 font-medium text-sm flex items-center gap-2">
                <Lock size={14} className="text-magenta" /> Private projects
              </h3>
              <p className="px-5 pt-3 text-xs text-gray-600">
                {profile?.role === 'owner'
                  ? "As owner you can see every private project across the team."
                  : 'You can see private projects you created or were given access to.'}
              </p>
              <div className="divide-y divide-white/5 mt-1">
                {privateProjects.map((p) => {
                  const creator = members.find((m) => m.id === p.created_by)
                  const accessList = (privateAccess[p.id] ?? [])
                    .map((entry) => members.find((m) => m.id === entry.user_id))
                    .filter((m): m is TeamMember => Boolean(m))
                  return (
                    <div key={p.id} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm truncate">{p.name}</p>
                        <span className="text-xs text-gray-500 shrink-0">
                          created by {creator?.full_name ?? creator?.email ?? 'Unknown'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        {accessList.length === 0
                          ? 'No one else has been granted access.'
                          : `Access: ${accessList.map((m) => m.full_name ?? m.email).join(', ')}`}
                      </p>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {removedCount > 0 && (
            <section className="glass-panel">
              <h3 className="px-5 py-3 border-b border-white/10 font-medium text-sm">
                Removed members
                <span className="ml-2 text-xs font-normal text-gray-500">{removedCount}</span>
              </h3>
              <p className="px-5 pt-3 text-xs text-gray-600">Hidden from the active team list, still shown as author on their past work. Restore their access, or delete them permanently.</p>
              <div className="divide-y divide-white/5 mt-1">
                {members
                  .filter((m) => m.approved_at && !m.is_active && !m.deleted_at)
                  .map((m) => (
                    <div key={m.id} className="flex items-center justify-between px-5 py-3">
                      <div className="min-w-0">
                        <p className="text-sm text-gray-400 truncate">{m.full_name ?? m.email}</p>
                        <p className="text-xs text-gray-600 truncate">{m.email}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleRestoreMember(m)}
                          disabled={memberActionId === m.id}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-gray-400 border border-white/10 hover:text-cyan hover:border-cyan/30 hover:bg-white/5 disabled:opacity-40"
                          title="Restore access"
                        >
                          <RotateCcw size={13} />
                          Restore
                        </button>
                        <button
                          onClick={() => handleDeleteMemberPermanently(m)}
                          disabled={memberActionId === m.id}
                          className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-white/5 disabled:opacity-40"
                          title="Delete permanently"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          )}
        </div>
      )}

      {tab === 'activity' && (
        <section className="glass-panel">
          <h3 className="px-5 py-3 border-b border-white/10 font-medium text-sm">
            Activity — who did what, when, and who logged in
          </h3>

          <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-white/10 text-xs">
            <select
              value={activityPersonFilter}
              onChange={(e) => setActivityPersonFilter(e.target.value)}
              className="input-field py-1 text-xs w-auto"
            >
              <option value="all">Everyone</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>Only: {m.full_name ?? m.email}</option>
              ))}
            </select>
            <select
              value={activityActionFilter}
              onChange={(e) => setActivityActionFilter(e.target.value)}
              className="input-field py-1 text-xs w-auto"
            >
              <option value="all">All actions</option>
              {activityActionOptions.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {activityPersonFilter === 'all' && (
            <div className="flex flex-wrap items-center gap-1.5 px-5 py-2.5 border-b border-white/10 text-xs">
              <span className="text-gray-500 shrink-0">Hide:</span>
              {members.map((m) => {
                const hidden = activityExcludedIds.has(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      setActivityExcludedIds((prev) => {
                        const next = new Set(prev)
                        if (hidden) next.delete(m.id)
                        else next.add(m.id)
                        return next
                      })
                    }
                    className={`px-2 py-0.5 rounded-full border transition-colors ${
                      hidden ? 'border-magenta/40 text-magenta bg-magenta/10' : 'border-white/10 text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {m.full_name ?? m.email}
                  </button>
                )
              })}
            </div>
          )}

          <div className="divide-y divide-white/5 max-h-[70vh] overflow-y-auto">
            {filteredTimeline.length === 0 && <p className="px-5 py-4 text-sm text-gray-500">Nothing matches these filters.</p>}
            {filteredTimeline.map((t) => (
              <div key={t.id} className="px-5 py-2.5 text-sm flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-baseline gap-2">
                  <span className="text-gray-200 font-medium shrink-0">{t.actorLabel}</span>
                  <span className="text-gray-400 shrink-0">
                    {t.action}
                  </span>
                  <span className="text-gray-500 truncate">{t.detail}</span>
                </div>
                <span className="text-xs text-gray-500 shrink-0">{formatDistanceToNow(new Date(t.timestamp), { addSuffix: true })}</span>
              </div>
            ))}
          </div>
        </section>
      )}
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
