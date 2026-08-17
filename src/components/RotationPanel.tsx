import type { GameSession } from '../types/game'
import { seatsForRole } from '../engine/rotation'

interface Props {
  session:      GameSession
  connectedIds: Set<string>
  // Facilitator only — hand the current role's turn to the next person in its
  // pool. Undefined for players, who see the panel read-only.
  onReassign?:  () => void
}

// Replaces the per-character InitiativeTracker in departmental sessions. The
// order here is ROLES, not people — that is the whole point of the mode — and
// each role shows who is up and how much of its rotation is still unspent.
export function RotationPanel({ session, connectedIds, onReassign }: Props) {
  const { roleInitiative, seats, rotation, currentActor } = session
  if (!roleInitiative || !seats) return null

  const currentIndex = currentActor ? roleInitiative.indexOf(currentActor.role) : -1
  const actingSeat = currentActor
    ? seats.find((s) => s.participantId === currentActor.participantId)
    : null
  // Only offer a handover when there is somebody connected to hand it to.
  const roleHasAlternate = currentActor
    ? seatsForRole(seats, currentActor.role)
        .some((s) => s.participantId !== currentActor.participantId && connectedIds.has(s.participantId))
    : false

  return (
    <div className="space-y-3">
      <div className="text-[10px] text-terminal-dim tracking-widest uppercase">
        Round {session.round} · Rotation
      </div>

      {/* Who is up, and on which sheet */}
      {actingSeat && (
        <div className="rounded border border-terminal-green/40 bg-terminal-green/5 px-3 py-2">
          <div className="text-[9px] text-terminal-dim tracking-widest uppercase">{currentActor!.role} is up</div>
          <div className="text-sm font-bold text-terminal-green truncate">{actingSeat.displayName}</div>
          <div className="text-[10px] text-terminal-dim mt-0.5">
            {actingSeat.usesTemplate ? `standard ${actingSeat.gameRole} sheet` : 'own character'}
            {!connectedIds.has(actingSeat.participantId) && (
              <span className="text-terminal-amber"> · offline</span>
            )}
          </div>
          {onReassign && roleHasAlternate && (
            <button onClick={onReassign}
              className="mt-2 w-full py-1 rounded border border-terminal-border text-[10px] text-terminal-dim
                hover:border-terminal-amber hover:text-terminal-amber transition-colors">
              Hand to next in {currentActor!.role}
            </button>
          )}
        </div>
      )}

      {/* Role order. Unstaffed roles never appear — they are skipped entirely. */}
      <div className="space-y-1">
        {roleInitiative.map((role, i) => {
          const pool    = rotation?.[role]
          const total   = seatsForRole(seats, role).length
          const spent   = pool?.drawn.length ?? 0
          const isNow   = i === currentIndex
          const online  = seatsForRole(seats, role).filter((s) => connectedIds.has(s.participantId)).length
          return (
            <div key={role}
              className={`flex items-center gap-2 px-2 py-1.5 rounded border ${isNow
                ? 'border-terminal-green/40 bg-terminal-green/5'
                : 'border-transparent'}`}>
              <span className={`text-[10px] w-3 flex-shrink-0 tabular-nums ${isNow ? 'text-terminal-green' : 'text-terminal-dim/50'}`}>
                {i + 1}
              </span>
              <span className={`text-[11px] flex-1 truncate ${isNow ? 'text-white font-semibold' : 'text-terminal-dim'}`}>
                {role}
              </span>
              {online === 0 && <span className="text-[9px] text-terminal-amber flex-shrink-0">all offline</span>}
              <span className="text-[9px] text-terminal-dim/60 flex-shrink-0 tabular-nums" title="Spent this rotation cycle">
                {spent}/{total}
              </span>
            </div>
          )
        })}
      </div>

      <div className="text-[9px] text-terminal-dim/50 leading-relaxed">
        Everyone staffing a role acts once before anyone repeats.
      </div>
    </div>
  )
}
