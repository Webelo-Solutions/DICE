import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { useRoomStore } from '../store/roomStore'
import { disconnectRoom } from '../api/roomSocket'
import { roomApi } from '../api/rooms'
import { ActionMenu } from '../components/ActionMenu'
import type { StatKey } from '../types/game'

const FEED_COLOR: Record<string, string> = {
  dm_narration:        'text-terminal-green',
  player_action:       'text-terminal-blue',
  roll_result:         'text-terminal-amber',
  inject:              'text-terminal-red',
  hint:                'text-purple-400',
  system:              'text-terminal-dim',
  adversary_action:    'text-rose-400',
  adversary_narration: 'text-rose-400',
}
const STAT_ABBR: Record<StatKey, string> = {
  vigilance: 'VIG', agility: 'AGI', analysis: 'ANA', fortitude: 'FOR', stealth: 'STL', command: 'CMD',
}

// The player's seat in a multiplayer room. The facilitator runs the DM; this is
// where a player follows the live incident and takes their character's turns.
export function RoomPlayer() {
  const navigate     = useNavigate()
  const session      = useGameStore((s) => s.session)
  const feed         = useGameStore((s) => s.feed)
  const membership   = useRoomStore((s) => s.membership)
  const participants = useRoomStore((s) => s.participants)
  const connected    = useRoomStore((s) => s.connected)
  const streaming    = useRoomStore((s) => s.streamingNarration)

  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!membership) { navigate('/'); return null }
  const leave = () => { disconnectRoom(); useRoomStore.getState().clearMembership(); navigate('/') }

  const me     = participants.find((p) => p.id === membership.participantId)
  const myChar = me?.character ?? null

  if (!session) {
    return (
      <div className="min-h-screen bg-terminal-bg font-mono flex items-center justify-center p-6 text-center">
        <div>
          <div className="text-sm text-terminal-green tracking-widest uppercase mb-2">You're in — waiting to start</div>
          <div className="text-xs text-terminal-dim">
            {myChar ? <>You'll play <span className="text-terminal-blue">{myChar.name}</span> ({myChar.class}). </> : null}
            The facilitator will begin the session shortly.
          </div>
          <button onClick={() => navigate('/lobby')} className="mt-6 text-xs text-terminal-dim hover:text-terminal-green">← Back to lobby</button>
        </div>
      </div>
    )
  }

  const stages      = session.scenario.killChainStages
  const reached     = session.attackerProgress
  const myCharId    = me?.characterId ?? null
  const isMyTurn    = !!myCharId && session.currentTurnPlayerId === myCharId
  const currentChar = session.players.find((c) => c.id === session.currentTurnPlayerId)

  const submitAction = async (action: string) => {
    const text = action.trim()
    if (!text) return
    setBusy(true); setError(null)
    try { await roomApi.submitAction(membership.code, membership.token, text) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen bg-terminal-bg font-mono flex flex-col">
      {/* Header */}
      <div className="border-b border-terminal-border bg-terminal-surface px-5 py-3 flex items-center gap-4 flex-shrink-0">
        <div className="min-w-0">
          <div className="text-[10px] text-terminal-dim tracking-widest uppercase">{membership.roomName}</div>
          <div className="text-sm font-bold text-white truncate">{session.scenario.title}</div>
        </div>
        <div className="ml-auto flex items-center gap-4 text-xs">
          <div className="text-center"><div className="text-terminal-amber font-bold font-mono">{session.scenarioClockRemaining}</div><div className="text-[9px] text-terminal-dim">min left</div></div>
          <div className="text-center"><div className="text-white font-bold">A{session.act}·R{session.round}</div><div className="text-[9px] text-terminal-dim">act·round</div></div>
          <span className={`text-[10px] px-2 py-0.5 rounded border ${connected ? 'border-terminal-green/40 bg-terminal-green/10 text-terminal-green' : 'border-terminal-amber/40 bg-terminal-amber/10 text-terminal-amber'}`}>
            {connected ? '● live' : '○ reconnecting'}
          </span>
        </div>
      </div>

      {/* Your character strip */}
      {myChar && (
        <div className="px-5 py-2 border-b border-terminal-border bg-terminal-blue/5 flex items-center gap-3 flex-wrap flex-shrink-0">
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-terminal-blue/20 text-terminal-blue tracking-widest uppercase">You</span>
          <span className="text-sm font-bold text-white">{myChar.name}</span>
          <span className="text-[10px] px-2 py-0.5 rounded border border-terminal-blue/40 text-terminal-blue">{myChar.class}</span>
          <div className="flex items-center gap-2 ml-auto">
            {(Object.keys(STAT_ABBR) as StatKey[]).map((k) => (
              <span key={k} className="text-[10px] text-terminal-dim">{STAT_ABBR[k]} <span className="text-gray-300 font-mono">{myChar.stats[k]}</span></span>
            ))}
          </div>
        </div>
      )}

      {/* Kill chain */}
      <div className="px-5 py-2 border-b border-terminal-border flex items-center gap-1.5 flex-wrap flex-shrink-0">
        {stages.map((stage, i) => {
          const hit = reached.includes(stage)
          return (
            <div key={stage} className="flex items-center gap-1.5">
              <span className={`text-[10px] px-2 py-0.5 rounded border ${hit ? 'border-terminal-red/40 bg-terminal-red/10 text-terminal-red' : 'border-terminal-border text-terminal-dim/50'}`}>
                {stage.replace(/_/g, ' ')}
              </span>
              {i < stages.length - 1 && <span className="text-terminal-dim/40 text-[10px]">→</span>}
            </div>
          )
        })}
      </div>

      {/* Narrative feed */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {feed.length === 0 && <div className="text-xs text-terminal-dim italic">The incident is about to unfold…</div>}
        {feed.map((e) => (
          <div key={e.id} className="text-sm leading-relaxed">
            <span className={`text-[10px] font-mono tracking-widest uppercase mr-2 ${FEED_COLOR[e.type] ?? 'text-terminal-dim'}`}>{e.speaker}</span>
            <span className="text-gray-200 whitespace-pre-wrap">
              {e.type === 'roll_result' && e.roll
                ? `Roll ${e.roll.raw} + ${e.roll.modifier} = ${e.roll.total} vs DC ${e.roll.dc} — ${e.roll.outcome.replace(/_/g, ' ').toUpperCase()}`
                : e.text}
            </span>
          </div>
        ))}
        {/* Live DM narration streaming in (cleared once it lands in the feed) */}
        {streaming && (
          <div className="text-sm leading-relaxed">
            <span className="text-[10px] font-mono tracking-widest uppercase mr-2 text-terminal-green">DM</span>
            <span className="text-gray-200 whitespace-pre-wrap">{streaming}<span className="animate-pulse text-terminal-green ml-0.5">▌</span></span>
          </div>
        )}
      </div>

      {/* Turn / action footer */}
      <div className="border-t border-terminal-border bg-terminal-surface px-5 py-3 flex-shrink-0 space-y-2">
        {error && <div className="text-[11px] text-terminal-red">{error}</div>}

        {isMyTurn && myChar ? (
          <div>
            <div className="text-[10px] text-terminal-green tracking-widest uppercase mb-2">▶ Your turn, {myChar.name}</div>
            <ActionMenu character={myChar} onSubmit={(action) => submitAction(action)} disabled={busy} />
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-terminal-dim">
              {currentChar
                ? <>Hold tight — <span className="text-terminal-blue">{currentChar.name}</span> is taking their turn. You're up soon.</>
                : 'Waiting for the next turn…'}
            </span>
            <button onClick={leave} className="text-[10px] text-terminal-red/70 hover:text-terminal-red tracking-widest uppercase">Leave</button>
          </div>
        )}
      </div>
    </div>
  )
}
