import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Character, FeedEntry, OutcomeTier } from '../types/game'
import { levelForXp, LEVEL_THRESHOLDS } from '../utils/leveling'

// XP awarded per roll outcome (live, pre-session-end)
const OUTCOME_XP: Record<OutcomeTier, number> = {
  critical_hit:  25,
  success:       15,
  partial:       8,
  failure:       3,
  critical_fail: 1,
}

const OUTCOME_COLOR: Record<OutcomeTier, string> = {
  critical_hit:  'text-terminal-green',
  success:       'text-terminal-green',
  partial:       'text-terminal-amber',
  failure:       'text-terminal-red',
  critical_fail: 'text-terminal-red',
}

interface SessionXp {
  total:       number
  lastGain:    number
  lastOutcome: OutcomeTier | null
  rollCount:   number
}

function computeSessionXp(playerId: string, feed: FeedEntry[]): SessionXp {
  const rolls = feed.filter((e) => e.type === 'roll_result' && e.roll?.player === playerId)
  const total = rolls.reduce((sum, e) => sum + (e.outcome ? (OUTCOME_XP[e.outcome] ?? 0) : 0), 0)
  const last  = rolls[rolls.length - 1]
  return {
    total,
    lastGain:    last?.outcome ? (OUTCOME_XP[last.outcome] ?? 0) : 0,
    lastOutcome: (last?.outcome as OutcomeTier | null) ?? null,
    rollCount:   rolls.length,
  }
}

// XP progress within the current level bracket
function xpProgress(totalXp: number): { pct: number; levelXp: number; needed: number; level: number; maxLevel: boolean } {
  const level    = levelForXp(totalXp)
  const maxLevel = level >= LEVEL_THRESHOLDS.length
  if (maxLevel) return { pct: 100, levelXp: 0, needed: 0, level, maxLevel: true }

  const floor  = LEVEL_THRESHOLDS[level - 1] as number
  const ceil   = LEVEL_THRESHOLDS[level]     as number
  const span   = ceil - floor
  const earned = totalXp - floor
  return { pct: Math.min(100, Math.round((earned / span) * 100)), levelXp: earned, needed: span - earned, level, maxLevel: false }
}

// ─── Player row ───────────────────────────────────────────────────────────────

interface RowProps {
  player:    Character
  sessionXp: SessionXp
  prevRolls: React.MutableRefObject<number>
}

