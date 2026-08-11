interface Props {
  size?: number
  label?: string
}

// Respects prefers-reduced-motion automatically — the global CSS override in
// index.css neutralizes the animate-spin keyframe for users who need it.
export function Spinner({ size = 14, label = 'Loading' }: Props) {
  return (
    <span
      role="status"
      aria-label={label}
      className="inline-block rounded-full border-2 border-terminal-dim/20 border-t-terminal-green animate-spin"
      style={{ width: size, height: size }}
    />
  )
}
