import type { FeedEntry, GameSession, SessionResult, LearningPathItem } from '../types/game'

// Kill chain stage → learning area mapping
const STAGE_GAPS: Record<string, { area: string; gap: string; recommendation: string; nistRef: string }> = {
  execution: {
    area:           'Malware Execution Detection',
    gap:            'Attacker achieved code execution before the team identified and contained the initial vector.',
    recommendation: 'Practice identifying LOLBins and fileless malware execution patterns. Review EDR alert triage for PowerShell and WMI abuse. Conduct tabletop exercises focused on initial-access detection workflows.',
    nistRef:        'NIST SP 800-61 §3.2.2 — Detection and Analysis',
  },
  persistence: {
    area:           'Persistence Mechanism Identification',
    gap:            'Attacker established persistence before the team completed scoping, increasing dwell time and recovery complexity.',
    recommendation: 'Train on registry run keys, scheduled task auditing, and WMI subscriptions. Implement automated hunts for common persistence indicators using Velociraptor or Osquery.',
    nistRef:        'NIST SP 800-61 §3.3 — Containment, Eradication, and Recovery',
  },
  privilege_escalation: {
    area:           'Privilege Escalation Detection',
    gap:            'Attacker elevated privileges, broadening their access and increasing the scope of potential impact.',
    recommendation: 'Review Kerberoasting and pass-the-hash detection use cases in your SIEM. Ensure alerting on LSASS access and abnormal service account authentication. Practice AD security assessment techniques.',
    nistRef:        'NIST SP 800-61 §3.2.4 — Incident Prioritization',
  },
  lateral_movement: {
    area:           'Lateral Movement Detection',
    gap:            'Attacker spread to additional hosts before the team identified the full blast radius.',
    recommendation: 'Develop and validate detection rules for SMB lateral movement, PsExec, and WMI remote execution. Practice network segmentation and east-west traffic analysis. Conduct host isolation drills.',
    nistRef:        'NIST SP 800-61 §3.2 — Detection and Analysis; NIST SP 800-83 §5',
  },
  collection: {
    area:           'Data Staging and Collection Detection',
    gap:            'Attacker staged sensitive data for exfiltration before containment was achieved.',
    recommendation: 'Implement DLP monitoring on staging directories and archive file creation. Train on identifying abnormal file access patterns and large directory enumeration events in endpoint logs.',
    nistRef:        'NIST SP 800-61 §3.2.7 — Documentation',
  },
  exfiltration: {
    area:           'Exfiltration Prevention and Detection',
    gap:            'Data exfiltration was initiated, triggering potential breach notification obligations.',
    recommendation: 'Review outbound traffic baselines and establish anomaly alerting for large transfers over standard ports. Practice DNS exfiltration and HTTPS tunneling detection. Validate firewall egress controls.',
    nistRef:        'NIST SP 800-61 §3.4 — Post-Incident Activity; GDPR Art. 33 / HIPAA §164.412',
  },
  impact: {
    area:           'Ransomware Prevention and Recovery Readiness',
    gap:            'Attacker successfully deployed the ransomware payload. Recovery procedures and backup integrity must be validated.',
    recommendation: 'Conduct backup restoration drills. Validate offline backup integrity and RTO/RPO targets. Review endpoint protection configurations. Establish and test a business continuity playbook for ransomware scenarios.',
    nistRef:        'NIST SP 800-61 §3.5 — Lessons Learned; NIST SP 800-34 Rev.1',
  },
}

const HINT_GAP: LearningPathItem = {
  area:           'Domain Knowledge and Procedural Confidence',
  gapIdentified:  'Team requested decision-support hints during the exercise, indicating gaps in procedural confidence or technical knowledge.',
  recommendation: 'Review incident response playbooks for the relevant threat type. Consider structured knowledge-building through SANS FOR508 or equivalent IR training. Practice scenario run-throughs with documented playbooks before operating under time pressure.',
  nistRef:        'NIST SP 800-61 §2.4 — Incident Response Team Structure and Staffing',
  priority:       'medium',
}

const TIMER_GAP: LearningPathItem = {
  area:           'Decision Speed and Triage Efficiency',
  gapIdentified:  'Round timers expired during the exercise, indicating that triage and decision-making exceeded target response windows.',
  recommendation: 'Practice rapid log triage and IOC pivoting drills. Use structured decision frameworks (e.g., IR playbooks, decision trees) to reduce cognitive load under pressure. Consider tabletop exercises with progressively reduced timers.',
  nistRef:        'NIST SP 800-61 §3.2.1 — Precursors and Indicators',
  priority:       'high',
}

const CRIT_FAIL_GAP: LearningPathItem = {
  area:           'Technical Execution Under Pressure',
  gapIdentified:  'Critical failures occurred during the exercise. Actions that backfired or caused collateral damage indicate execution gaps under incident conditions.',
  recommendation: 'Review the session timeline to identify which actions produced critical failures. Build targeted runbooks for those specific scenarios. Practice containment actions in isolated lab environments before exercising under simulated pressure.',
  nistRef:        'NIST SP 800-61 §3.3.4 — Eradication',
  priority:       'high',
}

const STRONG_PERFORMANCE: LearningPathItem = {
  area:           'Advanced Threat Scenarios',
  gapIdentified:  'Team demonstrated strong performance. Ready for increased complexity.',
  recommendation: 'Progress to higher-difficulty scenario packs. Consider APT-01 (nation-state, living-off-the-land) or INSIDER-01 (privileged insider, low-noise exfiltration). Introduce multi-vector or concurrent incident scenarios.',
  nistRef:        'NIST SP 800-61 §2.1 — Events and Incidents',
  priority:       'low',
}

export function generateLearningPath(
  _feed:   FeedEntry[],
  session: GameSession,
  result:  SessionResult,
): LearningPathItem[] {
  const items: LearningPathItem[] = []
  const allStages       = session.scenario.killChainStages
  const stoppedAtIndex  = allStages.indexOf(result.finalAttackerStage)

  // Map each attacker stage reached (beyond initial_access) to a learning item
  for (let i = 1; i <= stoppedAtIndex; i++) {
    const stage = allStages[i]
    const def   = STAGE_GAPS[stage]
    if (!def) continue
    const isLate = i >= allStages.length - 2
    items.push({
      area:          def.area,
      gapIdentified: def.gap,
      recommendation: def.recommendation,
      nistRef:       def.nistRef,
      priority:      isLate ? 'critical' : i >= 3 ? 'high' : 'medium',
    })
  }

  // Timer expiry penalty
  if (result.timerExpiries >= 2) items.push(TIMER_GAP)

  // Hint usage
  if (result.hintsUsed >= 2) items.push(HINT_GAP)

  // Critical fails
  if (result.criticalFails >= 2) items.push(CRIT_FAIL_GAP)

  // Strong performance — recommend harder content
  if (result.outcome === 'victory' && result.criticalFails === 0 && items.length === 0) {
    items.push(STRONG_PERFORMANCE)
  }

  // Deduplicate by area
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.area)) return false
    seen.add(item.area)
    return true
  })
}

export function formatDuration(startMs: number, endMs: number): string {
  const totalSecs = Math.floor((endMs - startMs) / 1000)
  const hours     = Math.floor(totalSecs / 3600)
  const mins      = Math.floor((totalSecs % 3600) / 60)
  const secs      = totalSecs % 60
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`
  if (mins > 0)  return `${mins}m ${secs}s`
  return `${secs}s`
}

export function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString('en-US', {
    year:   'numeric', month:  'long', day:    'numeric',
    hour:   '2-digit', minute: '2-digit', second: '2-digit',
    hour12: true,
  })
}
