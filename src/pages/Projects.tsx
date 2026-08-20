import { useEffect, useState, type FormEvent, type MouseEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, FolderGit2, Kanban as KanbanIcon, Timer, ShieldCheck, Activity, StickyNote, LogOut, Lock, Pencil, Trash2 } from 'lucide-react'
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
import { Button, Input, Textarea, Modal, EmptyState, Badge, LoadingState, ConfirmDialog, PageHeader } from '../components/ui'

/** Toggle-chip multi-select for a project's languages. Shared by the create and edit forms. */
function LanguageChips({ selected, onToggle }: { selected: string[]; onToggle: (lang: string) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs uppercase tracking-wide text-gray-400">
        Languages<span className="text-danger ml-0.5">*</span>
      </label>
      <div className="flex flex-wrap gap-1.5">
        {LANGUAGES.map((l) => {
          const active = selected.includes(l)
          return (
            <button
              key={l}
              type="button"
              onClick={() => onToggle(l)}
              aria-pressed={active}
              className={`px-2.5 py-1 rounded-full text-xs border transition-colors duration-150 ${
                active ? 'border-cyan/50 text-cyan bg-cyan/10' : 'border-white/10 text-gray-400 hover:text-gray-200 hover:border-white/20'
              }`}
            >
              {l}
            </button>
          )
        })}
      </div>
      {selected.length === 0 && <p className="text-xs text-danger">Select at least one language.</p>}
    </div>
  )
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [deletingProject, setDeletingProject] = useState<Project | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
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

  function openDeleteConfirm(e: MouseEvent, project: Project) {
    e.preventDefault()
    e.stopPropagation()
    setDeletingProject(project)
  }

  async function confirmDelete() {
    if (!deletingProject) return
    setDeleteLoading(true)
    try {
      await softDeleteProject(deletingProject.id)
      setProjects((prev) => prev.filter((p) => p.id !== deletingProject.id))
      pushToast(`Moved "${deletingProject.name}" to recycle bin`, { link: '/recycle-bin', type: 'success' })
      setDeletingProject(null)
    } finally {
      setDeleteLoading(false)
    }
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
          <Button variant="secondary" size="sm" onClick={() => signOut()} title="Sign out">
            <LogOut size={14} className="sm:hidden" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <PageHeader
          title="Projects"
          subtitle="Your team's code vault, organized by project."
          actions={
            <Button onClick={() => setShowModal(true)}>
              <Plus size={16} /> New project
            </Button>
          }
        />
      </div>

      {loading && <LoadingState label="Loading projects…" />}

      {!loading && projects.length === 0 && (
        <EmptyState
          icon={FolderGit2}
          title="No projects yet"
          description="Create your first project to start organizing your code."
          action={
            <Button onClick={() => setShowModal(true)}>
              <Plus size={16} /> New project
            </Button>
          }
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((p) => {
          const canEdit = profile?.role === 'owner' || p.created_by === user?.id
          return (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              className="group relative glass-panel p-5 hover:border-white/20 hover:bg-panel/70 transition-colors duration-200 block"
            >
              <div className="absolute top-3 right-3 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                {canEdit && (
                  <Button variant="tertiary" onClick={(e) => openEdit(e, p)} title="Edit project">
                    <Pencil size={14} />
                  </Button>
                )}
                <Button
                  variant="tertiary"
                  className="hover:text-danger"
                  onClick={(e) => openDeleteConfirm(e, p)}
                  title="Delete project"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
              <div className="flex items-center justify-between mb-2 pr-14">
                <h3 className="font-medium truncate flex items-center gap-1.5">
                  {p.is_private && <Lock size={12} className="text-magenta shrink-0" />}
                  <span className="truncate">{p.name}</span>
                </h3>
                <div className="flex flex-wrap gap-1 shrink-0 justify-end">
                  {p.languages.map((l) => (
                    <Badge key={l} variant="accent">{l}</Badge>
                  ))}
                </div>
              </div>
              <p className="text-sm text-secondary line-clamp-2 min-h-[2.5rem]">{p.description || 'No description'}</p>
              <p className="text-xs text-muted mt-3">Updated {formatDistanceToNow(new Date(p.updated_at), { addSuffix: true })}</p>
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

      <ConfirmDialog
        open={Boolean(deletingProject)}
        onClose={() => setDeletingProject(null)}
        onConfirm={confirmDelete}
        title={`Move "${deletingProject?.name}" to recycle bin?`}
        description="You can restore it later from the recycle bin."
        confirmLabel="Move to recycle bin"
        danger
        loading={deleteLoading}
      />
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
  const [languages, setLanguages] = useState<string[]>([LANGUAGES[0]])
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

  function toggleLanguage(lang: string) {
    setLanguages((prev) => (prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (languages.length === 0) return
    setSubmitting(true)
    setError(null)
    try {
      const project = await createProject({
        name,
        description: description || null,
        languages,
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
    <Modal open onClose={onClose} title="New project" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
        <Textarea label="Description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        <LanguageChips selected={languages} onToggle={toggleLanguage} />

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
                {members.length === 0 && <p className="text-xs text-muted">No other team members yet.</p>}
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
                      <span className="text-[10px] text-muted ml-auto shrink-0">{m.role}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={submitting} disabled={languages.length === 0}>{submitting ? 'Creating…' : 'Create'}</Button>
        </div>
      </form>
    </Modal>
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
  const [languages, setLanguages] = useState<string[]>(project.languages)
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

  function toggleLanguage(lang: string) {
    setLanguages((prev) => (prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]))
  }

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
    if (languages.length === 0) return
    setSubmitting(true)
    setError(null)
    try {
      const updated = await updateProject(project.id, {
        name: name.trim(),
        description: description.trim() || null,
        languages,
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
    <Modal open onClose={onClose} title="Edit project" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
        <Textarea label="Description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        <LanguageChips selected={languages} onToggle={toggleLanguage} />

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
                {accessLoading && <LoadingState label="Loading…" />}
                {!accessLoading && members.length === 0 && <p className="text-xs text-muted">No other team members yet.</p>}
                {!accessLoading && (
                  <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border border-white/10 p-2">
                    {members.map((m) => {
                      const granted = accessUserIds.has(m.id)
                      return (
                        <div key={m.id} className="flex items-center gap-2 text-sm px-1.5 py-1 rounded-lg hover:bg-white/5">
                          <span className="truncate flex-1">{m.full_name ?? m.email}</span>
                          <span className="text-[10px] text-muted shrink-0">{m.role}</span>
                          <button
                            type="button"
                            disabled={savingAccessId === m.id}
                            onClick={() => toggleAccess(m.id, granted)}
                            className={`text-xs px-2.5 py-1 rounded-lg border shrink-0 transition-colors duration-150 ${
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

        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={submitting} disabled={languages.length === 0}>{submitting ? 'Saving…' : 'Save changes'}</Button>
        </div>
      </form>
    </Modal>
  )
}
