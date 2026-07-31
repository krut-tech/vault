import { useCallback, useRef, useState } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import { Play } from 'lucide-react'
import { useDebouncedCallback } from '../lib/useDebouncedCallback'
import { saveFileContent } from '../lib/api/files'
import { runCode, isExecutable, type RunResult } from '../lib/api/execute'
import RunOutputPanel from './RunOutputPanel'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface Props {
  fileId: string
  initialContent: string
  language: string
  userId: string
  onSaved?: () => void
}

export default function CodeEditor({ fileId, initialContent, language, userId, onSaved }: Props) {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<RunResult | null>(null)
  const [showOutput, setShowOutput] = useState(false)
  const contentRef = useRef(initialContent)

  const persist = useCallback(
    async (value: string) => {
      setStatus('saving')
      try {
        await saveFileContent(fileId, value, userId)
        setStatus('saved')
        onSaved?.()
      } catch {
        setStatus('error')
      }
    },
    [fileId, userId, onSaved],
  )

  const debouncedSave = useDebouncedCallback(persist, 1200)

  const handleMount: OnMount = (editor) => {
    editor.updateOptions({ fontLigatures: true, fontSize: 14, minimap: { enabled: true } })
  }

  function handleChange(value: string | undefined) {
    const v = value ?? ''
    contentRef.current = v
    setStatus('idle')
    debouncedSave(v)
  }

  async function handleRun() {
    setShowOutput(true)
    setRunning(true)
    const result = await runCode(language, contentRef.current)
    setRunResult(result)
    setRunning(false)
  }

  return (
    <div className="glass-panel overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 text-xs">
        <span className="text-gray-400 uppercase tracking-wide">{language}</span>
        <div className="flex items-center gap-3">
          {isExecutable(language) && (
            <button onClick={handleRun} disabled={running} className="flex items-center gap-1 text-cyan hover:text-cyan/80 disabled:opacity-50" title="Run code">
              <Play size={13} /> Run
            </button>
          )}
          <SaveIndicator status={status} />
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          theme="vs-dark"
          language={language}
          defaultValue={initialContent}
          onMount={handleMount}
          onChange={handleChange}
          options={{
            fontFamily: "'JetBrains Mono', monospace",
            automaticLayout: true,
            padding: { top: 12 },
            scrollBeyondLastLine: false,
          }}
        />
      </div>
      {showOutput && <RunOutputPanel running={running} result={runResult} onClose={() => setShowOutput(false)} />}
    </div>
  )
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  const map: Record<SaveStatus, { label: string; className: string }> = {
    idle: { label: 'Editing…', className: 'text-gray-500' },
    saving: { label: 'Saving…', className: 'text-violet animate-pulse' },
    saved: { label: 'Saved', className: 'text-cyan' },
    error: { label: 'Save failed', className: 'text-magenta' },
  }
  const { label, className } = map[status]
  return <span className={className}>{label}</span>
}
