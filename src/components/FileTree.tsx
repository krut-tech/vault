import { useMemo, useRef, useState } from 'react'
import { Folder as FolderIcon, FolderOpen, FileCode2, FileText, Star, Plus, Upload, FolderUp, Download, Trash2 } from 'lucide-react'
import type { Folder, VaultFile, PdfFile } from '../types/vault'

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
}

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
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [uploadMenuFor, setUploadMenuFor] = useState<string | null>(null)
  const rootFolderInputRef = useRef<HTMLInputElement>(null)

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

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
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
          className="text-gray-500 hover:text-cyan"
          title="Upload file"
        >
          <Upload size={folderId === null ? 14 : 12} />
        </button>
        {open && (
          <div className="absolute z-20 top-full right-0 mt-1 w-32 glass-panel py-1 text-xs shadow-lg">
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
          className="group flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer text-sm"
          style={{ paddingLeft: depth * 14 + 8 }}
          onClick={() => toggle(folder.id)}
        >
          {isOpen ? <FolderOpen size={15} className="text-cyan shrink-0" /> : <FolderIcon size={15} className="text-cyan/70 shrink-0" />}
          <span className="truncate flex-1">{folder.name}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onCreateFile(folder.id) }}
            className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-cyan"
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
        className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm hover:bg-white/5 transition-colors ${
          active ? 'bg-cyan/10 text-cyan' : 'text-gray-300'
        }`}
        style={{ paddingLeft: depth * 14 + 8 }}
      >
        <button onClick={() => onSelectFile(file)} className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
          <FileCode2 size={14} className="shrink-0 opacity-70" />
          <span className="truncate flex-1">{file.name}</span>
          {file.is_favorite && <Star size={12} className="text-violet fill-violet shrink-0" />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDownloadFile(file) }}
          className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-cyan shrink-0"
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
        className="group flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm hover:bg-white/5 transition-colors text-gray-300"
        style={{ paddingLeft: depth * 14 + 8 }}
      >
        <button onClick={() => onDownloadPdf(pdf)} className="flex items-center gap-1.5 flex-1 min-w-0 text-left" title="Open PDF">
          <FileText size={14} className="shrink-0 opacity-70 text-magenta" />
          <span className="truncate flex-1">{pdf.name}</span>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDownloadPdf(pdf) }}
          className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-cyan shrink-0"
          title="Download PDF"
        >
          <Download size={13} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDeletePdf(pdf) }}
          className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-magenta shrink-0"
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

  return (
    <div className="glass-panel h-full overflow-y-auto p-2">
      <div className="flex items-center justify-between px-2 py-1.5 mb-1 flex-wrap gap-y-1">
        <span className="text-xs uppercase tracking-wide text-gray-500">Explorer</span>
        <div className="flex gap-2.5 items-center">
          <button onClick={() => onCreateFolder(null)} className="text-gray-500 hover:text-cyan text-xs" title="New folder">+ Folder</button>
          <button onClick={() => onCreateFile(null)} className="text-gray-500 hover:text-violet text-xs" title="New file">+ File</button>
          {renderUploadMenu('root', null)}
          <button onClick={() => rootFolderInputRef.current?.click()} className="text-gray-500 hover:text-violet" title="Upload folder">
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
      {rootFolders.length === 0 && rootFiles.length === 0 && rootPdfs.length === 0 && (
        <p className="px-2 py-4 text-xs text-gray-500">Empty. Create a folder/file, or upload from your computer.</p>
      )}
    </div>
  )
}
