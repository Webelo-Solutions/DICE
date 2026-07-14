import { useState, type ReactNode } from 'react'

// Small hover/focus-triggered info tooltip matching the terminal theme. Wraps a
// trigger element (typically an "ⓘ" icon) and renders `text` in a floating
// bubble above it — keyboard-accessible via focus/blur, not just mouse hover.
export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded border
            border-terminal-border bg-terminal-bg px-2.5 py-2 text-[11px] leading-relaxed text-terminal-dim
            shadow-lg pointer-events-none normal-case tracking-normal font-normal"
        >
          {text}
        </span>
      )}
    </span>
  )
}