function PlayerRow({ player, sessionXp, prevRolls }: RowProps) {
  const [flash, setFlash] = useState<number | null>(null)
  // One-shot celebratory banner that appears the moment the player crosses a
  // level threshold mid-session. Carries the new level so it can label itself.
  const [levelUpFlash, setLevelUpFlash] = useState<number | null>(null)
  // The last level we've already celebrated for this player in this session;
  // used to fire the banner once per threshold crossing (handles multi-level
  // gains if a session pushes through two thresholds).
  const lastShownLevelRef = useRef(player.level)

  const totalXp     = player.xp + sessionXp.total
  const progress    = xpProgress(totalXp)
  // "Leveled up THIS session" — persists in the UI until session end (where the
  // player picks their upgrade). Distinct from the one-shot flash above.
  const leveledUp   = progress.level > player.level

  // Flash "+N XP" badge when a new roll lands
  useEffect(() => {
    if (sessionXp.rollCount > prevRolls.current && sessionXp.lastGain > 0) {
      setFlash(sessionXp.lastGain)
      prevRolls.current = sessionXp.rollCount
      const t = setTimeout(() => setFlash(null), 1800)
      return () => clearTimeout(t)
    }
  }, [sessionXp.rollCount])

  // Level-up edge detector: fire the celebratory banner once per new level.
  useEffect(() => {
    if (progress.level > lastShownLevelRef.current) {
      setLevelUpFlash(progress.level)
      lastShownLevelRef.current = progress.level
      const t = setTimeout(() => setLevelUpFlash(null), 3500)
      return () => clearTimeout(t)
    }
  }, [progress.level])

  const barColor = leveledUp
    ? 'bg-terminal-amber'                     // gold while a level-up is pending
    : progress.pct >= 100
    ? 'bg-terminal-amber'
    : sessionXp.lastOutcome === 'critical_hit'
    ? 'bg-terminal-green'
    : 'bg-terminal-green/70'

  return (
    <div className="space-y-1">
      {/* Name row */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] font-semibold text-gray-200 truncate">{player.name}</span>
          {sessionXp.lastOutcome && (
            <span className={`text-[8px] tracking-wider ${OUTCOME_COLOR[sessionXp.lastOutcome]}`}>
              {sessionXp.lastOutcome === 'critical_hit'  ? 'CRIT!'
               : sessionXp.lastOutcome === 'critical_fail' ? 'FAIL'
               : sessionXp.lastOutcome === 'success'     ? 'HIT'
               : sessionXp.lastOutcome === 'partial'     ? 'PART'
               : 'MISS'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0 relative">
          {/* Level badge — pulses gold when the player crossed a threshold this session */}
          {leveledUp ? (
            <motion.span
              animate={{ opacity: [1, 0.55, 1], scale: [1, 1.06, 1] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              className="text-[9px] px-1 py-0.5 rounded bg-terminal-amber/15 border border-terminal-amber/60 text-terminal-amber font-bold"
              title={`Leveled up: pick an upgrade at session end (current LVL ${player.level} → ${progress.level})`}
            >
              LVL {progress.level} ↑
            </motion.span>
          ) : (
            <span className="text-[9px] px-1 py-0.5 rounded bg-terminal-green/10 border border-terminal-green/20 text-terminal-green font-bold">
              LVL {progress.level}
            </span>
          )}

          {/* Animated XP gain flash */}
          <AnimatePresence>
            {flash !== null && (
              <motion.span
                key={flash + sessionXp.rollCount}
                initial={{ opacity: 1, y: 0 }}
                animate={{ opacity: 0, y: -14 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.6, ease: 'easeOut' }}
                className={`absolute right-0 -top-4 text-[10px] font-bold pointer-events-none ${
                  sessionXp.lastOutcome ? OUTCOME_COLOR[sessionXp.lastOutcome] : 'text-terminal-green'
                }`}
              >
                +{flash}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* One-shot LEVEL UP banner — appears the moment a threshold is crossed */}
      <AnimatePresence>
        {levelUpFlash !== null && (
          <motion.div
            key={`lvlup-${levelUpFlash}`}
            initial={{ opacity: 0, scale: 0.6, y: -4 }}
            animate={{ opacity: 1, scale: 1,   y: 0 }}
            exit={{   opacity: 0, scale: 0.9, y: -2 }}
            transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
            className="flex items-center justify-center gap-1.5 py-1 rounded border border-terminal-amber/60
              bg-terminal-amber/15 text-terminal-amber text-[10px] font-bold tracking-widest uppercase"
          >
            <motion.span animate={{ rotate: [0, -8, 8, -4, 0] }} transition={{ duration: 0.5 }}>⬆</motion.span>
            Level Up! → LVL {levelUpFlash}
          </motion.div>
        )}
      </AnimatePresence>

      {/* XP bar */}
      <div className="flex items-center gap-1.5">
        <div className="flex-1 h-1.5 bg-terminal-muted rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${barColor}`}
            initial={{ width: 0 }}
            animate={{ width: `${progress.pct}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
        <span className="text-[11px] text-terminal-dim flex-shrink-0 w-12 text-right">
          {sessionXp.total > 0
            ? <span className="text-terminal-green">+{sessionXp.total}</span>
            : <span>0 XP</span>
          }
        </span>
      </div>

      {/* XP detail */}
      <div className="text-[10px] text-terminal-dim">
        {progress.maxLevel
          ? 'Max level reached'
          : `${totalXp} XP · ${progress.needed} to Lvl ${progress.level + 1}`
        }
      </div>
    </div>
  )
}

// ─── Scorecard ────────────────────────────────────────────────────────────────

interface Props {
  players: Character[]
  feed:    FeedEntry[]
}

export function LiveXPScorecard({ players, feed }: Props) {
  // Per-player ref tracking roll count to detect new rolls
  const prevRollsMap = useRef<Map<string, React.MutableRefObject<number>>>(new Map())

  const sessionXpMap = new Map<string, SessionXp>()
  for (const p of players) {
    sessionXpMap.set(p.id, computeSessionXp(p.id, feed))
    if (!prevRollsMap.current.has(p.id)) {
      prevRollsMap.current.set(p.id, { current: 0 })
    }
  }

  const totalSessionXp = [...sessionXpMap.values()].reduce((s, x) => s + x.total, 0)
  const rollCount      = feed.filter((e) => e.type === 'roll_result').length

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] text-terminal-dim tracking-widest uppercase">XP Scorecard</div>
        <div className="text-[9px] text-terminal-dim">
          {rollCount} roll{rollCount !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="space-y-3">
        {players.map((p) => (
          <PlayerRow
            key={p.id}
            player={p}
            sessionXp={sessionXpMap.get(p.id)!}
            prevRolls={prevRollsMap.current.get(p.id)!}
          />
        ))}
      </div>

      {/* Team XP total */}
      {players.length > 1 && (
        <div className="mt-3 pt-2 border-t border-terminal-border flex items-center justify-between">
          <span className="text-[9px] text-terminal-dim uppercase tracking-widest">Team total</span>
          <span className="text-xs font-bold text-terminal-green">+{totalSessionXp} XP</span>
        </div>
      )}
    </div>
  )
}
