import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { roomApi } from '../api/rooms'
import { NarrativeFeed } from '../components/NarrativeFeed'
import { DiceRollOverlay } from '../components/DiceRollOverlay'
import { ScenarioClock } from '../components/Timers'
import { VoiceDMButton } from '../components/VoiceDMButton'
import { useVoiceDM } from '../hooks/useVoiceDM'
import { computeXpAwards } from '../utils/xp'
import type { GameSession, FeedEntry, Character, RollRecord } from '../types/game'

interface ServerMessage {
  type: 'session' | 'dm_stream' | 'error'
  session?: GameSession | null
  feed?: FeedEntry[]
  narration?: string
  error?: string
}

// Read-only audience view — no login, no character, no way to affect the
// game. Meant for a projector/conference-room screen following along with a
// live session via a shared "watch" link, separate from the participant flow
// (RoomPlayer.tsx) which requires a DICE account and a room membership.
export function SpectatorView() {
  const { code } = useParams<{ code: string }>()
  const [roomName, setRoomName] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [connected, setConnected] = useState(false)
  const [session, setSession]   = useState<GameSession | null>(null)
  const [feed, setFeed]         = useState<FeedEntry[]>([])
  const [streaming, setStreaming] = useState('')

  const [activeRoll, setActiveRoll] = useState<
    { feedId: string; roll: RollRecord; playerChar: Character; actionText: string } | null
  >(null)
  const knownRollIdsRef = useRef<Set<string> | null>(null)

  const [endedSnapshot, setEndedSnapshot] = useState<{ session: GameSession; feed: FeedEntry[] } | null>(null)

  const { speakChunk, flushChunks } = useVoiceDM()
  const lastSpokenLenRef = useRef(0)

  // Room existence + display name, via the existing unauthenticated lobby endpoint.
  useEffect(() => {
    if (!code) return
    let cancelled = false
    roomApi.getLobby(code).then(({ room }) => { if (!cancelled) setRoomName(room.name) })
      .catch(() => { if (!cancelled) setNotFound(true) })
    return () => { cancelled = true }
  }, [code])

  // Raw WebSocket — deliberately not routed through roomSocket.ts/useGameStore/
  // useRoomStore, which are all built around an authenticated participant's
  // role-branching logic a read-only spectator has no business touching.
  useEffect(() => {
    if (!code || notFound) return
    let socket: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    let intentionalClose = false

    const connect = () => {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      socket = new WebSocket(`${proto}://${window.location.host}/api/rooms/${encodeURIComponent(code)}/ws?spectate=1`)
      socket.onopen = () => setConnected(true)
      socket.onmessage = (event) => {
        let msg: ServerMessage
        try { msg = JSON.parse(event.data) } catch { return }
        if (msg.type === 'session') {
          setSession(msg.session ?? null)
          setFeed(msg.feed ?? [])
          setStreaming('')
        } else if (msg.type === 'dm_stream') {
          setStreaming(msg.narration ?? '')
        } else if (msg.type === 'error') {
          intentionalClose = true
          setNotFound(true)
        }
      }
      socket.onclose = () => {
        setConnected(false)
        if (!intentionalClose) reconnectTimer = setTimeout(connect, 1500)
      }
    }
    connect()

    return () => {
      intentionalClose = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      socket?.close()
    }
  }, [code, notFound])

  // Speak the DM's narration as it streams in, same as the player screen.
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

  // Animate each new roll as it lands — same pattern as RoomPlayer.tsx.
  useEffect(() => {
    const rollEntries = feed.filter((e) => e.type === 'roll_result' && e.roll)
    if (knownRollIdsRef.current === null) {
      knownRollIdsRef.current = new Set(rollEntries.map((e) => e.id))
      return
    }
    const unseen = rollEntries.filter((e) => !knownRollIdsRef.current!.has(e.id))
    if (unseen.length === 0) return
    unseen.forEach((e) => knownRollIdsRef.current!.add(e.id))

    const latest   = unseen[unseen.length - 1]
    const rollChar = session?.players.find((c) => c.id === latest.roll!.player)
    if (!rollChar) return
    const idx       = feed.indexOf(latest)
    const prevEntry = idx > 0 ? feed[idx - 1] : null
    const actionText = prevEntry?.type === 'player_action' && prevEntry.speaker === latest.speaker
      ? prevEntry.text
      : 'Rolling…'
    setActiveRoll({ feedId: latest.id, roll: latest.roll!, playerChar: rollChar, actionText })
  }, [feed, session])

  // Capture the session+feed once, the moment the scenario ends — same
  // decoupled-from-live-state pattern as RoomPlayer.tsx's own results view.
  useEffect(() => {
    if (!endedSnapshot && session &&
        (session.status === 'victory' || session.status === 'defeat' || session.status === 'timeout')) {
      setEndedSnapshot({ session, feed })
    }
  }, [session, feed, endedSnapshot])

  if (notFound) {
    return (
      <div className="min-h-screen bg-terminal-bg font-mono flex items-center justify-center text-center p-6">
        <div>
          <div className="text-sm text-terminal-red tracking-widest uppercase mb-2">Room not found</div>
          <div className="text-xs text-terminal-dim">This room doesn't exist, or the session has ended.</div>
        </div>
      </div>
    )
  }

  if (endedSnapshot) {
    const { session: endSession, feed: endFeed } = endedSnapshot
    const outcome = endSession.status === 'victory' ? 'victory' : endSession.status === 'timeout' ? 'partial' : 'defeat'
    const { total: teamXp } = computeXpAwards(endSession.players, endFeed, outcome)
    const label = outcome === 'victory' ? 'CONTAINED' : outcome === 'partial' ? 'PARTIAL' : 'BREACH'
    const color = outcome === 'defeat' ? 'text-terminal-red' : 'text-terminal-green'

    return (
      <div className="min-h-screen bg-terminal-bg font-mono flex items-center justify-center p-8">
        <div className={`max-w-lg w-full rounded border p-8 ${
          outcome === 'defeat' ? 'border-terminal-red/30 bg-terminal-red/5' : 'border-terminal-green/30 bg-terminal-green/5'
        }`}>
          <div className={`text-4xl font-bold tracking-widest mb-1 ${color}`}>{label}</div>
          <div className="text-sm text-terminal-dim mb-6">
            {endSession.scenario.title} — {outcome === 'defeat' ? endSession.scenario.failureCondition : endSession.scenario.victoryCondition}
          </div>
          <div className="text-xs text-terminal-dim">
            Rounds played: {endSession.round} · Clock remaining: {endSession.scenarioClockRemaining}m · Team XP earned: {teamXp}
          </div>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-terminal-bg font-mono flex items-center justify-center text-center p-6">
        <div>
          <div className="text-sm text-terminal-green tracking-widest uppercase mb-2">
            {roomName ?? 'Loading…'}
          </div>
          <div className="text-xs text-terminal-dim">Waiting for the facilitator to start the session.</div>
        </div>
      </div>
    )
  }

  const stages  = session.scenario.killChainStages
  const reached = session.attackerProgress

  return (
    <div className="min-h-screen bg-terminal-bg font-mono flex flex-col">
      <div className="flex-shrink-0 border-b border-terminal-border bg-terminal-surface px-5 py-3 flex items-center gap-4">
        <div className="min-w-0">
          <div className="text-[10px] text-terminal-dim tracking-widest uppercase">{roomName} · Spectating</div>
          <div className="text-sm font-bold text-white truncate">{session.scenario.title}</div>
        </div>
        <div className="w-32 flex-shrink-0">
          <ScenarioClock totalMinutes={session.scenario.scenarioClockStart} remainingMinutes={session.scenarioClockRemaining} />
        </div>
        <div className="ml-auto flex items-center gap-4 text-xs flex-shrink-0">
          <div className="text-center"><div className="text-white font-bold">A{session.act}·R{session.round}</div><div className="text-[9px] text-terminal-dim">act·round</div></div>
          <VoiceDMButton />
          <span className={`text-[10px] px-2 py-0.5 rounded border ${connected ? 'border-terminal-green/40 bg-terminal-green/10 text-terminal-green' : 'border-terminal-amber/40 bg-terminal-amber/10 text-terminal-amber'}`}>
            {connected ? '● live' : '○ reconnecting'}
          </span>
        </div>
      </div>

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

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <NarrativeFeed entries={feed} streamingText={streaming} />
      </div>

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
