import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { NPCState } from '../types/npc'
import {
  NPC_PROFILES, NPC_STANCE_LABEL, NPC_STANCE_COLOR, NPC_STANCE_DC_MOD,
} from '../types/npc'

interface Props {
  npcs:         NPCState[]
  currentRound: number
}

function TrustBar({ trust, stance }: { trust: number; stance: NPCState['stance'] }) {
  const color =
    stance === 'hostile'    ? 'bg-terminal-red'          :
    stance === 'skeptical'  ? 'bg-terminal-amber'        :
    stance === 'neutral'    ? 'bg-terminal-dim'          :
    stance === 'supportive' ? 'bg-terminal-green/70'     :
                              'bg-terminal-green'

  return (
    <div className="h-1 w-full rounded-full bg-terminal-border overflow-hidden">
      <motion.div
        className={`h-full rounded-full ${color}`}
        initial={false}
        animate={{ width: `${trust}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
    </div>
  )
}

function NPCCard({ npc, currentRound }: { npc: NPCState; currentRound: number }) {
  const profile     = NPC_PROFILES.find((p) => p.role === npc.role)!
  const isRecent    = npc.lastActiveRound !== null && currentRound - npc.lastActiveRound <= 1
  const dcMod       = NPC_STANCE_DC_MOD[npc.stance]
  const lastInteraction = npc.interactions[npc.interactions.length - 1]

  return (
    <motion.div
      layout
      className={`rounded border p-2 transition-colors duration-300 ${
        isRecent
          ? 'border-terminal-amber/50 bg-terminal-amber/5'
          : 'border-terminal-border bg-terminal-surface/50'
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={`text-sm font-mono ${NPC_STANCE_COLOR[npc.stance]}`}>
          {profile.glyph}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-mono font-semibold text-white tracking-wide">
              {profile.title}
            </span>
            {dcMod !== 0 && (
              <span className={`text-[9px] font-mono font-bold ${
                dcMod < 0 ? 'text-terminal-green/80' : 'text-terminal-amber/80'
              }`}>
                {dcMod > 0 ? `+${dcMod}` : dcMod} DC
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-1 mt-0.5">
            <span className={`text-[9px] font-mono ${NPC_STANCE_COLOR[npc.stance]}`}>
              {NPC_STANCE_LABEL[npc.stance]}
            </span>
            <span className="text-[9px] font-mono text-terminal-dim/50">
              {npc.trust}/100
            </span>
          </div>
        </div>
      </div>

      <TrustBar trust={npc.trust} stance={npc.stance} />

      {lastInteraction && (
        <p className="text-[9px] text-terminal-dim/60 font-mono mt-1.5 leading-snug line-clamp-2">
          {lastInteraction.summary}
        </p>
      )}

      {npc.awareness.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {npc.awareness.slice(-2).map((fact, i) => (
            <span
              key={i}
              title={fact}
              className="text-[8px] font-mono px-1 py-0.5 rounded bg-terminal-green/8
                border border-terminal-green/20 text-terminal-green/60 leading-tight line-clamp-1 max-w-full"
            >
              {fact.length > 32 ? fact.slice(0, 32) + '…' : fact}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  )
}

export function StakeholderPanel({ npcs, currentRound }: Props) {
  const [open, setOpen] = useState(true)

  // Only NPCs the team is aware of yet: 'known' from the start, 'emergent' once
  // the DM introduces them. Cast-but-unintroduced NPCs stay hidden.
  const visible = npcs.filter((n) => n.introduced)
  if (visible.length === 0) return null

  const avgTrust    = Math.round(visible.reduce((sum, n) => sum + n.trust, 0) / visible.length)
  const hostileCount = visible.filter((n) => n.stance === 'hostile' || n.stance === 'skeptical').length
  const recentCount  = visible.filter((n) => n.lastActiveRound !== null && currentRound - n.lastActiveRound <= 1).length

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between mb-2 group"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono tracking-widest text-terminal-dim uppercase">
            Stakeholders
          </span>
          {recentCount > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-terminal-amber/15
              border border-terminal-amber/30 text-terminal-amber font-mono animate-pulse">
              {recentCount} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {hostileCount > 0 && (
            <span className="text-[9px] font-mono text-terminal-amber/70">
              ⚠ {hostileCount}
            </span>
          )}
          <span className={`text-[9px] font-mono ${
            avgTrust >= 65 ? 'text-terminal-green/60' :
            avgTrust >= 40 ? 'text-terminal-dim/50'   :
                             'text-terminal-amber/70'
          }`}>
            {avgTrust}%
          </span>
          <span className="text-[9px] text-terminal-dim/40 group-hover:text-terminal-dim transition-colors">
            {open ? '▲' : '▼'}
          </span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-2">
              {visible.map((npc) => (
                <NPCCard key={npc.role} npc={npc} currentRound={currentRound} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
