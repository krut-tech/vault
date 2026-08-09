import { useEffect, useState, type FormEvent, type MouseEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, FolderGit2, Trash2, Pencil, Kanban as KanbanIcon, Timer, ShieldCheck, Activity, StickyNote, LogOut, Lock } from 'lucide-react'
import {
  listProjects,
  createProject,
  updateProject,
  softDeleteProject,
  listProjectAccess,
  grantProjectAccess,
  revokeProjectAccess,
} from '../lib/api/projects'
import { listTeamMembers, type TeamMember } from '../lib/api/admin'
import { LANGUAGES } from '../types/vault'
import type { Project } from '../types/vault'
import { useAuthStore } from '../store/authStore'
import { useBrandingStore } from '../store/brandingStore'
import { useToastStore } from '../store/toastStore'
import { formatDistanceToNow } from 'date-fns'
import GlobalSearch from '../components/GlobalSearch'

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const canMakePrivate = profile?.role === 'owner' || profile?.role === 'admin'
  const signOut = useAuthStore((s) => s.signOut)
  const { appName, logoUrl, load } = useBrandingStore()
  const pushToast = useToastStore((s) => s.push)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setShowModal(true)
      const next = new URLSearchParams(searchParams)
      next.delete('new')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  async function refresh() {
    setLoading(true)
    try {
      setProjects(await listProjects())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    load()
  }, [load])

  function openEdit(e: MouseEvent, project: Project) {
    e.preventDefault()
    e.stopPropagation()
    setEditingProject(project)
  }

  async function handleDelete(e: MouseEvent, project: Project) {
    e.preventDefault()
    e.stopPropagation()
    if (!window.confirm(`Move "${project.name}" to recycle bin? You can restore it later.`)) return
    await softDeleteProject(project.id)
    setProjects((prev) => prev.filter((p) => p.id !== project.id))
    pushToast(`Moved "${project.name}" to recycle bin`, { link: '/recycle-bin', type: 'success' })
  }

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto">
      <div className="glass-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3 mb-6 sm:px-5">
        <div className="flex items-center gap-2.5 shrink-0">
          {logoUrl && <img src={logoUrl} alt="" className="h-7 w-7 rounded-lg object-cover" />}
          <h1 className="text-lg font-bold neon-gradient-text-animated truncate max-w-[50vw] sm:max-w-none">{appName}</h1>
        </div>
        <div className="order-3 w-full sm:order-none sm:w-auto sm:flex-1 sm:min-w-[160px]">
          <GlobalSearch />
        </div>
        <div className="flex items-center gap-2.5 sm:gap-4 shrink-0 flex-wrap justify-end">
          <Link to="/boards" className="text-gray-400 hover:text-cyan" title="Kanban boards">
            <KanbanIcon size={18} />
          </Link>
          <Link to="/time" className="text-gray-400 hover:text-cyan" title="Time tracker">
            <Timer size={18} />
          </Link>
          <Link to="/monitors" className="text-gray-400 hover:text-cyan" title="Site monitoring">
            <Activity size={18} />
          </Link>
          <Link to="/notes" className="text-gray-400 hover:text-cyan" title="Notes &amp; quick tasks">
            <StickyNote size={18} />
          </Link>
          <Link to="/admin" className="text-gray-400 hover:text-cyan" title="Admin panel">
            <ShieldCheck size={18} />
          </Link>
          <Link to="/recycle-bin" className="text-gray-400 hover:text-cyan" title="Recycle bin">
            <Trash2 size={18} />
          </Link>
          <Link to="/settings" className="flex items-center gap-2 text-sm text-gray-400 hover:text-cyan">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
            ) : (
              <span className="h-6 w-6 rounded-full bg-panel border border-white/10 flex items-center justify-center text-[10px]">
                {(profile?.full_name ?? profile?.email ?? '?').charAt(0).toUpperCase()}
              </span>
            )}
            <span className="hidden lg:inline">{profile?.full_name ?? profile?.email}</span>
          </Link>
          <button
            onClick={() => signOut()}
            title="Sign out"
            className="flex items-center gap-1.5 text-sm px-2.5 sm:px-3 py-1.5 rounded-lg border border-white/10 hover:border-magenta/50 hover:text-magenta transition-colors"
          >
            <LogOut size={14} className="sm:hidden" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Projects</h2>
          <p className="text-sm text-gray-500">Your team's code vault, organized by project.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-1.5 text-sm shrink-0">
          <Plus size={16} /> New project
        </button>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}

      {!loading && projects.length === 0 && (
        <div className="glass-panel p-10 text-center text-gray-500">
          <FolderGit2 className="mx-auto mb-3 text-cyan/50" size={32} />
          No projects yet. Create your first one.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((p) => {
          const canEdit = profile?.role === 'owner' || p.created_by === user?.id
          return (
            <Link key={p.id} to={`/projects/${p.id}`} className="group relative glass-panel p-5 hover:glow-border transition-shadow block">
              <div className="absolute top-3 right-3 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                {canEdit && (
                  <button
                    onClick={(e) => openEdit(e, p)}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-cyan hover:bg-white/5"
                    title="Edit project"
                  >
                    <Pencil size={14} />
                  </button>
                )}
                <button
                  onClick={(e) => handleDelete(e, p)}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-magenta hover:bg-white/5"
                  title="Delete project"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex items-center justify-between mb-2 pr-14">
                <h3 className="font-medium truncate flex items-center gap-1.5">
                  {p.is_private && <Lock size={12} className="text-magenta shrink-0" />}
                  <span className="truncate">{p.name}</span>
                </h3>
                <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-violet/15 text-violet shrink-0">{p.language}</span>
              </div>
              <p className="text-sm text-gray-500 line-clamp-2 min-h-[2.5rem]">{p.description || 'No description'}</p>
              <p className="text-xs text-gray-600 mt-3">Updated {formatDistanceToNow(new Date(p.updated_at), { addSuffix: true })}</p>
            </Link>
          )
        })}
      </div>

      {showModal && user && (
        <CreateProjectModal
          userId={user.id}
          canMakePrivate={canMakePrivate}
          onClose={() => setShowModal(false)}
          onCreated={(project) => { setShowModal(false); pushToast(`Created "${project.name}"`, { type: 'success' }); navigate(`/projects/${project.id}`) }}
        />
      )}

      {editingProject && user && (
        <EditProjectModal
          project={editingProject}
          currentUserId={user.id}
          canMakePrivate={canMakePrivate}
          onClose={() => setEditingProject(null)}
          onSaved={(updated) => {
            setEditingProject(null)
            setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
            pushToast(`Saved "${updated.name}"`, { type: 'success' })
          }}
        />
      )}
    </div>
  )
}

