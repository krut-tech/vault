import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  backTo?: string
  actions?: ReactNode
}

/**
 * Shared page header: back button + title (+ optional subtitle) on the left,
 * primary action area on the right. Standardizes the pattern already used
 * ad hoc in AdminPanel.tsx (ArrowLeft + Link + h2) so every page's header
 * sits in the same place with the same spacing and type scale.
 */
export default function PageHeader({ title, subtitle, backTo, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="flex items-start gap-3 min-w-0">
        {backTo && (
          <Link to={backTo} className="text-gray-400 hover:text-cyan mt-0.5 shrink-0" aria-label="Back">
            <ArrowLeft size={18} />
          </Link>
        )}
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-100 truncate">{title}</h2>
          {subtitle && <p className="text-sm text-secondary mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}
