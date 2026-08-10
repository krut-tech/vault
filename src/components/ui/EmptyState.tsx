import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}

/**
 * Shared empty state: icon, title, short description, optional primary action.
 * Replaces the one-line "No X yet." text currently used across Monitors, Kanban,
 * Notes, Recycle Bin, etc. — same structure everywhere so no page's empty state
 * looks more finished than another's.
 */
export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="glass-panel p-10 sm:p-14 text-center">
      <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
        <Icon size={22} className="text-cyan/70" />
      </div>
      <p className="text-sm font-medium text-gray-200">{title}</p>
      {description && <p className="text-sm text-secondary mt-1.5 max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
