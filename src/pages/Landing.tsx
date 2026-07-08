import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useGameStore }     from '../store/gameStore'
import { useCampaignStore } from '../store/campaignStore'
import { useRoomStore }     from '../store/roomStore'
import { disconnectRoom }   from '../api/roomSocket'
import { ALL_SCENARIOS }    from '../data/scenarios'
import type { SaveSlot }    from '../types/campaign'
import { CommSettingsModal }     from '../components/CommSettingsModal'
import { ProviderSettingsModal } from '../components/ProviderSettingsModal'
import { OrgPostureWidget }      from '../components/OrgPostureWidget'
import { PLATFORM_LABEL }        from '../engine/webhookClient'
import { PROVIDER_LABEL, PROVIDER_GLYPH } from '../types/provider'

const PILLARS = [
  { label: 'Scenarios',         value: String(ALL_SCENARIOS.length) },
  { label: 'Character Classes', value: '6'                          },
  { label: 'AI Dungeon Master', value: 'Claude'                     },
  { label: 'Kill Chain Phases', value: '6+'                         },
]

const FEATURES = [
  { icon: '⚔',  title: 'Initiative Rolls',    desc: 'Turn order decided by agility + d20 at session start' },
  { icon: '🎲', title: 'Live Dice Mechanics', desc: 'Auto-rolling d20 with animated outcome tiers'          },
  { icon: '⚡', title: 'Critical Events',      desc: 'Critical hits and fails shift the narrative'           },
  { icon: '⏱', title: 'Timed Rounds',         desc: 'Adjustable pressure timers from Rookie to Elite'       },
  { icon: '🔥', title: 'Threat Injects',       desc: 'Unexpected complications escalate mid-scenario'        },
  { icon: '📈', title: 'XP & Leveling',        desc: 'Characters earn experience and unlock new skills'      },
]

function timeAgo(ms: number): string {
  const diff = Date.now() - ms
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)   return 'just now'
  if (mins  < 60)  return `${mins}m ago`
  if (hours < 24)  return `${hours}h ago`
  return `${days}d ago`
}

