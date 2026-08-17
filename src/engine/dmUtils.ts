import type { GameSession } from '../types/game'
import type { DMRequestPayload, DMResponse } from '../types/dm'
import { NPC_PROFILES, NPC_STANCE_DC_MOD } from '../types/npc'
import type { OrgState } from '../types/orgState'
import type { OrgProfile } from '../types/orgProfile'
import { isOrgProfileConfigured } from '../types/orgProfile'
import { parseLLMJson } from './llmJson'

export function buildPayload(
  session: GameSession,
  declaredAction: string,
  orgState?: OrgState,
  orgProfile?: OrgProfile | null,
): DMRequestPayload {
  const currentAct = session.scenario.acts.find((a) => a.number === session.act)
  return {
    phase:    session.phase,
    scenario: {
      id:                           session.scenario.id,
      title:                        session.scenario.title,
      act:                          session.act,
      round:                        session.round,
      scenarioClockRemainingMinutes: session.scenarioClockRemaining,
      attackerProgress:             session.attackerProgress,
      activeComplications:          session.activeComplications,
      victoryCondition:             session.scenario.victoryCondition,
      failureCondition:             session.scenario.failureCondition,
      actSeed:                      currentAct?.seed ?? '',
      bossEvent:                    currentAct?.bossEvent ?? null,
      estimatedMinutes:             session.scenario.estimatedMinutes,
      realElapsedMinutes:           Math.round((Date.now() - session.startedAt) / 60000),
    },
    players: session.players.map((p) => ({
      id:     p.id,
      name:   p.name,
      class:  p.class,
      stats:  p.stats as unknown as Record<string, number>,
      skills: p.skills,
      traits: p.traits as string[],
      level:  p.level,
    })),
    npcs: session.npcs.map((npc) => {
      const profile = NPC_PROFILES.find((p) => p.role === npc.role)!
      return {
        role:         npc.role,
        title:        profile.title,
        mode:         profile.mode,
        visibility:   profile.visibility,
        introduced:   npc.introduced,
        concern:      profile.concern,
        trust:        npc.trust,
        stance:       npc.stance,
        dcMod:        NPC_STANCE_DC_MOD[npc.stance],
        awareness:    npc.awareness,
        interactions: npc.interactions.length,
      }
    }),
    initiativeOrder:   session.initiativeOrder,
    currentTurn:       session.currentTurnPlayerId,
    lastRoll:          session.lastRoll,
    declaredAction,
    roundTimerExpired: session.roundTimerExpired,
    scriptedCriticalEffect: session.scriptedCriticalEffect,
    activeEffects: session.activeEffects.map((e) => ({
      description:     e.description,
      roundsRemaining: e.expiresRound - session.round + 1,
    })),
    orgContext: orgState && orgState.sessionsPlayed > 0
      ? {
          securityPosture:       orgState.securityPosture,
          sessionsPlayed:        orgState.sessionsPlayed,
          orgComplications:      orgState.orgComplications.map((c) => ({
            name:        c.name,
            severity:    c.severity,
            description: c.description,
          })),
          persistentCompromises: orgState.persistentCompromises.map((c) => ({
            asset:  c.asset,
            detail: c.detail,
          })),
          knownTTPs: orgState.identifiedTTPs.map((t) => ({
            techniqueId:   t.techniqueId,
            techniqueName: t.techniqueName,
            threatType:    t.threatType,
          })),
          npcReputation: orgState.npcReputation,
        }
      : null,
    orgProfile: orgProfile && isOrgProfileConfigured(orgProfile) ? orgProfile : null,
  }
}

export function parseDMResponse(raw: string): DMResponse {
  const parsed = parseLLMJson<Record<string, any>>(raw, 'DM response')

  const sc = parsed.stateChanges ?? parsed.state_changes ?? {}
  const mo = parsed.mechanicalOutcome ?? parsed.mechanical_outcome ?? null
  const inj = parsed.inject ?? null

  return {
    narration:         parsed.narration ?? '',
    mechanicalOutcome: mo ? {
      dcAssigned:      mo.dcAssigned      ?? mo.dc_assigned      ?? 0,
      modifierApplied: mo.modifierApplied ?? mo.modifier_applied ?? 0,
      effectiveRoll:   mo.effectiveRoll   ?? mo.effective_roll   ?? 0,
      outcomeTier:     mo.outcomeTier     ?? mo.outcome_tier     ?? 'success',
      rollSummary:     mo.rollSummary     ?? mo.roll_summary     ?? '',
    } : null,
    stateChanges: {
      attackerProgressAdded:     sc.attackerProgressAdded     ?? sc.attacker_progress_added     ?? [],
      complicationsAdded:        sc.complicationsAdded        ?? sc.complications_added         ?? [],
      complicationsRemoved:      sc.complicationsRemoved      ?? sc.complications_removed       ?? [],
      scenarioClockDeltaMinutes: sc.scenarioClockDeltaMinutes ?? sc.scenario_clock_delta_minutes ?? 0,
      actChange:                 sc.actChange                 ?? sc.act_change                  ?? null,
      npcUpdates:                sc.npcUpdates                ?? sc.npc_updates                 ?? [],
      sessionOutcome:            sc.sessionOutcome             ?? sc.session_outcome              ?? null,
    },
    inject: inj && typeof (inj.description ?? '') === 'string' && (inj.description || inj.mechanicalEffect || inj.mechanical_effect)
      ? {
          description:      inj.description      ?? '',
          mechanicalEffect: inj.mechanicalEffect  ?? inj.mechanical_effect ?? '',
        }
      : null,
    nextPrompt: parsed.nextPrompt ?? parsed.next_prompt ?? '',
    dcHint:     parsed.dcHint     ?? parsed.dc_hint     ?? null,
  }
}

export const HINT_SYSTEM_PROMPT = `
You are the Dungeon Master for DICE, a cybersecurity incident response training game.
The player has requested a hint. Provide 2-3 sentences of in-character guidance in second person, present tense.
Draw the player's attention to overlooked evidence or suggest a category of action — do NOT solve the problem outright.
Use real security tool names where relevant. Be evocative, not prescriptive.
Return ONLY the hint text. No JSON, no preamble, no labels.
`.trim()
