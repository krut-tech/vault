import { create } from 'zustand'

export interface Toast {
  id: string
  message: string
  link?: string | null
  type?: 'info' | 'success' | 'error'
}

interface ToastState {
  toasts: Toast[]
  push: (message: string, opts?: { link?: string | null; type?: Toast['type'] }) => void
  dismiss: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (message, opts) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    set((s) => ({ toasts: [...s.toasts, { id, message, link: opts?.link, type: opts?.type ?? 'info' }] }))
    // auto-dismiss after 5s
    window.setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 5000)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
