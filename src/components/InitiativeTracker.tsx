import type { Character } from '../types/game'

interface Props {
  players:        Character[]
  order:          string[]
  currentId:      string
  attackerStage?: string
}

export function InitiativeTracker({ players, order, currentId, attackerStage }: Props) {
  const playerMap = Object.fromEntries(players.map((p) => [p.id, p]))

  return (
    <div className="space-y-1 font-mono">
      <div className="text-[10px] text-terminal-dim tracking-widest uppercase mb-2">
        Initiative Order
      </div>

      {order.map((id, idx) => {
        const p = playerMap[id]
        const isActive = id === currentId
        return (
          <div
            key={id}
            className={`flex items-center gap-2 px-2 py-1.5 rounded transition-all duration-200 ${
              isActive
                ? 'bg-terminal-green/10 border border-terminal-green/40'
                : 'border border-transparent'
            }`}
          >
            <span className="text-terminal-dim text-xs w-4">{idx + 1}.</span>
            {isActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-terminal-green animate-pulse-glow flex-shrink-0" />
            )}
            <span className={`text-xs flex-1 ${isActive ? 'text-white font-semibold' : 'text-gray-400'}`}>
              {p ? p.name : id}
            </span>
            {p && (
              <span className="text-[10px] text-terminal-dim">{p.class}</span>
            )}
          </div>
        )
      })}

      {/* Attacker row */}
      <div className="flex items-center gap-2 px-2 py-1.5 rounded border border-terminal-red/20 mt-2">
        <span className="w-1.5 h-1.5 rounded-full bg-terminal-red animate-pulse flex-shrink-0" />
        <span className="text-xs text-terminal-red/80 flex-1">Attacker</span>
        {attackerStage && (
          <span className="text-[10px] text-terminal-dim">{attackerStage.replace(/_/g, ' ')}</span>
        )}
      </div>
    </div>
  )
}
