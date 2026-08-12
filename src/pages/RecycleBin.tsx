import { useEffect, useState } from 'react'
import { RotateCcw, Trash2, FolderGit2, Folder as FolderIcon, FileCode2, Inbox } from 'lucide-react'
import { listTrash, restoreItem, permanentlyDelete, type TrashedItem } from '../lib/api/trash'
import { Badge, Button, ConfirmDialog, EmptyState, LoadingState, PageHeader } from '../components/ui'
import type { BadgeVariant } from '../components/ui'

const ICONS = { project: FolderGit2, folder: FolderIcon, file: FileCode2 }
const TYPE_BADGE: Record<TrashedItem['type'], BadgeVariant> = { project: 'accent', folder: 'default', file: 'default' }

export default function RecycleBin() {
  const [items, setItems] = useState<TrashedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [restoringKey, setRestoringKey] = useState<string | null>(null)
  const [deletingItem, setDeletingItem] = useState<TrashedItem | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

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
    const key = `${item.type}-${item.id}`
    setRestoringKey(key)
    try {
      await restoreItem(item)
      setItems((prev) => prev.filter((i) => !(i.type === item.type && i.id === item.id)))
    } finally {
      setRestoringKey(null)
    }
  }

  async function confirmPurge() {
    if (!deletingItem) return
    setDeleteLoading(true)
    try {
      await permanentlyDelete(deletingItem)
      setItems((prev) => prev.filter((i) => !(i.type === deletingItem.type && i.id === deletingItem.id)))
      setDeletingItem(null)
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="p-3 sm:p-6 max-w-4xl mx-auto space-y-6">
      <PageHeader title="Recycle bin" backTo="/" subtitle="Deleted projects, folders, and files. Restore them or remove them for good." />

      {loading && <LoadingState label="Loading recycle bin…" />}

      {!loading && items.length === 0 && (
        <EmptyState icon={Inbox} title="Recycle bin is empty" description="Anything you delete shows up here until you restore it or remove it permanently." />
      )}

      {!loading && items.length > 0 && (
        <div className="glass-panel divide-y divide-white/5">
          {items.map((item) => {
            const Icon = ICONS[item.type]
            const key = `${item.type}-${item.id}`
            return (
              <div key={key} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Icon size={16} className="text-muted shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-gray-200">{item.name}</p>
                    <Badge variant={TYPE_BADGE[item.type]} className="mt-1">{item.type}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleRestore(item)}
                    loading={restoringKey === key}
                    aria-label={`Restore ${item.name}`}
                  >
                    <RotateCcw size={13} /> Restore
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setDeletingItem(item)}
                    aria-label={`Permanently delete ${item.name}`}
                  >
                    <Trash2 size={13} /> Delete
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deletingItem)}
        onClose={() => setDeletingItem(null)}
        onConfirm={confirmPurge}
        title={`Permanently delete "${deletingItem?.name}"?`}
        description="This cannot be undone."
        confirmLabel="Delete permanently"
        danger
        loading={deleteLoading}
      />
    </div>
  )
}
