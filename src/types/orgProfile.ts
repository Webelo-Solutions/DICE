// Organizational tech-stack profile.
// Names the tools the team actually uses so scenarios and DM narration
// stay inside the group's operational purview — no Splunk references
// when the SIEM is Sentinel.
//
// Field values are freeform strings. Empty string means "not specified"
// and the DM prompt should narrate that category as a manual workaround
// or a known gap rather than invent a brand name.

export interface OrgProfile {
  // ─── Detection & Response ───────────────────────────────────────────
  siem:           string   // e.g. "Microsoft Sentinel", "Splunk", "Elastic"
  edr:            string   // e.g. "Defender for Endpoint", "CrowdStrike Falcon"
  soar:           string   // e.g. "Tines", "XSOAR", "Splunk SOAR" — blank if none
  threatIntel:    string   // e.g. "Recorded Future", "Mandiant", "MISP" — blank if none

  // ─── Identity & Access ──────────────────────────────────────────────
  identity:       string   // e.g. "Entra ID + AD", "Okta", "Google Workspace"
  mfa:            string   // e.g. "Duo", "Microsoft Authenticator", "YubiKey"

  // ─── Network & Perimeter ────────────────────────────────────────────
  network:        string   // edge/NGFW vendor — e.g. "Palo Alto", "Fortinet"
  email:          string   // e.g. "M365 + Defender for Office", "Google Workspace + Proofpoint"

  // ─── Endpoint Management ────────────────────────────────────────────
  configMgmt:     string   // e.g. "Intune", "SCCM", "Jamf", "Ansible"
  vulnMgmt:       string   // e.g. "Tenable", "Qualys", "Wiz" — blank if none

  // ─── Cloud & Forensics ──────────────────────────────────────────────
  cloudProvider:  string   // e.g. "Azure-primary", "AWS", "Multi-cloud", "On-prem only"
  forensics:      string   // e.g. "Velociraptor", "KAPE", "Defender Live Response"

  // ─── Process & Context ──────────────────────────────────────────────
  ticketing:      string   // e.g. "ServiceNow", "Jira", "PagerDuty"
  notes:          string   // freeform: compliance regime, hybrid quirks, known gaps
}

export const INITIAL_ORG_PROFILE: OrgProfile = {
  siem:          '',
  edr:           '',
  soar:          '',
  threatIntel:   '',
  identity:      '',
  mfa:           '',
  network:       '',
  email:         '',
  configMgmt:    '',
  vulnMgmt:      '',
  cloudProvider: '',
  forensics:     '',
  ticketing:     '',
  notes:         '',
}

// Common picks per category — UI can render these as a dropdown with a
// freeform "Other..." escape hatch. The OrgProfile field itself stays
// `string` so custom or in-house tools fit without schema changes.
export const ORG_PROFILE_CHOICES: Record<keyof Omit<OrgProfile, 'notes'>, readonly string[]> = {
  siem:          ['Microsoft Sentinel', 'Splunk', 'CrowdStrike Falcon Next-Gen SIEM', 'Elastic Security', 'IBM QRadar', 'Google Chronicle', 'Sumo Logic', 'Exabeam'],
  edr:           ['Microsoft Defender for Endpoint', 'CrowdStrike Falcon', 'SentinelOne', 'VMware Carbon Black', 'Palo Alto Cortex XDR'],
  soar:          ['None', 'Tines', 'Torq', 'Palo Alto XSOAR', 'Splunk SOAR', 'Microsoft Sentinel Playbooks', 'Swimlane'],
  threatIntel:   ['None', 'Recorded Future', 'Mandiant Advantage', 'CrowdStrike Falcon Intel', 'Intel 471', 'Industry ISAC', 'Anomali', 'MISP (open source)'],
  identity:      ['Entra ID + Active Directory', 'Active Directory (on-prem)', 'Okta', 'Ping Identity', 'Google Workspace', 'JumpCloud'],
  mfa:           ['Microsoft Authenticator', 'Duo', 'Okta Verify', 'YubiKey (FIDO2)', 'RSA SecurID', 'SMS / Voice (legacy)'],
  network:       ['Palo Alto NGFW', 'Fortinet FortiGate', 'Cisco Firepower', 'Check Point', 'Zscaler', 'Cloudflare'],
  email:         ['M365 + Defender for Office', 'Google Workspace + native', 'Proofpoint', 'Mimecast', 'Abnormal Security'],
  configMgmt:    ['Microsoft Intune', 'SCCM / MECM', 'Jamf', 'Ansible', 'Chef', 'Puppet', 'Workspace ONE'],
  vulnMgmt:      ['None', 'Tenable', 'Qualys', 'Rapid7 InsightVM', 'Wiz', 'Microsoft Defender Vuln Mgmt'],
  cloudProvider: ['Azure-primary', 'AWS-primary', 'GCP-primary', 'Multi-cloud', 'Hybrid (Azure + on-prem)', 'Hybrid (AWS + on-prem)', 'On-prem only'],
  forensics:     ['Velociraptor', 'KAPE', 'Microsoft Defender Live Response', 'CrowdStrike Real Time Response', 'Magnet AXIOM', 'GRR Rapid Response'],
  ticketing:     ['ServiceNow', 'Jira Service Management', 'TheHive', 'Torq', 'PagerDuty', 'Opsgenie', 'Zendesk', 'Linear'],
} as const

// True when at least one category has been filled in. Useful for deciding
// whether to inject the org-profile section into the DM system prompt.
export function isOrgProfileConfigured(profile: OrgProfile): boolean {
  return Object.entries(profile).some(([key, value]) => key !== 'notes' && value.trim().length > 0)
}
