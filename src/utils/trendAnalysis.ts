import type { SessionRecord } from '../types/history'
import type { FeedEntry, OutcomeTier } from '../types/game'
import { extractActionTriples, mechanicalGrade } from './actionGrading'

export interface TrendPoint {
  sessionId:     string
  playedAt:      number
  scenarioTitle: string
  outcome:       'victory' | 'partial' | 'defeat'
  gpa:           number   // session-wide average grade across all graded rolls
  actionCount:   number
}

// Session-wide average GPA (not per-player) — averages every graded roll in
// a feed regardless of who made it, so a single number represents "how did
// the whole team perform." Takes a raw feed (not a SessionRecord) so it
// works both for live state (Hot Wash, mid-session or just-ended) and for
// persisted history (record.feed ?? []).
export function computeSessionGpa(feed: FeedEntry[]): number {
  if (feed.length === 0) return 0
  const triples = extractActionTriples(feed)
  const grades  = triples
    .filter((t) => t.roll?.outcome)
    .map((t) => mechanicalGrade(t.roll!.outcome as OutcomeTier))
  if (grades.length === 0) return 0
  return grades.reduce((sum, g) => sum + g.gpa, 0) / grades.length
}

// Chronological (oldest → newest) trend of session-wide GPA. `sessionHistory`
// from the store is newest-first, so this re-sorts. Sessions with no stored
// feed are skipped (nothing to grade) rather than plotted as a false zero.
export function computeGradeTrend(history: SessionRecord[]): TrendPoint[] {
  return [...history]
    .filter((r) => (r.feed ?? []).length > 0)
    .sort((a, b) => a.playedAt - b.playedAt)
    .map((r) => ({
      sessionId:     r.id,
      playedAt:      r.playedAt,
      scenarioTitle: r.scenarioTitle,
      outcome:       r.outcome,
      gpa:           computeSessionGpa(r.feed ?? []),
      actionCount:   extractActionTriples(r.feed ?? []).filter((t) => t.roll?.outcome).length,
    }))
}

// Average GPA across the most recent N graded sessions, excluding one session
// id (Hot Wash uses this to compare "this session" against everything
// before it, even if the current session is already in history by render time).
export function recentAverageGpa(history: SessionRecord[], excludeId?: string, windowSize = 5): number | null {
  const points = computeGradeTrend(excludeId ? history.filter((r) => r.id !== excludeId) : history)
  if (points.length === 0) return null
  const recent = points.slice(-windowSize)
  return recent.reduce((sum, p) => sum + p.gpa, 0) / recent.length
}
