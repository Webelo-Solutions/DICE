import { useState } from 'react'
import type { Character, StatKey } from '../types/game'
import { CLASS_ACTIONS } from '../data/classActions'
import type { SubAction } from '../data/classActions'
import { useGameStore } from '../store/gameStore'
import { substituteOrgTokens } from '../utils/orgProfileTokens'

interface Props {
  character:   Character
  onSubmit:    (action: string, stat: StatKey | null, additionalPenalty: number) => void
  disabled:    boolean
  dcHint?:     number | null
  dcPenalty?:  number
  // Notifies the parent when the rationale textarea gains/loses focus, so the
  // round timer can be paused while the player is composing their action.
  onTypingChange?: (typing: boolean) => void
}

interface Selection {
  label:      string
  stat:       StatKey | null
  penalty:    number
  improvised: boolean
}

const STAT_LABEL: Record<StatKey, string> = {
  vigilance: 'VIG',
  agility:   'AGI',
  analysis:  'ANA',
  fortitude: 'FOR',
  stealth:   'STL',
  command:   'CMD',
}

export function ActionMenu({ character, onSubmit, disabled, dcHint, dcPenalty = 0, onTypingChange }: Props) {
  const [selection,         setSelection]         = useState<Selection | null>(null)
  const [rationale,         setRationale]         = useState('')
  const [selectedSubAction, setSelectedSubAction] = useState<string | null>(null)

  const actions    = CLASS_ACTIONS[character.class]
  const orgProfile = useGameStore((s) => s.activeOrgProfile)
  const detailFor  = (sub: SubAction) => substituteOrgTokens(sub.detail, orgProfile)

  const select = (label: string, stat: StatKey | null, penalty: number, improvised = false) => {
    if (disabled) return
    setSelection({ label, stat, penalty, improvised })
    setRationale('')
    setSelectedSubAction(null)
  }

  const applySubAction = (sub: SubAction) => {
    if (disabled) return
    setRationale(detailFor(sub))
    setSelectedSubAction(sub.id)
  }

  const clear = () => { setSelection(null); setRationale(''); setSelectedSubAction(null) }

  const declare = () => {
    if (!selection || disabled || !rationale.trim()) return
    const text = selection.improvised
      ? rationale.trim()
      : `${selection.label} — ${rationale.trim()}`
    onSubmit(text, selection.stat, selection.penalty)
    setSelection(null)
    setRationale('')
  }

  const effectiveDc = dcHint ? dcHint + dcPenalty : null

  const activeSubActions: SubAction[] = selection && !selection.improvised
    ? (actions.primary.find((a) => a.label === selection.label)?.subActions ?? [])
    : []

  return (
    <div className="space-y-3">

      {/* DC hint */}
      {effectiveDc !== null && (
        <div className="flex items-center gap-2 text-xs font-mono text-terminal-amber">
          <span className="text-terminal-dim">DC HINT</span>
          <span className="font-bold">{effectiveDc}</span>
          {dcPenalty > 0 && (
            <span className="text-terminal-red/70 text-[10px]">(+{dcPenalty} accumulated)</span>
          )}
        </div>
      )}

      {/* Primary actions */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[11px] font-mono tracking-widest text-terminal-green/80 uppercase">
            {character.class}
          </span>
          <span className="text-[11px] font-mono text-terminal-green/40">— primary actions</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {actions.primary.map((action) => {
            const active = selection?.label === action.label && !selection.improvised
            return (
              <button
                key={action.id}
                onClick={() => select(action.label, action.stat, 0)}
                disabled={disabled}
                title={`${action.description}\nStat: ${STAT_LABEL[action.stat]}`}
                className={`group relative px-2.5 py-1 text-sm font-mono rounded border
                  transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed ${
                  active
                    ? 'border-terminal-green bg-terminal-green/20 text-terminal-green ring-1 ring-terminal-green/40'
                    : 'border-terminal-green/40 bg-terminal-green/5 text-terminal-green hover:bg-terminal-green/15 hover:border-terminal-green/70'
                }`}
              >
                {action.label}
                <span className="ml-1.5 text-[9px] opacity-0 group-hover:opacity-40 transition-opacity font-mono">
                  [{STAT_LABEL[action.stat]}]
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Secondary actions */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[11px] font-mono tracking-widest text-terminal-amber/60 uppercase">
            Secondary
          </span>
          <span className="text-[11px] font-mono text-terminal-amber/40">+2 DC — outside specialty</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {actions.secondary.map((action) => {
            const active = selection?.label === action.label && !selection.improvised
            return (
              <button
                key={action.id}
                onClick={() => select(action.label, action.stat, 2)}
                disabled={disabled}
                title={`${action.description}\nStat: ${STAT_LABEL[action.stat]}\n+2 DC penalty`}
                className={`group relative px-2.5 py-1 text-sm font-mono rounded border
                  transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed ${
                  active
                    ? 'border-terminal-amber bg-terminal-amber/20 text-terminal-amber ring-1 ring-terminal-amber/40'
                    : 'border-terminal-amber/25 bg-terminal-amber/5 text-terminal-amber/60 hover:bg-terminal-amber/10 hover:border-terminal-amber/45 hover:text-terminal-amber'
                }`}
              >
                {action.label}
                <span className="ml-1.5 text-[9px] opacity-0 group-hover:opacity-40 transition-opacity font-mono">
                  [{STAT_LABEL[action.stat]}]
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Rationale / improvise input — appears after any selection */}
      {selection && (
        <div className="space-y-1.5">
          {/* Selection badge */}
          <div className="flex items-center gap-2 min-w-0">
            {selection.improvised ? (
              <span className="text-[11px] font-mono tracking-widest text-terminal-red/70 uppercase">
                Improvise
                <span className="text-terminal-red/40 ml-1.5">+3 DC</span>
              </span>
            ) : (
              <>
                <span className={`text-[11px] font-mono tracking-widest uppercase truncate ${
                  selection.penalty === 0 ? 'text-terminal-green/90' : 'text-terminal-amber/90'
                }`}>
                  {selection.label}
                </span>
                {selection.stat && (
                  <span className="text-[9px] font-mono text-terminal-dim/50 flex-shrink-0">
                    [{STAT_LABEL[selection.stat]}]
                  </span>
                )}
                {selection.penalty > 0 && (
                  <span className="text-[9px] font-mono text-terminal-amber/50 flex-shrink-0">
                    +{selection.penalty} DC
                  </span>
                )}
              </>
            )}
            <button
              onClick={clear}
              className="ml-auto flex-shrink-0 text-[10px] text-terminal-dim/40
                hover:text-terminal-dim transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Sub-action chips */}
          {activeSubActions.length > 0 && (
            <div className="space-y-1">
              <span className="text-[9px] font-mono tracking-widest text-terminal-green/50 uppercase">
                Quick fill — pick a focus or type your own below
              </span>
              <div className="flex flex-wrap gap-1.5">
                {activeSubActions.map((sub) => {
                  const active = selectedSubAction === sub.id
                  return (
                    <button
                      key={sub.id}
                      onClick={() => applySubAction(sub)}
                      disabled={disabled}
                      title={detailFor(sub)}
                      className={`flex items-center gap-1.5 px-2 py-1 text-[11px] font-mono rounded border
                        transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed ${
                        active
                          ? 'border-terminal-green/60 bg-terminal-green/15 text-terminal-green'
                          : 'border-terminal-green/20 bg-transparent text-terminal-green/60 hover:border-terminal-green/40 hover:text-terminal-green/90 hover:bg-terminal-green/8'
                      }`}
                    >
                      {sub.label}
                      <span className={`text-[9px] font-mono transition-colors ${
                        active ? 'text-terminal-green/60' : 'text-terminal-dim/40'
                      }`}>
                        ~DC {sub.dcHint}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Rationale textarea */}
          <div className={`flex gap-2 rounded border transition-all duration-200 bg-terminal-surface ${
            disabled
              ? 'border-terminal-border opacity-40'
              : selection.improvised
              ? 'border-terminal-red/30 focus-within:border-terminal-red/55'
              : 'border-terminal-green/25 focus-within:border-terminal-green/50'
          }`}>
            <span className={`font-mono text-sm px-3 py-2 select-none flex-shrink-0 ${
              selection.improvised ? 'text-terminal-red/50' : 'text-terminal-green/40'
            }`}>
              &gt;
            </span>
            <textarea
              rows={2}
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); declare() }
                if (e.key === 'Escape') clear()
              }}
              onFocus={() => onTypingChange?.(true)}
              onBlur={() => onTypingChange?.(false)}
              disabled={disabled}
              placeholder={
                selection.improvised
                  ? 'Describe your action and your reasoning — what are you doing and why?'
                  : 'Your hypothesis — what are you looking for, and why does this action make sense?'
              }
              className="flex-1 bg-transparent font-mono text-sm text-gray-200 placeholder-terminal-dim
                resize-none py-2 pr-2 focus:outline-none"
              autoFocus
            />
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[9px] font-mono text-terminal-dim/40">
              {selection.improvised
                ? 'Stat inferred from text'
                : `Stat: ${selection.stat ? STAT_LABEL[selection.stat] : '—'}`
              }
              {' · '}Enter to declare
            </span>
            <button
              onClick={declare}
              disabled={disabled || !rationale.trim()}
              className={`px-3 py-1 text-xs font-mono font-semibold tracking-widest uppercase
                rounded transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed ${
                selection.improvised
                  ? 'bg-terminal-red/10 border border-terminal-red/35 text-terminal-red/80 hover:bg-terminal-red/20 hover:border-terminal-red/60 hover:text-terminal-red'
                  : 'bg-terminal-green/10 border border-terminal-green/35 text-terminal-green/80 hover:bg-terminal-green/20 hover:border-terminal-green/60 hover:text-terminal-green'
              }`}
            >
              Declare
            </button>
          </div>
        </div>
      )}

      {/* Improvise — hidden while any action is selected */}
      {!selection && (
        <button
          onClick={() => select('', null, 3, true)}
          disabled={disabled}
          className="text-xs font-mono text-terminal-dim/50 hover:text-terminal-dim
            underline underline-offset-2 decoration-dotted transition-colors
            disabled:cursor-not-allowed disabled:no-underline"
        >
          ⚡ Improvise (+3 DC)...
        </button>
      )}
    </div>
  )
}
