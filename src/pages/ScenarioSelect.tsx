import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ALL_SCENARIOS } from '../data/scenarios'
import { useCampaignStore } from '../store/campaignStore'
import { CATEGORIES, CUSTOM_CATEGORY } from '../data/categories'
import type { ScenarioCategoryDef } from '../data/categories'
import type { ScenarioPack } from '../types/game'
import { matchingTechniques } from '../utils/techniqueCoverage'

const DIFF_LABEL = ['', 'Novice', 'Analyst', 'Senior', 'Expert', 'Elite']
const DIFF_COLOR = ['', 'text-terminal-green', 'text-terminal-blue', 'text-terminal-amber', 'text-orange-400', 'text-terminal-red']

interface Props {
  onSelect: (scenario: ScenarioPack) => void
}

export function ScenarioSelect({ onSelect }: Props) {
  const navigate            = useNavigate()
  const { customScenarios } = useCampaignStore()

  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({})
  const toggle = (id: string) => setOpenFolders((p) => ({ ...p, [id]: !p[id] }))

  const [techniqueQuery, setTechniqueQuery] = useState('')
  const hasQuery = techniqueQuery.trim().length > 0
  const matchesQuery = (s: ScenarioPack) => !hasQuery || matchingTechniques(s, techniqueQuery).length > 0

  const grouped = CATEGORIES
    .map((cat) => ({
      cat,
      scenarios: ALL_SCENARIOS
        .filter((s) => (s.category ?? 'custom') === cat.id)
        .filter(matchesQuery)
        .sort((a, b) => a.difficulty - b.difficulty),
    }))
    .filter((g) => g.scenarios.length > 0)

  const totalBuiltIn = ALL_SCENARIOS.length
  const totalCustom  = customScenarios.length
  const sortedCustomScenarios = [...customScenarios]
    .filter(matchesQuery)
    .sort((a, b) => a.difficulty - b.difficulty)
  const noMatches = hasQuery && grouped.length === 0 && sortedCustomScenarios.length === 0

  // Every scenario shown anywhere on this screen — built-in categories plus
  // the player's own custom folder — so "random" really does mean any of them.
  const allSelectable = [...ALL_SCENARIOS, ...customScenarios]
  const pickRandomScenario = () => {
    const scenario = allSelectable[Math.floor(Math.random() * allSelectable.length)]
    onSelect(scenario)
    navigate('/roster')
  }

  return (
    <div className="min-h-screen bg-terminal-bg p-8 font-mono">
      <div className="max-w-3xl mx-auto">

        {/* Nav row */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/')}
            className="text-xs text-terminal-dim hover:text-terminal-green transition-colors"
          >
            ← Back
          </button>
          <button
            onClick={() => navigate('/campaigns')}
            className="text-xs px-3 py-1.5 rounded border border-terminal-border text-terminal-dim
              hover:border-terminal-green/50 hover:text-terminal-green transition-colors"
          >
            ◎ Campaign Builder
          </button>
        </div>

        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">SELECT SCENARIO</h1>
            <p className="text-sm text-terminal-dim">
              {totalBuiltIn} built-in scenarios across {grouped.length} categories
              {totalCustom > 0 ? ` · ${totalCustom} custom` : ''}.
            </p>
          </div>
          <button
            onClick={pickRandomScenario}
            title="Pick a random scenario from every category"
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded border border-terminal-green/40
              bg-terminal-green/10 text-terminal-green text-xs font-bold tracking-widest uppercase
              hover:bg-terminal-green/20 hover:border-terminal-green/70 transition-all duration-150"
          >
            <span className="text-base leading-none">🎲</span>
            Random Scenario
          </button>
        </div>

        {/* Technique search */}
        <div className="relative mb-8">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-terminal-dim text-xs">⌕</span>
          <input
            type="text"
            value={techniqueQuery}
            onChange={(e) => setTechniqueQuery(e.target.value)}
            placeholder="Search by MITRE ATT&CK technique — e.g. T1566 or Phishing"
            className="w-full pl-9 pr-9 py-2.5 rounded border border-terminal-border bg-terminal-surface
              text-sm text-white placeholder:text-terminal-dim focus:outline-none focus:border-terminal-green/50
              transition-colors"
          />
          {hasQuery && (
            <button
              onClick={() => setTechniqueQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-terminal-dim hover:text-white text-xs"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {noMatches && (
          <div className="mb-8 p-6 rounded border border-terminal-border bg-terminal-surface/30 text-center">
            <p className="text-sm text-terminal-dim">
              No scenarios reference a technique matching "{techniqueQuery}".
            </p>
          </div>
        )}

        {/* Category folders */}
        <div className="space-y-5">
          {grouped.map(({ cat, scenarios }) => (
            <ScenarioFolder
              key={cat.id}
              cat={cat}
              scenarios={scenarios}
              isOpen={hasQuery ? true : (openFolders[cat.id] ?? false)}
              onToggle={() => toggle(cat.id)}
              onSelect={(s) => { onSelect(s); navigate('/roster') }}
              techniqueQuery={hasQuery ? techniqueQuery : undefined}
            />
          ))}

          {sortedCustomScenarios.length > 0 && (
            <ScenarioFolder
              cat={CUSTOM_CATEGORY}
              scenarios={sortedCustomScenarios}
              isOpen={hasQuery ? true : (openFolders['custom'] ?? false)}
              onToggle={() => toggle('custom')}
              onSelect={(s) => { onSelect(s); navigate('/roster') }}
              isCustom
              techniqueQuery={hasQuery ? techniqueQuery : undefined}
              headerExtra={
                <button
                  onClick={(e) => { e.stopPropagation(); navigate('/campaigns') }}
                  className="text-[10px] text-terminal-green hover:underline"
                >
                  Manage →
                </button>
              }
            />
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 p-4 rounded border border-terminal-border bg-terminal-surface/30
          flex items-center justify-between gap-4">
          <p className="text-xs text-terminal-dim">
            Build your own scenarios or chain them into a campaign in the Campaign Builder.
          </p>
          <button
            onClick={() => navigate('/campaigns')}
            className="flex-shrink-0 px-3 py-1.5 rounded border border-terminal-green/30
              text-terminal-green text-xs hover:bg-terminal-green/10 transition-colors"
          >
            Open Builder →
          </button>
        </div>

      </div>
    </div>
  )
}

// ─── Folder ───────────────────────────────────────────────────────────────────

function ScenarioFolder({
  cat,
  scenarios,
  isOpen,
  onToggle,
  onSelect,
  isCustom,
  headerExtra,
  techniqueQuery,
}: {
  cat:          ScenarioCategoryDef
  scenarios:    ScenarioPack[]
  isOpen:       boolean
  onToggle:     () => void
  onSelect:     (s: ScenarioPack) => void
  isCustom?:    boolean
  headerExtra?: React.ReactNode
  techniqueQuery?: string
}) {
  return (
    <div>
      {/* Folder tab — sits above the body, left-aligned */}
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1.5
          border border-b-0 rounded-tl-md rounded-tr-md
          text-[10px] font-bold tracking-widest uppercase
          ${cat.textColor} ${cat.borderColor} ${cat.tabBg}`}
      >
        <span className="text-sm leading-none">{cat.glyph}</span>
        <span>{cat.label}</span>
      </div>

      {/* Folder body — top-left is square to meet the tab cleanly */}
      <div
        className={`border rounded-tr-lg rounded-b-lg overflow-hidden ${cat.borderColor}`}
        style={{ marginTop: '-1px' }}
      >
        {/* Clickable header */}
        <button
          onClick={onToggle}
          className={`w-full flex items-center justify-between px-4 py-3
            transition-opacity hover:opacity-80 ${cat.bgColor}`}
        >
          <div className="flex items-center gap-3">
            <span className={`text-xl leading-none ${cat.textColor}`}>{cat.glyph}</span>
            <span className="text-xs text-terminal-dim">{cat.description}</span>
          </div>
          <div className="flex items-center gap-3">
            {headerExtra}
            <span className={`text-[10px] font-bold ${cat.textColor}`}>
              {scenarios.length} scenario{scenarios.length !== 1 ? 's' : ''}
            </span>
            <span className="text-terminal-dim/60 text-[10px]">{isOpen ? '▲' : '▼'}</span>
          </div>
        </button>

        {/* Expandable card list */}
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              key="content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 pt-2 space-y-3 bg-terminal-bg/40">
                {scenarios.map((scenario) => (
                  <ScenarioCard
                    key={scenario.id}
                    scenario={scenario}
                    onSelect={() => onSelect(scenario)}
                    isCustom={isCustom}
                    accentColor={cat.textColor}
                    isTutorial={scenario.id === 'TUTORIAL-01'}
                    techniqueQuery={techniqueQuery}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function ScenarioCard({
  scenario,
  onSelect,
  isCustom,
  accentColor,
  isTutorial,
  techniqueQuery,
}: {
  scenario:     ScenarioPack
  onSelect:     () => void
  isCustom?:    boolean
  accentColor:  string
  isTutorial?:  boolean
  techniqueQuery?: string
}) {
  const matched = techniqueQuery ? matchingTechniques(scenario, techniqueQuery) : []
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded border p-4 transition-all duration-200 group ${
        isTutorial
          ? 'border-terminal-amber/40 bg-terminal-amber/5 hover:border-terminal-amber/70 hover:bg-terminal-amber/10'
          : 'border-terminal-border bg-terminal-surface hover:border-terminal-green/50 hover:bg-terminal-green/5'
      }`}
    >
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-[9px] text-terminal-dim tracking-widest font-mono">{scenario.id}</span>
            <span className={`text-[10px] font-bold ${DIFF_COLOR[scenario.difficulty]}`}>
              {DIFF_LABEL[scenario.difficulty]}
            </span>
            {isTutorial && (
              <span className="text-[9px] px-1.5 py-0.5 rounded border border-terminal-amber/40
                bg-terminal-amber/10 text-terminal-amber font-bold tracking-widest">
                START HERE
              </span>
            )}
            {isCustom && (
              <span className="text-[9px] px-1.5 py-0.5 rounded border border-terminal-amber/30
                text-terminal-amber bg-terminal-amber/5">
                CUSTOM
              </span>
            )}
          </div>
          <h2 className={`text-base font-bold text-white transition-colors ${
            isTutorial ? 'group-hover:text-terminal-amber' : `group-hover:${accentColor}`
          }`}>
            {scenario.title}
          </h2>
          <p className="text-[10px] text-terminal-dim mt-0.5">{scenario.threatType}</p>
        </div>
        <div className="text-right flex-shrink-0 text-[10px] text-terminal-dim space-y-0.5">
          <div>~{scenario.estimatedMinutes} min</div>
          <div>{scenario.recommendedPlayers} player{scenario.recommendedPlayers !== '1' ? 's' : ''}</div>
        </div>
      </div>

      <p className="text-xs text-gray-400 leading-relaxed mb-3">{scenario.summary}</p>

      <div className="flex flex-wrap gap-1.5">
        <span className="text-[9px] px-2 py-0.5 rounded bg-terminal-green/10 text-terminal-green/70
          border border-terminal-green/20">
          ✓ {scenario.victoryCondition}
        </span>
        <span className="text-[9px] px-2 py-0.5 rounded bg-terminal-red/10 text-terminal-red/70
          border border-terminal-red/20">
          ✗ {scenario.failureCondition}
        </span>
      </div>

      {matched.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-terminal-border/60">
          {matched.map((t) => (
            <span key={t.id} className="text-[9px] px-2 py-0.5 rounded bg-terminal-blue/10 text-terminal-blue
              border border-terminal-blue/20 font-mono">
              {t.id} · {t.name}
            </span>
          ))}
        </div>
      )}
    </button>
  )
}
