import { useMemo, useState } from 'react'
import { Folder as FolderIcon, FolderOpen, FileCode2, Star, Plus } from 'lucide-react'
import type { Folder, VaultFile } from '../types/vault'

interface Props {
  folders: Folder[]
  files: VaultFile[]
  activeFileId: string | null
  onSelectFile: (file: VaultFile) => void
  onCreateFolder: (parentId: string | null) => void
  onCreateFile: (folderId: string | null) => void
}

export default function FileTree({ folders, files, activeFileId, onSelectFile, onCreateFolder, onCreateFile }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

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

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function renderFolder(folder: Folder, depth: number) {
    const isOpen = expanded.has(folder.id)
    const subFolders = childrenOf.get(folder.id) ?? []
    const subFiles = filesOf.get(folder.id) ?? []

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
          >
            <Plus size={13} />
          </button>
        </div>
        {isOpen && (
          <div>
            {subFolders.map((f) => renderFolder(f, depth + 1))}
            {subFiles.map((file) => renderFile(file, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  function renderFile(file: VaultFile, depth: number) {
    const active = file.id === activeFileId
    return (
      <button
        key={file.id}
        onClick={() => onSelectFile(file)}
        className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm text-left hover:bg-white/5 transition-colors ${
          active ? 'bg-cyan/10 text-cyan' : 'text-gray-300'
        }`}
        style={{ paddingLeft: depth * 14 + 8 }}
      >
        <FileCode2 size={14} className="shrink-0 opacity-70" />
        <span className="truncate flex-1">{file.name}</span>
        {file.is_favorite && <Star size={12} className="text-violet fill-violet shrink-0" />}
      </button>
    )
  }

  const rootFolders = childrenOf.get(null) ?? []
  const rootFiles = filesOf.get(null) ?? []

  return (
    <div className="glass-panel h-full overflow-y-auto p-2">
      <div className="flex items-center justify-between px-2 py-1.5 mb-1">
        <span className="text-xs uppercase tracking-wide text-gray-500">Explorer</span>
        <div className="flex gap-2">
          <button onClick={() => onCreateFolder(null)} className="text-gray-500 hover:text-cyan text-xs" title="New folder">+ Folder</button>
          <button onClick={() => onCreateFile(null)} className="text-gray-500 hover:text-violet text-xs" title="New file">+ File</button>
        </div>
      </div>
      {rootFolders.map((f) => renderFolder(f, 0))}
      {rootFiles.map((f) => renderFile(f, 0))}
      {rootFolders.length === 0 && rootFiles.length === 0 && (
        <p className="px-2 py-4 text-xs text-gray-500">Empty. Create a folder or file to get started.</p>
      )}
    </div>
  )
}
