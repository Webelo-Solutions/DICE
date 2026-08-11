import { useEffect } from 'react'
import { useToastStore, type Toast } from '../store/toastStore'

const DISMISS_MS = 4000

const VARIANT_CLS: Record<Toast['variant'], string> = {
  success: 'border-terminal-green/40 bg-terminal-green/10 text-terminal-green',
  error:   'border-terminal-red/40   bg-terminal-red/10   text-terminal-red',
  info:    'border-terminal-blue/40  bg-terminal-blue/10  text-terminal-blue',
}
const VARIANT_GLYPH: Record<Toast['variant'], string> = { success: '✓', error: '✗', info: 'ℹ' }

// Fixed bottom-right toast stack, mounted once in AppShell. Screen readers
// get each toast announced via aria-live — errors interrupt (assertive),
// success/info wait their turn (polite).
export function ToastStack() {
  const toasts  = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-72 pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, DISMISS_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id])

  return (
    <div
      role="status"
      aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
      className={`pointer-events-auto flex items-start gap-2 rounded border px-3 py-2 text-xs font-mono
        shadow-lg animate-slide-in ${VARIANT_CLS[toast.variant]}`}
    >
      <span className="flex-shrink-0">{VARIANT_GLYPH[toast.variant]}</span>
      <span className="flex-1 leading-relaxed">{toast.message}</span>
      <button onClick={onDismiss} aria-label="Dismiss" className="flex-shrink-0 opacity-60 hover:opacity-100">×</button>
    </div>
  )
}
