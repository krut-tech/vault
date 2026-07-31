import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, RotateCcw, Trash2, FolderGit2, Folder as FolderIcon, FileCode2 } from 'lucide-react'
import { listTrash, restoreItem, permanentlyDelete, type TrashedItem } from '../lib/api/trash'

const ICONS = { project: FolderGit2, folder: FolderIcon, file: FileCode2 }

export default function RecycleBin() {
  const [items, setItems] = useState<TrashedItem[]>([])
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)
    try {
      setItems(await listTrash())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  async function handleRestore(item: TrashedItem) {
    await restoreItem(item)
    setItems((prev) => prev.filter((i) => !(i.type === item.type && i.id === item.id)))
  }

  async function handlePurge(item: TrashedItem) {
    if (!window.confirm(`Permanently delete "${item.name}"? This cannot be undone.`)) return
    await permanentlyDelete(item)
    setItems((prev) => prev.filter((i) => !(i.type === item.type && i.id === item.id)))
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/" className="text-gray-400 hover:text-cyan"><ArrowLeft size={18} /></Link>
        <h2 className="text-lg font-semibold">Recycle bin</h2>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {!loading && items.length === 0 && <div className="glass-panel p-8 text-center text-gray-500 text-sm">Recycle bin is empty.</div>}

      <div className="glass-panel divide-y divide-white/5">
        {items.map((item) => {
          const Icon = ICONS[item.type]
          return (
            <div key={`${item.type}-${item.id}`} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <Icon size={16} className="text-gray-500 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-sm">{item.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{item.type}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button onClick={() => handleRestore(item)} className="text-gray-400 hover:text-cyan flex items-center gap-1 text-xs" title="Restore">
                  <RotateCcw size={14} /> Restore
                </button>
                <button onClick={() => handlePurge(item)} className="text-gray-400 hover:text-magenta flex items-center gap-1 text-xs" title="Delete permanently">
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
