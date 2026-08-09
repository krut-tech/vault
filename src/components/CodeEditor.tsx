import { useCallback, useEffect, useRef, useState } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import { Play, Terminal } from 'lucide-react'
import { useDebouncedCallback } from '../lib/useDebouncedCallback'
import { saveFileContent } from '../lib/api/files'
import { runCode, isExecutable, type RunResult } from '../lib/api/execute'
import { useWorkspaceStore } from '../store/workspaceStore'
import RunOutputPanel from './RunOutputPanel'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface Props {
  fileId: string
  initialContent: string
  language: string
  userId: string
  onSaved?: () => void
  onDirtyChange?: (dirty: boolean) => void
}

export default function CodeEditor({ fileId, initialContent, language, userId, onSaved, onDirtyChange }: Props) {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<RunResult | null>(null)
  const [showStdin, setShowStdin] = useState(false)
  const [stdin, setStdin] = useState('')
  const contentRef = useRef(initialContent)
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)
  const showOutput = useWorkspaceStore((s) => s.terminalVisible)
  const setTerminalVisible = useWorkspaceStore((s) => s.setTerminalVisible)
  const registerCommands = useWorkspaceStore((s) => s.registerCommands)
  const unregisterCommands = useWorkspaceStore((s) => s.unregisterCommands)

  const persist = useCallback(
    async (value: string) => {
      setStatus('saving')
      onDirtyChange?.(true)
      try {
        await saveFileContent(fileId, value, userId)
        setStatus('saved')
        onDirtyChange?.(false)
        onSaved?.()
      } catch {
        setStatus('error')
      }
    },
    [fileId, userId, onSaved, onDirtyChange],
  )

  const debouncedSave = useDebouncedCallback(persist, 1200)

  async function handleRun() {
    setTerminalVisible(true)
    setRunning(true)
    const result = await runCode(language, contentRef.current, stdin)
    setRunResult(result)
    setRunning(false)
  }

  function handleFormat() {
    editorRef.current?.getAction('editor.action.formatDocument')?.run()
  }

  // Registers this file's run/format/terminal-toggle so the global
  // Command Palette (mounted elsewhere, has no idea an editor is even
  // open) can trigger them. Re-registers whenever the runnability or
  // active file changes so "Run Code" always targets whichever file is
  // actually open right now.
  useEffect(() => {
    registerCommands({
      runCurrentFile: isExecutable(language) ? handleRun : undefined,
      formatCurrentFile: handleFormat,
      toggleTerminal: () => setTerminalVisible(!showOutput),
    })
    return () => unregisterCommands(['runCurrentFile', 'formatCurrentFile', 'toggleTerminal'])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId, language, showOutput])

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    editor.updateOptions({ fontLigatures: true, fontSize: 14, minimap: { enabled: true } })
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      persist(contentRef.current)
    })
  }

  function handleChange(value: string | undefined) {
    const v = value ?? ''
    contentRef.current = v
    setStatus('idle')
    onDirtyChange?.(true)
    debouncedSave(v)
  }

  return (
    <div className="glass-panel overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 text-xs">
        <span className="text-gray-400 uppercase tracking-wide">{language}</span>
        <div className="flex items-center gap-3">
          {isExecutable(language) && (
            <>
              <button
                onClick={() => setShowStdin((v) => !v)}
                className={`flex items-center gap-1 hover:text-violet/80 ${showStdin ? 'text-violet' : 'text-gray-400'}`}
                title="Program input (stdin)"
              >
                <Terminal size={13} /> Input
              </button>
              <button onClick={handleRun} disabled={running} className="flex items-center gap-1 text-cyan hover:text-cyan/80 disabled:opacity-50" title="Run code (or Ctrl/Cmd+K then Run Code)">
                <Play size={13} /> Run
              </button>
            </>
          )}
          <SaveIndicator status={status} />
        </div>
      </div>
      {showStdin && isExecutable(language) && (
        <div className="border-b border-white/10 px-4 py-2 bg-black/20">
          <label className="text-[10px] uppercase tracking-wide text-gray-500 mb-1 block">
            Stdin — one value per line, fed to input() / cin / Scanner in order
          </label>
          <textarea
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            placeholder={'e.g.\n1\nHello'}
            rows={3}
            className="w-full bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-xs font-mono text-gray-200 focus:outline-none focus:border-cyan/50 resize-y"
          />
        </div>
      )}
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
      {showOutput && <RunOutputPanel running={running} result={runResult} onClose={() => setTerminalVisible(false)} />}
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
