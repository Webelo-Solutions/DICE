import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { computeXpAwards } from '../utils/xp'
import { useRoomStore } from '../store/roomStore'
import { roomApi } from '../api/rooms'
import { NarrativeFeed } from '../components/NarrativeFeed'
import { DiceRollOverlay } from '../components/DiceRollOverlay'
import { ScenarioClock, RoundTimer } from '../components/Timers'
import { CharacterCard } from '../components/CharacterCard'
import { InitiativeTracker } from '../components/InitiativeTracker'
import { RotationPanel } from '../components/RotationPanel'
import { ActionMenu } from '../components/ActionMenu'
import { callDM, callDMHint } from '../engine/dmClient'
import { callAdversaryOptions, callAdversaryNarrate, getEvasionModifier } from '../engine/adversaryClient'
import { computeModifier, adjudicateRoll, outcomeTierColor, outcomeTierLabel, rollD20 } from '../engine/dice'
import type { RollContext } from '../engine/dice'
import type { RollRecord, OutcomeTier, StatKey } from '../types/game'
import { TIMER_DIFFICULTY_SECONDS } from '../types/game'
import type { DMResponse } from '../types/dm'
import { ADVERSARY_CLASSES } from '../types/adversary'
import type { AdversaryTacticOption } from '../types/adversary'
import { FacilitatorPanel } from '../components/FacilitatorPanel'
import { StakeholderPanel } from '../components/StakeholderPanel'
import { LiveXPScorecard } from '../components/LiveXPScorecard'
import { ThreatPulse } from '../components/ThreatPulse'
import { CommSettingsModal } from '../components/CommSettingsModal'
import { VoiceDMButton } from '../components/VoiceDMButton'
import { useVoiceDM } from '../hooks/useVoiceDM'
import { postWebhookEvent, PLATFORM_LABEL } from '../engine/webhookClient'
import { TACTIC_MAP } from '../data/attackTactics'

function uid() { return crypto.randomUUID() }

