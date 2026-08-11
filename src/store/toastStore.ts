import { create } from 'zustand'

export type ToastVariant = 'success' | 'error' | 'info'

export interface Toast {
  id:        string
  message:   string
  variant:   ToastVariant
  createdAt: number
}

interface ToastStore {
  toasts: Toast[]
  push:    (message: string, variant?: ToastVariant) => void
  dismiss: (id: string) => void
}

// Plain Zustand store (no context provider) so any page/handler can call
// useToastStore.getState().push(...) for a transient, auto-dismissing
// notification. Persistent inline form-validation errors should stay inline,
// not go through here — see EmptyState/toast usage notes.
export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (message, variant = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    set((s) => ({ toasts: [...s.toasts, { id, message, variant, createdAt: Date.now() }] }))
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
