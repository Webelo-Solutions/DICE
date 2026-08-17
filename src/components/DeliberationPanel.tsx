import { useState } from 'react'
import { roomApi } from '../api/rooms'
import { useRoomStore } from '../store/roomStore'
import { useToastStore } from '../store/toastStore'
import type { GameSession } from '../types/game'
import type { Participant } from '../types/room'

interface Props {
  session: GameSession
  me:      Participant | null
  // Set when the local player holds the turn — they get the inbox and can adopt
  // a suggestion. Everyone else gets the composer instead.
  isMyTurn: boolean
  onAdopt?: (text: string, fromParticipantId: string) => void
}

// The other nineteen people's half of a departmental turn (decision D10).
// Whoever is up sees what their bench is telling them and can take it verbatim,
// edit it, or ignore it; everyone in scope sees what has already been said, so
// five people don't independently suggest the same thing.
export function DeliberationPanel({ session, me, isMyTurn, onAdopt }: Props) {
  const membership   = useRoomStore((s) => s.membership)
  const suggestions  = useRoomStore((s) => s.suggestions)
  const participants = useRoomStore((s) => s.participants)
  const pushToast    = useToastStore((s) => s.push)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const config = session.deliberation
  if (!config?.enabled || !membership || !session.currentActor) return null

  const actorSeat = session.seats?.find((s) => s.participantId === session.currentActor!.participantId)
  // Mirror the server's scope rule so people are not shown a box that will be
  // rejected. The server remains the authority — this is courtesy, not security.
  const inScope = (() => {
    if (isMyTurn || !me) return false
    // The facilitator watches the bench but never joins it (enforced server-side).
    if (me.role === 'facilitator') return false
    if (config.scope === 'anyone') return true
    if (config.scope === 'role') return me.gameRole === session.currentActor!.role
    // Department is a live roster fact, not part of the frozen seat map — the
    // facilitator can move someone between departments mid-session.
    const actorDept = participants.find((p) => p.id === session.currentActor!.participantId)?.departmentId
    return !!me.departmentId && me.departmentId === actorDept
  })()

  const relevant = suggestions.filter((s) => s.forParticipantId === session.currentActor!.participantId)

  const send = async () => {
    const body = text.trim()
    if (!body) return
    setBusy(true)
    try {
      await roomApi.suggest(membership.code, membership.token, body)
      setText('')
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Could not send that suggestion', 'error')
    } finally { setBusy(false) }
  }

  const scopeLabel = config.scope === 'role'
    ? `${session.currentActor.role} bench`
    : config.scope === 'department' ? 'their department' : 'anyone'

  return (
    <div className="rounded border border-terminal-blue/30 bg-terminal-blue/5 overflow-hidden">
      <div className="px-3 py-2 border-b border-terminal-blue/20 flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold text-terminal-blue tracking-widest uppercase">
          {isMyTurn ? 'Your bench' : `Advise ${actorSeat?.displayName ?? 'the responder'}`}
        </span>
        <span className="text-[9px] text-terminal-dim">{relevant.length}</span>
      </div>

      {/* What has been said so far — visible to everyone, so the room can see
          it is converging or splitting. */}
      <div className="max-h-44 overflow-y-auto divide-y divide-terminal-blue/10">
        {relevant.length === 0 && (
          <div className="px-3 py-2.5 text-[10px] text-terminal-dim/60 italic">
            {isMyTurn ? 'No suggestions yet — the call is yours.' : 'Nothing suggested yet.'}
          </div>
        )}
        {relevant.map((s) => (
          <div key={s.id} className="px-3 py-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[10px] font-semibold text-white truncate">{s.displayName}</span>
              {s.gameRole && <span className="text-[9px] text-terminal-dim">{s.gameRole}</span>}
            </div>
            <p className="text-[11px] text-gray-300 leading-snug mt-0.5">{s.text}</p>
            {isMyTurn && onAdopt && (
              <button onClick={() => onAdopt(s.text, s.participantId)}
                className="mt-1 text-[10px] text-terminal-green hover:underline underline-offset-2">
                Use this
              </button>
            )}
          </div>
        ))}
      </div>

      {inScope && (
        <div className="px-3 py-2.5 border-t border-terminal-blue/20 space-y-1.5">
          <textarea
            value={text} onChange={(e) => setText(e.target.value)} maxLength={500}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send() }}
            placeholder={`Suggest an action for ${actorSeat?.displayName ?? 'them'}…`}
            aria-label="Your suggestion"
            className="w-full h-14 resize-none bg-terminal-bg border border-terminal-border rounded px-2 py-1.5
              text-[11px] text-white placeholder-terminal-dim/50 focus:outline-none
              focus:border-terminal-blue transition-colors"
          />
          <button onClick={send} disabled={busy || !text.trim()}
            className="w-full py-1.5 rounded border border-terminal-blue/50 text-terminal-blue text-[10px]
              font-bold tracking-widest uppercase hover:bg-terminal-blue/10 disabled:opacity-30
              disabled:cursor-not-allowed transition-colors">
            {busy ? 'Sending…' : 'Send suggestion'}
          </button>
        </div>
      )}

      {!inScope && !isMyTurn && (
        <div className="px-3 py-2 border-t border-terminal-blue/20 text-[9px] text-terminal-dim/60 leading-relaxed">
          This turn is being advised by the {scopeLabel}.
        </div>
      )}
    </div>
  )
}
