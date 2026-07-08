import type { OrgProfile } from '../types/orgProfile'

// Token name (used inside {{...}}) → which OrgProfile key it maps to, and the
// generic phrase to substitute when no profile is set or the field is blank.
// Centralizing this map is the single source of truth: rename a profile key
// here and every tokenized string follows.

const TOKEN_MAP = {
  SIEM:      { key: 'siem',          generic: 'the SIEM' },
  EDR:       { key: 'edr',           generic: 'the EDR' },
  SOAR:      { key: 'soar',          generic: 'the SOAR platform' },
  INTEL:     { key: 'threatIntel',   generic: 'the threat intel platform' },
  IDENTITY:  { key: 'identity',      generic: 'AD/Entra ID' },
  MFA:       { key: 'mfa',           generic: 'the MFA provider' },
  NETWORK:   { key: 'network',       generic: 'the NGFW' },
  EMAIL:     { key: 'email',         generic: 'the email security stack' },
  CONFIG:    { key: 'configMgmt',    generic: 'config management' },
  VULN:      { key: 'vulnMgmt',      generic: 'the vulnerability scanner' },
  CLOUD:     { key: 'cloudProvider', generic: 'the cloud environment' },
  FORENSICS: { key: 'forensics',     generic: 'forensic tooling' },
  TICKETING: { key: 'ticketing',     generic: 'the ticketing system' },
} as const satisfies Record<string, { key: keyof OrgProfile; generic: string }>

const TOKEN_RE = /\{\{(\w+)\}\}/g

export function substituteOrgTokens(text: string, profile: OrgProfile | null | undefined): string {
  return text.replace(TOKEN_RE, (full, token) => {
    const mapping = TOKEN_MAP[token as keyof typeof TOKEN_MAP]
    if (!mapping) {
      if (import.meta.env.DEV) console.warn(`[orgProfileTokens] unknown token "${full}" — schema drift?`)
      return full
    }
    const value = profile?.[mapping.key]?.toString().trim()
    return value && value.length > 0 ? value : mapping.generic
  })
}
