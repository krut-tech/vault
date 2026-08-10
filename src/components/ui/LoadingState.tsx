import { Loader2 } from 'lucide-react'

interface LoadingStateProps {
  label?: string
  /** Fills available vertical space and centers — for a whole page/panel still loading. */
  fullHeight?: boolean
}

/**
 * Shared loading indicator, replacing scattered `<p className="text-sm text-gray-500">Loading…</p>`
 * strings with one consistent spinner + label treatment.
 */
export default function LoadingState({ label = 'Loading…', fullHeight = false }: LoadingStateProps) {
  return (
    <div className={`flex items-center justify-center gap-2 text-sm text-secondary ${fullHeight ? 'py-20' : 'py-6'}`}>
      <Loader2 size={15} className="animate-spin text-cyan/70" />
      {label}
    </div>
  )
}
