import { useState, useRef, useEffect } from 'react'

interface Props {
  onSubmit:    (action: string) => void
  disabled:    boolean
  placeholder?: string
  dcHint?:     number | null
}

export function ActionInput({ onSubmit, disabled, placeholder, dcHint }: Props) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!disabled) textareaRef.current?.focus()
  }, [disabled])

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSubmit(trimmed)
    setValue('')
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="space-y-2">
      {dcHint && (
        <div className="flex items-center gap-2 text-xs font-mono text-terminal-amber">
          <span className="text-terminal-dim">DC HINT</span>
          <span className="font-bold">{dcHint}</span>
          <span className="text-terminal-dim">— this will be difficult</span>
        </div>
      )}

      <div className={`flex gap-2 rounded border transition-all duration-200 ${
        disabled
          ? 'border-terminal-border opacity-40'
          : 'border-terminal-green/40 focus-within:border-terminal-green'
      } bg-terminal-surface`}>
        <span className="text-terminal-green font-mono text-sm px-3 py-2 select-none flex-shrink-0">
          &gt;
        </span>
        <textarea
          ref={textareaRef}
          rows={2}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKey}
          disabled={disabled}
          placeholder={placeholder ?? 'Declare your action... (Enter to submit)'}
          className="flex-1 bg-transparent font-mono text-sm text-gray-200 placeholder-terminal-dim
            resize-none py-2 pr-2 focus:outline-none"
        />
      </div>

      <div className="flex justify-between items-center">
        <span className="text-[10px] font-mono text-terminal-dim">
          Shift+Enter for new line · Enter to submit
        </span>
        <button
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className="px-3 py-1 text-xs font-mono font-semibold tracking-widest uppercase
            bg-terminal-green/10 border border-terminal-green/40 text-terminal-green
            hover:bg-terminal-green/20 hover:border-terminal-green
            disabled:opacity-30 disabled:cursor-not-allowed
            rounded transition-all duration-150"
        >
          Submit
        </button>
      </div>
    </div>
  )
}
