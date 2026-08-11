import type { ReactNode } from 'react'

interface Props {
  message: string
  icon?:   string
  action?: ReactNode
}

// Shared empty-list treatment, matching the dim-italic convention already
// used ad hoc across admin/list pages (e.g. AdminUsers' "No users..." div).
export function EmptyState({ message, icon = '—', action }: Props) {
  return (
    <div className="px-4 py-6 text-center">
      <div className="text-lg text-terminal-dim/30 mb-1">{icon}</div>
      <div className="text-xs text-terminal-dim italic">{message}</div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