function CreateProjectModal({
  userId,
  canMakePrivate,
  onClose,
  onCreated,
}: {
  userId: string
  canMakePrivate: boolean
  onClose: () => void
  onCreated: (p: Project) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [language, setLanguage] = useState<string>(LANGUAGES[0])
  const [isPrivate, setIsPrivate] = useState(false)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!canMakePrivate) return
    listTeamMembers()
      .then((all) => setMembers(all.filter((m) => m.id !== userId && m.is_active)))
      .catch(() => {})
  }, [canMakePrivate, userId])

  function toggleUser(id: string) {
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const project = await createProject({
        name,
        description: description || null,
        language,
        created_by: userId,
        is_private: canMakePrivate ? isPrivate : false,
      })
      if (canMakePrivate && isPrivate) {
        await Promise.all([...selectedUserIds].map((uid) => grantProjectAccess(project.id, uid, userId)))
      }
      onCreated(project)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="glass-panel glow-border w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold">New project</h3>
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wide text-gray-400">Name</label>
          <input required className="input-field w-full" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wide text-gray-400">Description</label>
          <textarea className="input-field w-full" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wide text-gray-400">Primary language</label>
          <select className="input-field w-full" value={language} onChange={(e) => setLanguage(e.target.value)}>
            {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        {canMakePrivate && (
          <div className="space-y-3 pt-1 border-t border-white/10">
            <label className="flex items-center gap-2 text-sm pt-3 cursor-pointer">
              <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="accent-cyan" />
              <Lock size={13} className="text-magenta" />
              Private project (only you + people you grant access can see it)
            </label>

            {isPrivate && (
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wide text-gray-400">Grant access to</label>
                {members.length === 0 && <p className="text-xs text-gray-600">No other team members yet.</p>}
                <div className="max-h-36 overflow-y-auto space-y-1 rounded-lg border border-white/10 p-2">
                  {members.map((m) => (
                    <label key={m.id} className="flex items-center gap-2 text-sm px-1.5 py-1 rounded-lg hover:bg-white/5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedUserIds.has(m.id)}
                        onChange={() => toggleUser(m.id)}
                        className="accent-cyan"
                      />
                      <span className="truncate">{m.full_name ?? m.email}</span>
                      <span className="text-[10px] text-gray-600 ml-auto shrink-0">{m.role}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-magenta">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-xl border border-white/10 hover:border-white/30">Cancel</button>
          <button type="submit" disabled={submitting} className="btn-primary text-sm">{submitting ? 'Creating…' : 'Create'}</button>
        </div>
      </form>
    </div>
  )
}

function EditProjectModal({
  project,
  currentUserId,
  canMakePrivate,
  onClose,
  onSaved,
}: {
  project: Project
  currentUserId: string
  canMakePrivate: boolean
  onClose: () => void
  onSaved: (p: Project) => void
}) {
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')
  const [language, setLanguage] = useState(project.language)
  const [isPrivate, setIsPrivate] = useState(project.is_private)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [accessUserIds, setAccessUserIds] = useState<Set<string>>(new Set())
  const [accessLoading, setAccessLoading] = useState(true)
  const [savingAccessId, setSavingAccessId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pushToast = useToastStore((s) => s.push)

  useEffect(() => {
    Promise.all([listTeamMembers(), listProjectAccess(project.id)])
      .then(([all, access]) => {
        setMembers(all.filter((m) => m.id !== project.created_by && m.is_active))
        setAccessUserIds(new Set(access.map((a) => a.user_id)))
      })
      .catch(() => {})
      .finally(() => setAccessLoading(false))
  }, [project.id, project.created_by])

  async function toggleAccess(userId: string, granted: boolean) {
    setSavingAccessId(userId)
    try {
      if (granted) {
        await revokeProjectAccess(project.id, userId)
        setAccessUserIds((prev) => { const next = new Set(prev); next.delete(userId); return next })
      } else {
        await grantProjectAccess(project.id, userId, currentUserId)
        setAccessUserIds((prev) => new Set(prev).add(userId))
      }
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to update access', { type: 'error' })
    } finally {
      setSavingAccessId(null)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const updated = await updateProject(project.id, {
        name: name.trim(),
        description: description.trim() || null,
        language,
        is_private: canMakePrivate ? isPrivate : project.is_private,
      })
      onSaved(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save project')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="glass-panel glow-border w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold">Edit project</h3>

        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wide text-gray-400">Name</label>
          <input required className="input-field w-full" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wide text-gray-400">Description</label>
          <textarea className="input-field w-full" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wide text-gray-400">Primary language</label>
          <select className="input-field w-full" value={language} onChange={(e) => setLanguage(e.target.value)}>
            {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        {canMakePrivate && (
          <div className="space-y-3 pt-1 border-t border-white/10">
            <label className="flex items-center gap-2 text-sm pt-3 cursor-pointer">
              <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="accent-cyan" />
              <Lock size={13} className="text-magenta" />
              Private project (only you + people you grant access can see it)
            </label>

            {isPrivate && (
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wide text-gray-400">Who has access</label>
                {accessLoading && <p className="text-xs text-gray-600">Loading…</p>}
                {!accessLoading && members.length === 0 && <p className="text-xs text-gray-600">No other team members yet.</p>}
                {!accessLoading && (
                  <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border border-white/10 p-2">
                    {members.map((m) => {
                      const granted = accessUserIds.has(m.id)
                      return (
                        <div key={m.id} className="flex items-center gap-2 text-sm px-1.5 py-1 rounded-lg hover:bg-white/5">
                          <span className="truncate flex-1">{m.full_name ?? m.email}</span>
                          <span className="text-[10px] text-gray-600 shrink-0">{m.role}</span>
                          <button
                            type="button"
                            disabled={savingAccessId === m.id}
                            onClick={() => toggleAccess(m.id, granted)}
                            className={`text-xs px-2.5 py-1 rounded-lg border shrink-0 transition-colors ${
                              granted
                                ? 'border-cyan/40 text-cyan hover:border-magenta/50 hover:text-magenta'
                                : 'border-white/10 text-gray-500 hover:border-cyan/50 hover:text-cyan'
                            }`}
                          >
                            {savingAccessId === m.id ? '…' : granted ? 'Revoke' : 'Grant'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-magenta">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-xl border border-white/10 hover:border-white/30">Cancel</button>
          <button type="submit" disabled={submitting} className="btn-primary text-sm">{submitting ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>
    </div>
  )
}
