// Shared editor-form UI atoms — originally local to CampaignBuilder.tsx, lifted
// out so the admin scenario/injects-catalog editors can reuse the same look.

export const inputCls = `w-full bg-transparent border border-terminal-border focus:border-terminal-green
  text-white text-sm px-3 py-2 rounded focus:outline-none placeholder-terminal-dim transition-colors`

export const labelCls = 'text-[10px] text-terminal-dim tracking-widest uppercase mb-1 block'

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  )
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-xs font-bold text-terminal-green tracking-widest uppercase">{children}</span>
      <div className="flex-1 h-px bg-terminal-border" />
    </div>
  )
}

export function IconBtn({
  onClick, title, children, danger, disabled,
}: { onClick: () => void; title?: string; children: React.ReactNode; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`px-1.5 py-0.5 rounded border text-[11px] transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        danger
          ? 'border-terminal-red/30 text-terminal-red/60 hover:text-terminal-red hover:border-terminal-red/60'
          : 'border-terminal-border text-terminal-dim hover:text-white hover:border-terminal-dim'
      }`}
    >
      {children}
    </button>
  )
}