export function GameSession() {
  const navigate = useNavigate()
  const store    = useGameStore()
  const {
    session, feed, isDMThinking, providerConfig,
    appendFeed, applyDMResponse, applyAdversaryRoll, markRoundTimerExpired, advanceTurn, endSession,
    updateSessionPlayer, markTraitUsed, reassignActor,
  } = store

  const { speakChunk, flushChunks, speak: speakDM, cancel: cancelSpeech } = useVoiceDM()

  const [streamingText,   setStreamingText]   = useState('')
  const [waitingForRoll,  setWaitingForRoll]  = useState(false)
  const [pendingAction,   setPendingAction]   = useState('')
  const [lastRoll,        setLastRoll]        = useState<RollRecord | null>(null)
  const [dcHint,          setDcHint]          = useState<number | null>(null)
  const [timerKey,        setTimerKey]        = useState(0)
  const [timerRunning,    setTimerRunning]    = useState(false)
  // Pauses the round timer while the player has focus in the action textarea.
  const [isTyping,        setIsTyping]        = useState(false)
  const [dcPenalty,       setDcPenalty]       = useState(0)   // accumulated from Analyst hints
  // Momentum: consecutive Success/Critical Hit count per player, reset on
  // anything less. Rally: +2 declared by a teammate for the CURRENT turn
  // player's next roll only, consumed the instant that roll resolves.
  const [momentumStreak,  setMomentumStreak]  = useState<Record<string, number>>({})
  const [rallyBonus,      setRallyBonus]      = useState(0)
  // Composure / Second Wind: pauses the turn right after a qualifying roll
  // (Critical Fail / Failure) so the player can choose whether to spend the
  // trait before the DM narrates the consequences.
  const [pendingTraitDecision, setPendingTraitDecision] = useState<{
    roll:  RollRecord
    trait: 'Composure' | 'Second Wind'
  } | null>(null)
  const [hintStreaming,     setHintStreaming]     = useState('')
  const [isHinting,         setIsHinting]         = useState(false)
  const [statOverride,      setStatOverride]      = useState<StatKey | null>(null)
  const [facilitatorOpen,   setFacilitatorOpen]   = useState(false)
  const [intelOpen,         setIntelOpen]         = useState(false)
  const [commOpen,          setCommOpen]          = useState(false)
  const [showRollOverlay, setShowRollOverlay] = useState(false)
  const [actTransition, setActTransition] = useState<{
    newAct: number
    objective: string
    bossEvent: string | null
  } | null>(null)

  // ── Adversary mode state ──────────────────────────────────────────────────
  const [adversaryPhase,         setAdversaryPhase]         = useState(false)
  const [adversaryOptionsLoading, setAdversaryOptionsLoading] = useState(false)
  const [adversaryOptions,        setAdversaryOptions]        = useState<AdversaryTacticOption[]>([])
  const [adversaryObjective,      setAdversaryObjective]      = useState('')
  const [adversarySelectedAction, setAdversarySelectedAction] = useState<AdversaryTacticOption | null>(null)
  const [adversaryWaitingForRoll, setAdversaryWaitingForRoll] = useState(false)
  const [adversaryStreaming,      setAdversaryStreaming]      = useState('')
  const [adversaryLastRoll,       setAdversaryLastRoll]       = useState<RollRecord | null>(null)
  const lastAdvNarLenRef  = useRef(0)
  const adversaryPhaseRef = useRef(false)   // guard against double-trigger

  const hasInitialized  = useRef(false)
  const lastNarLenRef   = useRef(0)
  const hasEndedRoomRef = useRef(false)

  const commConfig = useGameStore((s) => s.commConfig)

  // Room mode: a relayed player action waiting for the facilitator's engine.
  const incomingAction = useRoomStore((s) => s.incomingAction)
  const roomRole       = useRoomStore((s) => s.membership?.role)
  const roomStreaming  = useRoomStore((s) => s.streamingNarration)
  const roomParticipants = useRoomStore((s) => s.participants)
  const [autoRoll, setAutoRoll] = useState(false)

  // ── Departmental rotation ────────────────────────────────────────────────
  // The rotation skips anyone without an open socket rather than handing them
  // a turn nobody is there to take (decision D14), so every advance needs the
  // live connectivity set. Connection state lives in roomStore, not in the
  // session, so it is read here and passed down.
  const isDepartmental = session?.mode === 'departmental'
  const connectedIds = useMemo(
    () => roomParticipants.filter((p) => p.connected).map((p) => p.id),
    [roomParticipants],
  )
  // Solo replay of a departmental session (no room attached) has no
  // connectivity to speak of — treat everyone as available rather than stalling.
  const eligibleIds = roomParticipants.length > 0 ? connectedIds : undefined

  // Speak the facilitator's own room-streamed narration too — it's already
  // shown visually via NarrativeFeed (below) but was never fed to the voice
  // narrator. Guarded to room mode only so solo mode's own speakChunk call
  // sites (which stream from a direct AI call, not roomStreaming) aren't
  // double-triggered.
  const lastRoomSpokenLenRef = useRef(0)
  useEffect(() => {
    if (!roomRole) return
    if (roomStreaming) {
      const newChars = roomStreaming.slice(lastRoomSpokenLenRef.current)
      lastRoomSpokenLenRef.current = roomStreaming.length
      if (newChars) speakChunk(newChars)
    } else if (lastRoomSpokenLenRef.current > 0) {
      flushChunks()
      lastRoomSpokenLenRef.current = 0
    }
  }, [roomStreaming, roomRole, speakChunk, flushChunks])

  const currentPlayer   = session?.players.find((p) => p.id === session.currentTurnPlayerId)
  const adversaryPlayer = session?.adversary
    ? session.players.find((p) => p.id === session.adversary!.playerId)
    : null
  const adversaryClassDef = session?.adversary
    ? ADVERSARY_CLASSES.find((c) => c.id === session.adversary!.adversaryClass)
    : null

  // ── Session init ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session || hasInitialized.current || session.phase === 'turn') return
    hasInitialized.current = true
    runDM('', 'init')
  }, [session?.id])

  // ── Watch for end condition ───────────────────────────────────────────────
  // 'timeout' = the engine's hard real-time backstop force-concluded the
  // session (see gameStore.ts applyDMResponse) — reads as a 'partial' result,
  // not a loss, since the team may well have been on track.
  useEffect(() => {
    if (session?.status === 'defeat' || session?.status === 'victory' || session?.status === 'timeout') {
      const hintsUsed     = feed.filter((e) => e.type === 'hint').length
      const timerExpiries = feed.filter((e) => e.type === 'system' && e.speaker === 'TIMER').length
      const critHits      = feed.filter((e) => e.outcome === 'critical_hit').length
      const critFails     = feed.filter((e) => e.outcome === 'critical_fail').length

      const outcome = session.status === 'victory' ? 'victory' : session.status === 'timeout' ? 'partial' : 'defeat'
      // Individual XP per player, computed from their own rolls throughout the
      // session — matches what LiveXPScorecard showed live, not an even split.
      const { perPlayer: xpByPlayer, total: finalXpAwarded } = computeXpAwards(session.players, feed, outcome)

      // Room mode: the facilitator's own roster doesn't contain the players'
      // characters (each belongs to its own owner's account), so endSession's
      // local roster XP write below is a no-op for them. Write their earned
      // XP back to their own persisted characters server-side instead.
      const membership = useRoomStore.getState().membership
      if (membership?.role === 'facilitator' && !hasEndedRoomRef.current) {
        hasEndedRoomRef.current = true
        roomApi.endRoom(
          membership.code, membership.token,
          session.players.map((p) => ({ characterId: p.id, xpAwarded: xpByPlayer[p.id] ?? 0 })),
        ).catch((e) => console.error('[room] failed to write back player XP', e))
      }

      endSession({
        outcome,
        xpAwarded:          finalXpAwarded,
        xpByPlayer,
        criticalHits:       critHits,
        criticalFails:      critFails,
        injectsSurvived:    feed.filter((e) => e.type === 'inject').length,
        criticalInjectsFired: feed.filter((e) => e.type === 'inject' &&
          (e.speaker === '! INJECT [CRITICAL HIT]' || e.speaker === '! INJECT [CRITICAL FAIL]')).length,
        clockRemaining:     session.scenarioClockRemaining,
        roundsPlayed:       session.round,
        startedAt:          session.startedAt,
        endedAt:            Date.now(),
        actsCompleted:      session.act,
        finalAttackerStage: session.attackerProgress[session.attackerProgress.length - 1],
        hintsUsed,
        timerExpiries,
      })
      cancelSpeech()
      navigate('/end')
    }
  }, [session?.status])

  const runDM = async (action: string, phase: 'init' | 'turn') => {
    // Read the freshest session from the store, not the closure: handleDiceRollComplete
    // sets the new roll via setState immediately before calling runDM, so the closure
    // `session` still holds the previous roll. Using getState() avoids narrating a turn behind.
    const current = useGameStore.getState().session
    if (!current) return
    setStreamingText('')
    lastNarLenRef.current = 0

    try {
      const orgState   = useGameStore.getState().orgState
      const orgProfile = useGameStore.getState().activeOrgProfile
      const membership = useRoomStore.getState().membership
      let response: DMResponse

      if (membership && membership.role === 'facilitator') {
        // Room mode: the server runs the DM with its in-memory key (M4).
        const payload = { session: { ...current, phase }, action, phase, orgState, orgProfile }
        try {
          response = await roomApi.runServerDM(membership.code, membership.token, payload)
        } catch (err) {
          // Server lost the in-memory key (e.g. it restarted) — re-send once and retry.
          if (providerConfig && String(err).includes('No AI provider')) {
            await roomApi.setDmProvider(membership.code, membership.token, providerConfig)
            response = await roomApi.runServerDM(membership.code, membership.token, payload)
          } else { throw err }
        }
      } else {
        // Solo: client-side call with live token streaming for the typewriter + TTS.
        let buffer = ''
        response = await callDM(
          providerConfig!,
          { ...current, phase },
          action,
          (chunk) => {
            buffer += chunk
            const match = buffer.match(/"narration"\s*:\s*"((?:[^"\\]|\\.)*)/)
            if (match) {
              const narration = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"')
              setStreamingText(narration)
              const newChars = narration.slice(lastNarLenRef.current)
              lastNarLenRef.current = narration.length
              if (newChars) speakChunk(newChars)
            }
          },
          orgState,
          orgProfile,
        )
      }

      setStreamingText('')
      flushChunks()   // speak any partial sentence left in the buffer

      appendFeed({
        id:        uid(),
        type:      'dm_narration',
        speaker:   'DM',
        text:      response.narration,
        timestamp: Date.now(),
      })

      if (response.inject?.description) {
        appendFeed({
          id:        uid(),
          type:      'inject',
          speaker:   '! INJECT',
          text:      [response.inject.description, response.inject.mechanicalEffect].filter(Boolean).join('\n'),
          timestamp: Date.now(),
        })
      }

      setDcHint(response.dcHint)
      applyDMResponse(response)

      // Detect act transition signalled by the DM
      if (response.stateChanges.actChange !== null) {
        const newActNum = response.stateChanges.actChange
        const newActData = current.scenario.acts.find((a) => a.number === newActNum)
        appendFeed({
          id:        uid(),
          type:      'system',
          speaker:   `ACT ${newActNum}`,
          text:      newActData?.primaryObjective ?? `Act ${newActNum} begins.`,
          timestamp: Date.now(),
        })
        setActTransition({
          newAct:     newActNum,
          objective:  newActData?.primaryObjective ?? '',
          bossEvent:  newActData?.bossEvent ?? null,
        })
      }

      if (commConfig?.webhookUrl && response.narration) {
        postWebhookEvent(commConfig, `📖 DM: ${response.narration}`)
      }

      if (phase !== 'init') advanceTurn(eligibleIds)

      setTimerKey((k) => k + 1)
      setTimerRunning(true)
    } catch (err) {
      appendFeed({
        id:        uid(),
        type:      'system',
        speaker:   'SYSTEM',
        text:      `DM connection error: ${String(err)}`,
        timestamp: Date.now(),
      })
      setStreamingText('')
      useGameStore.setState((s) => ({
        isDMThinking: false,
        session: s.session ? { ...s.session, scriptedCriticalEffect: null } : null,
      }))
    }
  }

  // Step 1: player selects or declares an action
  const handleActionSubmit = (action: string, stat: StatKey | null = null, additionalPenalty = 0) => {
    if (!session || !currentPlayer || isDMThinking || waitingForRoll) return
    setTimerRunning(false)
    setIsTyping(false)   // textarea unmounts on submit; onBlur may not fire
    if (additionalPenalty > 0) setDcPenalty((p) => p + additionalPenalty)
    setStatOverride(stat)
    setLastRoll(null)        // clear previous turn's result so overlay starts clean
    setShowRollOverlay(true)

    appendFeed({
      id:        uid(),
      type:      'player_action',
      speaker:   currentPlayer.name,
      text:      action,
      timestamp: Date.now(),
    })

    setPendingAction(action)
    setWaitingForRoll(true)
  }

  // Shared tail of roll resolution — used both when no trait decision is
  // needed and after Composure/Second Wind resolve (or are declined).
  const finalizeRoll = (roll: RollRecord) => {
    setLastRoll(roll)
    // Momentum bookkeeping lives here so it only fires once per roll,
    // regardless of whether a trait decision paused the flow in between.
    const extendsMomentum = roll.outcome === 'success' || roll.outcome === 'critical_hit'
    setMomentumStreak((prev) => ({
      ...prev,
      [roll.player]: extendsMomentum ? (prev[roll.player] ?? 0) + 1 : 0,
    }))
    if (roll.outcome === 'critical_hit' || roll.outcome === 'critical_fail') {
      useGameStore.getState().resolveCriticalInject(roll.outcome)
    }
    useGameStore.setState((s) => ({
      session: s.session ? { ...s.session, lastRoll: roll } : null,
      isDMThinking: true,
    }))
    runDM(pendingAction, 'turn')
  }

  // Step 2: player clicks die — animation runs in DiceRoller, result fires here
  const handleDiceRollComplete = (raw: number) => {
    if (!session || !currentPlayer) return

    const dc      = (dcHint ?? 12) + dcPenalty
    const rollCtx: RollContext = {
      round:                session.round,
      timerExpired:         session.roundTimerExpired,
      consecutiveSuccesses: momentumStreak[currentPlayer.id] ?? 0,
    }
    const { modifier: baseModifier, traitsApplied } = computeModifier(currentPlayer, pendingAction, dc, statOverride ?? undefined, rollCtx)
    const modifier = baseModifier + rallyBonus
    setDcPenalty(0)      // reset after roll consumes the penalty
    setRallyBonus(0)     // reset after roll consumes the buff
    setStatOverride(null)
    const outcome  = adjudicateRoll(raw, modifier, dc)

    const roll: RollRecord = {
      player:   currentPlayer.id,
      raw,
      modifier,
      total:    raw + modifier,
      dc,
      outcome,
      traitsApplied: traitsApplied.length > 0 ? traitsApplied : undefined,
    }

    setWaitingForRoll(false)

    appendFeed({
      id:        uid(),
      type:      'roll_result',
      speaker:   currentPlayer.name,
      text:      `Roll ${roll.total} vs DC ${dc}`,
      timestamp: Date.now(),
      roll,
      outcome,
    })

    if (commConfig?.webhookUrl) {
      const outcomeLabel = outcome.replace(/_/g, ' ').toUpperCase()
      postWebhookEvent(
        commConfig,
        `🎲 ${currentPlayer.name} rolled ${roll.total} vs DC ${dc} — ${outcomeLabel}`,
      )
    }

    const usedByPlayer = session.usedOnceTraits?.[currentPlayer.id] ?? []
    const canUseComposure  = outcome === 'critical_fail' && currentPlayer.traits.includes('Composure')  && !usedByPlayer.includes('Composure')
    const canUseSecondWind = outcome === 'failure'       && currentPlayer.traits.includes('Second Wind') && !usedByPlayer.includes('Second Wind')

    if (canUseComposure)       { setPendingTraitDecision({ roll, trait: 'Composure'  }); return }
    if (canUseSecondWind)      { setPendingTraitDecision({ roll, trait: 'Second Wind' }); return }

    finalizeRoll(roll)
  }

  // Player's choice on the Composure / Second Wind prompt raised above.
  const resolveTraitDecision = (useTrait: boolean) => {
    if (!pendingTraitDecision || !currentPlayer) return
    const { roll, trait } = pendingTraitDecision
    setPendingTraitDecision(null)

    if (!useTrait) { finalizeRoll(roll); return }

    markTraitUsed(currentPlayer.id, trait)

    if (trait === 'Composure') {
      const downgraded: RollRecord = { ...roll, outcome: 'failure' }
      appendFeed({
        id: uid(), type: 'system', speaker: 'COMPOSURE', timestamp: Date.now(),
        text: `${currentPlayer.name} uses Composure — the Critical Fail is downgraded to a Failure.`,
        player: currentPlayer.id,
      })
      finalizeRoll(downgraded)
      return
    }

    // Second Wind: reroll and keep the better of the two totals.
    const secondRaw    = rollD20()
    const secondTotal   = secondRaw + roll.modifier
    const secondOutcome = adjudicateRoll(secondRaw, roll.modifier, roll.dc)
    const kept = secondTotal > roll.total
      ? { ...roll, raw: secondRaw, total: secondTotal, outcome: secondOutcome }
      : roll
    appendFeed({
      id: uid(), type: 'system', speaker: 'SECOND WIND', timestamp: Date.now(),
      text: `${currentPlayer.name} uses Second Wind — reroll ${secondTotal} vs DC ${roll.dc} `
        + `(kept the ${kept === roll ? 'original' : 'reroll'}).`,
      player: currentPlayer.id,
    })
    finalizeRoll(kept)
  }

  // Rally: any OTHER player with an unused Rally can buff the current turn
  // player's upcoming roll — a free action declared before that roll happens.
  const handleRallyClick = (fromPlayerId: string) => {
    if (!currentPlayer) return
    const fromPlayer = session?.players.find((p) => p.id === fromPlayerId)
    markTraitUsed(fromPlayerId, 'Rally')
    setRallyBonus(2)
    appendFeed({
      id: uid(), type: 'system', speaker: 'RALLY', timestamp: Date.now(),
      text: `${fromPlayer?.name ?? 'A teammate'} rallies the team — +2 to ${currentPlayer.name}'s next roll.`,
      player: fromPlayerId,
    })
  }

  // ── Room mode (facilitator): auto-process a relayed player action ─────────
  // When a player submits on their turn, the server relays it here. The
  // facilitator's client runs it through the normal action flow with an
  // auto-roll, and the resulting feed broadcasts back to all players.
  useEffect(() => {
    if (roomRole !== 'facilitator' || !incomingAction) return
    if (!session || isDMThinking || waitingForRoll) return   // process only when idle
    // Departmental turns are held by a participant, and two people staffing the
    // same role share nothing but that role — so the character id alone cannot
    // say whether this action came from whoever is actually up.
    const isCurrent = isDepartmental
      ? session.currentActor?.participantId === incomingAction.participantId
      : session.currentTurnPlayerId === incomingAction.characterId
    if (!isCurrent) {
      useRoomStore.getState().clearIncomingAction()   // stale — turn already moved on
      return
    }
    const text = incomingAction.text
    useRoomStore.getState().clearIncomingAction()
    handleActionSubmit(text)
    setAutoRoll(true)
  }, [incomingAction, roomRole, session?.currentTurnPlayerId, session?.currentActor?.participantId, isDMThinking, waitingForRoll])

  // Second half of the auto-process: once the action is staged and waiting for
  // a roll, just clear the flag — the DiceRollOverlay self-rolls on mount and
  // reports its result back via onRollComplete → handleDiceRollComplete, exactly
  // like the solo flow. (Previously this effect generated a SEPARATE random
  // number and called handleDiceRollComplete with it, which raced the overlay's
  // own rollD20 and produced a visible mismatch between the die face and the
  // recorded `raw`.)
  useEffect(() => {
    if (!autoRoll || !waitingForRoll || isDMThinking) return
    setAutoRoll(false)
  }, [autoRoll, waitingForRoll, isDMThinking])

  const handleTimerExpire = () => {
    // Departmental: the turn belongs to the ROLE, so a silent actor forfeits it
    // to the next person in that role's pool rather than costing the whole role
    // its action (decision D14). The round does not advance.
    if (isDepartmental && session?.currentActor) {
      const forfeiting = session.currentActor
      const seat = session.seats?.find((s) => s.participantId === forfeiting.participantId)
      reassignActor(eligibleIds)
      const next = useGameStore.getState().session?.currentActor
      if (next && next.participantId !== forfeiting.participantId) {
        const nextSeat = session.seats?.find((s) => s.participantId === next.participantId)
        appendFeed({
          id:        uid(),
          type:      'system',
          speaker:   'TIMER',
          text:      `${seat?.displayName ?? 'The acting responder'} did not call it in time — ${nextSeat?.displayName ?? 'the next responder'} picks up the ${forfeiting.role} action.`,
          timestamp: Date.now(),
        })
        return
      }
      // Nobody else in the role is reachable — fall through to the standard
      // penalty so the turn still costs something.
    }
    markRoundTimerExpired()
    appendFeed({
      id:        uid(),
      type:      'system',
      speaker:   'TIMER',
      text:      'Round timer expired. Action difficulty increased (+4 DC).',
      timestamp: Date.now(),
    })
  }

  // ── Adversary phase: trigger when a new round starts in adversary mode ────
  const prevRoundRef = useRef(1)
  useEffect(() => {
    if (!session || session.mode !== 'adversary' || session.phase !== 'turn') return
    if (session.round > prevRoundRef.current && !adversaryPhaseRef.current) {
      prevRoundRef.current = session.round
      adversaryPhaseRef.current = true
      handleAdversaryPhaseStart()
    }
  }, [session?.round, session?.phase])

  const handleAdversaryPhaseStart = async () => {
    const s   = useGameStore.getState().session
    const adv = s?.adversary
    if (!s || !adv || !providerConfig) return

    setAdversaryPhase(true)
    setAdversaryOptionsLoading(true)
    setAdversaryOptions([])
    setAdversarySelectedAction(null)
    setAdversaryLastRoll(null)
    setTimerRunning(false)

    appendFeed({
      id:        uid(),
      type:      'system',
      speaker:   'ADVERSARY',
      text:      `Round ${s.round - 1} complete — adversary is moving.`,
      timestamp: Date.now(),
    })

    try {
      const result = await callAdversaryOptions(providerConfig, s, adv)
      setAdversaryOptions(result.options)
      setAdversaryObjective(result.currentObjective)
    } catch (err) {
      appendFeed({
        id:        uid(),
        type:      'system',
        speaker:   'SYSTEM',
        text:      `Adversary AI error: ${String(err)}`,
        timestamp: Date.now(),
      })
      setAdversaryPhase(false)
      adversaryPhaseRef.current = false
    } finally {
      setAdversaryOptionsLoading(false)
    }
  }

  const handleAdversaryActionSelect = (option: AdversaryTacticOption) => {
    setAdversarySelectedAction(option)
    setAdversaryLastRoll(null)
    setAdversaryWaitingForRoll(true)
  }

  const handleAdversaryRollComplete = async (raw: number) => {
    const s   = useGameStore.getState().session
    const adv = s?.adversary
    if (!s || !adv || !adversarySelectedAction || !providerConfig) return

    const modifier    = getEvasionModifier(adv.adversaryClass)
    const total       = raw + modifier
    const dc          = adversarySelectedAction.detectionDC
    const evaded      = raw === 20 || total >= dc
    const adversaryChar = s.players.find((p) => p.id === adv.playerId)!

    const evasionRoll: RollRecord = {
      player:   adv.playerId,
      raw,
      modifier,
      total,
      dc,
      outcome:  raw === 1 ? 'critical_fail' : evaded ? (raw === 20 ? 'critical_hit' : 'success') : 'failure',
    }
    setAdversaryLastRoll(evasionRoll)
    setAdversaryWaitingForRoll(false)

    appendFeed({
      id:        uid(),
      type:      'adversary_action',
      speaker:   adversaryChar.name,
      text:      adversarySelectedAction.text,
      timestamp: Date.now(),
      roll:      evasionRoll,
      outcome:   evasionRoll.outcome,
    })

    const stageAdvanced  = evaded && adversarySelectedAction.targetStage
      ? adversarySelectedAction.targetStage
      : null
    const stealthDelta   = evaded ? 0 : -adversarySelectedAction.stealthCost
    const newStealth     = Math.max(0, Math.min(100, adv.stealthScore + stealthDelta))

    useGameStore.setState({ isDMThinking: true })
    lastAdvNarLenRef.current = 0

    try {
      const result = await callAdversaryNarrate(
        providerConfig,
        s,
        adv,
        adversarySelectedAction.text,
        { raw, modifier, total, detectionDC: dc, evaded },
        stageAdvanced,
        newStealth,
        (chunk) => {
          const buf = adversaryStreaming + chunk
          const match = buf.match(/"attackerNarration"\s*:\s*"((?:[^"\\]|\\.)*)/)
          if (match) {
            const narration = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"')
            setAdversaryStreaming(narration)
            const newChars = narration.slice(lastAdvNarLenRef.current)
            lastAdvNarLenRef.current = narration.length
            if (newChars) speakChunk(newChars)
          }
        },
      )

      setAdversaryStreaming('')
      flushChunks()

      applyAdversaryRoll(evaded, stageAdvanced, stealthDelta, result.complicationsAdded)

      if (result.attackerNarration) {
        appendFeed({
          id:        uid(),
          type:      'adversary_narration',
          speaker:   adversaryChar.name,
          text:      result.attackerNarration,
          timestamp: Date.now(),
        })
      }

      if (result.defenderObservable) {
        appendFeed({
          id:        uid(),
          type:      'dm_narration',
          speaker:   'DM',
          text:      result.defenderObservable,
          timestamp: Date.now(),
        })
      }
    } catch (err) {
      appendFeed({
        id:        uid(),
        type:      'system',
        speaker:   'SYSTEM',
        text:      `Adversary narration error: ${String(err)}`,
        timestamp: Date.now(),
      })
      applyAdversaryRoll(evaded, stageAdvanced, stealthDelta, [])
    } finally {
      useGameStore.setState({ isDMThinking: false })
      setAdversaryPhase(false)
      setAdversarySelectedAction(null)
      setAdversaryOptions([])
      adversaryPhaseRef.current = false
      setTimerKey((k) => k + 1)
      setTimerRunning(true)
    }
  }

  const handleHint = async () => {
    if (!session || isHinting || !canAct) return
    const isAnalyst = session.timerDifficulty === 'analyst'
    setIsHinting(true)
    setHintStreaming('')

    try {
      const hintText = await callDMHint(providerConfig!, session, (chunk) => {
        setHintStreaming((prev) => prev + chunk)
      })

      setHintStreaming('')
      appendFeed({
        id:        uid(),
        type:      'hint',
        speaker:   isAnalyst ? 'HINT  [DC +2 next roll]' : 'HINT',
        text:      hintText,
        timestamp: Date.now(),
      })
      speakDM(hintText)

      if (isAnalyst) setDcPenalty((p) => p + 2)
    } catch (err) {
      setHintStreaming('')
      appendFeed({
        id:        uid(),
        type:      'system',
        speaker:   'SYSTEM',
        text:      `Hint unavailable: ${String(err)}`,
        timestamp: Date.now(),
      })
    } finally {
      setIsHinting(false)
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-terminal-bg flex items-center justify-center font-mono">
        <div className="text-terminal-dim">
          No active session.{' '}
          <button onClick={() => navigate('/')} className="text-terminal-green underline">
            Return home.
          </button>
        </div>
      </div>
    )
  }

  const timerEnabled = session.timerDifficulty !== 'none'

  const timerSecs = (() => {
    if (!timerEnabled || !currentPlayer) return 0
    const base       = TIMER_DIFFICULTY_SECONDS[session.timerDifficulty]
    const agiBonus   = Math.max(0, currentPlayer.stats.agility - 1) * 8
    const modeDeduct = session.mode === 'team' ? 30 : 0
    return Math.max(30, base + agiBonus - modeDeduct)
  })()

  // Player can act when: DM done, not waiting for roll, turn phase active, not adversary phase
  const canAct = !isDMThinking && !waitingForRoll && session.phase === 'turn' && !adversaryPhase

  const currentAct = session.scenario.acts.find((a) => a.number === session.act)

  return (
    <div className="h-screen bg-terminal-bg font-mono flex flex-col overflow-hidden">

      {/* ── Single unified top bar ── */}
      <div className="flex-shrink-0 border-b border-terminal-border bg-terminal-surface">

        {/* Row 1 — live state: identity · act/round · objective. */}
        <div className="pl-4 pr-4 py-2 flex items-center gap-4">

          {/* Brand + title — click to return to landing */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 flex-shrink-0 group"
            title="Return to title screen"
          >
            <span className="text-terminal-green font-bold tracking-widest text-sm
              group-hover:text-terminal-green/70 transition-colors">
              ← DICE
            </span>
            <span className="text-terminal-dim text-xs hidden lg:block truncate max-w-[160px]">
              {session.scenario.title}
            </span>
          </button>

          {/* Divider */}
          <div className="w-px h-4 bg-terminal-border flex-shrink-0" />

          {/* Act / Round pills */}
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

          {/* Divider */}
          <div className="w-px h-4 bg-terminal-border flex-shrink-0" />

          {/* Objective — truncated single line */}
          {currentAct && (
            <div className="flex items-baseline gap-2 flex-1 min-w-0">
              <span className="text-[9px] text-terminal-dim tracking-widest uppercase flex-shrink-0">OBJ</span>
              <span className="text-xs text-gray-300 truncate">{currentAct.primaryObjective}</span>
            </div>
          )}
        </div>

        {/* Row 2 — status meters (left) + controls (right) */}
        <div className="px-4 py-1.5 border-t border-terminal-border/50 flex items-center gap-3">

          {/* Clocks */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-32">
              <ScenarioClock
                totalMinutes={session.scenario.scenarioClockStart}
                remainingMinutes={session.scenarioClockRemaining}
              />
            </div>
            {timerEnabled && (canAct || waitingForRoll) && (
              <div className="w-28">
                <RoundTimer
                  key={timerKey}
                  seconds={timerSecs}
                  running={timerRunning && canAct && !isTyping}
                  onExpire={handleTimerExpire}
                />
              </div>
            )}
            {!timerEnabled && (
              <span className="text-[9px] text-terminal-dim/50 tracking-widest">NO TIMER</span>
            )}
          </div>

          {/* Complications — count badge only */}
          {session.activeComplications.length > 0 && (
            <span
              title={session.activeComplications.map((c) => c.replace(/_/g, ' ')).join(', ')}
              className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-terminal-amber/15
                text-terminal-amber border border-terminal-amber/30 cursor-default"
            >
              ⚠ {session.activeComplications.length}
            </span>
          )}

          {/* Controls sit at the right edge */}
          <div className="ml-auto flex items-center gap-2">

            {/* Intel toggle */}
            {currentAct && currentAct.clues.length > 0 && (
              <button
                onClick={() => setIntelOpen((o) => !o)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px]
                  font-semibold tracking-widest uppercase transition-all ${
                  intelOpen
                    ? 'border-terminal-blue/60 bg-terminal-blue/15 text-terminal-blue'
                    : 'border-terminal-border text-terminal-dim hover:border-terminal-dim hover:text-white'
                }`}
              >
                Intel
                <span className="text-[9px] opacity-70">({currentAct.clues.length})</span>
                <span className="text-[9px]">{intelOpen ? '▲' : '▼'}</span>
              </button>
            )}

            {/* Comms button */}
            {commConfig ? (
              <div className="flex-shrink-0 flex items-center gap-1">
                <a
                  href={commConfig.joinUrl || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`px-2.5 py-1 rounded-l border border-r-0 text-[10px] font-semibold
                    tracking-widest uppercase transition-all
                    border-terminal-blue/40 bg-terminal-blue/10 text-terminal-blue
                    hover:bg-terminal-blue/20 ${!commConfig.joinUrl ? 'pointer-events-none opacity-40' : ''}`}
                >
                  💬 {PLATFORM_LABEL[commConfig.platform]}
                </a>
                <button
                  onClick={() => setCommOpen(true)}
                  title="Edit comms settings"
                  className="px-1.5 py-1 rounded-r border border-terminal-blue/40 bg-terminal-blue/10
                    text-terminal-blue/60 hover:text-terminal-blue hover:bg-terminal-blue/20
                    text-[10px] transition-all"
                >
                  ⚙
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCommOpen(true)}
                className="flex-shrink-0 px-2.5 py-1 rounded border text-[10px] font-semibold
                  tracking-widest uppercase transition-all
                  border-terminal-border text-terminal-dim/50
                  hover:border-terminal-blue/40 hover:text-terminal-blue/70"
              >
                💬 Comms
              </button>
            )}

            {/* Voice DM */}
            <VoiceDMButton />

            {/* Facilitator toggle */}
            <button
              onClick={() => setFacilitatorOpen((o) => !o)}
              className={`flex-shrink-0 px-2.5 py-1 rounded border text-[10px] font-semibold
                tracking-widest uppercase transition-all ${
                facilitatorOpen
                  ? 'border-terminal-amber bg-terminal-amber/20 text-terminal-amber'
                  : 'border-terminal-amber/30 bg-terminal-amber/5 text-terminal-amber/60 hover:bg-terminal-amber/10 hover:border-terminal-amber/60'
              }`}
            >
              Facilitator
            </button>
          </div>
        </div>

        {/* Intel dropdown — slides in below the bar */}
        {intelOpen && currentAct && currentAct.clues.length > 0 && (
          <div className="border-t border-terminal-blue/20 bg-terminal-blue/5 px-4 py-3">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
              {currentAct.clues.map((clue, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span className="text-[9px] text-terminal-blue/50 mt-0.5 flex-shrink-0">{i + 1}.</span>
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 leading-snug">{clue.text}</p>
                    {clue.techniqueId && (
                      <span className="inline-flex items-center gap-1 mt-0.5 text-[9px] text-terminal-blue/60
                        font-mono tracking-wide">
                        {clue.techniqueId} · {clue.techniqueName}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <div className="w-56 flex-shrink-0 border-r border-terminal-border p-4 space-y-6 overflow-y-auto">
          {/* Departmental sessions run on a ROLE order, and twenty character
              cards would bury the sidebar — so the rotation replaces both the
              per-character initiative tracker and the full team list, and only
              the acting sheet is shown in detail. */}
          {isDepartmental ? (
            <>
              <RotationPanel
                session={session}
                connectedIds={new Set(connectedIds)}
                onReassign={roomRole === 'facilitator' ? () => reassignActor(eligibleIds) : undefined}
              />
              {currentPlayer && (
                <div className="space-y-2">
                  <div className="text-[10px] text-terminal-dim tracking-widest uppercase">Acting Sheet</div>
                  <CharacterCard character={currentPlayer} isActive={canAct} compact />
                </div>
              )}
            </>
          ) : (
            <>
              <InitiativeTracker
                players={session.players}
                order={session.initiativeOrder}
                currentId={session.currentTurnPlayerId}
                attackerStage={session.attackerProgress[session.attackerProgress.length - 1]}
              />
              <div className="space-y-2">
                <div className="text-[10px] text-terminal-dim tracking-widest uppercase">Team</div>
                {session.players.map((p) => (
                  <CharacterCard
                    key={p.id}
                    character={p}
                    isActive={p.id === session.currentTurnPlayerId && canAct}
                    compact
                    onEdit={(name, cls) => updateSessionPlayer(p.id, { name, class: cls })}
                  />
                ))}
              </div>
            </>
          )}

          {session.npcs.some((n) => n.introduced) && (
            <div className="border-t border-terminal-border pt-4">
              <StakeholderPanel npcs={session.npcs} currentRound={session.round} />
            </div>
          )}

        </div>

        {/* Center: narrative feed + action input */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden p-4">
            <NarrativeFeed entries={feed} streamingText={streamingText || roomStreaming || undefined} />
          </div>

          <div className="flex-shrink-0 border-t border-terminal-border p-3 space-y-2 overflow-y-auto max-h-[52%]">
            {/* Turn header + hint button row */}
            <div className="flex items-center justify-between">
              <div className="text-xs text-terminal-dim">
                {currentPlayer && canAct && (
                  <>
                    <span className="text-terminal-green font-semibold">{currentPlayer.name}</span>
                    <span className="ml-2">[{currentPlayer.class}]</span>
                    <span className="ml-2">— your turn</span>
                  </>
                )}
                {waitingForRoll && (
                  <motion.span
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    className="text-terminal-amber"
                  >
                    Action declared — rolling...
                  </motion.span>
                )}
              </div>

              {/* Hint button — Rookie, Analyst, and No-Timer (training) modes.
                  Senior and Elite intentionally deny hints as part of their challenge. */}
              {canAct && (
                session.timerDifficulty === 'rookie'  ||
                session.timerDifficulty === 'analyst' ||
                session.timerDifficulty === 'none'
              ) && (
                <button
                  onClick={handleHint}
                  disabled={isHinting}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded border text-xs font-mono font-semibold
                    tracking-widest uppercase transition-all duration-150
                    ${session.timerDifficulty === 'analyst'
                      ? 'border-purple-500/40 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 hover:border-purple-400'
                      : 'border-purple-500/30 bg-purple-500/5  text-purple-400/80 hover:bg-purple-500/15 hover:border-purple-500/50'
                    }
                    disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {isHinting ? (
                    <span className="animate-pulse">thinking...</span>
                  ) : (
                    <>
                      <span>?</span>
                      <span>
                        Hint{session.timerDifficulty === 'analyst' ? ' (+2 DC)' : ''}
                      </span>
                      {session.timerDifficulty === 'analyst' && dcPenalty > 0 && (
                        <span className="text-terminal-red text-[10px]">+{dcPenalty} used</span>
                      )}
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Hint streaming preview */}
            {hintStreaming && (
              <div className="rounded border border-purple-500/30 bg-purple-500/5 px-3 py-2">
                <span className="text-[10px] text-purple-400 tracking-widest uppercase mr-2">HINT</span>
                <span className="text-xs text-gray-300 font-mono">{hintStreaming}</span>
                <span className="animate-pulse text-purple-400 ml-1">▌</span>
              </div>
            )}

            {/* Rally — any other player with an unused Rally can buff the
                current turn player's upcoming roll, declared before they roll. */}
            {currentPlayer && !isDMThinking && !pendingTraitDecision && (
              (() => {
                const eligible = session.players.filter((p) =>
                  p.id !== currentPlayer.id &&
                  p.traits.includes('Rally') &&
                  !(session.usedOnceTraits?.[p.id] ?? []).includes('Rally')
                )
                if (eligible.length === 0) return null
                return (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {rallyBonus > 0 && (
                      <span className="text-[10px] text-terminal-green font-mono">+{rallyBonus} rallied</span>
                    )}
                    {eligible.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleRallyClick(p.id)}
                        title={`Rally as ${p.name} — grant ${currentPlayer.name} +2 on their next roll`}
                        className="px-2 py-1 text-[10px] font-mono rounded border border-terminal-green/40
                          bg-terminal-green/5 text-terminal-green hover:bg-terminal-green/15
                          hover:border-terminal-green/70 transition-all duration-150"
                      >
                        ⚡ Rally (as {p.name})
                      </button>
                    ))}
                  </div>
                )
              })()
            )}

            {pendingTraitDecision && currentPlayer ? (
              <div className="rounded border border-terminal-amber/40 bg-terminal-amber/5 p-3 space-y-2">
                <div className="text-xs font-mono text-terminal-amber">
                  {pendingTraitDecision.trait === 'Composure'
                    ? `Critical Fail. Use Composure to downgrade it to a Failure?`
                    : `Failure. Use Second Wind to reroll and keep the better result?`}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => resolveTraitDecision(true)}
                    className="px-3 py-1.5 text-xs font-mono font-semibold rounded border border-terminal-amber
                      bg-terminal-amber/15 text-terminal-amber hover:bg-terminal-amber/25 transition-all duration-150"
                  >
                    Use {pendingTraitDecision.trait}
                  </button>
                  <button
                    onClick={() => resolveTraitDecision(false)}
                    className="px-3 py-1.5 text-xs font-mono rounded border border-terminal-border
                      text-terminal-dim hover:text-gray-300 hover:border-terminal-dim transition-all duration-150"
                  >
                    Continue without
                  </button>
                </div>
              </div>
            ) : roomRole === 'facilitator' ? (
              /* In a room the facilitator runs the DM only — players declare
                 their own actions from their screens, which auto-process here. */
              <div className="text-xs font-mono text-terminal-dim py-2">
                {isDMThinking      ? 'The DM is narrating…'
                : waitingForRoll   ? 'Resolving the action…'
                : currentPlayer    ? `${currentPlayer.name} is taking their turn — they act from their own screen.`
                : 'Waiting for the next turn…'}
              </div>
            ) : canAct && currentPlayer ? (
              <ActionMenu
                character={currentPlayer}
                onSubmit={handleActionSubmit}
                disabled={!canAct || isHinting}
                dcHint={dcHint}
                dcPenalty={dcPenalty}
                onTypingChange={setIsTyping}
              />
            ) : (
              <div className="text-xs font-mono text-terminal-dim/50 py-2">
                {isDMThinking    ? 'The DM is narrating...'
                : waitingForRoll ? 'Action declared — click the die to roll...'
                : 'Waiting for your turn...'}
              </div>
            )}
          </div>
        </div>

        {/* Facilitator panel — slides over from the right */}
        {facilitatorOpen && (
          <FacilitatorPanel onClose={() => setFacilitatorOpen(false)} waitingForRoll={waitingForRoll} />
        )}

        {/* Right sidebar: dice → attacker kill chain → XP scorecard */}
        <div className="w-52 flex-shrink-0 border-l border-terminal-border flex flex-col overflow-y-auto">
          {/* Last roll summary */}
          <div className="p-4 border-b border-terminal-border flex-shrink-0">
            <div className="text-[10px] text-terminal-dim tracking-widest uppercase mb-3">Last Roll</div>
            {lastRoll ? (
              <div className="text-center">
                <div className={`text-4xl font-black tabular-nums mb-1 ${outcomeTierColor(lastRoll.outcome as OutcomeTier)}`}>
                  {lastRoll.total}
                </div>
                <div className="text-xs text-terminal-dim mb-1.5">
                  {lastRoll.raw} {lastRoll.modifier >= 0 ? '+' : ''}{lastRoll.modifier} vs DC {lastRoll.dc}
                </div>
                <div className={`text-xs font-bold tracking-widest uppercase ${outcomeTierColor(lastRoll.outcome as OutcomeTier)}`}>
                  {outcomeTierLabel(lastRoll.outcome as OutcomeTier)}
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-terminal-dim/30 text-3xl mb-1 select-none">⬡</div>
                <div className="text-[10px] text-terminal-dim/40">
                  {waitingForRoll ? 'Rolling...' : 'Awaiting action'}
                </div>
              </div>
            )}
          </div>

          {/* Attacker kill chain */}
          <div className="p-4 border-b border-terminal-border flex-shrink-0">
            <div className="text-[10px] text-terminal-dim tracking-widest uppercase mb-2">Attacker</div>
            <div className="space-y-1">
              {session.scenario.killChainStages.map((stage) => {
                const reached   = session.attackerProgress.includes(stage)
                const isCurrent = session.attackerProgress[session.attackerProgress.length - 1] === stage
                const tactic    = TACTIC_MAP[stage]
                return (
                  <div
                    key={stage}
                    className={`text-xs px-2 py-1 rounded flex items-center gap-1.5 ${
                      isCurrent
                        ? 'bg-terminal-red/20 text-terminal-red border border-terminal-red/30'
                        : reached
                        ? 'bg-terminal-muted text-terminal-dim line-through'
                        : 'text-terminal-dim/40'
                    }`}
                  >
                    {isCurrent && <span className="animate-pulse flex-shrink-0">▶</span>}
                    <div className="min-w-0">
                      <div className="capitalize">{stage.replace(/_/g, ' ')}</div>
                      {tactic && (
                        <div className="text-[10px] opacity-60 font-mono tracking-wide">{tactic.id}</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Live XP Scorecard */}
          <div className="p-4 flex-shrink-0">
            <LiveXPScorecard players={session.players} feed={feed} />
          </div>
        </div>
      </div>

      <ThreatPulse feed={feed} />

      <AnimatePresence>
        {commOpen && <CommSettingsModal onClose={() => setCommOpen(false)} />}
      </AnimatePresence>

      {/* Dice roll overlay — surfaces when a player declares an action */}
      <AnimatePresence>
        {showRollOverlay && currentPlayer && (
          <DiceRollOverlay
            key={`${session.round}-${session.currentTurnPlayerId}`}
            player={currentPlayer}
            action={pendingAction}
            lastRoll={lastRoll}
            onRollComplete={handleDiceRollComplete}
            onDismiss={() => setShowRollOverlay(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Adversary Phase Overlay ─────────────────────────────────────────── */}
      <AnimatePresence>
        {adversaryPhase && adversaryClassDef && session.adversary && (
          <motion.div
            key="adversary-phase"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0,      opacity: 1 }}
            exit={{    y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 30 }}
            className="fixed inset-0 z-40 flex flex-col bg-black/90 backdrop-blur-sm"
          >
            {/* Red header bar */}
            <div className={`flex-shrink-0 border-b ${adversaryClassDef.borderColor} bg-terminal-surface px-6 py-3`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className={`text-2xl ${adversaryClassDef.color}`}>{adversaryClassDef.glyph}</span>
                  <div>
                    <div className="text-[9px] text-terminal-red/60 tracking-widest uppercase font-semibold">
                      Adversary Phase — Round {session.round - 1} Complete
                    </div>
                    <div className={`text-sm font-bold ${adversaryClassDef.color}`}>
                      {adversaryPlayer?.name} — {adversaryClassDef.name}
                    </div>
                  </div>
                  {/* Stealth score */}
                  <div className="ml-6">
                    <div className="text-[9px] text-terminal-dim tracking-widest uppercase mb-1">Stealth</div>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 rounded-full bg-terminal-border overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${session.adversary.stealthScore}%`,
                            background: session.adversary.stealthScore > 60
                              ? '#22c55e'
                              : session.adversary.stealthScore > 30
                              ? '#f59e0b'
                              : '#ef4444',
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-white font-mono">
                        {session.adversary.stealthScore}
                      </span>
                    </div>
                  </div>
                </div>
                {/* Kill chain progress */}
                <div className="text-[10px] text-terminal-dim">
                  Stage{' '}
                  <span className="text-terminal-red font-bold">
                    {session.attackerProgress.length}
                  </span>
                  <span className="text-terminal-dim/40"> / {session.scenario.killChainStages.length}</span>
                  <span className="ml-2 text-terminal-red/80">
                    {session.attackerProgress[session.attackerProgress.length - 1]?.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            </div>

            {/* Main content area */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {adversaryOptionsLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <motion.div
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                    className={`text-4xl ${adversaryClassDef.color}`}
                  >
                    {adversaryClassDef.glyph}
                  </motion.div>
                  <div className="text-terminal-dim text-sm tracking-widest">
                    Threat actor is choosing tactics...
                  </div>
                </div>
              ) : adversaryLastRoll && adversarySelectedAction && !adversaryWaitingForRoll ? (
                /* Post-roll / narration streaming view */
                <div className="max-w-2xl mx-auto">
                  <div className={`rounded-lg border ${adversaryClassDef.borderColor} ${adversaryClassDef.bgColor} p-5 mb-4`}>
                    <div className={`text-[9px] tracking-widest uppercase mb-1 ${adversaryClassDef.color}`}>
                      Executing
                    </div>
                    <p className="text-sm text-white font-mono">{adversarySelectedAction.text}</p>
                    {adversaryLastRoll && (
                      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/10">
                        <span className="text-2xl font-black text-white">{adversaryLastRoll.total}</span>
                        <span className="text-terminal-dim text-xs">
                          {adversaryLastRoll.raw} + {adversaryLastRoll.modifier} evasion vs DC {adversaryLastRoll.dc}
                        </span>
                        <span className={`text-xs font-bold tracking-widest ${
                          adversaryLastRoll.outcome === 'success' || adversaryLastRoll.outcome === 'critical_hit'
                            ? adversaryClassDef.color
                            : 'text-terminal-dim'
                        }`}>
                          {adversaryLastRoll.outcome === 'success' || adversaryLastRoll.outcome === 'critical_hit'
                            ? 'EVADED'
                            : 'DETECTED'}
                        </span>
                      </div>
                    )}
                  </div>
                  {adversaryStreaming && (
                    <div className={`rounded-lg border ${adversaryClassDef.borderColor} ${adversaryClassDef.bgColor} p-4`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-[9px] tracking-widest uppercase ${adversaryClassDef.color}`}>
                          [{adversaryClassDef.name}]
                        </span>
                        <span className={`text-xs animate-pulse ${adversaryClassDef.color}`}>●</span>
                      </div>
                      <p className="text-sm text-gray-300 font-mono leading-relaxed">
                        {adversaryStreaming}
                      </p>
                    </div>
                  )}
                  {isDMThinking && !adversaryStreaming && (
                    <div className="flex items-center gap-2 text-terminal-dim text-sm">
                      <span className="animate-pulse">●</span>
                      <span>Narrating outcome...</span>
                    </div>
                  )}
                </div>
              ) : (
                /* Tactic selection */
                <div className="max-w-3xl mx-auto">
                  {adversaryObjective && (
                    <div className="mb-5">
                      <span className="text-[9px] text-terminal-dim tracking-widest uppercase">Objective — </span>
                      <span className="text-xs text-white">{adversaryObjective}</span>
                    </div>
                  )}
                  <div className="text-[9px] text-terminal-dim tracking-widest uppercase mb-3">
                    Choose Tactic — Evasion Bonus: +{getEvasionModifier(session.adversary.adversaryClass)}
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {adversaryOptions.map((opt) => {
                      const isSelected = adversarySelectedAction?.id === opt.id
                      return (
                        <button
                          key={opt.id}
                          onClick={() => !adversaryWaitingForRoll && setAdversarySelectedAction(
                            isSelected ? null : opt
                          )}
                          className={`text-left rounded-lg border p-4 transition-all duration-150 ${
                            isSelected
                              ? `${adversaryClassDef.borderColor} ${adversaryClassDef.bgColor}`
                              : 'border-terminal-border bg-terminal-surface hover:border-terminal-dim'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white font-mono leading-snug mb-1.5">
                                {opt.text}
                              </p>
                              <div className="flex items-center gap-3 text-[10px]">
                                <span className="text-terminal-dim/60 italic">{opt.tooltip}</span>
                              </div>
                            </div>
                            <div className="flex-shrink-0 text-right space-y-1">
                              <div className="text-[10px] text-terminal-dim">
                                Detection DC{' '}
                                <span className={`font-bold ${
                                  opt.detectionDC <= 10
                                    ? 'text-terminal-red'
                                    : opt.detectionDC <= 14
                                    ? 'text-terminal-amber'
                                    : adversaryClassDef.color
                                }`}>
                                  {opt.detectionDC <= 10 ? '⚠ ' : opt.detectionDC <= 14 ? '△ ' : ''}
                                  {opt.detectionDC}
                                </span>
                              </div>
                              <div className="text-[10px] text-terminal-dim">
                                If caught{' '}
                                <span className="text-terminal-red">−{opt.stealthCost}</span>
                                <span className="text-terminal-dim/50"> stealth</span>
                              </div>
                              {opt.targetStage && (
                                <div className={`text-[10px] font-semibold ${adversaryClassDef.color}`}>
                                  → {opt.targetStage.replace(/_/g, ' ')}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {adversarySelectedAction && (
                    <motion.button
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => handleAdversaryActionSelect(adversarySelectedAction)}
                      className={`w-full mt-4 py-3 rounded-lg border ${adversaryClassDef.borderColor}
                        ${adversaryClassDef.bgColor} ${adversaryClassDef.color}
                        font-bold text-sm tracking-widest uppercase
                        hover:opacity-80 transition-all`}
                    >
                      ⬡ Roll Evasion
                    </motion.button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Adversary dice roll overlay */}
      <AnimatePresence>
        {adversaryWaitingForRoll && adversarySelectedAction && adversaryPlayer && (
          <DiceRollOverlay
            key={`adversary-roll-${session.round}`}
            player={adversaryPlayer}
            action={adversarySelectedAction.text}
            lastRoll={adversaryLastRoll}
            onRollComplete={handleAdversaryRollComplete}
            onDismiss={() => {
              setAdversaryWaitingForRoll(false)
              setAdversarySelectedAction(null)
            }}
          />
        )}
      </AnimatePresence>

      {/* Act transition overlay */}
      <AnimatePresence>
        {actTransition && (
          <motion.div
            key={`act-transition-${actTransition.newAct}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setActTransition(null)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 20 }}
              animate={{ scale: 1,    opacity: 1, y: 0  }}
              exit={{    scale: 0.95, opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="max-w-lg w-full mx-4 rounded-lg border border-terminal-amber/50
                bg-terminal-surface shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header bar */}
              <div className="bg-terminal-amber/10 border-b border-terminal-amber/30 px-6 py-4 flex items-center gap-4">
                <div className="flex-1">
                  <div className="text-[10px] text-terminal-amber/60 tracking-widest uppercase font-semibold mb-0.5">
                    Situation Escalating
                  </div>
                  <div className="text-2xl font-bold text-terminal-amber tracking-widest">
                    ACT {actTransition.newAct}
                  </div>
                </div>
                <div className="text-terminal-amber/30 text-4xl font-black select-none">
                  {actTransition.newAct}
                </div>
              </div>

              {/* Objective */}
              <div className="px-6 py-4">
                <div className="text-[9px] text-terminal-dim tracking-widest uppercase mb-1.5">New Objective</div>
                <p className="text-sm text-white font-semibold leading-snug">
                  {actTransition.objective}
                </p>
              </div>

              {/* Boss event — only if present */}
              {actTransition.bossEvent && (
                <div className="px-6 pb-4">
                  <div className="rounded border border-terminal-red/30 bg-terminal-red/5 p-3">
                    <div className="text-[9px] text-terminal-red tracking-widest uppercase font-bold mb-1.5 flex items-center gap-1.5">
                      <span className="animate-pulse">⚡</span>
                      Boss Event
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed">
                      {actTransition.bossEvent}
                    </p>
                  </div>
                </div>
              )}

              {/* Dismiss */}
              <div className="px-6 pb-5">
                <button
                  onClick={() => setActTransition(null)}
                  className="w-full py-2.5 rounded border border-terminal-amber/40 bg-terminal-amber/10
                    text-terminal-amber text-xs font-semibold tracking-widest uppercase
                    hover:bg-terminal-amber/20 hover:border-terminal-amber transition-all"
                >
                  Continue →
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
