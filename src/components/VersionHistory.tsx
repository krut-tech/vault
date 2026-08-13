import { useEffect, useState } from 'react'
import { listVersions, restoreVersion } from '../lib/api/files'
import type { FileVersion } from '../types/vault'
import { diffLines } from '../lib/diff'
import { formatDistanceToNow } from 'date-fns'
import { ConfirmDialog } from './ui'

interface Props {
  fileId: string
  currentContent: string
  userId: string
  onRestored: (content: string) => void
  onClose: () => void
}

export default function VersionHistory({ fileId, currentContent, userId, onRestored, onClose }: Props) {
  const [versions, setVersions] = useState<FileVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<FileVersion | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [confirmingRestore, setConfirmingRestore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listVersions(fileId)
      .then((v) => { if (!cancelled) setVersions(v) })
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [fileId])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Let the confirm dialog own Escape while it's open — closing the
      // whole panel out from under an open confirmation would be confusing.
      if (e.key === 'Escape' && !confirmingRestore) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, confirmingRestore])

  async function handleRestore() {
    if (!selected) return
    setRestoring(true)
    setError(null)
    try {
      await restoreVersion(fileId, selected.content, userId)
      onRestored(selected.content)
      setConfirmingRestore(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore this version')
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-panel glow-border w-full max-w-4xl max-h-[90vh] sm:max-h-[85vh] flex flex-col sm:flex-row overflow-hidden">
        <div className="sm:w-64 max-h-40 sm:max-h-none shrink-0 border-b sm:border-b-0 sm:border-r border-white/10 overflow-y-auto">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <h2 className="font-semibold text-sm">Version history</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-danger text-sm" aria-label="Close">✕</button>
          </div>
          {loading && <p className="p-4 text-sm text-gray-500">Loading…</p>}
          {!loading && versions.length === 0 && <p className="p-4 text-sm text-gray-500">No saved versions yet.</p>}
          <ul>
            {versions.map((v) => (
              <li key={v.id}>
                <button
                  onClick={() => setSelected(v)}
                  className={`w-full text-left px-4 py-3 text-xs border-b border-white/5 hover:bg-white/5 transition-colors ${
                    selected?.id === v.id ? 'bg-cyan/10 text-cyan' : 'text-gray-300'
                  }`}
                >
                  {formatDistanceToNow(new Date(v.created_at), { addSuffix: true })}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex-1 min-w-0 overflow-y-auto p-4">
          {!selected && <p className="text-sm text-gray-500">Select a version to compare against current content.</p>}
          {selected && (
            <div className="space-y-3">
              {error && (
                <div className="glass-panel border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger flex items-center justify-between gap-3">
                  <span>{error}</span>
                  <button onClick={() => setError(null)} className="text-danger/70 hover:text-danger shrink-0">Dismiss</button>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium">
                  Comparing to {formatDistanceToNow(new Date(selected.created_at), { addSuffix: true })}
                </h3>
                <button onClick={() => setConfirmingRestore(true)} className="btn-primary text-xs px-3 py-1.5 shrink-0">
                  Restore this version
                </button>
              </div>
              <pre className="font-mono text-xs leading-5 bg-abyss/80 rounded-lg p-3 overflow-x-auto">
                {diffLines(currentContent, selected.content).map((line, idx) => (
                  <div
                    key={idx}
                    className={
                      line.type === 'added' ? 'bg-cyan/10 text-cyan' :
                      line.type === 'removed' ? 'bg-danger/10 text-danger line-through decoration-danger/40' :
                      'text-gray-400'
                    }
                  >
                    {line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  '}
                    {line.text || ' '}
                  </div>
                ))}
              </pre>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmingRestore}
        onClose={() => setConfirmingRestore(false)}
        onConfirm={handleRestore}
        title="Restore this version?"
        description="This replaces the file's current content in the editor. The current content stays in version history too, so this can be undone."
        confirmLabel="Restore"
        loading={restoring}
      />
    </div>
  )
}
