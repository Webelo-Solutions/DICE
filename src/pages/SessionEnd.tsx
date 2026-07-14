import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { motion, AnimatePresence } from 'framer-motion'
import {
  detectLevelUps,
  availableSkillUpgrades,
  availableNewTraits,
  availableStatIncreases,
  levelForXp,
} from '../utils/leveling'
import type { LevelUpEvent, LevelUpChoice } from '../utils/leveling'
import { TRAIT_DEFINITIONS } from '../data/traitDefinitions'
import { generateLearningPath } from '../utils/learningPath'

// ─── Level-up choice modal ────────────────────────────────────────────────────

function LevelUpModal({
  event,
  character,
  onConfirm,
}: {
  event: LevelUpEvent
  character: ReturnType<typeof useGameStore.getState>['roster'][number]
  onConfirm: (choice: LevelUpChoice) => void
}) {
  const [selected, setSelected] = useState<LevelUpChoice | null>(null)
  const skillChoices = availableSkillUpgrades(character)
  const traitChoices = availableNewTraits(character)
  const statChoices  = availableStatIncreases(character)

  const STAT_LABEL: Record<string, string> = {
    vigilance: 'Vigilance', agility: 'Agility', analysis: 'Analysis',
    fortitude: 'Fortitude', stealth: 'Stealth', command: 'Command',
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
    >
      <div className="max-w-lg w-full rounded border border-terminal-green/50 bg-terminal-bg p-6 font-mono">
        <div className="text-xs text-terminal-green/60 tracking-widest uppercase mb-1">
          Level Up
        </div>
        <div className="text-xl font-bold text-terminal-green mb-0.5">
          {character.name}
        </div>
        <div className="text-sm text-terminal-dim mb-5">
          {character.class} · LVL {event.oldLevel} → LVL {event.newLevel}
        </div>

        <div className="text-xs text-terminal-dim tracking-widest uppercase mb-3">
          Choose one upgrade
        </div>

        <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1 mb-5">
          {skillChoices.length === 0 && traitChoices.length === 0 && statChoices.length === 0 && (
            <p className="text-sm text-terminal-dim italic">No upgrades available.</p>
          )}

          {/* Stat increases */}
          {statChoices.length > 0 && (
            <div className="mb-1">
              <div className="text-[9px] text-terminal-dim/50 tracking-widest uppercase mb-1 px-1">Stat Increase</div>
              {statChoices.map((choice, i) => {
                const isSelected = selected === choice
                return (
                  <button
                    key={`stat-${i}`}
                    onClick={() => setSelected(choice)}
                    className={`w-full text-left px-3 py-2 rounded border transition-all flex items-center gap-3 mb-1 ${
                      isSelected
                        ? 'border-terminal-green bg-terminal-green/10 text-white'
                        : 'border-terminal-border bg-terminal-surface text-gray-300 hover:border-terminal-dim hover:text-white'
                    }`}
                  >
                    <span className="text-[9px] font-semibold tracking-widest px-1.5 py-0.5 rounded border flex-shrink-0 text-terminal-green border-terminal-green/40 bg-terminal-green/10">
                      STAT
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">{STAT_LABEL[choice.stat]} {choice.fromVal} → {choice.toVal}</div>
                    </div>
                    {isSelected && <span className="ml-auto text-terminal-green text-sm flex-shrink-0">✓</span>}
                  </button>
                )
              })}
            </div>
          )}

          {/* Skill upgrades */}
          {skillChoices.length > 0 && (
            <div className="mb-1">
              <div className="text-[9px] text-terminal-dim/50 tracking-widest uppercase mb-1 px-1">Skill Upgrade</div>
              {skillChoices.map((choice, i) => {
                const isSelected = selected === choice
                return (
                  <button
                    key={`skill-${i}`}
                    onClick={() => setSelected(choice)}
                    className={`w-full text-left px-3 py-2 rounded border transition-all flex items-center gap-3 mb-1 ${
                      isSelected
                        ? 'border-terminal-green bg-terminal-green/10 text-white'
                        : 'border-terminal-border bg-terminal-surface text-gray-300 hover:border-terminal-dim hover:text-white'
                    }`}
                  >
                    <span className="text-[9px] font-semibold tracking-widest px-1.5 py-0.5 rounded border flex-shrink-0 text-terminal-blue border-terminal-blue/40 bg-terminal-blue/10">
                      SKILL
                    </span>
                    <span className="text-sm flex-1">{choice.skillName} — Lvl {choice.fromLevel} → {choice.toLevel}</span>
                    {isSelected && <span className="ml-auto text-terminal-green text-sm flex-shrink-0">✓</span>}
                  </button>
                )
              })}
            </div>
          )}

          {/* New traits */}
          {traitChoices.length > 0 && (
            <div>
              <div className="text-[9px] text-terminal-dim/50 tracking-widest uppercase mb-1 px-1">New Trait</div>
              {traitChoices.map((choice, i) => {
                const isSelected = selected === choice
                const def = TRAIT_DEFINITIONS[choice.traitName]
                return (
                  <button
                    key={`trait-${i}`}
                    onClick={() => setSelected(choice)}
                    className={`w-full text-left px-3 py-2 rounded border transition-all flex items-start gap-3 mb-1 ${
                      isSelected
                        ? 'border-terminal-green bg-terminal-green/10 text-white'
                        : 'border-terminal-border bg-terminal-surface text-gray-300 hover:border-terminal-dim hover:text-white'
                    }`}
                  >
                    <span className="text-[9px] font-semibold tracking-widest px-1.5 py-0.5 rounded border flex-shrink-0 mt-0.5 text-terminal-amber border-terminal-amber/40 bg-terminal-amber/10">
                      TRAIT
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold">{choice.traitName}</div>
                      {def && (
                        <>
                          <div className="text-[10px] text-gray-400 mt-0.5 leading-snug">{def.description}</div>
                          <div className="text-[10px] text-terminal-blue/70 mt-0.5 leading-snug font-mono">{def.mechanicalEffect}</div>
                        </>
                      )}
                    </div>
                    {isSelected && <span className="text-terminal-green text-sm flex-shrink-0">✓</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <button
          disabled={!selected}
          onClick={() => selected && onConfirm(selected)}
          className="w-full py-2.5 rounded border border-terminal-green/50 bg-terminal-green/10
            text-terminal-green text-sm font-semibold tracking-widest uppercase
            hover:bg-terminal-green/20 hover:border-terminal-green
            disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          Confirm Upgrade
        </button>
      </div>
    </motion.div>
  )
}

// ─── Main SessionEnd page ─────────────────────────────────────────────────────

export function SessionEnd() {
  const navigate = useNavigate()
  const { result, session, roster, resetAll, levelUpCharacter } = useGameStore()

  const xpApplied = useRef(false)
  const [levelUpQueue, setLevelUpQueue]   = useState<LevelUpEvent[]>([])
  const [queueIndex, setQueueIndex]       = useState(0)
  const [levelingDone, setLevelingDone]   = useState(false)

  // Apply XP once on mount, detect level-ups, and record session history
  useEffect(() => {
    if (xpApplied.current || !result || !session) return
    xpApplied.current = true

    const participants = session.players
    const xpEach = Math.round(result.xpAwarded / Math.max(1, participants.length))
    const events  = detectLevelUps(participants, xpEach)

    // Build and persist the session record for analytics
    const { feed, recordSession, applySessionToOrg } = useGameStore.getState()
    const learningPath = generateLearningPath(feed, session, result)
    recordSession({
      id:            session.id,
      scenarioId:    session.scenario.id,
      scenarioTitle: session.scenario.title,
      difficulty:    session.scenario.difficulty,
      outcome:       result.outcome,
      playerCount:   participants.length,
      players:       participants.map((p) => ({ id: p.id, name: p.name, class: p.class })),
      result,
      learningPath,
      playedAt:      result.endedAt,
      feed,
    })

    applySessionToOrg(session, result)

    if (events.length > 0) {
      setLevelUpQueue(events)
    } else {
      setLevelingDone(true)
    }
  }, [result, session])

  if (!result || !session) {
    navigate('/')
    return null
  }

  const isVictory    = result.outcome !== 'defeat'
  const color        = isVictory ? 'text-terminal-green'    : 'text-terminal-red'
  const borderColor  = isVictory ? 'border-terminal-green/30' : 'border-terminal-red/30'
  const bgColor      = isVictory ? 'bg-terminal-green/5'    : 'bg-terminal-red/5'
  const xpEach       = Math.round(result.xpAwarded / Math.max(1, session.players.length))

  const handleLevelUpChoice = (choice: LevelUpChoice) => {
    const event = levelUpQueue[queueIndex]
    levelUpCharacter(event.characterId, event.newLevel, choice)
    const next = queueIndex + 1
    if (next >= levelUpQueue.length) {
      setLevelingDone(true)
    } else {
      setQueueIndex(next)
    }
  }

  const handleReset = () => { resetAll(); navigate('/') }

  return (
    <>
      <div className="min-h-screen bg-terminal-bg font-mono flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`max-w-lg w-full rounded border ${borderColor} ${bgColor} p-8`}
        >
          <div className={`text-4xl font-bold tracking-widest mb-1 ${color}`}>
            {result.outcome === 'victory' ? 'CONTAINED' : result.outcome === 'partial' ? 'PARTIAL' : 'BREACH'}
          </div>
          <div className="text-sm text-terminal-dim mb-6">
            {session.scenario.title} — {result.outcome === 'defeat' ? session.scenario.failureCondition : session.scenario.victoryCondition}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            {[
              { label: 'XP Earned',        value: result.xpAwarded,        color: 'text-terminal-green' },
              { label: 'Rounds Played',    value: result.roundsPlayed,     color: 'text-white' },
              { label: 'Critical Hits',    value: result.criticalHits,     color: 'text-terminal-green' },
              { label: 'Critical Fails',   value: result.criticalFails,    color: 'text-terminal-red' },
              { label: 'Injects Survived', value: result.injectsSurvived,  color: 'text-terminal-amber' },
              { label: 'Clock Remaining',  value: `${result.clockRemaining}m`, color: result.clockRemaining > 20 ? 'text-terminal-green' : 'text-terminal-amber' },
            ].map(({ label, value, color: c }) => (
              <div key={label} className="rounded border border-terminal-border bg-terminal-surface p-3">
                <div className="text-[10px] text-terminal-dim tracking-widest uppercase">{label}</div>
                <div className={`text-xl font-bold mt-1 ${c}`}>{value}</div>
              </div>
            ))}
          </div>

          {/* Per-player XP and level */}
          <div className="mb-6">
            <div className="text-xs text-terminal-dim tracking-widest uppercase mb-3">Team Results</div>
            <div className="space-y-2">
              {session.players.map((p) => {
                const rosterChar = roster.find((r) => r.id === p.id)
                const currentXp  = (rosterChar?.xp ?? p.xp)
                const currentLvl = levelForXp(currentXp)
                const event      = levelUpQueue.find((e) => e.characterId === p.id)
                return (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">
                      {p.name} <span className="text-terminal-dim text-xs">[{p.class}]</span>
                    </span>
                    <div className="flex items-center gap-3">
                      {event && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded border border-terminal-amber/40 bg-terminal-amber/10 text-terminal-amber font-semibold tracking-widest">
                          LVL UP → {event.newLevel}
                        </span>
                      )}
                      <span className="text-terminal-dim text-xs">LVL {currentLvl}</span>
                      <span className="text-terminal-green font-bold">+{xpEach} XP</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Level-up call to action */}
          {levelUpQueue.length > 0 && !levelingDone && (
            <div className="mb-5 rounded border border-terminal-amber/40 bg-terminal-amber/5 px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-terminal-amber tracking-widest uppercase">
                  Level Up Available
                </div>
                <div className="text-xs text-terminal-dim mt-0.5">
                  {levelUpQueue.length} character{levelUpQueue.length > 1 ? 's' : ''} earned an upgrade
                </div>
              </div>
              <span className="text-terminal-amber text-lg">★</span>
            </div>
          )}
          {levelUpQueue.length > 0 && levelingDone && (
            <div className="mb-5 rounded border border-terminal-green/30 bg-terminal-green/5 px-4 py-3 text-xs text-terminal-green font-semibold tracking-widest uppercase">
              Upgrades Applied ✓
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex-1 py-2 rounded border border-terminal-border text-terminal-dim
                hover:text-white hover:border-terminal-dim text-xs font-semibold tracking-widest uppercase transition-all"
            >
              New Session
            </button>
            <button
              onClick={() => navigate('/report')}
              className="flex-1 py-2 rounded border border-terminal-blue/40 bg-terminal-blue/10
                text-terminal-blue text-xs font-semibold tracking-widest uppercase
                hover:bg-terminal-blue/20 hover:border-terminal-blue transition-all"
            >
              Hot Wash
            </button>
            <button
              onClick={() => navigate('/analytics')}
              className="flex-1 py-2 rounded border border-terminal-dim/30 bg-terminal-surface
                text-terminal-dim text-xs font-semibold tracking-widest uppercase
                hover:text-white hover:border-terminal-dim transition-all"
            >
              Analytics
            </button>
            <button
              onClick={() => { resetAll(); navigate('/scenarios') }}
              className="flex-1 py-2 rounded border border-terminal-green/40 bg-terminal-green/10
                text-terminal-green text-xs font-semibold tracking-widest uppercase
                hover:bg-terminal-green/20 hover:border-terminal-green transition-all"
            >
              Play Again
            </button>
          </div>
        </motion.div>
      </div>

      {/* Level-up modal — shown over the top */}
      <AnimatePresence>
        {levelUpQueue.length > 0 && !levelingDone && (() => {
          const event     = levelUpQueue[queueIndex]
          const character = roster.find((c) => c.id === event.characterId)
          if (!character) return null
          return (
            <LevelUpModal
              key={event.characterId}
              event={event}
              character={character}
              onConfirm={handleLevelUpChoice}
            />
          )
        })()}
      </AnimatePresence>
    </>
  )
}
