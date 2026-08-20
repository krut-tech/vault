import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { ArrowLeft, History, Star, Trash2, MessageSquare, Rocket, ScanSearch, FileArchive, X, ChevronRight, GripVertical, Lock, FileCode2 } from 'lucide-react'
import CommentsPanel from '../components/CommentsPanel'
import DeployPanel from '../components/DeployPanel'
import CodeScanner from '../components/CodeScanner'
import { logActivity } from '../lib/api/activity'
import { getProject } from '../lib/api/projects'
import { listFolders, createFolder, renameFolder, moveFolder, softDeleteFolderCascade } from '../lib/api/folders'
import { listFiles, createFile, toggleFavorite, softDeleteFile, getFile, renameFile, moveFile, duplicateFile } from '../lib/api/files'
import { listPdfs, uploadPdf, deletePdf, getPdfUrl } from '../lib/api/pdfs'
import { matchesProjectLanguages, acceptForLanguages, detectLanguage } from '../lib/languageMap'
import type { Project, Folder, VaultFile, PdfFile } from '../types/vault'
import FileTree from '../components/FileTree'
import CodeEditor from '../components/CodeEditor'
import VersionHistory from '../components/VersionHistory'
import { useAuthStore } from '../store/authStore'
import { useWorkspaceStore } from '../store/workspaceStore'
import { useToastStore } from '../store/toastStore'
import { supabase } from '../lib/supabase'
import { Badge, Button, ConfirmDialog, LoadingState } from '../components/ui'

const MIN_SIDEBAR = 190
const MAX_SIDEBAR = 480

