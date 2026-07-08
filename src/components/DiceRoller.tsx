import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useAnimation } from 'framer-motion'
import type { OutcomeTier } from '../types/game'
import { rollD20, outcomeTierColor, outcomeTierLabel } from '../engine/dice'

interface Props {
  onRollComplete: (raw: number) => void
  disabled:       boolean
  lastResult?:    number | null
  lastOutcome?:   OutcomeTier | null
  waitingForRoll?: boolean
}

const D20_FACES = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]

export function DiceRoller({ onRollComplete, disabled, lastResult, lastOutcome, waitingForRoll }: Props) {
  const [isAnimating,    setIsAnimating]    = useState(false)
  const [displayNumber,  setDisplayNumber]  = useState<number | null>(null)
  const [finalResult,    setFinalResult]    = useState<number | null>(null)
  const schedulerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isAnimRef     = useRef(false)   // shadow ref so triggerRoll closure is never stale
  const dieControls   = useAnimation()

  const setAnim = (val: boolean) => {
    isAnimRef.current = val
    setIsAnimating(val)
  }

  const triggerRoll = useCallback(() => {
    if (isAnimRef.current) return
    const result = rollD20()
    setFinalResult(null)
    setAnim(true)

    // Start continuous wobble via animation controls
    dieControls.start({
      rotate: [0, -7, 11, -9, 7, -5, 3, -2, 0],
      transition: { duration: 0.55, repeat: Infinity, ease: 'easeInOut' },
    })

    // Slot-machine: quadratic ease-out timing (fast start → slow landing)
    let count = 0
    const totalFrames = 26
    const schedule = () => {
      const progress  = count / totalFrames
      const delay     = Math.round(30 + progress * progress * 140)
      schedulerRef.current = setTimeout(() => {
        count++
        if (count < totalFrames) {
          setDisplayNumber(D20_FACES[Math.floor(Math.random() * D20_FACES.length)])
          schedule()
        } else {
          setDisplayNumber(result)
          setFinalResult(result)
          // Stop wobble, do a landing bounce
          dieControls.start({
            rotate: 0,
            scale:  [1, 1.14, 0.93, 1.05, 1],
            transition: { duration: 0.38, ease: 'easeOut' },
          })
          setAnim(false)
          onRollComplete(result)
        }
      }, delay)
    }
    schedule()
  }, [dieControls, onRollComplete])

  // Auto-trigger 600ms after action is submitted
  useEffect(() => {
    if (!waitingForRoll || isAnimRef.current || disabled) return
    const id = setTimeout(triggerRoll, 600)
    return () => clearTimeout(id)
  }, [waitingForRoll, disabled, triggerRoll])

  // Cleanup scheduler on unmount
  useEffect(() => () => {
    if (schedulerRef.current) clearTimeout(schedulerRef.current)
  }, [])

  const displayVal = displayNumber ?? lastResult ?? null
  const shown      = finalResult ?? lastResult
  const isCrit     = shown === 20
  const isFail     = shown === 1

  const dieClass = [
    'absolute inset-0 border-2 transition-colors duration-200',
    isCrit      ? 'border-terminal-green  bg-terminal-green/15'  :
    isFail      ? 'border-terminal-red    bg-terminal-red/15'    :
    isAnimating ? 'border-terminal-amber  bg-terminal-amber/10'  :
    waitingForRoll ? 'border-terminal-green/50 bg-terminal-green/5' :
                  'border-terminal-border bg-terminal-surface',
  ].join(' ')

  const numClass = [
    'relative z-10 text-3xl font-bold select-none',
    isCrit      ? 'text-terminal-green animate-pulse-glow' :
    isFail      ? 'text-terminal-red   animate-shake'      :
    isAnimating ? 'text-terminal-amber'                    :
                  'text-white',
  ].join(' ')

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Die face */}
      <motion.div
        animate={dieControls}
        className="relative w-28 h-28 flex items-center justify-center select-none"
      >
        <div
          className={dieClass}
          style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
        />

        <AnimatePresence mode="wait">
          {displayVal !== null ? (
            <motion.span
              key={displayVal}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1,   opacity: 1 }}
              exit={{   scale: 1.6,  opacity: 0 }}
              transition={{ duration: isAnimating ? 0.045 : 0.18, ease: 'backOut' }}
              className={numClass}
            >
              {displayVal}
            </motion.span>
          ) : (
            <motion.span
              key="placeholder"
              animate={waitingForRoll ? { opacity: [0.35, 1, 0.35] } : { opacity: 0.6 }}
              transition={waitingForRoll ? { duration: 1.1, repeat: Infinity } : {}}
              className={`relative z-10 text-lg font-semibold select-none ${
                waitingForRoll ? 'text-terminal-green' : 'text-terminal-dim'
              }`}
            >
              d20
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Outcome label */}
      <AnimatePresence>
        {lastOutcome && !isAnimating && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{   opacity: 0 }}
            className={`text-sm font-bold tracking-widest ${outcomeTierColor(lastOutcome)}`}
          >
            {outcomeTierLabel(lastOutcome)}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status line */}
      <div className="h-4 flex items-center justify-center">
        {isAnimating && (
          <motion.span
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 0.55, repeat: Infinity }}
            className="text-xs text-terminal-amber tracking-widest"
          >
            Rolling...
          </motion.span>
        )}
        {!isAnimating && waitingForRoll && displayVal === null && (
          <motion.span
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="text-xs text-terminal-green"
          >
            Preparing roll...
          </motion.span>
        )}
        {!isAnimating && !waitingForRoll && !lastResult && (
          <span className="text-xs text-terminal-dim">Awaiting action...</span>
        )}
      </div>
    </div>
  )
}
