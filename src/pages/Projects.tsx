import { useEffect, useState, type FormEvent, type MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, FolderGit2, Trash2, Pencil, Kanban as KanbanIcon, Timer, ShieldCheck, Activity, StickyNote } from 'lucide-react'
import { listProjects, createProject, renameProject, softDeleteProject } from '../lib/api/projects'
import { LANGUAGES } from '../types/vault'
import type { Project } from '../types/vault'
import { useAuthStore } from '../store/authStore'
import { useBrandingStore } from '../store/brandingStore'
import { formatDistanceToNow } from 'date-fns'
import GlobalSearch from '../components/GlobalSearch'

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const signOut = useAuthStore((s) => s.signOut)
  const { appName, logoUrl, load } = useBrandingStore()
  const navigate = useNavigate()

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

  async function handleRename(e: MouseEvent, project: Project) {
    e.preventDefault()
    e.stopPropagation()
    const name = window.prompt('New project name', project.name)
    if (!name || name.trim() === '' || name === project.name) return
    await renameProject(project.id, name.trim())
    setProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, name: name.trim() } : p)))
  }

  async function handleDelete(e: MouseEvent, project: Project) {
    e.preventDefault()
    e.stopPropagation()
    if (!window.confirm(`Move "${project.name}" to recycle bin? You can restore it later.`)) return
    await softDeleteProject(project.id)
    setProjects((prev) => prev.filter((p) => p.id !== project.id))
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="glass-panel flex items-center justify-between gap-4 px-5 py-3 mb-6">
        <div className="flex items-center gap-2.5 shrink-0">
          {logoUrl && <img src={logoUrl} alt="" className="h-7 w-7 rounded-lg object-cover" />}
          <h1 className="text-lg font-bold neon-gradient-text">{appName}</h1>
        </div>
        <GlobalSearch />
        <div className="flex items-center gap-4 shrink-0">
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
            <span className="hidden sm:inline">{profile?.full_name ?? profile?.email}</span>
          </Link>
          <button onClick={() => signOut()} className="text-sm px-3 py-1.5 rounded-lg border border-white/10 hover:border-magenta/50 hover:text-magenta transition-colors">
            Sign out
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Projects</h2>
          <p className="text-sm text-gray-500">Your team's code vault, organized by project.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-1.5 text-sm">
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
        {projects.map((p) => (
          <Link key={p.id} to={`/projects/${p.id}`} className="group relative glass-panel p-5 hover:glow-border transition-shadow block">
            <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => handleRename(e, p)}
                className="p-1.5 rounded-lg text-gray-500 hover:text-cyan hover:bg-white/5"
                title="Rename project"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={(e) => handleDelete(e, p)}
                className="p-1.5 rounded-lg text-gray-500 hover:text-magenta hover:bg-white/5"
                title="Delete project"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="flex items-center justify-between mb-2 pr-14">
              <h3 className="font-medium truncate">{p.name}</h3>
              <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-violet/15 text-violet shrink-0">{p.language}</span>
            </div>
            <p className="text-sm text-gray-500 line-clamp-2 min-h-[2.5rem]">{p.description || 'No description'}</p>
            <p className="text-xs text-gray-600 mt-3">Updated {formatDistanceToNow(new Date(p.updated_at), { addSuffix: true })}</p>
          </Link>
        ))}
      </div>

      {showModal && user && (
        <CreateProjectModal
          userId={user.id}
          onClose={() => setShowModal(false)}
          onCreated={(project) => { setShowModal(false); navigate(`/projects/${project.id}`) }}
        />
      )}
    </div>
  )
}

function CreateProjectModal({ userId, onClose, onCreated }: { userId: string; onClose: () => void; onCreated: (p: Project) => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [language, setLanguage] = useState<string>(LANGUAGES[0])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const project = await createProject({ name, description: description || null, language, created_by: userId })
      onCreated(project)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="glass-panel glow-border w-full max-w-md p-6 space-y-4">
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
        {error && <p className="text-sm text-magenta">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-xl border border-white/10 hover:border-white/30">Cancel</button>
          <button type="submit" disabled={submitting} className="btn-primary text-sm">{submitting ? 'Creating…' : 'Create'}</button>
        </div>
      </form>
    </div>
  )
}
