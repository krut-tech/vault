import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Folder as FolderIcon,
  FolderOpen,
  FileCode2,
  FileText,
  Star,
  Plus,
  Upload,
  FolderUp,
  Download,
  Trash2,
  Pencil,
  Copy,
  FolderInput,
  ChevronRight,
  FolderPlus,
  FilePlus2,
  Inbox,
} from 'lucide-react'
import type { Folder, VaultFile, PdfFile } from '../types/vault'
import { Modal, Select } from './ui'

interface Props {
  folders: Folder[]
  files: VaultFile[]
  pdfs: PdfFile[]
  activeFileId: string | null
  acceptExtensions: string
  onSelectFile: (file: VaultFile) => void
  onCreateFolder: (parentId: string | null) => void
  onCreateFile: (folderId: string | null) => void
  onUploadFiles: (folderId: string | null, fileList: FileList) => void
  onUploadFolder: (fileList: FileList) => void
  onUploadPdf: (folderId: string | null, fileList: FileList) => void
  onDownloadFile: (file: VaultFile) => void
  onDownloadPdf: (pdf: PdfFile) => void
  onDeletePdf: (pdf: PdfFile) => void
  onRenameFile: (file: VaultFile) => void
  onRenameFolder: (folder: Folder) => void
  onDuplicateFile: (file: VaultFile) => void
  onMoveFile: (file: VaultFile, targetFolderId: string | null) => void
  onMoveFolder: (folder: Folder, targetFolderId: string | null) => void
  onDeleteFolder: (folder: Folder) => void
}

type ContextTarget = { kind: 'file'; item: VaultFile } | { kind: 'folder'; item: Folder }
type MoveTarget = ContextTarget

