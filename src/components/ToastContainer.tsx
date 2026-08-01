import { Link } from 'react-router-dom'
import { X, Bell } from 'lucide-react'
import { useToastStore } from '../store/toastStore'

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-16 right-4 z-[70] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
      {toasts.map((t) => {
        const Wrapper = t.link ? Link : 'div'
        return (
          <Wrapper
            key={t.id}
            to={t.link ?? undefined as never}
            onClick={() => dismiss(t.id)}
            className="glass-panel glow-border px-4 py-3 flex items-start gap-2.5 text-sm shadow-lg animate-[fadeIn_0.15s_ease-out] cursor-pointer"
          >
            <Bell size={16} className="mt-0.5 text-cyan shrink-0" />
            <span className="flex-1 text-gray-100">{t.message}</span>
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                dismiss(t.id)
              }}
              className="text-gray-500 hover:text-gray-300 shrink-0"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </Wrapper>
        )
      })}
    </div>
  )
}
