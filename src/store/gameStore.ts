import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Character, GameSession, FeedEntry, ScenarioPack, SessionResult, TimerDifficulty, TraitName } from '../types/game'
import type { DMResponse } from '../types/dm'
import { applyLevelUp } from '../utils/leveling'
import { computeXpAwards } from '../utils/xp'
import type { LevelUpChoice } from '../utils/leveling'
import type { CommConfig } from '../engine/webhookClient'
import type { SessionRecord } from '../types/history'
import type { ProviderConfig } from '../types/provider'
import type { AdversaryState, AdversaryClass } from '../types/adversary'
import type { NPCState } from '../types/npc'
import { initialNPCState, trustToStance } from '../types/npc'
import type { OrgState } from '../types/orgState'
import { INITIAL_ORG_STATE } from '../types/orgState'
import { applySessionToOrg } from '../utils/orgStateEngine'
import type { OrgProfile } from '../types/orgProfile'
import { useInjectsCatalogStore } from './injectsCatalogStore'
import type { CriticalInjectEntry, CriticalInjectCatalogEntry } from '../types/game'

interface GameStore {
  roster:       Character[]
  // Characters imported from content packs. Read-only here (managed by pack
  // install/uninstall); the user copies one into the roster to actually play it.
  library:      Character[]
  addCharacter:         (c: Character) => void
  removeCharacter:      (id: string) => void
  updateCharacter:      (id: string, updates: Partial<Character>) => void
  updateSessionPlayer:  (id: string, updates: Partial<Character>) => void
  clearRoster:          () => void

  session:      GameSession | null
  feed:         FeedEntry[]
  isDMThinking: boolean
  result:       SessionResult | null

  initSession:  (scenario: ScenarioPack, players: Character[], mode: 'solo' | 'team' | 'adversary', timerDifficulty: TimerDifficulty, adversaryPlayerId?: string, adversaryClass?: AdversaryClass) => void

  pendingAction:  string
  setAction:      (action: string) => void

  applyDMResponse:   (response: DMResponse) => void
  appendFeed:        (entry: FeedEntry) => void
  applyAdversaryRoll: (evaded: boolean, stageAdvanced: string | null, stealthDelta: number, complicationsAdded: string[]) => void

  markRoundTimerExpired: () => void
  advanceTurn:      () => void
  // Records that a player has spent a once-per-session trait (Composure,
  // Rally, Second Wind) this session, so it can't be used again.
  markTraitUsed:    (playerId: string, trait: TraitName) => void

  endSession:  (result: SessionResult) => void
  levelUpCharacter: (characterId: string, newLevel: number, choice: LevelUpChoice) => void
  resetAll:    () => void

  // Fires on a player skill-check natural 20 / natural 1 — draws a random
  // (no-repeat-until-exhausted) entry from the scenario's critical-inject
  // table, applies its mechanical effect, and appends it to the feed. No-op
  // when the scenario has no such table configured (backward compatible).
  resolveCriticalInject: (tier: 'critical_hit' | 'critical_fail') => void

  // Facilitator controls
  facilitatorAdjustClock:       (deltaMins: number) => void
  facilitatorSetAttackerStage:  (stage: string) => void
  facilitatorAddComplication:   (name: string) => void
  facilitatorRemoveComplication:(name: string) => void
  facilitatorNote:              (text: string) => void
  facilitatorGenerateHotWash:   () => void

  providerConfig:    ProviderConfig | null
  setProviderConfig: (cfg: ProviderConfig | null) => void

  commConfig:    CommConfig | null
  setCommConfig: (cfg: CommConfig | null) => void

  sessionHistory:  SessionRecord[]
  recordSession:   (record: SessionRecord) => void
  clearHistory:    () => void

  orgState:            OrgState
  applySessionToOrg:   (session: GameSession, result: SessionResult) => void
  resetOrgState:       () => void

  activeOrgProfile:    OrgProfile | null  // set when a campaign launches; null for ad-hoc scenarios
  setActiveOrgProfile: (profile: OrgProfile | null) => void

  // Set when a campaign launches its current scenario; null for ad-hoc play.
  // Survives initSession's fresh-session rebuild (mirrors activeOrgProfile) so
  // SessionEnd can report the outcome back to the right campaign/scenario slot.
  activeCampaignContext:    { campaignId: string; scenarioIndex: number } | null
  setActiveCampaignContext: (ctx: { campaignId: string; scenarioIndex: number } | null) => void
}

