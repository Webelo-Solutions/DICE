import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { FeedEntry } from '../types/game'
import { outcomeTierColor, outcomeTierLabel } from '../engine/dice'

interface Props {
  entries: FeedEntry[]
  streamingText?: string
}

const TYPE_LABEL: Record<FeedEntry['type'], string> = {
  dm_narration:       'DM',
  player_action:      'ACTION',
  roll_result:        'ROLL',
  inject:             '! INJECT',
  hint:               'HINT',
  system:             'SYSTEM',
  adversary_action:   'THREAT ACT',
  adversary_narration:'ADVERSARY',
}

const TYPE_COLOR: Record<FeedEntry['type'], string> = {
  dm_narration:       'text-terminal-green',
  player_action:      'text-terminal-blue',
  roll_result:        'text-terminal-amber',
  inject:             'text-terminal-red',
  hint:               'text-purple-400',
  system:             'text-terminal-dim',
  adversary_action:   'text-terminal-red',
  adversary_narration:'text-terminal-red',
}

export function NarrativeFeed({ entries, streamingText }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries.length, streamingText])

  return (
    <div className="flex flex-col h-full overflow-y-auto pr-2 space-y-3 scrollbar-thin">
      <AnimatePresence initial={false}>
        {entries.map((entry) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className={`rounded border border-terminal-border bg-terminal-surface p-3 ${
              entry.type === 'inject'              ? 'border-terminal-red/40 bg-terminal-red/5'    :
              entry.type === 'hint'                ? 'border-purple-500/30 bg-purple-500/5'        :
              entry.type === 'adversary_narration' ? 'border-terminal-red/50 bg-terminal-red/8'   :
              entry.type === 'adversary_action'    ? 'border-terminal-red/30 bg-terminal-red/5'   : ''
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-mono font-semibold tracking-widest ${TYPE_COLOR[entry.type]}`}>
                [{TYPE_LABEL[entry.type]}]
              </span>
              {entry.speaker && (
                <span className="text-xs text-terminal-dim font-mono">{entry.speaker}</span>
              )}
            </div>

            {entry.type === 'roll_result' && entry.roll ? (
              <div className="font-mono text-sm space-y-1">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-white">{entry.roll.raw}</span>
                  <span className="text-terminal-dim">+{entry.roll.modifier} mod</span>
                  <span className="text-terminal-dim">= {entry.roll.total}</span>
                  <span className="text-terminal-dim">vs DC {entry.roll.dc}</span>
                  <span className={`font-bold text-sm tracking-wider ${outcomeTierColor(entry.roll.outcome)}`}>
                    {outcomeTierLabel(entry.roll.outcome)}
                  </span>
                </div>
              </div>
            ) : entry.type === 'adversary_action' && entry.roll ? (
              <div className="font-mono text-sm space-y-2">
                <p className="text-gray-300 text-xs leading-snug">{entry.text}</p>
                <div className="flex items-center gap-3 pt-1 border-t border-terminal-red/20">
                  <span className="text-xl font-bold text-terminal-red">{entry.roll.raw}</span>
                  <span className="text-terminal-dim text-xs">+{entry.roll.modifier} evasion</span>
                  <span className="text-terminal-dim text-xs">= {entry.roll.total}</span>
                  <span className="text-terminal-dim text-xs">vs DC {entry.roll.dc}</span>
                  <span className={`font-bold text-xs tracking-widest ${
                    entry.roll.outcome === 'success' || entry.roll.outcome === 'critical_hit'
                      ? 'text-terminal-red'
                      : 'text-terminal-dim'
                  }`}>
                    {entry.roll.outcome === 'success' || entry.roll.outcome === 'critical_hit'
                      ? 'EVADED'
                      : 'DETECTED'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="font-mono text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                {entry.text}
              </p>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {streamingText && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded border border-terminal-green/30 bg-terminal-surface p-3"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-semibold tracking-widest text-terminal-green animate-pulse-glow">
              [DM]
            </span>
            <span className="text-xs text-terminal-dim animate-pulse">●</span>
          </div>
          <p className="font-mono text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
            {streamingText}
          </p>
        </motion.div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
