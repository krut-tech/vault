import { useEffect, useState } from 'react'
import { ScanSearch, X, KeyRound, MessageSquareWarning, FileWarning } from 'lucide-react'
import { scanProject, type ScanFinding } from '../lib/api/scanner'

const ICONS = { secret: KeyRound, todo: MessageSquareWarning, 'large-file': FileWarning }
const COLORS = { secret: 'text-magenta', todo: 'text-violet', 'large-file': 'text-yellow-400' }

export default function CodeScanner({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [findings, setFindings] = useState<ScanFinding[] | null>(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  async function runScan() {
    setScanning(true)
    setError(null)
    try {
      setFindings(await scanProject(projectId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed — please try again')
    } finally {
      setScanning(false)
    }
  }

  const secretCount = findings?.filter((f) => f.type === 'secret').length ?? 0
  const todoCount = findings?.filter((f) => f.type === 'todo').length ?? 0
  const largeFileCount = findings?.filter((f) => f.type === 'large-file').length ?? 0

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-panel glow-border w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <h2 className="font-semibold text-sm flex items-center gap-1.5"><ScanSearch size={15} /> Code scanner</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-danger" aria-label="Close code scanner"><X size={16} /></button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {error && (
            <div className="glass-panel border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger flex items-center justify-between gap-3">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-danger/70 hover:text-danger shrink-0">Dismiss</button>
            </div>
          )}

          {!findings && (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400 mb-4">Scans this project's files for exposed secrets, TODO/FIXME markers, and unusually large files.</p>
              <button onClick={runScan} disabled={scanning} className="btn-primary text-sm">{scanning ? 'Scanning…' : 'Run scan'}</button>
            </div>
          )}

          {findings && (
            <>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="glass-panel p-2 sm:p-3 text-center">
                  <p className="text-lg sm:text-xl font-bold text-magenta">{secretCount}</p>
                  <p className="text-[9px] sm:text-[10px] text-gray-500 uppercase">Possible secrets</p>
                </div>
                <div className="glass-panel p-2 sm:p-3 text-center">
                  <p className="text-lg sm:text-xl font-bold text-violet">{todoCount}</p>
                  <p className="text-[9px] sm:text-[10px] text-gray-500 uppercase">TODOs</p>
                </div>
                <div className="glass-panel p-2 sm:p-3 text-center">
                  <p className="text-lg sm:text-xl font-bold text-yellow-400">{largeFileCount}</p>
                  <p className="text-[9px] sm:text-[10px] text-gray-500 uppercase">Large files</p>
                </div>
              </div>

              {findings.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No findings — looks clean.</p>}

              <div className="space-y-2">
                {findings.map((f, idx) => {
                  const Icon = ICONS[f.type]
                  return (
                    <div key={idx} className="glass-panel px-3 py-2 flex items-start gap-2.5 text-sm">
                      <Icon size={14} className={`${COLORS[f.type]} shrink-0 mt-0.5`} />
                      <div className="min-w-0">
                        <p className="truncate">
                          <span className="text-gray-300">{f.fileName}</span>
                          {f.line && <span className="text-gray-600"> :{f.line}</span>}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{f.detail}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              <button onClick={runScan} className="text-xs text-cyan hover:underline">Re-scan</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
