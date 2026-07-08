import { useMemo, useEffect, useRef } from 'react'
import { motion, useAnimation } from 'framer-motion'
import type { FeedEntry, OutcomeTier } from '../types/game'

// ─── Scoring ──────────────────────────────────────────────────────────────────

const OUTCOME_THREAT: Record<OutcomeTier, number> = {
  critical_hit:  0.00,
  success:       0.18,
  partial:       0.48,
  failure:       0.76,
  critical_fail: 1.00,
}

// Recency weights — index 0 = most recent roll, counts double
const WEIGHTS = [2.0, 1.6, 1.2, 1.0, 0.8]

function computeThreatScore(feed: FeedEntry[]): number | null {
  const rolls = feed
    .filter((e) => e.type === 'roll_result' && e.outcome)
    .slice(-5)
    .reverse()  // newest first

  if (rolls.length === 0) return null

  let weighted = 0
  let total    = 0
  rolls.forEach((r, i) => {
    const w = WEIGHTS[i] ?? 0.8
    weighted += (OUTCOME_THREAT[r.outcome as OutcomeTier] ?? 0.5) * w
    total    += w
  })
  return weighted / total
}

// ─── Threat bands ─────────────────────────────────────────────────────────────

interface Band {
  color:     string   // hex
  speed:     number   // pulse cycle seconds
  peakAlpha: number   // 0-1, opacity at peak of pulse
}

function scoreToBand(score: number): Band {
  if (score < 0.20) return { color: '#4ade80', speed: 4.5, peakAlpha: 0.10 }  // cool green — thriving
  if (score < 0.38) return { color: '#86efac', speed: 3.5, peakAlpha: 0.13 }  // light green — solid
  if (score < 0.54) return { color: '#fbbf24', speed: 2.2, peakAlpha: 0.18 }  // amber — slipping
  if (score < 0.70) return { color: '#fb923c', speed: 1.3, peakAlpha: 0.24 }  // orange — struggling
  return                     { color: '#f87171', speed: 0.65, peakAlpha: 0.34 } // red — critical
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  feed: FeedEntry[]
}

export function ThreatPulse({ feed }: Props) {
  // Only recompute when roll count changes, not on every DM narration
  const rollCount = useMemo(() => feed.filter((e) => e.type === 'roll_result').length, [feed])
  const score     = useMemo(() => computeThreatScore(feed), [rollCount])

  const controls   = useAnimation()
  const prevBandRef = useRef<Band | null>(null)

  useEffect(() => {
    if (score === null) return

    const band = scoreToBand(score)
    const prev = prevBandRef.current

    // Only restart animation cycle if speed changed meaningfully
    if (!prev || Math.abs(prev.speed - band.speed) > 0.2) {
      controls.start({
        opacity: [band.peakAlpha * 0.35, band.peakAlpha, band.peakAlpha * 0.35],
        transition: {
          duration:   band.speed,
          repeat:     Infinity,
          ease:       'easeInOut',
          repeatType: 'loop',
        },
      })
    }
    prevBandRef.current = band
  }, [rollCount, score, controls])

  if (score === null) return null

  const band = scoreToBand(score)

  return (
    <motion.div
      animate={controls}
      className="fixed inset-0 pointer-events-none"
      style={{
        zIndex: 15,
        // Vignette that emanates from screen edges inward
        background: [
          `radial-gradient(ellipse at center, transparent 52%, ${band.color}22 72%, ${band.color}55 100%)`,
        ].join(', '),
        // CSS transition handles color shifts between bands smoothly
        transition: 'background 2.5s ease',
      }}
    />
  )
}
