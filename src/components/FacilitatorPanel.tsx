import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore }     from '../store/gameStore'
import { useCampaignStore } from '../store/campaignStore'
import { useRoomStore }     from '../store/roomStore'
import type { SaveSlot }    from '../types/campaign'
import { postWebhookEvent } from '../engine/webhookClient'

export function FacilitatorPanel({ onClose, waitingForRoll }: { onClose: () => void; waitingForRoll: boolean }) {
  const navigate = useNavigate()
  const {
    session,
    isDMThinking,
    facilitatorAdjustClock,
    facilitatorSetAttackerStage,
    facilitatorAddComplication,
    facilitatorRemoveComplication,
    facilitatorNote,
    facilitatorGenerateHotWash,
    advanceTurn,
    appendFeed,
  } = useGameStore()

  const { addSave }       = useCampaignStore()
  const feed              = useGameStore((s) => s.feed)
  const commConfig        = useGameStore((s) => s.commConfig)
  const roomRole          = useRoomStore((s) => s.membership?.role)
  const roomParticipants  = useRoomStore((s) => s.participants)

  const [noteText,        setNoteText]        = useState('')
  const [complicationIn,  setComplicationIn]  = useState('')
  const [firedInjects,    setFiredInjects]    = useState<Set<string>>(new Set())
  const [saveNameInput,   setSaveNameInput]   = useState('')
  const [showSaveForm,    setShowSaveForm]    = useState(false)
  const [savedFlash,      setSavedFlash]      = useState(false)

  if (!session) return null

  const currentStageIdx = session.scenario.killChainStages.indexOf(
    session.attackerProgress[session.attackerProgress.length - 1]
  )

  const handleFireInject = (injectId: string) => {
    const inject = session.scenario.injects.find((i) => i.id === injectId)
    if (!inject) return
    appendFeed({
      id:        crypto.randomUUID(),
      type:      'inject',
      speaker:   '! INJECT [FACILITATOR]',
      text:      inject.description + '\n' + inject.mechanicalEffect,
      timestamp: Date.now(),
    })
    setFiredInjects((prev) => new Set([...prev, injectId]))
    if (commConfig?.webhookUrl) {
      postWebhookEvent(commConfig, `⚡ INJECT: ${inject.description}`)
    }
  }

  const autoSaveName = `${session.scenario.title} — Act ${session.act}, Round ${session.round}`

  const handleOpenSaveForm = () => {
    setSaveNameInput(autoSaveName)
    setShowSaveForm(true)
  }

  const handleSaveGame = () => {
    const slot: SaveSlot = {
      id:      crypto.randomUUID(),
      name:    saveNameInput.trim() || autoSaveName,
      savedAt: Date.now(),
      session: { ...session },
      feed:    [...feed],
    }
    addSave(slot)
    setShowSaveForm(false)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2500)
  }

  const handleNote = () => {
    const trimmed = noteText.trim()
    if (!trimmed) return
    facilitatorNote(trimmed)
    setNoteText('')
    if (commConfig?.webhookUrl) {
      postWebhookEvent(commConfig, `📋 NOTE [FACILITATOR]: ${trimmed}`)
    }
  }

  const handleAddComplication = () => {
    const trimmed = complicationIn.trim().toLowerCase().replace(/\s+/g, '_')
    if (!trimmed) return
    facilitatorAddComplication(trimmed)
    setComplicationIn('')
  }

  const currentTurnPlayer = session.players.find((p) => p.id === session.currentTurnPlayerId)
  const canSkipTurn = !isDMThinking && !waitingForRoll

  const handleSkipTurn = () => {
    if (!canSkipTurn) return
    facilitatorNote(`Turn skipped for ${currentTurnPlayer?.name ?? 'the current player'} by the facilitator.`)
    advanceTurn()
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'tween', duration: 0.2 }}
        className="fixed right-0 top-0 h-full w-80 bg-terminal-bg border-l border-terminal-amber/40
          z-40 flex flex-col overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-terminal-amber/30
          bg-terminal-amber/5 flex-shrink-0">
          <div>
            <div className="text-xs text-terminal-amber font-semibold tracking-widest uppercase">
              Facilitator Mode
            </div>
            <div className="text-[10px] text-terminal-dim mt-0.5">
              Controls do not affect player turns
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-terminal-dim hover:text-white text-sm transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Hot Wash shortcut */}
        <div className="px-4 py-3 border-b border-terminal-amber/20 flex-shrink-0">
          <button
            onClick={() => {
              facilitatorGenerateHotWash()
              navigate('/report')
            }}
            className="w-full py-2 rounded border border-terminal-blue/40 bg-terminal-blue/10
              text-terminal-blue text-xs font-semibold tracking-widest uppercase
              hover:bg-terminal-blue/20 hover:border-terminal-blue transition-all"
          >
            Generate Hot Wash Report
          </button>
          <div className="text-[10px] text-terminal-dim mt-1.5 text-center">
            Snapshot report — session remains active
          </div>
        </div>

        {/* Save Game */}
        <div className="px-4 py-3 border-b border-terminal-amber/20 flex-shrink-0">
          <AnimatePresence mode="wait">
            {savedFlash ? (
              <motion.div
                key="flash"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="w-full py-2 rounded border border-terminal-green/40 bg-terminal-green/10
                  text-terminal-green text-xs font-semibold tracking-widest uppercase text-center"
              >
                ✓ Session Saved
              </motion.div>
            ) : showSaveForm ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-2"
              >
                <div className="text-[10px] text-terminal-dim tracking-widest uppercase">Save Name</div>
                <input
                  autoFocus
                  type="text"
                  value={saveNameInput}
                  onChange={(e) => setSaveNameInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveGame(); if (e.key === 'Escape') setShowSaveForm(false) }}
                  className="w-full bg-terminal-surface border border-terminal-border rounded px-2 py-1.5
                    text-xs text-white font-mono placeholder-terminal-dim/50
                    focus:outline-none focus:border-terminal-green/60"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveGame}
                    className="flex-1 py-1.5 rounded border border-terminal-green/40 bg-terminal-green/10
                      text-terminal-green text-xs font-semibold tracking-widest uppercase
                      hover:bg-terminal-green/20 transition-all"
                  >
                    Confirm Save
                  </button>
                  <button
                    onClick={() => setShowSaveForm(false)}
                    className="px-3 py-1.5 rounded border border-terminal-border text-terminal-dim
                      text-xs hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.button
                key="btn"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleOpenSaveForm}
                className="w-full py-2 rounded border border-terminal-green/30 bg-terminal-green/5
                  text-terminal-green text-xs font-semibold tracking-widest uppercase
                  hover:bg-terminal-green/15 hover:border-terminal-green/50 transition-all"
              >
                💾 Save Session
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">

          {/* ── Room (multiplayer only) ───────────────────────────── */}
          {roomRole === 'facilitator' && (
            <section>
              <div className="text-[10px] text-terminal-amber tracking-widest uppercase mb-2">
                Room
              </div>
              <div className="space-y-1 mb-3">
                {roomParticipants.filter((p) => p.role === 'player').map((p) => (
                  <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded border border-terminal-border bg-terminal-surface text-[11px]">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.connected ? 'bg-terminal-green' : 'bg-terminal-dim/40'}`} />
                    <span className="text-gray-300 flex-1 truncate">{p.displayName}</span>
                    {!p.connected && <span className="text-[9px] text-terminal-dim">offline</span>}
                  </div>
                ))}
                {roomParticipants.filter((p) => p.role === 'player').length === 0 && (
                  <p className="text-[10px] text-terminal-dim italic">No players yet</p>
                )}
              </div>
              <button
                onClick={handleSkipTurn}
                disabled={!canSkipTurn}
                title={canSkipTurn ? '' : 'Wait for the current action to resolve'}
                className="w-full py-1.5 rounded border border-terminal-red/40 bg-terminal-red/10
                  text-terminal-red text-xs font-semibold tracking-widest uppercase
                  hover:bg-terminal-red/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Skip Turn{currentTurnPlayer ? ` — ${currentTurnPlayer.name}` : ''}
              </button>
            </section>
          )}

          {/* ── Scenario Clock ─────────────────────────────────────── */}
          <section>
            <div className="text-[10px] text-terminal-amber tracking-widest uppercase mb-2">
              Scenario Clock
            </div>
            <div className="text-2xl font-bold text-white mb-3 font-mono">
              {session.scenarioClockRemaining}
              <span className="text-sm text-terminal-dim font-normal ml-1">min remaining</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {[-10, -5, +5, +10].map((delta) => (
                <button
                  key={delta}
                  onClick={() => facilitatorAdjustClock(delta)}
                  className={`px-3 py-1.5 rounded border text-xs font-semibold font-mono transition-all ${
                    delta < 0
                      ? 'border-terminal-red/40 bg-terminal-red/10 text-terminal-red hover:bg-terminal-red/20'
                      : 'border-terminal-green/40 bg-terminal-green/10 text-terminal-green hover:bg-terminal-green/20'
                  }`}
                >
                  {delta > 0 ? '+' : ''}{delta}m
                </button>
              ))}
            </div>
          </section>

          {/* ── Attacker Kill Chain ───────────────────────────────── */}
          <section>
            <div className="text-[10px] text-terminal-amber tracking-widest uppercase mb-2">
              Attacker Stage Override
            </div>
            <div className="space-y-1">
              {session.scenario.killChainStages.map((stage, idx) => {
                const isReached  = idx <= currentStageIdx
                const isCurrent  = idx === currentStageIdx
                return (
                  <button
                    key={stage}
                    onClick={() => facilitatorSetAttackerStage(stage)}
                    className={`w-full text-left px-2 py-1.5 rounded border text-[11px] font-mono transition-all ${
                      isCurrent
                        ? 'border-terminal-red/50 bg-terminal-red/15 text-terminal-red'
                        : isReached
                        ? 'border-terminal-border bg-terminal-muted text-terminal-dim'
                        : 'border-terminal-border bg-transparent text-terminal-dim/50 hover:border-terminal-dim/50 hover:text-terminal-dim'
                    }`}
                  >
                    <span className="mr-1.5 opacity-50">{isCurrent ? '▶' : isReached ? '✓' : '○'}</span>
                    {stage.replace(/_/g, ' ')}
                  </button>
                )
              })}
            </div>
          </section>

          {/* ── Complications ────────────────────────────────────── */}
          <section>
            <div className="text-[10px] text-terminal-amber tracking-widest uppercase mb-2">
              Complications
            </div>
            {session.activeComplications.length === 0 && (
              <p className="text-[10px] text-terminal-dim mb-2 italic">None active</p>
            )}
            <div className="space-y-1 mb-2">
              {session.activeComplications.map((c) => (
                <div
                  key={c}
                  className="flex items-center justify-between px-2 py-1 rounded border
                    border-terminal-amber/30 bg-terminal-amber/5 text-[10px] text-terminal-amber"
                >
                  <span>{c.replace(/_/g, ' ')}</span>
                  <button
                    onClick={() => facilitatorRemoveComplication(c)}
                    className="text-terminal-dim hover:text-terminal-red ml-2 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={complicationIn}
                onChange={(e) => setComplicationIn(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddComplication()}
                placeholder="add complication..."
                className="flex-1 bg-terminal-surface border border-terminal-border rounded px-2 py-1
                  text-[11px] text-gray-300 font-mono placeholder-terminal-dim/50
                  focus:outline-none focus:border-terminal-amber/60"
              />
              <button
                onClick={handleAddComplication}
                className="px-2 py-1 rounded border border-terminal-amber/40 bg-terminal-amber/10
                  text-terminal-amber text-[10px] font-semibold hover:bg-terminal-amber/20 transition-all"
              >
                Add
              </button>
            </div>
          </section>

          {/* ── Injects ──────────────────────────────────────────── */}
          <section>
            <div className="text-[10px] text-terminal-amber tracking-widest uppercase mb-2">
              Fire Inject
            </div>
            <div className="space-y-2">
              {session.scenario.injects.map((inject) => {
                const fired = firedInjects.has(inject.id)
                return (
                  <div
                    key={inject.id}
                    className={`rounded border px-3 py-2 transition-all ${
                      fired
                        ? 'border-terminal-border bg-terminal-muted opacity-50'
                        : 'border-terminal-border bg-terminal-surface'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <div className="text-[10px] text-terminal-dim tracking-widest">
                          ACT {inject.act} · {inject.trigger.toUpperCase()} · {inject.id}
                        </div>
                        <div className="text-xs text-gray-300 mt-0.5 leading-snug">
                          {inject.description}
                        </div>
                        <div className="text-[10px] text-terminal-amber/70 mt-0.5 italic">
                          {inject.mechanicalEffect}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleFireInject(inject.id)}
                      disabled={fired}
                      className="mt-1 w-full py-1 rounded border text-[10px] font-semibold tracking-widest uppercase transition-all
                        border-terminal-amber/40 bg-terminal-amber/5 text-terminal-amber
                        hover:bg-terminal-amber/15 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {fired ? 'Fired' : 'Fire Inject'}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>

          {/* ── Facilitator Note ─────────────────────────────────── */}
          <section>
            <div className="text-[10px] text-terminal-amber tracking-widest uppercase mb-2">
              Add to Session Log
            </div>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Facilitator observation or note..."
              rows={3}
              className="w-full bg-terminal-surface border border-terminal-border rounded px-3 py-2
                text-xs text-gray-300 font-mono placeholder-terminal-dim/50 resize-none
                focus:outline-none focus:border-terminal-amber/60 mb-2"
            />
            <button
              onClick={handleNote}
              disabled={!noteText.trim()}
              className="w-full py-1.5 rounded border border-terminal-amber/40 bg-terminal-amber/10
                text-terminal-amber text-xs font-semibold tracking-widest uppercase
                hover:bg-terminal-amber/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Add Note to Log
            </button>
          </section>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
