interface Props {
  running: boolean
  result: { stdout: string; stderr: string; compileOutput: string | null; exitCode: number | null; error?: string } | null
  onClose: () => void
}

export default function RunOutputPanel({ running, result, onClose }: Props) {
  return (
    <div className="glass-panel border-t-2 border-t-cyan/40 h-48 flex flex-col mt-2">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
        <span className="text-xs uppercase tracking-wide text-gray-400">Output</span>
        <button onClick={onClose} className="text-gray-500 hover:text-magenta text-xs" aria-label="Close output">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
        {running && <p className="text-violet animate-pulse">Executing…</p>}
        {!running && result?.error && <p className="text-magenta">{result.error}</p>}
        {!running && result && !result.error && (
          <>
            {result.compileOutput && <pre className="text-yellow-400 whitespace-pre-wrap mb-2">{result.compileOutput}</pre>}
            {result.stdout && <pre className="text-gray-200 whitespace-pre-wrap">{result.stdout}</pre>}
            {result.stderr && <pre className="text-magenta whitespace-pre-wrap mt-2">{result.stderr}</pre>}
            {!result.stdout && !result.stderr && !result.compileOutput && <p className="text-gray-500">Program produced no output.</p>}
            {result.exitCode !== null && result.exitCode !== 0 && <p className="text-gray-500 mt-2">Exit code: {result.exitCode}</p>}
          </>
        )}
      </div>
    </div>
  )
}
