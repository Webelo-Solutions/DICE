import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserStore } from '../store/userStore'
import { useCommandPaletteStore } from '../store/commandPaletteStore'
import { NAV_ENTRIES } from '../config/navigation'

// Global Cmd/Ctrl+K palette. Mounted once in AppShell. Filters the shared
// NAV_ENTRIES list (same source the sidebar reads) so the two surfaces never
// disagree about what's navigable.
export function CommandPalette() {
  const navigate = useNavigate()
  const open     = useCommandPaletteStore((s) => s.open)
  const setOpen  = useCommandPaletteStore((s) => s.setOpen)
  const isAdmin  = useUserStore((s) => s.user?.role === 'admin')

  const [query,     setQuery]     = useState('')
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = NAV_ENTRIES
    .filter((e) => e.group !== 'admin' || isAdmin)
    .filter((e) => e.label.toLowerCase().includes(query.trim().toLowerCase()))

  // Global open shortcut — works from anywhere, not just while the palette is open.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(!open)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, setOpen])

  useEffect(() => {
    if (open) { setQuery(''); setHighlight(0); setTimeout(() => inputRef.current?.focus(), 0) }
  }, [open])

  useEffect(() => { setHighlight(0) }, [query])

  if (!open) return null

  const go = (path: string) => { setOpen(false); navigate(path) }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min(h + 1, results.length - 1)); return }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); return }
    if (e.key === 'Enter' && results[highlight]) { go(results[highlight].path) }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
    >
      <div
        role="dialog" aria-label="Command palette"
        className="w-full max-w-md mx-4 bg-terminal-surface border border-terminal-border rounded-lg shadow-2xl font-mono overflow-hidden"
        onKeyDown={onKeyDown}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Jump to…"
          className="w-full px-4 py-3 bg-transparent text-sm text-white placeholder:text-terminal-dim/40
            border-b border-terminal-border focus:outline-none"
        />
        <div className="max-h-72 overflow-y-auto scrollbar-thin">
          {results.length === 0 && (
            <div className="px-4 py-3 text-xs text-terminal-dim/50 italic">No matches.</div>
          )}
          {results.map((entry, i) => (
            <button
              key={entry.path}
              onClick={() => go(entry.path)}
              onMouseEnter={() => setHighlight(i)}
              className={`w-full flex items-center gap-2.5 px-4 py-2 text-xs text-left transition-colors ${
                i === highlight ? 'bg-terminal-green/10 text-terminal-green' : 'text-terminal-dim/80'
              }`}
            >
              <span className="text-sm">{entry.glyph}</span>
              <span>{entry.label}</span>
              <span className="ml-auto text-[9px] text-terminal-dim/40 uppercase tracking-widest">{entry.group}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
