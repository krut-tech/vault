import { useEffect, useRef, useState, type ReactNode } from 'react'

export interface DropdownItem {
  label: string
  onClick: () => void
  icon?: ReactNode
  danger?: boolean
  disabled?: boolean
}

interface DropdownProps {
  trigger: ReactNode
  items: DropdownItem[]
  align?: 'left' | 'right'
}

/**
 * Lightweight dropdown menu — no external dependency, closes on outside click,
 * Escape, or item selection. For things like a card's "..." context menu
 * (rename / duplicate / move / delete) that currently don't exist as a shared
 * pattern anywhere in the app.
 */
export default function Dropdown({ trigger, items, align = 'right' }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative inline-block">
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && (
        <div
          role="menu"
          className={`absolute z-40 mt-1.5 min-w-[160px] glass-panel p-1 motion-safe:animate-[fadeIn_0.15s_ease-out] ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {items.map((item, i) => (
            <button
              key={i}
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                item.onClick()
                setOpen(false)
              }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-left transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
                item.danger ? 'text-danger hover:bg-danger/10' : 'text-gray-300 hover:bg-white/5 hover:text-gray-100'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
