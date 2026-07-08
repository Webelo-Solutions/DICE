import type { GameSession, SessionResult } from '../types/game'
import type { OrgState, OrgComplication, PersistentCompromise, IdentifiedTTP, SessionLedgerEntry } from '../types/orgState'
import type { NPCRole } from '../types/npc'

const COMPLICATION_SEVERITY_MAP: Record<string, OrgComplication['severity']> = {
  // Severe — systemic / hard to recover from
  'ransomware':           'severe',
  'data_exfil':           'severe',
  'backup_corrupt':       'severe',
  'ad_compromise':        'severe',
  'supply_chain':         'severe',
  'executive_breach':     'severe',
  // Moderate — meaningful but bounded
  'executive_pressure':   'moderate',
  'tipped_off':           'moderate',
  'political_pressure':   'moderate',
  'communications_conflict': 'moderate',
  'edr_overload':         'moderate',
  'cloud_sync_active':    'moderate',
  'second_wire':          'moderate',
}

function complicationSeverity(name: string): OrgComplication['severity'] {
  const key = name.toLowerCase().replace(/[^a-z_]/g, '')
  return COMPLICATION_SEVERITY_MAP[key] ?? 'minor'
}

function orgImpactSentence(session: GameSession, result: SessionResult): string {
  const title = session.scenario.title
  const stage = result.finalAttackerStage?.replace(/_/g, ' ') ?? 'unknown stage'

  if (result.outcome === 'victory') {
    return `Team successfully contained the incident in "${title}" — threat actor was neutralized at ${stage}.`
  }
  if (result.outcome === 'partial') {
    return `Partial containment in "${title}" — attacker stalled at ${stage} but ${session.activeComplications.length} complications remain unresolved.`
  }
  return `Breach in "${title}" — attacker completed ${stage}; residual access and ${session.activeComplications.length} active complications were not contained.`
}

export function applySessionToOrg(
  orgState: OrgState,
  session:  GameSession,
  result:   SessionResult,
): OrgState {
  // ── 1. Posture delta ────────────────────────────────────────────────────────
  const postureChange =
    result.outcome === 'victory' ? +8  :
    result.outcome === 'partial' ? +3  : -12

  // Persistent compromise penalties reduce posture further
  const compromisePenalty = result.outcome === 'defeat' ? -5 : 0

  // ── 2. Unresolved complications → org complications ─────────────────────────
  const existingNames = new Set(orgState.orgComplications.map((c) => c.name))
  const newOrgComplications: OrgComplication[] = session.activeComplications
    .filter((name) => !existingNames.has(name))
    .map((name) => ({
      id:                  crypto.randomUUID(),
      name,
      description:         `Carried forward from "${session.scenario.title}" — unresolved at session end.`,
      severity:            complicationSeverity(name),
      sourceSessionId:     session.id,
      sourceScenarioTitle: session.scenario.title,
      addedAt:             Date.now(),
    }))

  // ── 3. Defeat terminal stage → persistent compromise ────────────────────────
  const newCompromises: PersistentCompromise[] = []
  if (result.outcome === 'defeat' && result.finalAttackerStage) {
    const asset = result.finalAttackerStage.replace(/_/g, ' ')
    newCompromises.push({
      id:            crypto.randomUUID(),
      asset,
      detail:        `Attacker completed "${asset}" during "${session.scenario.title}". Residual access is assumed active.`,
      sessionId:     session.id,
      scenarioTitle: session.scenario.title,
      addedAt:       Date.now(),
    })
  }

  // ── 4. Identified TTPs from scenario clues ──────────────────────────────────
  const knownTechniqueIds = new Set(orgState.identifiedTTPs.map((t) => t.techniqueId))
  const newTTPs: IdentifiedTTP[] = session.scenario.acts
    .flatMap((act) => act.clues)
    .filter((c) => c.techniqueId && !knownTechniqueIds.has(c.techniqueId!))
    .map((c) => ({
      techniqueId:   c.techniqueId!,
      techniqueName: c.techniqueName ?? '',
      threatType:    session.scenario.threatType,
      sessionId:     session.id,
    }))

  // ── 5. NPC reputation carry-forward (30% of session trust delta) ────────────
  const npcReputation = { ...orgState.npcReputation }
  session.npcs.forEach((npc) => {
    const totalDelta   = npc.interactions.reduce((sum, i) => sum + i.trustDelta, 0)
    const carry        = Math.round(totalDelta * 0.3)
    const role         = npc.role as NPCRole
    npcReputation[role] = Math.max(-25, Math.min(25, (npcReputation[role] ?? 0) + carry))
  })

  // ── 6. Session ledger entry ─────────────────────────────────────────────────
  const ledgerEntry: SessionLedgerEntry = {
    sessionId:     session.id,
    scenarioTitle: session.scenario.title,
    outcome:       result.outcome,
    postureChange: postureChange + compromisePenalty,
    timestamp:     Date.now(),
    impact:        orgImpactSentence(session, result),
  }

  return {
    securityPosture:       Math.max(10, Math.min(100, orgState.securityPosture + postureChange + compromisePenalty)),
    sessionsPlayed:        orgState.sessionsPlayed + 1,
    orgComplications:      [...orgState.orgComplications, ...newOrgComplications],
    persistentCompromises: [...orgState.persistentCompromises, ...newCompromises],
    identifiedTTPs:        [...orgState.identifiedTTPs, ...newTTPs],
    npcReputation,
    sessionLedger:         [...orgState.sessionLedger, ledgerEntry],
  }
}