export default function FileTree({
  folders,
  files,
  pdfs,
  activeFileId,
  acceptExtensions,
  onSelectFile,
  onCreateFolder,
  onCreateFile,
  onUploadFiles,
  onUploadFolder,
  onUploadPdf,
  onDownloadFile,
  onDownloadPdf,
  onDeletePdf,
  onRenameFile,
  onRenameFolder,
  onDuplicateFile,
  onMoveFile,
  onMoveFolder,
  onDeleteFolder,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [uploadMenuFor, setUploadMenuFor] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; target: ContextTarget } | null>(null)
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null)
  const rootFolderInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!contextMenu) return
    function close() { setContextMenu(null) }
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [contextMenu])

  const childrenOf = useMemo(() => {
    const map = new Map<string | null, Folder[]>()
    for (const f of folders) {
      const key = f.parent_id
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(f)
    }
    return map
  }, [folders])

  const filesOf = useMemo(() => {
    const map = new Map<string | null, VaultFile[]>()
    for (const f of files) {
      const key = f.folder_id
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(f)
    }
    return map
  }, [files])

  const pdfsOf = useMemo(() => {
    const map = new Map<string | null, PdfFile[]>()
    for (const p of pdfs) {
      const key = p.folder_id
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    }
    return map
  }, [pdfs])

  // Flat, indented list of every folder (for the "Move to…" picker),
  // excluding the folder being moved and anything inside it (can't
  // move a folder into its own descendant).
  const folderOptions = useMemo(() => {
    function descendantIds(id: string): Set<string> {
      const out = new Set<string>([id])
      const queue = [id]
      while (queue.length) {
        const cur = queue.shift()!
        for (const f of folders) {
          if (f.parent_id === cur && !out.has(f.id)) {
            out.add(f.id)
            queue.push(f.id)
          }
        }
      }
      return out
    }
    const excluded = moveTarget?.kind === 'folder' ? descendantIds(moveTarget.item.id) : new Set<string>()

    const options: { id: string; label: string }[] = []
    function walk(parentId: string | null, depth: number) {
      for (const f of childrenOf.get(parentId) ?? []) {
        if (!excluded.has(f.id)) options.push({ id: f.id, label: `${'\u2003'.repeat(depth)}${f.name}` })
        walk(f.id, depth + 1)
      }
    }
    walk(null, 0)
    return options
  }, [childrenOf, folders, moveTarget])

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function openContextMenu(e: React.MouseEvent, target: ContextTarget) {
    e.preventDefault()
    e.stopPropagation()
    const menuWidth = 160
    const menuHeight = target.kind === 'file' ? 148 : 112
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 8)
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 8)
    setContextMenu({ x: Math.max(8, x), y: Math.max(8, y), target })
  }

  function handleContextAction(action: 'rename' | 'duplicate' | 'move' | 'delete') {
    if (!contextMenu) return
    const { target } = contextMenu
    setContextMenu(null)
    if (action === 'rename') {
      if (target.kind === 'file') onRenameFile(target.item)
      else onRenameFolder(target.item)
    } else if (action === 'duplicate' && target.kind === 'file') {
      onDuplicateFile(target.item)
    } else if (action === 'move') {
      setMoveTarget(target)
    } else if (action === 'delete') {
      if (target.kind === 'folder') onDeleteFolder(target.item)
      // File delete is already reachable via the header's delete button
      // when that file is active — the context menu doesn't duplicate it.
    }
  }

  // Dropdown offering "Code file" vs "PDF" upload, used at root and per-folder.
  function renderUploadMenu(key: string, folderId: string | null) {
    const codeInputId = `upload-code-${key}`
    const pdfInputId = `upload-pdf-${key}`
    const open = uploadMenuFor === key

    return (
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setUploadMenuFor(open ? null : key)}
          className="text-muted hover:text-cyan transition-colors duration-150"
          title="Upload file"
        >
          <Upload size={folderId === null ? 14 : 12} />
        </button>
        {open && (
          <div className="absolute z-20 top-full right-0 mt-1 w-32 glass-panel py-1 text-xs motion-safe:animate-[fadeIn_0.15s_ease-out]">
            <label
              htmlFor={codeInputId}
              className="block px-3 py-1.5 hover:bg-white/5 cursor-pointer text-gray-300"
            >
              Code file
            </label>
            <label
              htmlFor={pdfInputId}
              className="block px-3 py-1.5 hover:bg-white/5 cursor-pointer text-gray-300"
            >
              PDF
            </label>
            <input
              id={codeInputId}
              type="file"
              multiple
              accept={acceptExtensions}
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) onUploadFiles(folderId, e.target.files)
                e.target.value = ''
                setUploadMenuFor(null)
              }}
            />
            <input
              id={pdfInputId}
              type="file"
              multiple
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) onUploadPdf(folderId, e.target.files)
                e.target.value = ''
                setUploadMenuFor(null)
              }}
            />
          </div>
        )}
      </div>
    )
  }

  function renderFolder(folder: Folder, depth: number) {
    const isOpen = expanded.has(folder.id)
    const subFolders = childrenOf.get(folder.id) ?? []
    const subFiles = filesOf.get(folder.id) ?? []
    const subPdfs = pdfsOf.get(folder.id) ?? []

    return (
      <div key={folder.id}>
        <div
          className="group flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer text-sm transition-colors duration-150"
          style={{ paddingLeft: depth * 14 + 4 }}
          onClick={() => toggle(folder.id)}
          onContextMenu={(e) => openContextMenu(e, { kind: 'folder', item: folder })}
        >
          <ChevronRight
            size={12}
            className={`shrink-0 text-muted transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
          />
          {isOpen ? <FolderOpen size={15} className="text-cyan shrink-0" /> : <FolderIcon size={15} className="text-cyan/70 shrink-0" />}
          <span className="truncate flex-1">{folder.name}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onCreateFile(folder.id) }}
            className="opacity-0 group-hover:opacity-100 text-muted hover:text-cyan transition-colors duration-150"
            aria-label={`New file in ${folder.name}`}
            title="New file"
          >
            <Plus size={13} />
          </button>
          <div className="opacity-0 group-hover:opacity-100">
            {renderUploadMenu(folder.id, folder.id)}
          </div>
        </div>
        {isOpen && (
          <div>
            {subFolders.map((f) => renderFolder(f, depth + 1))}
            {subFiles.map((file) => renderFile(file, depth + 1))}
            {subPdfs.map((pdf) => renderPdf(pdf, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  function renderFile(file: VaultFile, depth: number) {
    const active = file.id === activeFileId
    return (
      <div
        key={file.id}
        onContextMenu={(e) => openContextMenu(e, { kind: 'file', item: file })}
        className={`group flex items-center gap-1.5 pr-2 py-1.5 rounded-lg text-sm transition-colors duration-150 border-l-2 ${
          active ? 'bg-cyan/10 text-cyan border-cyan' : 'text-gray-300 border-transparent hover:bg-white/5'
        }`}
        style={{ paddingLeft: depth * 14 + 16 }}
      >
        <button onClick={() => onSelectFile(file)} className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
          <FileCode2 size={14} className={`shrink-0 ${active ? 'opacity-100' : 'opacity-60'}`} />
          <span className="truncate flex-1">{file.name}</span>
          {file.is_favorite && <Star size={12} className="text-violet fill-violet shrink-0" />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDownloadFile(file) }}
          className="opacity-0 group-hover:opacity-100 text-muted hover:text-cyan shrink-0 transition-colors duration-150"
          title="Download file"
        >
          <Download size={13} />
        </button>
      </div>
    )
  }

  function renderPdf(pdf: PdfFile, depth: number) {
    return (
      <div
        key={pdf.id}
        className="group flex items-center gap-1.5 pr-2 py-1.5 rounded-lg text-sm hover:bg-white/5 transition-colors duration-150 text-gray-300 border-l-2 border-transparent"
        style={{ paddingLeft: depth * 14 + 16 }}
      >
        <button onClick={() => onDownloadPdf(pdf)} className="flex items-center gap-1.5 flex-1 min-w-0 text-left" title="Open PDF">
          <FileText size={14} className="shrink-0 opacity-70 text-magenta" />
          <span className="truncate flex-1">{pdf.name}</span>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDownloadPdf(pdf) }}
          className="opacity-0 group-hover:opacity-100 text-muted hover:text-cyan shrink-0 transition-colors duration-150"
          title="Download PDF"
        >
          <Download size={13} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDeletePdf(pdf) }}
          className="opacity-0 group-hover:opacity-100 text-muted hover:text-danger shrink-0 transition-colors duration-150"
          title="Delete PDF"
        >
          <Trash2 size={13} />
        </button>
      </div>
    )
  }

  const rootFolders = childrenOf.get(null) ?? []
  const rootFiles = filesOf.get(null) ?? []
  const rootPdfs = pdfsOf.get(null) ?? []
  const isEmpty = rootFolders.length === 0 && rootFiles.length === 0 && rootPdfs.length === 0

  return (
    <div className="glass-panel h-full overflow-y-auto p-2 relative">
      <div className="flex items-center justify-between px-2 py-1.5 mb-1 flex-wrap gap-y-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">Explorer</span>
        <div className="flex gap-3 items-center">
          <button
            onClick={() => onCreateFolder(null)}
            className="flex items-center gap-1 text-muted hover:text-cyan text-xs transition-colors duration-150"
            title="New folder"
          >
            <FolderPlus size={13} /> <span className="hidden sm:inline">Folder</span>
          </button>
          <button
            onClick={() => onCreateFile(null)}
            className="flex items-center gap-1 text-muted hover:text-violet text-xs transition-colors duration-150"
            title="New file"
          >
            <FilePlus2 size={13} /> <span className="hidden sm:inline">File</span>
          </button>
          {renderUploadMenu('root', null)}
          <button
            onClick={() => rootFolderInputRef.current?.click()}
            className="text-muted hover:text-violet transition-colors duration-150"
            title="Upload folder"
          >
            <FolderUp size={14} />
          </button>
          <input
            ref={rootFolderInputRef}
            type="file"
            multiple
            className="hidden"
            {...({ webkitdirectory: 'true', directory: 'true' } as Record<string, string>)}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) onUploadFolder(e.target.files)
              e.target.value = ''
            }}
          />
        </div>
      </div>
      {rootFolders.map((f) => renderFolder(f, 0))}
      {rootFiles.map((f) => renderFile(f, 0))}
      {rootPdfs.map((p) => renderPdf(p, 0))}
      {isEmpty && (
        <div className="flex flex-col items-center text-center px-4 py-8 gap-2">
          <Inbox size={22} className="text-muted" />
          <p className="text-xs text-secondary">Empty. Create a folder/file, or upload from your computer.</p>
        </div>
      )}

      {contextMenu && (
        <div
          className="fixed z-50 w-40 glass-panel py-1 text-sm motion-safe:animate-[fadeIn_0.15s_ease-out]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={() => handleContextAction('rename')} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 text-left text-gray-300 transition-colors duration-150">
            <Pencil size={13} /> Rename
          </button>
          {contextMenu.target.kind === 'file' && (
            <button onClick={() => handleContextAction('duplicate')} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 text-left text-gray-300 transition-colors duration-150">
              <Copy size={13} /> Duplicate
            </button>
          )}
          <button onClick={() => handleContextAction('move')} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 text-left text-gray-300 transition-colors duration-150">
            <FolderInput size={13} /> Move to…
          </button>
          <button onClick={() => handleContextAction('delete')} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 text-left text-danger transition-colors duration-150">
            <Trash2 size={13} /> Delete
          </button>
        </div>
      )}

      <Modal open={Boolean(moveTarget)} onClose={() => setMoveTarget(null)} title={`Move "${moveTarget?.item.name}" to…`} size="sm">
        <Select
          defaultValue=""
          autoFocus
          onChange={(e) => {
            if (!moveTarget) return
            const value = e.target.value === '__root__' ? null : e.target.value
            if (moveTarget.kind === 'file') onMoveFile(moveTarget.item, value)
            else onMoveFolder(moveTarget.item, value)
            setMoveTarget(null)
          }}
        >
          <option value="" disabled>Choose a destination…</option>
          <option value="__root__">Root (no folder)</option>
          {folderOptions.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </Select>
      </Modal>
    </div>
  )
}
