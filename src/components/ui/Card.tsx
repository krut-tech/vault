import type { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Slightly brighten border + background on hover — for clickable/interactive cards. */
  hover?: boolean
  /** Adds the cyan glow-border treatment. Use sparingly — only for the one thing that matters on a page. */
  accent?: boolean
  /** Removes the default padding, for cards that manage their own internal spacing (e.g. list-style cards with a header row). */
  noPadding?: boolean
}

/**
 * Shared card surface. Wraps .glass-panel (Step 1) so every card in the app — project
 * tiles, stat cards, list panels, settings sections — renders with one consistent
 * background, border, radius and shadow instead of each page repeating the same
 * className string.
 */
export default function Card({ hover = false, accent = false, noPadding = false, className = '', children, ...rest }: CardProps) {
  return (
    <div
      className={`glass-panel ${noPadding ? '' : 'p-4 sm:p-5'} ${accent ? 'glow-border' : ''} ${
        hover ? 'hover:border-white/20 hover:bg-panel/70 transition-colors duration-200 cursor-pointer' : ''
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}
