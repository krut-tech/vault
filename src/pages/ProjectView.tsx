import { useCallback, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, History, Star, Trash2, MessageSquare, Rocket, ScanSearch, FileArchive, FileText } from 'lucide-react'
import CommentsPanel from '../components/CommentsPanel'
import DeployPanel from '../components/DeployPanel'
import CodeScanner from '../components/CodeScanner'
import PdfPanel from '../components/PdfPanel'
import { logActivity } from '../lib/api/activity'
import { getProject } from '../lib/api/projects'
import { listFolders, createFolder } from '../lib/api/folders'
import { listFiles, createFile, toggleFavorite, softDeleteFile, getFile } from '../lib/api/files'
import { matchesProjectLanguage, acceptForLanguage } from '../lib/languageMap'
import type { Project, Folder, VaultFile } from '../types/vault'
import FileTree from '../components/FileTree'
import CodeEditor from '../components/CodeEditor'
import VersionHistory from '../components/VersionHistory'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'

export default function ProjectView() {
  const { id } = useParams<{ id: string }>()
  const user = useAuthStore((s) => s.user)

  const [project, setProject] = useState<Project | null>(null)
  const [folders, setFolders] = useState<Folder[]>([])
  const [files, setFiles] = useState<VaultFile[]>([])
  const [activeFile, setActiveFile] = useState<VaultFile | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [showDeploy, setShowDeploy] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [showPdfs, setShowPdfs] = useState(false)
  const [loading, setLoading] = useState(true)
  const [zipping, setZipping] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [p, f, fl] = await Promise.all([getProject(id), listFolders(id), listFiles(id)])
      setProject(p)
      setFolders(f)
      setFiles(fl)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!id) return
    const channel = supabase
      .channel(`project-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'files', filter: `project_id=eq.${id}` }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setFiles((prev) => prev.filter((f) => f.id !== (payload.old as VaultFile).id))
          return
        }
        const row = payload.new as VaultFile
        setFiles((prev) => {
          const exists = prev.some((f) => f.id === row.id)
          if (row.is_deleted) return prev.filter((f) => f.id !== row.id)
          if (exists) return prev.map((f) => (f.id === row.id ? row : f))
          return [...prev, row]
        })
        setActiveFile((prev) => (prev && prev.id === row.id ? (row.is_deleted ? null : row) : prev))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'folders', filter: `project_id=eq.${id}` }, async () => {
        setFolders(await listFolders(id))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id])

  async function handleCreateFolder(parentId: string | null) {
    if (!id) return
    const name = window.prompt('Folder name')
    if (!name) return
    const folder = await createFolder({ project_id: id, parent_id: parentId, name })
    setFolders((prev) => [...prev, folder])
  }

  async function handleCreateFile(folderId: string | null) {
    if (!id || !user) return
    const name = window.prompt('File name (e.g. main.ts)')
    if (!name) return
    const file = await createFile({
      project_id: id,
      folder_id: folderId,
      name,
      language: project?.language ?? 'plaintext',
      content: '',
      created_by: user.id,
    })
    setFiles((prev) => [...prev, file])
    setActiveFile(file)
    void logActivity(user.id, 'created', 'file', file.id, { name: file.name, project_id: id })
  }

  // --- Upload: individual files into a given folder (or root) ---
  async function handleUploadFiles(folderId: string | null, fileList: FileList) {
    if (!id || !user || !project) return
    const incoming = Array.from(fileList)
    const rejected: string[] = []
    const created: VaultFile[] = []

    for (const f of incoming) {
      if (!matchesProjectLanguage(f.name, project.language)) {
        rejected.push(f.name)
        continue
      }
      const content = await f.text()
      const file = await createFile({
        project_id: id,
        folder_id: folderId,
        name: f.name,
        language: project.language,
        content,
        created_by: user.id,
      })
      created.push(file)
      void logActivity(user.id, 'uploaded', 'file', file.id, { name: file.name, project_id: id })
    }

    if (created.length > 0) setFiles((prev) => [...prev, ...created])
    if (rejected.length > 0) {
      window.alert(
        `This is a "${project.language}" project, so ${rejected.length} file(s) were skipped (wrong file type):\n\n${rejected.join('\n')}`,
      )
    }
  }

  // --- Upload: a whole folder, preserving its internal structure ---
  async function handleUploadFolder(fileList: FileList) {
    if (!id || !user || !project) return
    const projectId = id
    const currentUser = user
    const incoming = Array.from(fileList) as (File & { webkitRelativePath?: string })[]
    const rejected: string[] = []
    const createdFiles: VaultFile[] = []
    const pathToFolderId = new Map<string, string>()
    const localFolders = [...folders]

    async function ensureFolderPath(pathParts: string[]): Promise<string | null> {
      let parentId: string | null = null
      let cumulativePath = ''
      for (const part of pathParts) {
        cumulativePath = cumulativePath ? `${cumulativePath}/${part}` : part
        if (pathToFolderId.has(cumulativePath)) {
          parentId = pathToFolderId.get(cumulativePath)!
          continue
        }
        const existing = localFolders.find((fo) => fo.parent_id === parentId && fo.name === part)
        if (existing) {
          pathToFolderId.set(cumulativePath, existing.id)
          parentId = existing.id
          continue
        }
        const folder = await createFolder({ project_id: projectId, parent_id: parentId, name: part })
        localFolders.push(folder)
        pathToFolderId.set(cumulativePath, folder.id)
        parentId = folder.id
      }
      return parentId
    }

    for (const f of incoming) {
      const relPath = f.webkitRelativePath || f.name
      const parts = relPath.split('/')
      const fileName = parts.pop()!
      if (!matchesProjectLanguage(fileName, project.language)) {
        rejected.push(relPath)
        continue
      }
      const folderId = parts.length > 0 ? await ensureFolderPath(parts) : null
      const content = await f.text()
      const file = await createFile({
        project_id: projectId,
        folder_id: folderId,
        name: fileName,
        language: project.language,
        content,
        created_by: currentUser.id,
      })
      createdFiles.push(file)
    }

    setFolders(localFolders)
    if (createdFiles.length > 0) {
      setFiles((prev) => [...prev, ...createdFiles])
      if (user) void logActivity(user.id, 'uploaded', 'folder', id, { count: createdFiles.length, project_id: id })
    }
    if (rejected.length > 0) {
      window.alert(
        `This is a "${project.language}" project, so ${rejected.length} file(s) were skipped (wrong file type):\n\n${rejected.join('\n')}`,
      )
    }
  }

  function handleDownloadFile(file: VaultFile) {
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    a.click()
    URL.revokeObjectURL(url)
  }

  function folderPath(folderId: string | null): string {
    if (!folderId) return ''
    const parts: string[] = []
    let current = folders.find((f) => f.id === folderId) ?? null
    while (current) {
      parts.unshift(current.name)
      current = current.parent_id ? folders.find((f) => f.id === current!.parent_id) ?? null : null
    }
    return parts.join('/')
  }

  async function handleDownloadZip() {
    if (!project) return
    setZipping(true)
    try {
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()
      for (const f of files) {
        const path = folderPath(f.folder_id)
        zip.file(path ? `${path}/${f.name}` : f.name, f.content)
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${project.name.replace(/[^a-z0-9_-]+/gi, '_')}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setZipping(false)
    }
  }

  async function handleToggleFavorite() {
    if (!activeFile) return
    const next = !activeFile.is_favorite
    await toggleFavorite(activeFile.id, next)
    setActiveFile({ ...activeFile, is_favorite: next })
    setFiles((prev) => prev.map((f) => (f.id === activeFile.id ? { ...f, is_favorite: next } : f)))
  }

  async function handleDeleteFile() {
    if (!activeFile) return
    if (!window.confirm(`Move "${activeFile.name}" to recycle bin?`)) return
    await softDeleteFile(activeFile.id)
    setFiles((prev) => prev.filter((f) => f.id !== activeFile.id))
    if (user) void logActivity(user.id, 'deleted', 'file', activeFile.id, { name: activeFile.name })
    setActiveFile(null)
  }

  async function handleRestoredVersion() {
    if (!activeFile) return
    const refreshed = await getFile(activeFile.id)
    setActiveFile(refreshed)
    setShowHistory(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-cyan/30 border-t-cyan animate-spin" />
      </div>
    )
  }

  if (!project) return <div className="p-6 text-gray-400">Project not found.</div>

  return (
    <div className="h-screen flex flex-col">
      <header className="glass-panel m-4 mb-2 flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-gray-400 hover:text-cyan"><ArrowLeft size={18} /></Link>
          <h1 className="font-semibold">{project.name}</h1>
          <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-violet/15 text-violet">{project.language}</span>
          <button onClick={() => setShowDeploy(true)} className="text-gray-400 hover:text-cyan flex items-center gap-1 text-xs ml-2" title="Deploy">
            <Rocket size={14} /> Deploy
          </button>
          <button onClick={() => setShowScanner(true)} className="text-gray-400 hover:text-violet flex items-center gap-1 text-xs" title="Code scanner">
            <ScanSearch size={14} /> Scan
          </button>
          <button onClick={() => setShowPdfs(true)} className="text-gray-400 hover:text-cyan flex items-center gap-1 text-xs" title="PDF documents">
            <FileText size={14} /> PDFs
          </button>
          <button
            onClick={handleDownloadZip}
            disabled={zipping || files.length === 0}
            className="text-gray-400 hover:text-cyan flex items-center gap-1 text-xs disabled:opacity-40"
            title="Download whole project as ZIP"
          >
            <FileArchive size={14} /> {zipping ? 'Zipping…' : 'Download ZIP'}
          </button>
        </div>
        {activeFile && (
          <div className="flex items-center gap-3">
            <button onClick={handleToggleFavorite} className="text-gray-400 hover:text-violet" title="Toggle favorite">
              <Star size={16} className={activeFile.is_favorite ? 'fill-violet text-violet' : ''} />
            </button>
            <button onClick={() => setShowHistory(true)} className="text-gray-400 hover:text-cyan" title="Version history">
              <History size={16} />
            </button>
            <button onClick={() => setShowComments((v) => !v)} className="text-gray-400 hover:text-violet" title="Comments">
              <MessageSquare size={16} />
            </button>
            <button onClick={handleDeleteFile} className="text-gray-400 hover:text-magenta" title="Delete file">
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-[260px_1fr] gap-2 px-4 pb-4">
        <FileTree
          folders={folders}
          files={files}
          activeFileId={activeFile?.id ?? null}
          acceptExtensions={acceptForLanguage(project.language)}
          onSelectFile={setActiveFile}
          onCreateFolder={handleCreateFolder}
          onCreateFile={handleCreateFile}
          onUploadFiles={handleUploadFiles}
          onUploadFolder={handleUploadFolder}
          onDownloadFile={handleDownloadFile}
        />

        {activeFile && user ? (
          <CodeEditor key={activeFile.id} fileId={activeFile.id} initialContent={activeFile.content} language={activeFile.language} userId={user.id} />
        ) : (
          <div className="glass-panel flex items-center justify-center text-gray-500 text-sm">
            Select or create a file to start editing.
          </div>
        )}
      </div>

      {showHistory && activeFile && user && (
        <VersionHistory
          fileId={activeFile.id}
          currentContent={activeFile.content}
          userId={user.id}
          onRestored={handleRestoredVersion}
          onClose={() => setShowHistory(false)}
        />
      )}

      {showComments && activeFile && <CommentsPanel fileId={activeFile.id} onClose={() => setShowComments(false)} />}

      {showDeploy && id && <DeployPanel projectId={id} onClose={() => setShowDeploy(false)} />}

      {showScanner && id && <CodeScanner projectId={id} onClose={() => setShowScanner(false)} />}
      {showPdfs && id && <PdfPanel projectId={id} onClose={() => setShowPdfs(false)} />}
    </div>
  )
}
