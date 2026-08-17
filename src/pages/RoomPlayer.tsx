import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useGameStore } from '../store/gameStore'
import { useRoomStore } from '../store/roomStore'
import { disconnectRoom } from '../api/roomSocket'
import { roomApi } from '../api/rooms'
import { ActionMenu } from '../components/ActionMenu'
import { VoiceDMButton } from '../components/VoiceDMButton'
import { DiceRollOverlay } from '../components/DiceRollOverlay'
import { ClaimFacilitatorPanel } from '../components/ClaimFacilitatorPanel'
import { ScenarioClock, RoundTimer } from '../components/Timers'
import { useVoiceDM } from '../hooks/useVoiceDM'
import { computeXpAwards } from '../utils/xp'
import { ADVERSARY_CLASSES } from '../types/adversary'
import type { StatKey, GameSession, FeedEntry, Character, RollRecord } from '../types/game'
import { TIMER_DIFFICULTY_SECONDS } from '../types/game'

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

  // Hoisted above the early returns below so the turn-alert effect (which
  // needs it) can run unconditionally, per the Rules of Hooks. Safe with
  // optional chaining even before `membership`/`session` are known non-null.
  const myCharId = participants.find((p) => p.id === membership?.participantId)?.characterId ?? null
  const isMyTurn = !!myCharId && session?.currentTurnPlayerId === myCharId

  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The dice overlay animates each new roll as it lands — everyone's, not just
  // the local player's — mirroring the shared "watch the roll together" feel
  // the facilitator's screen already has.
  const [activeRoll, setActiveRoll] = useState<
    { feedId: string; roll: RollRecord; playerChar: Character; actionText: string } | null
  >(null)
  const knownRollIdsRef = useRef<Set<string> | null>(null)

  // Captured once, the moment the scenario ends — deliberately decoupled from
  // the live `session` afterward, so the facilitator resetting their own
  // screen doesn't silently yank the player back to a "waiting" screen before
  // they've seen how it went.
  const [endedSnapshot, setEndedSnapshot] = useState<{ session: GameSession; feed: FeedEntry[] } | null>(null)

  // Narrate the facilitator's streamed DM text as it arrives. voiceStore is a
  // per-browser persisted preference, so each player mutes/configures their
  // own narrator independently — no server involvement needed.
  const { speak, speakChunk, flushChunks } = useVoiceDM()
  const lastSpokenLenRef = useRef(0)
  useEffect(() => {
    if (streaming) {
      const newChars = streaming.slice(lastSpokenLenRef.current)
      lastSpokenLenRef.current = streaming.length
      if (newChars) speakChunk(newChars)
    } else if (lastSpokenLenRef.current > 0) {
      flushChunks()
      lastSpokenLenRef.current = 0
    }
  }, [streaming, speakChunk, flushChunks])

  // "Your turn" alert — announces it (respecting the player's own voice mute
  // preference) and, if the tab isn't focused, flashes the title until they
  // come back or act.
  const prevIsMyTurnRef  = useRef(false)
  const originalTitleRef = useRef(document.title)
  const titleFlashRef    = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopTitleFlash = useCallback(() => {
    if (titleFlashRef.current) { clearInterval(titleFlashRef.current); titleFlashRef.current = null }
    document.title = originalTitleRef.current
  }, [])

  useEffect(() => {
    if (isMyTurn && !prevIsMyTurnRef.current) {
      speak("It's your turn")
      if (document.hidden || !document.hasFocus()) {
        let flip = false
        titleFlashRef.current = setInterval(() => {
          document.title = flip ? originalTitleRef.current : '▶ YOUR TURN'
          flip = !flip
        }, 1000)
      }
    }
    if (!isMyTurn) stopTitleFlash()
    prevIsMyTurnRef.current = isMyTurn
  }, [isMyTurn, speak, stopTitleFlash])

  useEffect(() => {
    document.addEventListener('visibilitychange', stopTitleFlash)
    window.addEventListener('focus', stopTitleFlash)
    return () => {
      document.removeEventListener('visibilitychange', stopTitleFlash)
      window.removeEventListener('focus', stopTitleFlash)
      document.title = originalTitleRef.current
    }
  }, [stopTitleFlash])

  useEffect(() => {
    const rollEntries = feed.filter((e) => e.type === 'roll_result' && e.roll)
    if (knownRollIdsRef.current === null) {
      // First observation (mount, or rejoining mid-session) — seed from
      // whatever's already in the feed so history doesn't replay-animate.
      knownRollIdsRef.current = new Set(rollEntries.map((e) => e.id))
      return
    }
    const unseen = rollEntries.filter((e) => !knownRollIdsRef.current!.has(e.id))
    if (unseen.length === 0) return
    unseen.forEach((e) => knownRollIdsRef.current!.add(e.id))

    const latest    = unseen[unseen.length - 1]
    const rollChar  = session?.players.find((c) => c.id === latest.roll!.player)
    if (!rollChar) return
    const idx       = feed.indexOf(latest)
    const prevEntry = idx > 0 ? feed[idx - 1] : null
    const actionText = prevEntry?.type === 'player_action' && prevEntry.speaker === latest.speaker
      ? prevEntry.text
      : 'Rolling…'
    setActiveRoll({ feedId: latest.id, roll: latest.roll!, playerChar: rollChar, actionText })
  }, [feed, session])

  useEffect(() => {
    if (!endedSnapshot && session &&
        (session.status === 'victory' || session.status === 'defeat' || session.status === 'timeout')) {
      setEndedSnapshot({ session, feed })
    }
  }, [session, feed, endedSnapshot])

  if (!membership) { navigate('/'); return null }
  const leave = () => { disconnectRoom(); useRoomStore.getState().clearMembership(); navigate('/') }

  const me     = participants.find((p) => p.id === membership.participantId)
  const myChar = me?.character ?? null

  if (endedSnapshot) {
    const { session: endSession, feed: endFeed } = endedSnapshot
    const outcome = endSession.status === 'victory' ? 'victory' : endSession.status === 'timeout' ? 'partial' : 'defeat'
    const { perPlayer: xpByPlayer } = computeXpAwards(endSession.players, endFeed, outcome)
    const label     = outcome === 'victory' ? 'CONTAINED' : outcome === 'partial' ? 'PARTIAL' : 'BREACH'
    const color     = outcome === 'defeat' ? 'text-terminal-red' : 'text-terminal-green'
    const myEndChar = endSession.players.find((c) => c.id === me?.characterId)
    const backToLobby = () => { setEndedSnapshot(null); navigate('/lobby') }

    return (
      <div className="min-h-screen bg-terminal-bg font-mono flex items-center justify-center p-8">
        <div className={`max-w-lg w-full rounded border p-8 ${
          outcome === 'defeat' ? 'border-terminal-red/30 bg-terminal-red/5' : 'border-terminal-green/30 bg-terminal-green/5'
        }`}>
          <div className={`text-4xl font-bold tracking-widest mb-1 ${color}`}>{label}</div>
          <div className="text-sm text-terminal-dim mb-6">
            {endSession.scenario.title} — {outcome === 'defeat' ? endSession.scenario.failureCondition : endSession.scenario.victoryCondition}
          </div>

          {myEndChar && (
            <div className="mb-6 rounded border border-terminal-blue/30 bg-terminal-blue/5 p-3">
              <div className="text-[10px] text-terminal-dim tracking-widest uppercase mb-1">Your result</div>
              <div className="text-sm text-white">
                {myEndChar.name} <span className="text-terminal-dim text-xs">[{myEndChar.class}]</span>
              </div>
              <div className="text-terminal-green font-bold mt-1">+{xpByPlayer[myEndChar.id] ?? 0} XP earned this session</div>
              {myEndChar.pendingLevelUp && (
                <div className="text-[10px] text-terminal-amber mt-1">Level up available — check your roster.</div>
              )}
            </div>
          )}

          <div className="text-xs text-terminal-dim mb-6">
            Rounds played: {endSession.round} · Clock remaining: {endSession.scenarioClockRemaining}m
          </div>

          <div className="flex gap-3">
            <button
              onClick={backToLobby}
              className="flex-1 py-2 rounded border border-terminal-green/40 bg-terminal-green/10
                text-terminal-green text-xs font-semibold tracking-widest uppercase
                hover:bg-terminal-green/20 transition-all"
            >
              Back to Lobby
            </button>
            <button
              onClick={leave}
              className="flex-1 py-2 rounded border border-terminal-border text-terminal-dim
                text-xs font-semibold tracking-widest uppercase
                hover:text-white hover:border-terminal-dim transition-all"
            >
              Leave Room
            </button>
          </div>
        </div>
      </div>
    )
  }

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
  const currentChar = session.players.find((c) => c.id === session.currentTurnPlayerId)

  const currentAct       = session.scenario.acts.find((a) => a.number === session.act)
  const adversaryClassDef = session.adversary
    ? ADVERSARY_CLASSES.find((c) => c.id === session.adversary!.adversaryClass)
    : null
  const timerEnabled = session.timerDifficulty !== 'none'
  const canAct        = isMyTurn && !busy
  const timerSecs = (() => {
    if (!timerEnabled || !myChar) return 0
    const base       = TIMER_DIFFICULTY_SECONDS[session.timerDifficulty]
    const agiBonus   = Math.max(0, myChar.stats.agility - 1) * 8
    const modeDeduct = session.mode === 'team' ? 30 : 0
    return Math.max(30, base + agiBonus - modeDeduct)
  })()

  const submitAction = async (action: string) => {
    const text = action.trim()
    if (!text) return
    stopTitleFlash()
    setBusy(true); setError(null)
    try { await roomApi.submitAction(membership.code, membership.token, text) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen bg-terminal-bg font-mono flex flex-col">
      {/* ── Top bar — mirrors the facilitator's, minus facilitator-only controls ── */}
      <div className="flex-shrink-0 border-b border-terminal-border bg-terminal-surface">
        <div className="pl-4 pr-4 py-2 flex items-center gap-4">
          <button
            onClick={() => navigate('/lobby')}
            className="flex items-center gap-2 flex-shrink-0 group"
            title="Return to lobby"
          >
            <span className="text-terminal-green font-bold tracking-widest text-sm
              group-hover:text-terminal-green/70 transition-colors">
              ← DICE
            </span>
            <span className="text-terminal-dim text-xs hidden lg:block truncate max-w-[160px]">
              {membership.roomName} · {session.scenario.title}
            </span>
          </button>

          <div className="w-px h-4 bg-terminal-border flex-shrink-0" />

          <div className="flex items-center gap-3 flex-shrink-0 text-xs">
            {session.mode === 'adversary' && adversaryClassDef && (
              <span className={`text-[9px] px-2 py-0.5 rounded border tracking-widest uppercase font-bold
                ${adversaryClassDef.color} ${adversaryClassDef.borderColor} ${adversaryClassDef.bgColor}`}>
                {adversaryClassDef.glyph} ADV
              </span>
            )}
            <span className="text-terminal-dim">
              ACT <span className="text-terminal-amber font-bold">{session.act}</span>
              <span className="text-terminal-dim/40 mx-1">/</span>
              <span className="text-terminal-dim">{session.scenario.acts.length}</span>
            </span>
            <span className="text-terminal-dim">
              RND <span className="text-white font-bold">{session.round}</span>
            </span>
          </div>

          <div className="w-px h-4 bg-terminal-border flex-shrink-0" />

          {currentAct && (
            <div className="flex items-baseline gap-2 flex-1 min-w-0">
              <span className="text-[9px] text-terminal-dim tracking-widest uppercase flex-shrink-0">OBJ</span>
              <span className="text-xs text-gray-300 truncate">{currentAct.primaryObjective}</span>
            </div>
          )}
        </div>

        <div className="px-4 py-1.5 border-t border-terminal-border/50 flex items-center gap-3">
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-32">
              <ScenarioClock
                totalMinutes={session.scenario.scenarioClockStart}
                remainingMinutes={session.scenarioClockRemaining}
              />
            </div>
            {timerEnabled && (
              <div className="w-28">
                {isMyTurn ? (
                  <RoundTimer
                    key={`${session.round}-${session.currentTurnPlayerId}`}
                    seconds={timerSecs}
                    running={canAct}
                    onExpire={() => {}}
                  />
                ) : (
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-mono text-terminal-dim tracking-widest uppercase">Round Timer</span>
                      <span className="text-xs font-mono text-terminal-dim">waiting…</span>
                    </div>
                    <div className="h-1.5 bg-terminal-muted rounded-full overflow-hidden" />
                  </div>
                )}
              </div>
            )}
            {!timerEnabled && (
              <span className="text-[9px] text-terminal-dim/50 tracking-widest">NO TIMER</span>
            )}
          </div>

          {session.activeComplications.length > 0 && (
            <span
              title={session.activeComplications.map((c) => c.replace(/_/g, ' ')).join(', ')}
              className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-terminal-amber/15
                text-terminal-amber border border-terminal-amber/30 cursor-default"
            >
              ⚠ {session.activeComplications.length}
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            <VoiceDMButton />
            <span className={`text-[10px] px-2 py-0.5 rounded border ${connected ? 'border-terminal-green/40 bg-terminal-green/10 text-terminal-green' : 'border-terminal-amber/40 bg-terminal-amber/10 text-terminal-amber'}`}>
              {connected ? '● live' : '○ reconnecting'}
            </span>
          </div>
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
        <ClaimFacilitatorPanel />
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

      {/* Animated dice roll — replays whichever roll (anyone's) just landed */}
      <AnimatePresence>
        {activeRoll && (
          <DiceRollOverlay
            key={activeRoll.feedId}
            player={activeRoll.playerChar}
            action={activeRoll.actionText}
            lastRoll={activeRoll.roll}
            knownResult={activeRoll.roll.raw}
            onRollComplete={() => {}}
            onDismiss={() => setActiveRoll(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
