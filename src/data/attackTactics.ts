export interface AttackTactic {
  id:    string   // "TA0001"
  label: string   // "Initial Access"
}

export const TACTIC_MAP: Record<string, AttackTactic> = {
  reconnaissance:       { id: 'TA0043', label: 'Reconnaissance' },
  resource_development: { id: 'TA0042', label: 'Resource Development' },
  initial_access:       { id: 'TA0001', label: 'Initial Access' },
  execution:            { id: 'TA0002', label: 'Execution' },
  persistence:          { id: 'TA0003', label: 'Persistence' },
  privilege_escalation: { id: 'TA0004', label: 'Privilege Escalation' },
  defense_evasion:      { id: 'TA0005', label: 'Defense Evasion' },
  credential_access:    { id: 'TA0006', label: 'Credential Access' },
  discovery:            { id: 'TA0007', label: 'Discovery' },
  lateral_movement:     { id: 'TA0008', label: 'Lateral Movement' },
  collection:           { id: 'TA0009', label: 'Collection' },
  command_and_control:  { id: 'TA0011', label: 'Command & Control' },
  exfiltration:         { id: 'TA0010', label: 'Exfiltration' },
  impact:               { id: 'TA0040', label: 'Impact' },
}
