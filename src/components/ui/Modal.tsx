import { useEffect, useRef, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Set false for dialogs where an accidental outside click shouldn't discard input. */
  closeOnBackdropClick?: boolean
}

const sizeClass: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
}

/**
 * Shared modal shell — visually matches the existing create/edit-project modal pattern
 * (glass-panel + glow-border) but adds the behavior individual pages don't currently have:
 * Escape-to-close, click-outside-to-close, and focus moved into the dialog on open /
 * restored to the trigger on close. Reduced-motion friendly (uses a short opacity/scale
 * transition, skipped entirely for prefers-reduced-motion via Tailwind's motion-safe).
 *
 * Not wired into any page yet — pages keep their own inline modal markup until Step 3.
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnBackdropClick = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    previouslyFocused.current = document.activeElement as HTMLElement | null

    const panel = panelRef.current
    const focusable = panel?.querySelector<HTMLElement>('input, textarea, select, button, [tabindex]:not([tabindex="-1"])')
    focusable?.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && panel) {
        const focusables = panel.querySelectorAll<HTMLElement>(
          'input, textarea, select, button, [href], [tabindex]:not([tabindex="-1"])'
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
      previouslyFocused.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 motion-safe:animate-[fadeIn_0.15s_ease-out]"
      onMouseDown={(e) => {
        if (closeOnBackdropClick && e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        aria-describedby={description ? 'modal-description' : undefined}
        className={`glass-panel glow-border w-full ${sizeClass[size]} p-6 space-y-4 max-h-[90vh] overflow-y-auto motion-safe:animate-[scaleIn_0.15s_ease-out]`}
      >
        {title && (
          <div className="space-y-1">
            <h3 id="modal-title" className="font-semibold text-gray-100">{title}</h3>
            {description && <p id="modal-description" className="text-xs text-secondary">{description}</p>}
          </div>
        )}
        {children}
        {footer && <div className="flex justify-end gap-2 pt-1">{footer}</div>}
      </div>
    </div>
  )
}
