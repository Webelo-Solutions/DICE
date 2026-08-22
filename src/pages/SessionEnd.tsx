import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { useCampaignStore } from '../store/campaignStore'
import { motion, AnimatePresence } from 'framer-motion'
import {
  detectLevelUps,
  levelForXp,
} from '../utils/leveling'
import type { LevelUpEvent, LevelUpChoice } from '../utils/leveling'
import { generateLearningPath } from '../utils/learningPath'
import { LevelUpModal } from '../components/LevelUpModal'
import { launchCampaignScenario } from '../utils/campaignPlay'
import { CampaignCertificateButton } from '../components/CampaignCertificateButton'
import { isTemplateCharacterId } from '../utils/departmentalSession'
import { buildDepartmentalReport } from '../utils/departmentalReport'
import { buildSessionCpeReport } from '../utils/cpe'
import { useRoomStore } from '../store/roomStore'
import { roomApi } from '../api/rooms'
import { ALL_SCENARIOS } from '../data/scenarios'
import type { Campaign } from '../types/campaign'

// ─── Main SessionEnd page ─────────────────────────────────────────────────────

export function SessionEnd() {
  const navigate = useNavigate()
  const { result, session, roster, resetAll, levelUpCharacter } = useGameStore()
  const customScenarios = useCampaignStore((s) => s.customScenarios)

  const xpApplied = useRef(false)
  const [levelUpQueue, setLevelUpQueue]   = useState<LevelUpEvent[]>([])
  const [queueIndex, setQueueIndex]       = useState(0)
  const [levelingDone, setLevelingDone]   = useState(false)
  const [campaignProgress, setCampaignProgress] = useState<{ campaign: Campaign; done: boolean } | null>(null)

  // Apply XP once on mount, detect level-ups, and record session history
  useEffect(() => {
    if (xpApplied.current || !result || !session) return
    xpApplied.current = true

    const participants = session.players
    // Role-baseline sheets are ephemeral: they exist only for the duration of
    // the session and earn no persisted XP (decision D5), so they can cross a
    // level threshold on paper but have nothing to level. Offering that choice
    // would queue a modal whose result is discarded.
    const events  = detectLevelUps(
      participants.filter((p) => !isTemplateCharacterId(p.id)),
      result.xpByPlayer,
    )

    // Build and persist the session record for analytics
    const { feed, recordSession, applySessionToOrg } = useGameStore.getState()
    const learningPath = generateLearningPath(feed, session, result)
    const record = {
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
    }
    recordSession(record)

    // Departmental sessions report on people, which needs the server-side
    // event ledger. Record first and enrich after: recordSession replaces by
    // id, so a slow or failed fetch costs the departmental section rather than
    // the whole history entry.
    const membership = useRoomStore.getState().membership
    if (session.mode === 'departmental' && membership?.role === 'facilitator') {
      roomApi.getTallies(membership.code, membership.token, session.id)
        .then(({ tallies }) => {
          recordSession({
            ...record,
            departmental: buildDepartmentalReport(session, feed, result, tallies),
            // Same tallies, different question: the departmental report asks
            // what each person contributed, CPE asks how long they were here.
            cpe: buildSessionCpeReport(session.scenario.title, result.startedAt, result.endedAt, tallies),
          })
        })
        .catch((e) => console.error('[departmental-report]', e))
    }

    applySessionToOrg(session, result)

    const { activeCampaignContext, setActiveCampaignContext } = useGameStore.getState()
    if (activeCampaignContext) {
      useCampaignStore.getState().completeCampaignScenario(
        activeCampaignContext.campaignId,
        activeCampaignContext.scenarioIndex,
        session.scenario.id,
        result.outcome,
        // Carried onto the campaign so a completion certificate can report real
        // gameplay hours without having to re-derive them from session history.
        { sessionId: session.id, startedAt: result.startedAt, endedAt: result.endedAt },
      )
      setActiveCampaignContext(null)
      const updated = useCampaignStore.getState().campaigns.find((c) => c.id === activeCampaignContext.campaignId)
      if (updated) {
        setCampaignProgress({ campaign: updated, done: updated.currentScenarioIndex >= updated.scenarioSequence.length })
      }
    }

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

  const nextCampaignScenario = campaignProgress && !campaignProgress.done
    ? [...ALL_SCENARIOS, ...customScenarios]
        .find((s) => s.id === campaignProgress.campaign.scenarioSequence[campaignProgress.campaign.currentScenarioIndex])
    : null

  const handleContinueCampaign = () => {
    if (!campaignProgress) return
    if (launchCampaignScenario(campaignProgress.campaign, customScenarios)) navigate('/roster')
  }

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
              { label: 'Critical Injects', value: result.criticalInjectsFired, color: 'text-terminal-amber' },
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
                      <span className="text-terminal-green font-bold">+{result.xpByPlayer[p.id] ?? 0} XP</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Campaign progress */}
          {campaignProgress && !campaignProgress.done && nextCampaignScenario && (
            <div className="mb-5 rounded border border-terminal-green/40 bg-terminal-green/5 px-4 py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-terminal-green tracking-widest uppercase truncate">
                  {campaignProgress.campaign.name}
                </div>
                <div className="text-xs text-terminal-dim mt-0.5 truncate">
                  Next: {nextCampaignScenario.title} · Scenario {campaignProgress.campaign.currentScenarioIndex + 1} of {campaignProgress.campaign.scenarioSequence.length}
                </div>
              </div>
              <button
                onClick={handleContinueCampaign}
                className="flex-shrink-0 px-4 py-2 rounded border border-terminal-green bg-terminal-green/10
                  text-terminal-green text-xs font-bold tracking-widest uppercase hover:bg-terminal-green/20 transition-colors">
                ▶ Continue Campaign
              </button>
            </div>
          )}
          {campaignProgress?.done && (
            <div className="mb-5 rounded border border-terminal-blue/40 bg-terminal-blue/5 px-4 py-3
              flex items-center justify-between gap-4">
              <div>
                <div className="text-xs text-terminal-blue font-semibold tracking-widest uppercase">
                  ✓ {campaignProgress.campaign.name} — Campaign Complete
                </div>
                <div className="text-xs text-terminal-dim mt-0.5">
                  Every scenario in the sequence is finished. Download the completion certificate.
                </div>
              </div>
              <div className="flex-shrink-0">
                <CampaignCertificateButton campaign={campaignProgress.campaign} variant="dark" />
              </div>
            </div>
          )}

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
