import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useAnimation } from 'framer-motion'
import type { Character, OutcomeTier, RollRecord } from '../types/game'
import { rollD20 } from '../engine/dice'

interface Props {
  player:         Character
  action:         string
  lastRoll:       RollRecord | null
  onRollComplete: (raw: number) => void
  onDismiss:      () => void
}

const D20_FACES = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]

const OUTCOME_DISPLAY: Record<OutcomeTier, { label: string; glyph: string }> = {
  critical_hit:  { label: 'CRITICAL HIT',  glyph: '⚡' },
  success:       { label: 'SUCCESS',        glyph: '✓'  },
  partial:       { label: 'PARTIAL',        glyph: '~'  },
  failure:       { label: 'FAILURE',        glyph: '✗'  },
  critical_fail: { label: 'CRITICAL FAIL',  glyph: '☠'  },
}

// Hexagon clip-path — used for the die face
const HEX = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'

// Accent colors as raw values (needed for boxShadow / textShadow / gradients)
const COLOR_GREEN  = '#00e87a'
const COLOR_AMBER  = '#f59e0b'
const COLOR_RED    = '#ef4444'
const COLOR_BLUE   = '#38bdf8'
const COLOR_DIM    = '#4a5568'

function accentFor(raw: number | null, animating: boolean): string {
  if (raw === 20)    return COLOR_GREEN
  if (raw === 1)     return COLOR_RED
  if (animating)     return COLOR_AMBER
  if (raw !== null)  return COLOR_GREEN
  return COLOR_DIM
}