export default function ProjectView() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const user = useAuthStore((s) => s.user)
  const pushToast = useToastStore((s) => s.push)
  const registerCommands = useWorkspaceStore((s) => s.registerCommands)
  const unregisterCommands = useWorkspaceStore((s) => s.unregisterCommands)
  const sidebarVisible = useWorkspaceStore((s) => s.sidebarVisible)
  const pushRecentFile = useWorkspaceStore((s) => s.pushRecentFile)

  const [project, setProject] = useState<Project | null>(null)
  const [folders, setFolders] = useState<Folder[]>([])
  const [files, setFiles] = useState<VaultFile[]>([])
  const [openFiles, setOpenFiles] = useState<VaultFile[]>([])
  const [activeFileId, setActiveFileId] = useState<string | null>(null)
  const [dirtyFileIds, setDirtyFileIds] = useState<Set<string>>(new Set())
  const [showHistory, setShowHistory] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [showDeploy, setShowDeploy] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null)
  const [deletingPdf, setDeletingPdf] = useState<PdfFile | null>(null)
  const [confirmDeleteFile, setConfirmDeleteFile] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [pdfs, setPdfs] = useState<PdfFile[]>([])
  const [loading, setLoading] = useState(true)
  const [zipping, setZipping] = useState(false)
  const [importingZip, setImportingZip] = useState(false)
  const [mobilePane, setMobilePane] = useState<'files' | 'editor'>('files')
  const [sidebarWidth, setSidebarWidth] = useState(260)

  const uploadFilesInputRef = useRef<HTMLInputElement>(null)
  const uploadFolderInputRef = useRef<HTMLInputElement>(null)
  const importZipInputRef = useRef<HTMLInputElement>(null)
  // Tracks which open files we've already logged an "edited" activity
  // event for, so autosave (fires every ~1.2s while typing) doesn't
  // spam the audit trail — one log entry per file per open-session.
  const editedThisSessionRef = useRef<Set<string>>(new Set())

  const activeFile = useMemo(() => openFiles.find((f) => f.id === activeFileId) ?? null, [openFiles, activeFileId])

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [p, f, fl, pf] = await Promise.all([getProject(id), listFolders(id), listFiles(id), listPdfs(id)])
      setProject(p)
      setFolders(f)
      setFiles(fl)
      setPdfs(pf)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  // ?file=<id> — used by the Command Palette's "Recent Files" and by
  // Advanced Search results to jump straight into a file from outside
  // the project. Consumed once, then stripped from the URL.
  useEffect(() => {
    const wanted = searchParams.get('file')
    if (!wanted || files.length === 0) return
    const match = files.find((f) => f.id === wanted)
    if (match) openFile(match)
    const next = new URLSearchParams(searchParams)
    next.delete('file')
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files])

  useEffect(() => {
    if (!id) return
    const channel = supabase
      .channel(`project-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'files', filter: `project_id=eq.${id}` }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const deletedId = (payload.old as VaultFile).id
          setFiles((prev) => prev.filter((f) => f.id !== deletedId))
          setOpenFiles((prev) => prev.filter((f) => f.id !== deletedId))
          return
        }
        const row = payload.new as VaultFile
        setFiles((prev) => {
          const exists = prev.some((f) => f.id === row.id)
          if (row.is_deleted) return prev.filter((f) => f.id !== row.id)
          if (exists) return prev.map((f) => (f.id === row.id ? row : f))
          return [...prev, row]
        })
        setOpenFiles((prev) => {
          if (row.is_deleted) return prev.filter((f) => f.id !== row.id)
          return prev.map((f) => (f.id === row.id ? row : f))
        })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'folders', filter: `project_id=eq.${id}` }, async () => {
        setFolders(await listFolders(id))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id])

  function openFile(file: VaultFile) {
    const alreadyOpen = openFiles.some((f) => f.id === file.id)
    setOpenFiles((prev) => (alreadyOpen ? prev : [...prev, file]))
    setActiveFileId(file.id)
    setMobilePane('editor')
    if (project) pushRecentFile({ id: file.id, name: file.name, projectId: project.id, projectName: project.name, openedAt: Date.now() })
    // Only log a genuine "opened" the first time this file is opened in
    // this visit — re-clicking an already-open tab isn't a new open.
    if (!alreadyOpen && user) void logActivity(user.id, 'opened', 'file', file.id, { name: file.name, project_id: id })
  }

  function closeTab(fileId: string) {
    setOpenFiles((prev) => {
      const idx = prev.findIndex((f) => f.id === fileId)
      const next = prev.filter((f) => f.id !== fileId)
      if (activeFileId === fileId) {
        const fallback = next[idx] ?? next[idx - 1] ?? null
        setActiveFileId(fallback?.id ?? null)
      }
      return next
    })
    setDirtyFileIds((prev) => {
      if (!prev.has(fileId)) return prev
      const next = new Set(prev)
      next.delete(fileId)
      return next
    })
    editedThisSessionRef.current.delete(fileId)
  }

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
      language: detectLanguage(name),
      content: '',
      created_by: user.id,
    })
    setFiles((prev) => [...prev, file])
    openFile(file)
    void logActivity(user.id, 'created', 'file', file.id, { name: file.name, project_id: id })
  }

  async function handleRenameFile(file: VaultFile) {
    const name = window.prompt('Rename file', file.name)
    if (!name || name === file.name) return
    await renameFile(file.id, name)
    setFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, name } : f)))
    setOpenFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, name } : f)))
  }

  async function handleRenameFolder(folder: Folder) {
    const name = window.prompt('Rename folder', folder.name)
    if (!name || name === folder.name) return
    await renameFolder(folder.id, name)
    setFolders((prev) => prev.map((f) => (f.id === folder.id ? { ...f, name } : f)))
  }

  async function handleDuplicateFile(file: VaultFile) {
    if (!user) return
    const copy = await duplicateFile(file, user.id)
    setFiles((prev) => [...prev, copy])
    pushToast(`Duplicated as "${copy.name}"`, { type: 'success' })
  }

  async function handleMoveFile(file: VaultFile, targetFolderId: string | null) {
    await moveFile(file.id, targetFolderId)
    setFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, folder_id: targetFolderId } : f)))
    setOpenFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, folder_id: targetFolderId } : f)))
  }

  async function handleMoveFolder(folder: Folder, targetFolderId: string | null) {
    if (targetFolderId === folder.id) return
    await moveFolder(folder.id, targetFolderId)
    setFolders((prev) => prev.map((f) => (f.id === folder.id ? { ...f, parent_id: targetFolderId } : f)))
  }

  async function confirmDeleteFolder() {
    if (!deletingFolder) return
    setDeleteBusy(true)
    try {
      const { folderIds, fileIds } = await softDeleteFolderCascade(deletingFolder.id, folders, files)
      setFolders((prev) => prev.filter((f) => !folderIds.includes(f.id)))
      setFiles((prev) => prev.filter((f) => !fileIds.includes(f.id)))
      setOpenFiles((prev) => prev.filter((f) => !fileIds.includes(f.id)))
      if (activeFileId && fileIds.includes(activeFileId)) setActiveFileId(null)
      pushToast(`Moved "${deletingFolder.name}" (${fileIds.length} file(s)) to recycle bin`, { link: '/recycle-bin', type: 'success' })
      setDeletingFolder(null)
    } finally {
      setDeleteBusy(false)
    }
  }

  // --- Upload: individual files into a given folder (or root) ---
  async function handleUploadFiles(folderId: string | null, fileList: FileList) {
    if (!id || !user || !project) return
    const incoming = Array.from(fileList)
    const rejected: string[] = []
    const failed: string[] = []
    const created: VaultFile[] = []

    for (const f of incoming) {
      if (!matchesProjectLanguages(f.name, project.languages)) {
        rejected.push(f.name)
        continue
      }
      try {
        const content = await f.text()
        const file = await createFile({
          project_id: id,
          folder_id: folderId,
          name: f.name,
          language: detectLanguage(f.name),
          content,
          created_by: user.id,
        })
        created.push(file)
        void logActivity(user.id, 'uploaded', 'file', file.id, { name: file.name, project_id: id })
      } catch (err) {
        console.error(`Upload failed for ${f.name}`, err)
        failed.push(f.name)
      }
    }

    if (created.length > 0) setFiles((prev) => [...prev, ...created])
    if (rejected.length > 0 || failed.length > 0) {
      const parts: string[] = []
      if (rejected.length > 0) {
        parts.push(`${rejected.length} file(s) skipped (wrong file type for a "${project.languages.join(', ')}" project):\n${rejected.join('\n')}`)
      }
      if (failed.length > 0) {
        parts.push(`${failed.length} file(s) failed to upload:\n${failed.join('\n')}`)
      }
      window.alert(`Uploaded ${created.length}/${incoming.length} file(s).\n\n${parts.join('\n\n')}`)
    }
  }

  // --- Upload: a whole folder, preserving its internal structure ---
  async function handleUploadFolder(fileList: FileList) {
    if (!id || !user || !project) return
    const projectId = id
    const currentUser = user
    const incoming = Array.from(fileList) as (File & { webkitRelativePath?: string })[]
    const rejected: string[] = []
    const failed: string[] = []
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
      if (!matchesProjectLanguages(fileName, project.languages)) {
        rejected.push(relPath)
        continue
      }
      try {
        const folderId = parts.length > 0 ? await ensureFolderPath(parts) : null
        const content = await f.text()
        const file = await createFile({
          project_id: projectId,
          folder_id: folderId,
          name: fileName,
          language: detectLanguage(fileName),
          content,
          created_by: currentUser.id,
        })
        createdFiles.push(file)
      } catch (err) {
        console.error(`Upload failed for ${relPath}`, err)
        failed.push(relPath)
      }
    }

    setFolders(localFolders)
    if (createdFiles.length > 0) {
      setFiles((prev) => [...prev, ...createdFiles])
      if (user) void logActivity(user.id, 'uploaded', 'folder', id, { count: createdFiles.length, project_id: id })
    }
    if (rejected.length > 0 || failed.length > 0) {
      const parts: string[] = []
      if (rejected.length > 0) {
        parts.push(`${rejected.length} file(s) skipped (wrong file type for a "${project.languages.join(', ')}" project):\n${rejected.join('\n')}`)
      }
      if (failed.length > 0) {
        parts.push(`${failed.length} file(s) failed to upload:\n${failed.join('\n')}`)
      }
      window.alert(`Uploaded ${createdFiles.length}/${incoming.length} file(s).\n\n${parts.join('\n\n')}`)
    }
  }

  // --- Import: a .zip archive, same folder-preserving logic as folder upload ---
  async function handleImportZip(zipFile: File) {
    if (!id || !user || !project) return
    setImportingZip(true)
    try {
      const { default: JSZip } = await import('jszip')
      const zip = await JSZip.loadAsync(zipFile)
      const projectId = id
      const currentUser = user
      const rejected: string[] = []
      const failed: string[] = []
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

      const entries = Object.values(zip.files).filter((entry) => !entry.dir)
      for (const entry of entries) {
        const parts = entry.name.split('/').filter(Boolean)
        const fileName = parts.pop()!
        if (fileName.startsWith('.')) continue // skip .DS_Store / dotfiles from the archive
        if (!matchesProjectLanguages(fileName, project.languages)) {
          rejected.push(entry.name)
          continue
        }
        try {
          const folderId = parts.length > 0 ? await ensureFolderPath(parts) : null
          const content = await entry.async('text')
          const file = await createFile({
            project_id: projectId,
            folder_id: folderId,
            name: fileName,
            language: detectLanguage(fileName),
            content,
            created_by: currentUser.id,
          })
          createdFiles.push(file)
        } catch (err) {
          console.error(`Import failed for ${entry.name}`, err)
          failed.push(entry.name)
        }
      }

      setFolders(localFolders)
      if (createdFiles.length > 0) {
        setFiles((prev) => [...prev, ...createdFiles])
        void logActivity(user.id, 'uploaded', 'folder', id, { count: createdFiles.length, project_id: id, source: 'zip' })
        pushToast(`Imported ${createdFiles.length} file(s) from ZIP`, { type: 'success' })
      }
      if (rejected.length > 0 || failed.length > 0) {
        window.alert(
          `Imported ${createdFiles.length}/${entries.length} file(s) from the ZIP.\n\n` +
          (rejected.length > 0 ? `${rejected.length} skipped (wrong file type for a "${project.languages.join(', ')}" project).\n` : '') +
          (failed.length > 0 ? `${failed.length} failed to read.` : ''),
        )
      }
    } catch (err) {
      console.error('ZIP import failed', err)
      pushToast('Could not read that ZIP file', { type: 'error' })
    } finally {
      setImportingZip(false)
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

  // --- PDFs: uploaded/listed/deleted separately from code files, shown in the same tree ---
  async function handleUploadPdf(folderId: string | null, fileList: FileList) {
    if (!id || !user) return
    const incoming = Array.from(fileList)
    const uploaded: PdfFile[] = []
    for (const file of incoming) {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) continue
      try {
        const pdf = await uploadPdf({ project_id: id, folder_id: folderId, file, uploaded_by: user.id })
        uploaded.push(pdf)
      } catch (err) {
        console.error('PDF upload failed', err)
      }
    }
    if (uploaded.length > 0) {
      setPdfs((prev) => [...prev, ...uploaded])
      void logActivity(user.id, 'uploaded', 'pdf', uploaded[0].id, { count: uploaded.length, project_id: id })
    }
  }

  function handleDownloadPdf(pdf: PdfFile) {
    window.open(getPdfUrl(pdf.storage_path), '_blank')
  }

  async function confirmDeletePdf() {
    if (!deletingPdf) return
    setDeleteBusy(true)
    try {
      await deletePdf(deletingPdf)
      setPdfs((prev) => prev.filter((p) => p.id !== deletingPdf.id))
      if (user) void logActivity(user.id, 'deleted', 'pdf', deletingPdf.id, { name: deletingPdf.name, project_id: id })
      setDeletingPdf(null)
    } finally {
      setDeleteBusy(false)
    }
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
    setOpenFiles((prev) => prev.map((f) => (f.id === activeFile.id ? { ...f, is_favorite: next } : f)))
    setFiles((prev) => prev.map((f) => (f.id === activeFile.id ? { ...f, is_favorite: next } : f)))
  }

  function handleDeleteFile() {
    if (!activeFile) return
    setConfirmDeleteFile(true)
  }

  async function confirmDeleteFileAction() {
    if (!activeFile) return
    setDeleteBusy(true)
    try {
      await softDeleteFile(activeFile.id)
      setFiles((prev) => prev.filter((f) => f.id !== activeFile.id))
      if (user) void logActivity(user.id, 'deleted', 'file', activeFile.id, { name: activeFile.name })
      closeTab(activeFile.id)
      setConfirmDeleteFile(false)
    } finally {
      setDeleteBusy(false)
    }
  }

  async function handleRestoredVersion() {
    if (!activeFile) return
    const refreshed = await getFile(activeFile.id)
    setOpenFiles((prev) => prev.map((f) => (f.id === refreshed.id ? refreshed : f)))
    setShowHistory(false)
  }

  // --- Command palette registration ---
  useEffect(() => {
    registerCommands({
      newFile: () => handleCreateFile(null),
      newFolder: () => handleCreateFolder(null),
      uploadFiles: () => uploadFilesInputRef.current?.click(),
      uploadFolder: () => uploadFolderInputRef.current?.click(),
      importZip: () => importZipInputRef.current?.click(),
    })
    return () => unregisterCommands(['newFile', 'newFolder', 'uploadFiles', 'uploadFolder', 'importZip'])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, project, folders])

  // --- Resizable sidebar (desktop only — mobile uses the pane switcher below) ---
  function startResize(e: React.MouseEvent) {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = sidebarWidth
    function onMove(ev: MouseEvent) {
      setSidebarWidth(Math.min(MAX_SIDEBAR, Math.max(MIN_SIDEBAR, startWidth + (ev.clientX - startX))))
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const breadcrumbSegments = activeFile ? folderPath(activeFile.folder_id).split('/').filter(Boolean) : []

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingState label="Loading project…" fullHeight />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-panel p-8 text-center max-w-sm">
          <p className="text-sm font-medium text-gray-200">Project not found</p>
          <p className="text-sm text-secondary mt-1.5">It may have been deleted or you don't have access to it.</p>
          <Link to="/" className="inline-block mt-4">
            <Button variant="secondary" size="sm"><ArrowLeft size={14} /> Back to projects</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      <input
        ref={uploadFilesInputRef}
        type="file"
        multiple
        accept={acceptForLanguages(project.languages)}
        className="hidden"
        onChange={(e) => { if (e.target.files?.length) handleUploadFiles(null, e.target.files); e.target.value = '' }}
      />
      <input
        ref={uploadFolderInputRef}
        type="file"
        multiple
        className="hidden"
        {...({ webkitdirectory: 'true', directory: 'true' } as Record<string, string>)}
        onChange={(e) => { if (e.target.files?.length) handleUploadFolder(e.target.files); e.target.value = '' }}
      />
      <input
        ref={importZipInputRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) handleImportZip(e.target.files[0]); e.target.value = '' }}
      />

      <header className="glass-panel m-3 sm:m-4 mb-2 flex flex-wrap items-center justify-between gap-y-2 gap-x-3 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
          <Link to="/" className="text-gray-400 hover:text-cyan shrink-0"><ArrowLeft size={18} /></Link>
          <h1 className="font-semibold truncate max-w-[45vw] sm:max-w-none">{project.name}</h1>
          {project.languages.map((l) => (
            <Badge key={l} variant="accent" className="shrink-0">{l}</Badge>
          ))}
          {project.is_private && (
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-magenta shrink-0" title="Private project">
              <Lock size={11} /> Private
            </span>
          )}
          <Button variant="tertiary" onClick={() => setShowDeploy(true)} className="sm:ml-2" title="Deploy">
            <Rocket size={14} /> <span className="hidden sm:inline">Deploy</span>
          </Button>
          <Button variant="tertiary" onClick={() => setShowScanner(true)} className="hover:text-violet" title="Code scanner">
            <ScanSearch size={14} /> <span className="hidden sm:inline">Scan</span>
          </Button>
          <Button
            variant="tertiary"
            onClick={handleDownloadZip}
            disabled={zipping || files.length === 0}
            title="Download whole project as ZIP"
          >
            <FileArchive size={14} /> <span className="hidden sm:inline">{zipping ? 'Zipping…' : 'Download ZIP'}</span>
          </Button>
          <Button
            variant="tertiary"
            onClick={() => importZipInputRef.current?.click()}
            disabled={importingZip}
            className="hover:text-violet"
            title="Import a .zip archive into this project"
          >
            <FileArchive size={14} /> <span className="hidden sm:inline">{importingZip ? 'Importing…' : 'Import ZIP'}</span>
          </Button>
        </div>
        {activeFile && (
          <div className="flex items-center gap-3 shrink-0">
            <Button variant="tertiary" onClick={handleToggleFavorite} className="hover:text-violet px-1.5" title="Toggle favorite">
              <Star size={16} className={activeFile.is_favorite ? 'fill-violet text-violet' : ''} />
            </Button>
            <Button variant="tertiary" onClick={() => setShowHistory(true)} className="px-1.5" title="Version history">
              <History size={16} />
            </Button>
            <Button variant="tertiary" onClick={() => setShowComments((v) => !v)} className="hover:text-violet px-1.5" title="Comments">
              <MessageSquare size={16} />
            </Button>
            <Button variant="tertiary" onClick={handleDeleteFile} className="hover:text-danger px-1.5" title="Delete file">
              <Trash2 size={16} />
            </Button>
          </div>
        )}
      </header>

      <div
        className="flex-1 min-h-0 flex flex-col gap-2 px-3 sm:px-4 pb-4 md:grid"
        style={{ gridTemplateColumns: sidebarVisible ? `${sidebarWidth}px 6px 1fr` : '0px 0px 1fr' }}
      >
        <div className="flex md:hidden glass-panel p-1 gap-1 text-xs shrink-0">
          <button
            type="button"
            onClick={() => setMobilePane('files')}
            className={`flex-1 py-1.5 rounded-lg transition-colors ${mobilePane === 'files' ? 'bg-cyan/15 text-cyan' : 'text-gray-400'}`}
          >
            Files
          </button>
          <button
            type="button"
            onClick={() => setMobilePane('editor')}
            className={`flex-1 py-1.5 rounded-lg transition-colors ${mobilePane === 'editor' ? 'bg-cyan/15 text-cyan' : 'text-gray-400'}`}
          >
            Editor
          </button>
        </div>

        {sidebarVisible && (
          <div className={`min-h-0 ${mobilePane === 'files' ? 'flex-1' : 'hidden'} md:block md:h-full md:min-h-0 md:overflow-hidden`}>
            <FileTree
              folders={folders}
              files={files}
              pdfs={pdfs}
              activeFileId={activeFileId}
              acceptExtensions={acceptForLanguages(project.languages)}
              onSelectFile={openFile}
              onCreateFolder={handleCreateFolder}
              onCreateFile={handleCreateFile}
              onUploadFiles={handleUploadFiles}
              onUploadFolder={handleUploadFolder}
              onUploadPdf={handleUploadPdf}
              onDownloadFile={handleDownloadFile}
              onDownloadPdf={handleDownloadPdf}
              onDeletePdf={setDeletingPdf}
              onRenameFile={handleRenameFile}
              onRenameFolder={handleRenameFolder}
              onDuplicateFile={handleDuplicateFile}
              onMoveFile={handleMoveFile}
              onMoveFolder={handleMoveFolder}
              onDeleteFolder={setDeletingFolder}
            />
          </div>
        )}

        {sidebarVisible && (
          <div
            onMouseDown={startResize}
            className="hidden md:flex items-center justify-center cursor-col-resize text-gray-700 hover:text-cyan/60 transition-colors"
            title="Drag to resize"
          >
            <GripVertical size={12} />
          </div>
        )}

        <div className={`min-h-0 flex flex-col gap-1.5 ${mobilePane === 'editor' ? 'flex-1' : 'hidden'} md:flex md:h-full md:min-h-0`}>
          {openFiles.length > 0 && (
            <div className="flex items-center gap-0.5 overflow-x-auto glass-panel px-1.5 py-1.5 shrink-0">
              {openFiles.map((f) => (
                <div
                  key={f.id}
                  onClick={() => setActiveFileId(f.id)}
                  className={`group flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-lg text-xs cursor-pointer shrink-0 transition-colors ${
                    f.id === activeFileId ? 'bg-cyan/15 text-cyan' : 'text-gray-400 hover:bg-white/5'
                  }`}
                >
                  <span className="truncate max-w-[140px]">{f.name}</span>
                  {dirtyFileIds.has(f.id) && <span className="h-1.5 w-1.5 rounded-full bg-violet shrink-0" title="Unsaved changes" />}
                  <button
                    onClick={(e) => { e.stopPropagation(); closeTab(f.id) }}
                    className="opacity-0 group-hover:opacity-100 hover:text-magenta shrink-0"
                    aria-label={`Close ${f.name}`}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeFile && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 px-1 flex-wrap shrink-0">
              <span>{project.name}</span>
              {breadcrumbSegments.map((seg, i) => (
                <span key={i} className="flex items-center gap-1.5"><ChevronRight size={11} className="shrink-0" /> {seg}</span>
              ))}
              <span className="flex items-center gap-1.5"><ChevronRight size={11} className="shrink-0" /> <span className="text-gray-300">{activeFile.name}</span></span>
            </div>
          )}

          <div className="flex-1 min-h-0">
            {activeFile && user ? (
              <CodeEditor
                key={activeFile.id}
                fileId={activeFile.id}
                initialContent={activeFile.content}
                language={activeFile.language}
                userId={user.id}
                onDirtyChange={(dirty) => {
                  setDirtyFileIds((prev) => {
                    const has = prev.has(activeFile.id)
                    if (dirty === has) return prev
                    const next = new Set(prev)
                    if (dirty) next.add(activeFile.id)
                    else next.delete(activeFile.id)
                    return next
                  })
                  if (dirty && user && !editedThisSessionRef.current.has(activeFile.id)) {
                    editedThisSessionRef.current.add(activeFile.id)
                    void logActivity(user.id, 'edited', 'file', activeFile.id, { name: activeFile.name, project_id: id })
                  }
                }}
              />
            ) : (
              <div className="glass-panel h-full flex flex-col items-center justify-center text-center px-4 gap-2">
                <FileCode2 size={28} className="text-cyan/40" />
                <p className="text-sm text-secondary">Select or create a file to start editing.</p>
              </div>
            )}
          </div>
        </div>
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

      <ConfirmDialog
        open={Boolean(deletingFolder)}
        onClose={() => setDeletingFolder(null)}
        onConfirm={confirmDeleteFolder}
        title={`Move "${deletingFolder?.name}" to recycle bin?`}
        description="Everything inside it moves too. You can restore it later."
        confirmLabel="Move to recycle bin"
        danger
        loading={deleteBusy}
      />

      <ConfirmDialog
        open={Boolean(deletingPdf)}
        onClose={() => setDeletingPdf(null)}
        onConfirm={confirmDeletePdf}
        title={`Delete "${deletingPdf?.name}"?`}
        confirmLabel="Delete"
        danger
        loading={deleteBusy}
      />

      <ConfirmDialog
        open={confirmDeleteFile}
        onClose={() => setConfirmDeleteFile(false)}
        onConfirm={confirmDeleteFileAction}
        title={`Move "${activeFile?.name}" to recycle bin?`}
        confirmLabel="Move to recycle bin"
        danger
        loading={deleteBusy}
      />
    </div>
  )
}
