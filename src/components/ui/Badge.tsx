import type { HTMLAttributes } from 'react'

export type BadgeVariant = 'default' | 'accent' | 'success' | 'warning' | 'danger'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const variantClass: Record<BadgeVariant, string> = {
  default: 'bg-white/5 text-gray-400 border-white/10',
  accent: 'bg-violet/15 text-violet border-violet/20',
  success: 'bg-success/15 text-success border-success/20',
  warning: 'bg-warning/15 text-warning border-warning/20',
  danger: 'bg-danger/15 text-danger border-danger/20',
}

/**
 * Small pill label — for language tags, status labels, role labels, counts.
 * Replaces one-off `text-[10px] uppercase ... rounded-full` strings repeated
 * across Projects.tsx, AdminPanel.tsx, etc.
 */
export default function Badge({ variant = 'default', className = '', children, ...rest }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full border ${variantClass[variant]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  )
}
