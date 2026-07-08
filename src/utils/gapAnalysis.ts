import type { SessionRecord, GapFrequency } from '../types/history'
import type { LearningPriority } from '../types/game'

const PRIORITY_RANK: Record<LearningPriority, number> = {
  critical: 4,
  high:     3,
  medium:   2,
  low:      1,
}

export function aggregateGaps(history: SessionRecord[]): GapFrequency[] {
  const map = new Map<string, GapFrequency>()

  for (const record of history) {
    for (const item of record.learningPath) {
      const existing = map.get(item.area)
      if (existing) {
        existing.count++
        existing.lastSeen = Math.max(existing.lastSeen, record.playedAt)
        if (PRIORITY_RANK[item.priority] > PRIORITY_RANK[existing.priority]) {
          existing.priority       = item.priority
          existing.recommendation = item.recommendation
          existing.nistRef        = item.nistRef
        }
      } else {
        map.set(item.area, {
          area:           item.area,
          count:          1,
          priority:       item.priority,
          recommendation: item.recommendation,
          nistRef:        item.nistRef,
          lastSeen:       record.playedAt,
        })
      }
    }
  }

  return [...map.values()].sort(
    (a, b) => b.count - a.count || PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority],
  )
}

export function winRate(history: SessionRecord[]): number {
  if (history.length === 0) return 0
  return Math.round((history.filter((r) => r.outcome === 'victory').length / history.length) * 100)
}

export function totalXpEarned(history: SessionRecord[]): number {
  return history.reduce((sum, r) => sum + r.result.xpAwarded, 0)
}

export interface ScenarioCoverage {
  scenarioId:    string
  scenarioTitle: string
  difficulty:    number
  plays:         number
  bestOutcome:   'victory' | 'partial' | 'defeat'
  lastPlayed:    number
}

export function scenarioCoverage(history: SessionRecord[]): ScenarioCoverage[] {
  const map = new Map<string, ScenarioCoverage>()

  for (const r of history) {
    const existing = map.get(r.scenarioId)
    if (existing) {
      existing.plays++
      existing.lastPlayed = Math.max(existing.lastPlayed, r.playedAt)
      if (r.outcome === 'victory' || (r.outcome === 'partial' && existing.bestOutcome === 'defeat')) {
        existing.bestOutcome = r.outcome
      }
    } else {
      map.set(r.scenarioId, {
        scenarioId:    r.scenarioId,
        scenarioTitle: r.scenarioTitle,
        difficulty:    r.difficulty,
        plays:         1,
        bestOutcome:   r.outcome,
        lastPlayed:    r.playedAt,
      })
    }
  }

  return [...map.values()].sort((a, b) => b.lastPlayed - a.lastPlayed)
}