export function DiceRollOverlay({ player, action, lastRoll, onRollComplete, onDismiss }: Props) {
  const [isAnimating,   setIsAnimating]   = useState(false)
  const [displayNumber, setDisplayNumber] = useState<number | null>(null)
  const [rawResult,     setRawResult]     = useState<number | null>(null)
  const [canDismiss,    setCanDismiss]    = useState(false)
  const [showRings,     setShowRings]     = useState(false)

  const schedulerRef      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isAnimRef         = useRef(false)
  const hasRolled         = useRef(false)
  const onRollCompleteRef = useRef(onRollComplete)
  const onDismissRef      = useRef(onDismiss)
  const dieControls       = useAnimation()
  const shakeControls     = useAnimation()

  useLayoutEffect(() => { onRollCompleteRef.current = onRollComplete })
  useLayoutEffect(() => { onDismissRef.current = onDismiss })

  const setAnim = (v: boolean) => { isAnimRef.current = v; setIsAnimating(v) }

  // Stable across renders — no prop deps, only dieControls / shakeControls
  const triggerRoll = useCallback(() => {
    if (isAnimRef.current || hasRolled.current) return
    hasRolled.current = true
    const result = rollD20()
    setAnim(true)

    // 3D tumble: multi-axis rotation decelerating to near-stop over 1.6s.
    // Numbers finish cycling ~1.5s later; the landing animation then interrupts
    // from whatever current angle and springs to face-forward (0, 0).
    void dieControls.start({
      rotateX: [0, -110, -230, -330, -400, -440, -465, -478, -484],
      rotateY: [0,  150,  290,  400,  470,  510,  530,  540,  544],
      transition: {
        duration: 1.6,
        ease: 'easeOut',
        times:    [0, 0.12, 0.26, 0.42, 0.58, 0.72, 0.84, 0.94, 1],
      },
    })

    // Number cycling — exponential slowdown
    let count = 0
    const totalFrames = 22
    const schedule = () => {
      const progress = count / totalFrames
      const delay = Math.round(20 + progress * progress * 200)
      schedulerRef.current = setTimeout(() => {
        count++
        if (count < totalFrames) {
          setDisplayNumber(D20_FACES[Math.floor(Math.random() * D20_FACES.length)])
          schedule()
        } else {
          setDisplayNumber(result)
          setRawResult(result)
          setAnim(false)

          // Landing: spring rotation to face-forward, bouncy scale thump
          void dieControls.start({
            rotateX: 0,
            rotateY: 0,
            scale:   [1, 1.42, 0.74, 1.20, 0.93, 1.04, 1],
            transition: {
              rotateX: { type: 'spring', stiffness: 320, damping: 22 },
              rotateY: { type: 'spring', stiffness: 320, damping: 22 },
              scale:   { duration: 0.65, ease: 'easeOut',
                         times: [0, 0.14, 0.34, 0.54, 0.72, 0.88, 1] },
            },
          })

          // Impact rings
          setShowRings(true)
          setTimeout(() => setShowRings(false), 900)

          // Card shake for crits
          if (result === 20 || result === 1) {
            void shakeControls.start({
              x: [0, -9, 11, -9, 7, -5, 3, -1, 0],
              transition: { duration: 0.48 },
            })
          }

          onRollCompleteRef.current(result)
        }
      }, delay)
    }
    schedule()
  }, [dieControls, shakeControls])

  // Fires once on mount — stable dep means timer never resets on re-render
  useEffect(() => {
    const id = setTimeout(triggerRoll, 600)
    return () => clearTimeout(id)
  }, [triggerRoll])

  // Auto-dismiss 2.4s after outcome; allow manual dismiss after 400ms
  useEffect(() => {
    if (!lastRoll) return
    const allow = setTimeout(() => setCanDismiss(true), 400)
    const auto  = setTimeout(() => onDismissRef.current(), 2600)
    return () => { clearTimeout(allow); clearTimeout(auto) }
  }, [lastRoll])

  useEffect(() => () => {
    if (schedulerRef.current) clearTimeout(schedulerRef.current)
  }, [])

  const isCrit  = rawResult === 20
  const isCritF = rawResult === 1
  const accent  = accentFor(rawResult, isAnimating)

  const cardBorder =
    !lastRoll                             ? 'border-terminal-border'   :
    lastRoll.outcome === 'critical_hit'   ? 'border-terminal-green'    :
    lastRoll.outcome === 'critical_fail'  ? 'border-terminal-red'      :
    lastRoll.outcome === 'success'        ? 'border-terminal-green/50' :
    lastRoll.outcome === 'partial'        ? 'border-terminal-amber/50' :
                                            'border-terminal-red/40'

  const outcome = lastRoll ? OUTCOME_DISPLAY[lastRoll.outcome] : null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={() => { if (canDismiss) onDismiss() }}
    >
      {/* Card entrance / exit */}
      <motion.div
        initial={{ scale: 0.84, opacity: 0, y: 32 }}
        animate={{ scale: 1,    opacity: 1, y: 0  }}
        exit={{    scale: 0.94, opacity: 0, y: -12 }}
        transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Inner wrapper — receives the shake animation */}
        <motion.div
          animate={shakeControls}
          className={`w-80 rounded-xl border-2 bg-terminal-surface
            shadow-2xl overflow-hidden font-mono transition-colors duration-300 ${cardBorder}`}
        >

          {/* ── Player + action ───────────────────────────────────────── */}
          <div className="px-5 pt-5 pb-4 border-b border-terminal-border">
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-sm font-bold text-white">{player.name}</span>
              <span className="text-xs text-terminal-dim">[{player.class}]</span>
            </div>
            <p className="text-xs text-gray-400 leading-snug line-clamp-2 italic">"{action}"</p>
          </div>

          {/* ── Die area ──────────────────────────────────────────────── */}
          <div className="py-8 flex flex-col items-center gap-4">

            {/* Perspective container: gives all child 3-D transforms depth */}
            <div className="relative" style={{ perspective: '700px', width: 176, height: 176 }}>

              {/* Impact rings — rendered behind the die */}
              <AnimatePresence>
                {showRings && (
                  <>
                    <motion.div
                      className="absolute inset-0 rounded-full pointer-events-none"
                      style={{ border: `2px solid ${accent}` }}
                      initial={{ scale: 0.55, opacity: 0.85 }}
                      animate={{ scale: 2.6,  opacity: 0 }}
                      exit={{}}
                      transition={{ duration: 0.7, ease: 'easeOut' }}
                    />
                    {(isCrit || isCritF) && (
                      <motion.div
                        className="absolute inset-0 rounded-full pointer-events-none"
                        style={{ border: `1px solid ${accent}` }}
                        initial={{ scale: 0.55, opacity: 0.5 }}
                        animate={{ scale: 3.8,  opacity: 0 }}
                        exit={{}}
                        transition={{ duration: 1.0, ease: 'easeOut', delay: 0.08 }}
                      />
                    )}
                  </>
                )}
              </AnimatePresence>

              {/* Die — receives the 3-D rotation and scale animation */}
              <motion.div
                animate={dieControls}
                className="absolute inset-0 flex items-center justify-center select-none"
                style={{ transformStyle: 'preserve-3d' }}
              >
                {/* Crit-20 ambient glow — radial gradient, not clipped */}
                {isCrit && !isAnimating && (
                  <motion.div
                    className="absolute pointer-events-none"
                    style={{
                      inset: '-40%',
                      background: `radial-gradient(circle, ${COLOR_GREEN}28 0%, transparent 65%)`,
                      borderRadius: '50%',
                    }}
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.4, repeat: Infinity }}
                  />
                )}
                {isCritF && !isAnimating && (
                  <motion.div
                    className="absolute pointer-events-none"
                    style={{
                      inset: '-40%',
                      background: `radial-gradient(circle, ${COLOR_RED}25 0%, transparent 65%)`,
                      borderRadius: '50%',
                    }}
                    animate={{ opacity: [0.4, 0.9, 0.4] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  />
                )}

                {/* Border layer: slightly larger hexagon in accent color, sits behind fill */}
                <div
                  className="absolute"
                  style={{
                    inset: '-2px',
                    clipPath: HEX,
                    backgroundColor: accent,
                    opacity: 0.9,
                    transition: 'background-color 0.2s',
                  }}
                />

                {/* Fill layer */}
                <div
                  className="absolute inset-0"
                  style={{
                    clipPath: HEX,
                    backgroundColor:
                      isCrit      ? `${COLOR_GREEN}18` :
                      isCritF     ? `${COLOR_RED}18`   :
                      isAnimating ? `${COLOR_AMBER}0e` :
                                    `${COLOR_GREEN}0c`,
                    transition: 'background-color 0.25s',
                  }}
                />

                {/* Inner ridge — second smaller hexagon for die-face detail */}
                <div
                  className="absolute"
                  style={{ inset: '12%', clipPath: HEX, backgroundColor: accent, opacity: 0.12 }}
                />
                <div
                  className="absolute"
                  style={{ inset: '14%', clipPath: HEX, backgroundColor: '#0d1117' }}
                />

                {/* "d20" watermark at top */}
                <span
                  className="absolute top-[22%] text-[9px] font-bold tracking-widest"
                  style={{ color: accent, opacity: 0.35 }}
                >
                  d20
                </span>

                {/* Number */}
                <AnimatePresence mode="wait">
                  {displayNumber !== null ? (
                    <motion.span
                      // Use a STABLE key while spinning ('rolling') rather than the
                      // per-frame number. With mode="wait", a key that changes every
                      // ~20-38ms outpaces the exit animations and backs them up; the
                      // component can then settle on a stale intermediate face instead
                      // of the final result. One key during the spin → one clean exit
                      // → the resting face is always `result`. The face text still
                      // updates in place each frame, so the slot-machine effect stays.
                      key={isAnimating ? 'rolling' : 'final'}
                      initial={{ scale: 0.3,  opacity: 0 }}
                      animate={{ scale: 1,    opacity: 1 }}
                      exit={{   scale: 1.8,   opacity: 0 }}
                      transition={{ duration: isAnimating ? 0.038 : 0.28, ease: 'backOut' }}
                      className="relative z-10 text-6xl font-black tabular-nums leading-none"
                      style={{
                        color: accent,
                        filter: isAnimating ? 'blur(4px)' : 'none',
                        transition: 'filter 0.25s, color 0.2s',
                        textShadow: !isAnimating && (isCrit || isCritF)
                          ? `0 0 24px ${accent}, 0 0 48px ${accent}60`
                          : 'none',
                      }}
                    >
                      {displayNumber}
                    </motion.span>
                  ) : (
                    <motion.span
                      key="placeholder"
                      animate={{ opacity: [0.25, 0.7, 0.25] }}
                      transition={{ duration: 1.3, repeat: Infinity }}
                      className="relative z-10 text-2xl font-bold"
                      style={{ color: COLOR_DIM }}
                    >
                      d20
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>

            {/* Status label */}
            {isAnimating && (
              <motion.span
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 0.55, repeat: Infinity }}
                className="text-xs text-terminal-amber tracking-widest uppercase"
              >
                Rolling...
              </motion.span>
            )}
            {!isAnimating && !rawResult && (
              <motion.span
                animate={{ opacity: [0.3, 0.75, 0.3] }}
                transition={{ duration: 1.1, repeat: Infinity }}
                className="text-xs tracking-widest"
                style={{ color: COLOR_DIM }}
              >
                Preparing roll...
              </motion.span>
            )}
          </div>

          {/* ── Breakdown — slides in once lastRoll is set ─────────────── */}
          <AnimatePresence>
            {lastRoll && (
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1,  y: 0  }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="px-5 pb-5"
              >
                {/* Roll / Mod / Total */}
                <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                  <div className="rounded border border-terminal-border bg-terminal-bg px-2 py-2">
                    <div className="text-[9px] text-terminal-dim tracking-widest uppercase mb-0.5">Roll</div>
                    <div className="text-2xl font-bold text-white tabular-nums">{lastRoll.raw}</div>
                  </div>
                  <div className="rounded border px-2 py-2"
                    style={{ borderColor: `${COLOR_BLUE}50`, background: `${COLOR_BLUE}0d` }}
                  >
                    <div className="text-[9px] text-terminal-dim tracking-widest uppercase mb-0.5">Mod</div>
                    <div className="text-2xl font-bold tabular-nums" style={{ color: COLOR_BLUE }}>
                      {lastRoll.modifier >= 0 ? '+' : ''}{lastRoll.modifier}
                    </div>
                  </div>
                  <div className={`rounded border px-2 py-2 ${
                    lastRoll.total >= lastRoll.dc
                      ? 'border-terminal-green/40 bg-terminal-green/10'
                      : 'border-terminal-red/40   bg-terminal-red/10'
                  }`}>
                    <div className="text-[9px] text-terminal-dim tracking-widest uppercase mb-0.5">
                      vs DC {lastRoll.dc}
                    </div>
                    <div className={`text-2xl font-bold tabular-nums ${
                      lastRoll.total >= lastRoll.dc ? 'text-terminal-green' : 'text-terminal-red'
                    }`}>
                      {lastRoll.total}
                    </div>
                  </div>
                </div>

                {/* Outcome banner */}
                {outcome && (
                  <motion.div
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1,   opacity: 1 }}
                    transition={{ delay: 0.1, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                    className={`flex items-center justify-center gap-2 py-3 rounded border
                      text-sm font-bold tracking-widest ${
                      lastRoll.outcome === 'critical_hit'  ? 'border-terminal-green/60 bg-terminal-green/15 text-terminal-green' :
                      lastRoll.outcome === 'critical_fail' ? 'border-terminal-red/60   bg-terminal-red/15   text-terminal-red'   :
                      lastRoll.outcome === 'success'       ? 'border-terminal-green/30 bg-terminal-green/5  text-terminal-green' :
                      lastRoll.outcome === 'partial'       ? 'border-terminal-amber/30 bg-terminal-amber/5  text-terminal-amber' :
                                                            'border-terminal-red/30   bg-terminal-red/5    text-terminal-red'
                    }`}
                  >
                    <motion.span
                      animate={lastRoll.outcome === 'critical_hit'
                        ? { scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }
                        : {}}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    >
                      {outcome.glyph}
                    </motion.span>
                    {outcome.label}
                  </motion.div>
                )}

                {/* Dismiss hint */}
                <AnimatePresence>
                  {canDismiss && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center text-[10px] text-terminal-dim/40 mt-3"
                    >
                      tap anywhere to continue
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

        </motion.div>
      </motion.div>
    </motion.div>
  )
}