export function Landing() {
  const navigate  = useNavigate()
  const { providerConfig, commConfig, sessionHistory, orgState } = useGameStore()
  const { saves, deleteSave } = useCampaignStore()
  const [showAllSaves,    setShowAllSaves]    = useState(false)
  const [commOpen,        setCommOpen]        = useState(false)
  const [providerOpen,    setProviderOpen]    = useState(false)
  const hasProvider = !!providerConfig?.apiKey

  // Solo/local play can't coexist with a LAN room in the same browser, so the
  // local entry points drop any leftover room membership first — otherwise a
  // stale membership would route the solo flow into room mode.
  const leaveRoomIfAny = () => {
    if (useRoomStore.getState().membership) {
      disconnectRoom()
      useRoomStore.getState().clearMembership()
    }
  }

  const handleStart = () => { leaveRoomIfAny(); navigate('/scenarios') }

  const handleLoadSave = (slot: SaveSlot) => {
    leaveRoomIfAny()
    useGameStore.setState({
      session:       { ...slot.session, status: 'active' },
      feed:          slot.feed,
      result:        null,
      isDMThinking:  false,
      pendingAction: '',
    })
    navigate('/game')
  }

  const visibleSaves = showAllSaves ? saves : saves.slice(0, 3)

  return (
    <div
      className="min-h-screen bg-terminal-bg font-mono flex flex-col overflow-x-hidden"
      style={{
        backgroundImage:
          'linear-gradient(rgba(74,222,128,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(74,222,128,0.025) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }}
    >
      {/* Classification bar */}
      <div className="w-full bg-terminal-amber/10 border-b border-terminal-amber/30 py-1.5 text-center flex-shrink-0 relative z-10">
        <span className="text-[10px] text-terminal-amber tracking-[0.3em] uppercase font-semibold">
          ▌ Exercise Material — Training Use Only ▐
        </span>
      </div>

      {/* ── Hero banner image ───────────────────────────────────────────────── */}
      <div className="relative w-full overflow-hidden flex-shrink-0" style={{ aspectRatio: '1602/572', maxHeight: '660px' }}>
        {/* Banner photo */}
        <img
          src="/banner.png"
          alt="DICE team in the field"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: 'center 60%' }}
          draggable={false}
        />

        {/* Scan-line texture over photo */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.07) 3px, rgba(0,0,0,0.07) 4px)',
          }}
        />

        {/* Green tint overlay — ties photo to terminal palette */}
        <div className="absolute inset-0 bg-terminal-green/5 pointer-events-none" />

        {/* Side vignettes */}
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-terminal-bg/70 to-transparent pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-terminal-bg/70 to-transparent pointer-events-none" />

        {/* Top vignette */}
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-terminal-bg/60 to-transparent pointer-events-none" />

        {/* Bottom fade — blends into page background */}
        <div
          className="absolute inset-x-0 bottom-0 pointer-events-none"
          style={{
            height: '65%',
            background: 'linear-gradient(to bottom, transparent 0%, rgba(13,17,23,0.55) 35%, rgba(13,17,23,0.88) 65%, #0d1117 100%)',
          }}
        />

        {/* Corner brackets */}
        <div className="absolute top-5 left-5 w-7 h-7 border-t-2 border-l-2 border-terminal-green/40 z-10" />
        <div className="absolute top-5 right-5 w-7 h-7 border-t-2 border-r-2 border-terminal-green/40 z-10" />

        {/* ── Overlaid title content ── */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-8 px-6 z-10">
          {/* DICE wordmark */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative text-center mb-2"
          >
            <div
              className="font-black text-terminal-green leading-none tracking-[0.18em] select-none"
              style={{
                fontSize: 'clamp(4rem, 10vw, 7rem)',
                textShadow: '0 0 30px rgba(74,222,128,0.6), 0 0 60px rgba(74,222,128,0.25), 0 2px 8px rgba(0,0,0,0.8)',
              }}
            >
              DICE
            </div>
          </motion.div>

          {/* Tagline */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-xs text-gray-300 tracking-[0.3em] uppercase mb-5"
            style={{ textShadow: '0 1px 6px rgba(0,0,0,0.9)' }}
          >
            Defensive Incident Containment Exercises
          </motion.div>

          {/* Stat pills */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
            className="flex flex-wrap justify-center gap-2"
          >
            {PILLARS.map(({ label, value }) => (
              <div
                key={label}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-terminal-green/25
                  bg-black/50 backdrop-blur-sm text-xs"
              >
                <span className="text-terminal-green font-bold">{value}</span>
                <span className="text-gray-400">{label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ── Saved Sessions ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {saves.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="w-full max-w-3xl mx-auto px-6 pb-2"
          >
            <div className="rounded border border-terminal-green/20 bg-terminal-surface/60 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-terminal-border">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-terminal-green tracking-widest uppercase">
                    Continue Session
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-terminal-green/10 border border-terminal-green/20 text-terminal-green">
                    {saves.length}
                  </span>
                </div>
                {saves.length > 3 && (
                  <button
                    onClick={() => setShowAllSaves((v) => !v)}
                    className="text-[10px] text-terminal-dim hover:text-terminal-green transition-colors"
                  >
                    {showAllSaves ? 'Show less ↑' : `Show all ${saves.length} →`}
                  </button>
                )}
              </div>

              {/* Save rows */}
              <div className="divide-y divide-terminal-border">
                {visibleSaves.map((slot) => (
                  <div key={slot.id} className="flex items-center gap-4 px-4 py-3 group hover:bg-terminal-green/3 transition-colors">
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{slot.name}</div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] text-terminal-dim">{slot.session.scenario.id}</span>
                        <span className="text-[10px] text-terminal-dim">
                          Act {slot.session.act} · Round {slot.session.round}
                        </span>
                        <span className="text-[10px] text-terminal-dim">
                          {slot.session.players.length} player{slot.session.players.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-[10px] text-terminal-dim/50">{timeAgo(slot.savedAt)}</span>
                      </div>
                    </div>

                    {/* Clock remaining */}
                    <div className="text-right flex-shrink-0 hidden sm:block">
                      <div className="text-xs text-terminal-amber font-mono">
                        {slot.session.scenarioClockRemaining} min
                      </div>
                      <div className="text-[9px] text-terminal-dim">clock left</div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleLoadSave(slot)}
                        className="px-3 py-1.5 rounded border border-terminal-green/40 bg-terminal-green/10
                          text-terminal-green text-xs font-bold tracking-widest uppercase
                          hover:bg-terminal-green/20 hover:border-terminal-green transition-all"
                      >
                        ▶ Load
                      </button>
                      <button
                        onClick={() => deleteSave(slot.id)}
                        className="px-2 py-1.5 rounded border border-transparent text-terminal-dim/40
                          text-xs hover:border-terminal-red/30 hover:text-terminal-red transition-all"
                        title="Delete save"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Feature grid ─────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.4 }}
        className="w-full max-w-3xl mx-auto px-6 pt-6 pb-8"
      >
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {FEATURES.map(({ icon, title, desc }) => (
            <div
              key={title}
              className="rounded border border-terminal-border bg-terminal-surface/70 px-4 py-3 space-y-1
                hover:border-terminal-green/30 transition-colors duration-200"
            >
              <div className="flex items-center gap-2">
                <span className="text-base leading-none">{icon}</span>
                <span className="text-xs font-semibold text-gray-200">{title}</span>
              </div>
              <p className="text-[11px] text-terminal-dim leading-snug">{desc}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Controls card ────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.4 }}
        className="w-full max-w-md mx-auto px-6 pb-12 space-y-4"
      >
        {/* AI provider card */}
        <button
          onClick={() => setProviderOpen(true)}
          className={`w-full rounded border p-4 text-left transition-all duration-150 ${
            hasProvider
              ? 'border-terminal-green/30 bg-terminal-green/5 hover:bg-terminal-green/10'
              : 'border-terminal-border bg-terminal-surface hover:border-terminal-green/40'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="text-[9px] text-terminal-dim tracking-widest uppercase">AI Dungeon Master</div>
            {hasProvider
              ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-terminal-green/10 border border-terminal-green/20 text-terminal-green">✓ Configured</span>
              : <span className="text-[10px] text-terminal-amber/70">Not configured</span>
            }
          </div>
          {hasProvider && providerConfig ? (
            <div className="flex items-center gap-2">
              <span className="text-base leading-none">{PROVIDER_GLYPH[providerConfig.provider]}</span>
              <span className="text-sm font-semibold text-white">{PROVIDER_LABEL[providerConfig.provider]}</span>
              <span className="text-xs text-terminal-dim">— {providerConfig.azureDeployment ?? providerConfig.model}</span>
            </div>
          ) : (
            <p className="text-xs text-terminal-dim/70">Click to select Anthropic, OpenAI, Azure, or Gemini</p>
          )}
        </button>

        {/* Begin button */}
        <button
          onClick={handleStart}
          disabled={!hasProvider}
          className="w-full py-4 rounded border border-terminal-green bg-terminal-green/10
            text-terminal-green font-bold text-sm tracking-[0.2em] uppercase
            hover:bg-terminal-green/20 disabled:opacity-30 disabled:cursor-not-allowed
            transition-all duration-200 relative overflow-hidden group"
        >
          <span className="relative z-10">▶ Begin Solo Training</span>
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform
            duration-700 bg-gradient-to-r from-transparent via-terminal-green/10 to-transparent" />
        </button>

        {/* Multiplayer (LAN) entry points */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/host')}
            className="py-2.5 rounded border border-terminal-blue/40 bg-terminal-blue/10 text-terminal-blue
              text-xs font-semibold tracking-widest uppercase hover:bg-terminal-blue/20 transition-all"
          >
            ⬡ Host Game
          </button>
          <button
            onClick={() => navigate('/join')}
            className="py-2.5 rounded border border-terminal-blue/40 bg-terminal-blue/10 text-terminal-blue
              text-xs font-semibold tracking-widest uppercase hover:bg-terminal-blue/20 transition-all"
          >
            ⊕ Join Game
          </button>
        </div>
        <p className="text-center text-[10px] text-terminal-dim/60 tracking-wide -mt-1">
          Multiplayer runs on your trusted local network — players join with a room code (not for internet use)
        </p>

        {/* Comms config button */}
        <button
          onClick={() => setCommOpen(true)}
          className={`w-full py-2.5 rounded border text-xs font-semibold tracking-widest uppercase
            transition-all ${commConfig
              ? 'border-terminal-blue/50 bg-terminal-blue/10 text-terminal-blue hover:bg-terminal-blue/20'
              : 'border-terminal-border text-terminal-dim/60 hover:border-terminal-blue/40 hover:text-terminal-blue/70'
            }`}
        >
          {commConfig
            ? `💬 ${PLATFORM_LABEL[commConfig.platform]} Connected`
            : '💬 Configure Team Comms'}
        </button>

        {/* Content packs — import shared scenarios & characters */}
        <button
          onClick={() => navigate('/content-packs')}
          className="w-full py-2.5 rounded border text-xs font-semibold tracking-widest uppercase
            transition-all border-terminal-border text-terminal-dim/60
            hover:border-terminal-green/40 hover:text-terminal-green/70"
        >
          📦 Content Packs
        </button>

        {/* Org Posture widget — shown once there's org history */}
        <OrgPostureWidget orgState={orgState} />

        {/* Analytics link — shown once there's history */}
        {sessionHistory.length > 0 && (
          <button
            onClick={() => navigate('/analytics')}
            className="w-full py-2.5 rounded border text-xs font-semibold tracking-widest uppercase
              transition-all border-terminal-border text-terminal-dim/60
              hover:border-terminal-blue/40 hover:text-terminal-blue/70"
          >
            📊 Team Analytics · {sessionHistory.length} session{sessionHistory.length !== 1 ? 's' : ''}
          </button>
        )}

        <p className="text-center text-[10px] text-terminal-dim tracking-wide">
          {hasProvider && providerConfig
            ? `Powered by ${PROVIDER_LABEL[providerConfig.provider]} — ${providerConfig.azureDeployment ?? providerConfig.model}`
            : 'Configure an AI provider to begin'
          }
        </p>
        <p className="text-center text-[9px] text-terminal-dim/50 tracking-widest uppercase -mt-1">
          DICE v{__APP_VERSION__}
        </p>
      </motion.div>

      <AnimatePresence>
        {commOpen && <CommSettingsModal onClose={() => setCommOpen(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {providerOpen && <ProviderSettingsModal onClose={() => setProviderOpen(false)} />}
      </AnimatePresence>

      {/* Bottom classification bar */}
      <div className="mt-auto w-full bg-terminal-surface border-t border-terminal-border py-1.5 text-center flex-shrink-0">
        <span className="text-[9px] text-terminal-dim/60 tracking-widest uppercase">
          DICE v0.1 · For authorized training exercises only · Not for operational use
        </span>
      </div>
    </div>
  )
}