function nextPlayerId(order: string[], current: string): string {
  const idx = order.indexOf(current)
  return order[(idx + 1) % order.length]
}

// Resolves a scenario's criticalHitInjectIds/criticalFailInjectIds against the
// (already-fetched, see src/store/injectsCatalogStore.ts) global catalog. Ids
// that don't resolve — catalog not yet loaded, entry deleted, wrong kind —
// are silently dropped rather than erroring, same graceful-degradation
// philosophy as an empty/undefined table.
function resolveCatalogInjects(ids: string[] | undefined, kind: CriticalInjectCatalogEntry['kind']): CriticalInjectEntry[] {
  const catalog = useInjectsCatalogStore.getState().entries
  return (ids ?? [])
    .map((id) => catalog.find((e) => e.id === id && e.kind === kind))
    .filter((e): e is CriticalInjectCatalogEntry => !!e)
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      roster:         [],
      library:        [],
      session:        null,
      feed:           [],
      isDMThinking:   false,
      result:         null,
      pendingAction:  '',
      providerConfig: null,
      commConfig:     null,
      sessionHistory: [],
      orgState:       INITIAL_ORG_STATE,
      activeOrgProfile: null,
      activeCampaignContext: null,

      addCharacter:    (c) => set((s) => ({ roster: [...s.roster, c] })),
      removeCharacter: (id) => set((s) => ({ roster: s.roster.filter((c) => c.id !== id) })),
      updateCharacter: (id, updates) => set((s) => ({
        roster: s.roster.map((c) => c.id === id ? { ...c, ...updates } : c),
      })),
      updateSessionPlayer: (id, updates) => set((s) => ({
        roster: s.roster.map((c) => c.id === id ? { ...c, ...updates } : c),
        session: s.session
          ? { ...s.session, players: s.session.players.map((p) => p.id === id ? { ...p, ...updates } : p) }
          : null,
      })),
      clearRoster:     () => set({ roster: [] }),

      setAction: (action) => set({ pendingAction: action }),

      setProviderConfig: (cfg) => set({ providerConfig: cfg }),
      setCommConfig: (cfg) => set({ commConfig: cfg }),

      recordSession: (record) =>
        set((s) => ({
          sessionHistory: [record, ...s.sessionHistory.filter((r) => r.id !== record.id)],
        })),
      clearHistory: () => set({ sessionHistory: [] }),

      initSession: (scenario, players, mode, timerDifficulty, adversaryPlayerId, adversaryClass) => {
        // In adversary mode, exclude the adversary from the defender initiative order
        const defenders = mode === 'adversary' && adversaryPlayerId
          ? players.filter((p) => p.id !== adversaryPlayerId)
          : players

        const initiativeOrder = [...defenders]
          .sort((a, b) => {
            const modA = a.stats.agility + (a.traits.includes('First Responder') ? 3 : 0)
            const modB = b.stats.agility + (b.traits.includes('First Responder') ? 3 : 0)
            const rollA = Math.floor(Math.random() * 20) + 1 + modA
            const rollB = Math.floor(Math.random() * 20) + 1 + modB
            return rollB - rollA
          })
          .map((p) => p.id)

        const adversary: AdversaryState | undefined =
          mode === 'adversary' && adversaryPlayerId && adversaryClass
            ? {
                playerId:            adversaryPlayerId,
                adversaryClass,
                objectivesCompleted: [],
                stealthScore:        100,
                rollHistory:         [],
                firstActionThisAct:  true,
              }
            : undefined

        // NPCs are opt-in per scenario (hidden by default). Build only the cast
        // the scenario declares; carry forward each one's org-level reputation.
        const { npcReputation } = get().orgState
        const npcs: NPCState[] = (scenario.npcRoles ?? [])
          .map((role) => {
            const base  = initialNPCState(role)
            const carry = npcReputation[role] ?? 0
            const trust = Math.max(20, Math.min(80, base.trust + carry))
            return { ...base, trust, stance: trustToStance(trust) }
          })

        const session: GameSession = {
          id:                     crypto.randomUUID(),
          scenario,
          players,
          mode,
          initiativeOrder,
          currentTurnPlayerId:    initiativeOrder[0],
          act:                    1,
          round:                  1,
          scenarioClockRemaining: scenario.scenarioClockStart,
          attackerProgress:       [scenario.killChainStages[0]],
          activeComplications:    [],
          lastRoll:               null,
          roundTimerExpired:      false,
          activeEffects:          [],
          scriptedCriticalEffect: null,
          critHitInjectsDrawn:    [],
          critFailInjectsDrawn:   [],
          resolvedCriticalHitInjects:  resolveCatalogInjects(scenario.criticalHitInjectIds, 'critical_hit'),
          resolvedCriticalFailInjects: resolveCatalogInjects(scenario.criticalFailInjectIds, 'critical_fail'),
          phase:                  'init',
          status:                 'active',
          timerDifficulty,
          startedAt:              Date.now(),
          adversary,
          npcs,
          usedOnceTraits: {},
        }
        set({ session, feed: [], result: null, isDMThinking: true })
      },

      appendFeed: (entry) => set((s) => ({ feed: [...s.feed, entry] })),

      applyAdversaryRoll: (_evaded, stageAdvanced, stealthDelta, complicationsAdded) =>
        set((s) => {
          if (!s.session?.adversary) return {}
          const adv = s.session.adversary

          const newStealth = Math.max(0, Math.min(100, adv.stealthScore + stealthDelta))
          const newProgress = stageAdvanced
            ? [...s.session.attackerProgress, stageAdvanced]
            : s.session.attackerProgress
          const newComplications = [
            ...s.session.activeComplications,
            ...complicationsAdded,
          ]

          const failStage = s.session.scenario.killChainStages[s.session.scenario.killChainStages.length - 1]
          const status    = newProgress.includes(failStage) ? 'defeat' : s.session.status

          return {
            session: {
              ...s.session,
              attackerProgress:    newProgress,
              activeComplications: newComplications,
              status,
              adversary: {
                ...adv,
                stealthScore:       newStealth,
                firstActionThisAct: false,
                objectivesCompleted: stageAdvanced
                  ? [...adv.objectivesCompleted, stageAdvanced]
                  : adv.objectivesCompleted,
              },
            },
          }
        }),

      resolveCriticalInject: (tier) => {
        const s = get().session
        if (!s) return

        const table = tier === 'critical_hit' ? s.resolvedCriticalHitInjects : s.resolvedCriticalFailInjects
        if (!table || table.length === 0) return

        const drawnKey  = tier === 'critical_hit' ? 'critHitInjectsDrawn' : 'critFailInjectsDrawn'
        const drawnIds  = s[drawnKey]
        // Draw without replacement; reshuffle (treat as a fresh deck) once exhausted.
        let pool      = table.filter((e) => !drawnIds.includes(e.id))
        let baseDrawn = drawnIds
        if (pool.length === 0) {
          pool      = table
          baseDrawn = []
        }
        const entry     = pool[Math.floor(Math.random() * pool.length)]
        const newDrawn  = [...baseDrawn, entry.id]

        let attackerProgress = s.attackerProgress
        let status            = s.status
        if (entry.advanceKillChainStage) {
          const stages = s.scenario.killChainStages
          const curIdx = stages.indexOf(attackerProgress[attackerProgress.length - 1])
          if (curIdx !== -1 && curIdx + 1 < stages.length) {
            attackerProgress = [...attackerProgress, stages[curIdx + 1]]
            const failStage = stages[stages.length - 1]
            status = attackerProgress.includes(failStage) ? 'defeat' : status
          }
        }

        // Same dedupe-then-merge pattern as applyDMResponse, to preserve the
        // monotone-state invariant (no reappearing "contained" complications).
        const removedSet         = new Set(entry.complicationsRemoved ?? [])
        const addedComplications = (entry.complicationsAdded ?? []).filter((c) => !removedSet.has(c))
        const activeComplications = Array.from(new Set([
          ...s.activeComplications.filter((c) => !removedSet.has(c)),
          ...addedComplications,
        ]))

        let npcs = s.npcs
        if (entry.npcEffect) {
          const eff = entry.npcEffect
          npcs = s.npcs.map((npc) => {
            if (npc.role !== eff.role) return npc
            const newTrust = Math.max(0, Math.min(100, npc.trust + eff.trustDelta))
            return {
              ...npc,
              trust:      newTrust,
              stance:     trustToStance(newTrust),
              // Unlike applyDMResponse's npcUpdates (which always reveals the
              // NPC), only force introduction when the author explicitly asked.
              introduced: eff.forceIntroduced ? true : npc.introduced,
              awareness:  eff.awarenessAdded && eff.awarenessAdded.length > 0
                ? [...npc.awareness, ...eff.awarenessAdded]
                : npc.awareness,
              interactions: [...npc.interactions, {
                round:      s.round,
                act:        s.act,
                summary:    entry.description,
                trustDelta: eff.trustDelta,
              }],
              lastActiveRound: s.round,
            }
          })
        }

        const activeEffects = entry.temporaryEffect
          ? [...s.activeEffects, {
              id:           crypto.randomUUID(),
              description:  entry.temporaryEffect.description,
              expiresRound: s.round + entry.temporaryEffect.durationRounds,
            }]
          : s.activeEffects

        set({
          session: {
            ...s,
            attackerProgress,
            activeComplications,
            status,
            npcs,
            activeEffects,
            scriptedCriticalEffect: entry.description,
            [drawnKey]: newDrawn,
          },
        })

        get().appendFeed({
          id:        crypto.randomUUID(),
          type:      'inject',
          speaker:   tier === 'critical_hit' ? '! INJECT [CRITICAL HIT]' : '! INJECT [CRITICAL FAIL]',
          text:      entry.description,
          timestamp: Date.now(),
        })
      },

      applyDMResponse: (response) => {
        const s = get().session
        if (!s) return

        const sc = response.stateChanges

        // State is MONOTONE: dedupe additions and never re-add what was just
        // removed. The DM occasionally re-emits a complication or kill-chain
        // stage that is already active / resolved; without these guards the
        // arrays accumulate duplicates and "contained" threats reappear, which
        // makes sessions feel like they're spinning in place. The DM prompt
        // also instructs the DM not to do this, but the engine enforces it.
        const removedSet = new Set(sc.complicationsRemoved)
        const addedComplications = sc.complicationsAdded.filter((c) => !removedSet.has(c))
        const newComplications = Array.from(new Set([
          ...s.activeComplications.filter((c) => !removedSet.has(c)),
          ...addedComplications,
        ]))
        const newProgress = Array.from(new Set([...s.attackerProgress, ...sc.attackerProgressAdded]))
        const newClock = Math.max(0, s.scenarioClockRemaining + sc.scenarioClockDeltaMinutes)
        const newAct   = sc.actChange ?? s.act

        // Resolution priority: a completed kill chain is an absolute mechanical
        // defeat (overrides anything the DM says); otherwise trust the DM's own
        // sessionOutcome call (new — see dmPrompt.ts SESSION RESOLUTION); otherwise
        // stay as-is. Kill-chain check stays as a safety net even now that the DM
        // can self-report defeat, in case it misses the mechanical trigger.
        const failStage = s.scenario.killChainStages[s.scenario.killChainStages.length - 1]
        const narrativeStatus = newProgress.includes(failStage) ? 'defeat' : (sc.sessionOutcome ?? s.status)

        // Hard backstop, independent of the DM: if a session has run well past
        // its advertised estimatedMinutes in real wall-clock time and still
        // hasn't concluded on its own, force it to a close rather than let it
        // run indefinitely. 'timeout' reads as a 'partial' result, not a loss —
        // see GameSession.tsx's end-condition watcher.
        const HARD_TIMEOUT_MULTIPLIER = 2
        const elapsedMinutes = (Date.now() - s.startedAt) / 60000
        const status = narrativeStatus === 'active' && elapsedMinutes >= s.scenario.estimatedMinutes * HARD_TIMEOUT_MULTIPLIER
          ? 'timeout'
          : narrativeStatus

        // Reset insider_threat firstActionThisAct on act transition
        const adversary = s.adversary && sc.actChange !== null
          ? { ...s.adversary, firstActionThisAct: true }
          : s.adversary

        // Trusted Voice: the acting player's rapport-building lands harder —
        // amplifies trust GAINED from a positive interaction. Scoped to the
        // current turn player only (whoever's action prompted this update),
        // not the critical-inject catalog path, which is chance, not roleplay.
        const actingPlayer = s.players.find((p) => p.id === s.currentTurnPlayerId)
        const hasTrustedVoice = actingPlayer?.traits.includes('Trusted Voice') ?? false

        const newNpcs = sc.npcUpdates.length > 0
          ? s.npcs.map((npc) => {
              const update = sc.npcUpdates.find((u) => u.role === npc.role)
              if (!update) return npc
              const trustDelta = hasTrustedVoice && update.trustDelta > 0
                ? Math.round(update.trustDelta * 1.5)
                : update.trustDelta
              const newTrust = Math.max(0, Math.min(100, npc.trust + trustDelta))
              const newStance = update.stance ?? trustToStance(newTrust)
              return {
                ...npc,
                trust:        newTrust,
                stance:       newStance,
                introduced:   true,  // any DM update reveals an emergent NPC to the team
                awareness:    update.awarenessAdded.length > 0
                  ? [...npc.awareness, ...update.awarenessAdded]
                  : npc.awareness,
                interactions: update.summary
                  ? [...npc.interactions, {
                      round:      s.round,
                      act:        s.act,
                      summary:    update.summary,
                      trustDelta,
                    }]
                  : npc.interactions,
                lastActiveRound: update.summary ? s.round : npc.lastActiveRound,
              }
            })
          : s.npcs

        set({
          session: {
            ...s,
            attackerProgress:       newProgress,
            activeComplications:    newComplications,
            scenarioClockRemaining: newClock,
            act:                    newAct,
            phase:                  'turn',
            roundTimerExpired:      false,
            scriptedCriticalEffect: null,
            status,
            adversary,
            npcs:                   newNpcs,
          },
          isDMThinking:  false,
          pendingAction: '',
        })

        // Trusted Voice fired if it actually amplified a positive trust
        // change above — logged after the fact since we only know that for
        // certain once we've checked every npcUpdate's original delta.
        if (hasTrustedVoice && actingPlayer && sc.npcUpdates.some((u) => u.trustDelta > 0)) {
          get().appendFeed({
            id:        crypto.randomUUID(),
            type:      'system',
            speaker:   'TRUSTED VOICE',
            text:      `${actingPlayer.name} uses Trusted Voice — trust gained from this interaction is amplified.`,
            timestamp: Date.now(),
            player:    actingPlayer.id,
          })
        }
      },

      markRoundTimerExpired: () =>
        set((s) => ({
          session: s.session ? { ...s.session, roundTimerExpired: true } : null,
        })),

      markTraitUsed: (playerId, trait) =>
        set((s) => {
          if (!s.session) return {}
          const used = s.session.usedOnceTraits ?? {}
          const forPlayer = used[playerId] ?? []
          if (forPlayer.includes(trait)) return {}
          return {
            session: {
              ...s.session,
              usedOnceTraits: { ...used, [playerId]: [...forPlayer, trait] },
            },
          }
        }),

      // Advance to the next player — does NOT set isDMThinking.
      // The DM only speaks in response to a player action, not on turn advance.
      advanceTurn: () =>
        set((s) => {
          if (!s.session) return {}
          const nextId   = nextPlayerId(s.session.initiativeOrder, s.session.currentTurnPlayerId)
          const newRound = nextId === s.session.initiativeOrder[0]
            ? s.session.round + 1
            : s.session.round
          return {
            session: {
              ...s.session,
              currentTurnPlayerId: nextId,
              round:               newRound,
              activeEffects:       s.session.activeEffects.filter((e) => e.expiresRound >= newRound),
            },
          }
        }),

      levelUpCharacter: (characterId, newLevel, choice) =>
        set((s) => {
          const character = s.roster.find((c) => c.id === characterId)
          if (!character) return {}
          const updates = applyLevelUp(character, newLevel, choice)
          return {
            roster: s.roster.map((c) =>
              c.id === characterId ? { ...c, ...updates, pendingLevelUp: null } : c
            ),
          }
        }),

      endSession: (result) =>
        set((s) => {
          if (!s.session) return { result }
          const playerIds = new Set(s.session.players.map((p) => p.id))
          return {
            result,
            roster: s.roster.map((c) =>
              playerIds.has(c.id) ? { ...c, xp: c.xp + (result.xpByPlayer[c.id] ?? 0) } : c
            ),
            // session.status is already terminal ('victory' | 'defeat' | 'timeout')
            // by the time endSession runs — it's what triggered the call. Don't
            // re-derive it here; a two-way outcome->status ternary can't represent
            // 'partial' (timeout) without collapsing it into 'victory'.
          }
        }),

      facilitatorAdjustClock: (deltaMins) =>
        set((s) => ({
          session: s.session
            ? { ...s.session, scenarioClockRemaining: Math.max(0, s.session.scenarioClockRemaining + deltaMins) }
            : null,
        })),

      facilitatorSetAttackerStage: (stage) =>
        set((s) => {
          if (!s.session) return {}
          const stages   = s.session.scenario.killChainStages
          const idx      = stages.indexOf(stage)
          if (idx === -1) return {}
          const progress = stages.slice(0, idx + 1)
          const failStage = stages[stages.length - 1]
          const status    = progress.includes(failStage) ? 'defeat' : s.session.status
          return { session: { ...s.session, attackerProgress: progress, status } }
        }),

      facilitatorAddComplication: (name) =>
        set((s) => ({
          session: s.session
            ? { ...s.session, activeComplications: [...s.session.activeComplications, name] }
            : null,
        })),

      facilitatorRemoveComplication: (name) =>
        set((s) => ({
          session: s.session
            ? { ...s.session, activeComplications: s.session.activeComplications.filter((c) => c !== name) }
            : null,
        })),

      facilitatorNote: (text) =>
        set((s) => ({
          feed: [...s.feed, {
            id:        crypto.randomUUID(),
            type:      'system' as const,
            speaker:   'FACILITATOR',
            text,
            timestamp: Date.now(),
          }],
        })),

      facilitatorGenerateHotWash: () => {
        const { session, feed, roster } = get()
        if (!session) return
        const hintsUsed     = feed.filter((e) => e.type === 'hint').length
        const timerExpiries = feed.filter((e) => e.type === 'system' && e.speaker === 'TIMER').length
        const critHits      = feed.filter((e) => e.outcome === 'critical_hit').length
        const critFails     = feed.filter((e) => e.outcome === 'critical_fail').length
        const { perPlayer: xpByPlayer, total: xpAwarded } = computeXpAwards(session.players, feed, 'partial')
        const playerIds     = new Set(session.players.map((p) => p.id))
        set({
          result: {
            outcome:            'partial',
            xpAwarded,
            xpByPlayer,
            criticalHits:       critHits,
            criticalFails:      critFails,
            injectsSurvived:    feed.filter((e) => e.type === 'inject').length,
            criticalInjectsFired: feed.filter((e) => e.type === 'inject' &&
              (e.speaker === '! INJECT [CRITICAL HIT]' || e.speaker === '! INJECT [CRITICAL FAIL]')).length,
            clockRemaining:     session.scenarioClockRemaining,
            roundsPlayed:       session.round,
            startedAt:          session.startedAt,
            endedAt:            Date.now(),
            actsCompleted:      session.act,
            finalAttackerStage: session.attackerProgress[session.attackerProgress.length - 1],
            hintsUsed,
            timerExpiries,
            adversaryStealthScore: session.adversary?.stealthScore,
            adversaryObjectives:   session.adversary?.objectivesCompleted.length,
            adversaryRoundsActive: session.adversary?.rollHistory.length,
          },
          roster: roster.map((c) =>
            playerIds.has(c.id) ? { ...c, xp: c.xp + (xpByPlayer[c.id] ?? 0) } : c
          ),
        })
      },

      applySessionToOrg: (session, result) =>
        set((s) => ({ orgState: applySessionToOrg(s.orgState, session, result) })),

      resetOrgState: () => set({ orgState: INITIAL_ORG_STATE }),

      setActiveOrgProfile: (profile) => set({ activeOrgProfile: profile }),
      setActiveCampaignContext: (ctx) => set({ activeCampaignContext: ctx }),

      resetAll: () => set({
        session:          null,
        feed:             [],
        result:           null,
        pendingAction:    '',
        isDMThinking:     false,
        activeOrgProfile: null,
        activeCampaignContext: null,
        // roster and providerConfig are intentionally preserved
      }),
    }),
    {
      name: 'dice-game-store',
      // Only secrets/connection config stay in localStorage (client-side) — API
      // keys must never go to the shared server DB. All game data is persisted
      // through the API (see src/api/sync.ts).
      partialize: (state) => ({
        providerConfig: state.providerConfig,
        commConfig:     state.commConfig,
      }),
      // Migrate users who had apiKey stored before multi-provider support
      onRehydrateStorage: () => (state) => {
        const legacy = state as unknown as Record<string, unknown>
        if (state && !state.providerConfig && typeof legacy['apiKey'] === 'string' && legacy['apiKey']) {
          state.providerConfig = {
            provider: 'anthropic',
            apiKey:   legacy['apiKey'] as string,
            model:    'claude-sonnet-5',
          }
        }
      },
    },
  ),
)
