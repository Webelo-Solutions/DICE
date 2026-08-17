export interface ScenarioCategoryDef {
  id:          string
  label:       string
  description: string
  glyph:       string
  textColor:   string
  borderColor: string
  bgColor:     string
  tabBg:       string
}

export const CATEGORIES: ScenarioCategoryDef[] = [
  {
    id:          'fundamentals',
    label:       'Fundamentals',
    description: 'Introductory training and core SOC mechanics',
    glyph:       '◈',
    textColor:   'text-terminal-amber',
    borderColor: 'border-terminal-amber/40',
    bgColor:     'bg-terminal-amber/5',
    tabBg:       'bg-terminal-amber/10',
  },
  {
    id:          'malware',
    label:       'Malware',
    description: 'Malware triage, RAT detection, and endpoint threats',
    glyph:       '⬡',
    textColor:   'text-red-400',
    borderColor: 'border-red-400/40',
    bgColor:     'bg-red-400/5',
    tabBg:       'bg-red-400/10',
  },
  {
    id:          'ransomware',
    label:       'Ransomware',
    description: 'Ransomware detection, containment, and recovery',
    glyph:       '◉',
    textColor:   'text-orange-400',
    borderColor: 'border-orange-400/40',
    bgColor:     'bg-orange-400/5',
    tabBg:       'bg-orange-400/10',
  },
  {
    id:          'phishing',
    label:       'Phishing & BEC',
    description: 'Credential phishing, account takeover, and business email compromise',
    glyph:       '◎',
    textColor:   'text-yellow-400',
    borderColor: 'border-yellow-400/40',
    bgColor:     'bg-yellow-400/5',
    tabBg:       'bg-yellow-400/10',
  },
  {
    id:          'identity',
    label:       'Identity & Access',
    description: 'Authentication anomalies, credential stuffing, and access abuse',
    glyph:       '⊕',
    textColor:   'text-terminal-blue',
    borderColor: 'border-terminal-blue/40',
    bgColor:     'bg-terminal-blue/5',
    tabBg:       'bg-terminal-blue/10',
  },
  {
    id:          'network',
    label:       'Network Threats',
    description: 'Reconnaissance, lateral movement, and network-based attacks',
    glyph:       '⊞',
    textColor:   'text-terminal-green',
    borderColor: 'border-terminal-green/40',
    bgColor:     'bg-terminal-green/5',
    tabBg:       'bg-terminal-green/10',
  },
  {
    id:          'cloud',
    label:       'Cloud Security',
    description: 'Cloud misconfiguration, data breach, and infrastructure threats',
    glyph:       '◇',
    textColor:   'text-sky-400',
    borderColor: 'border-sky-400/40',
    bgColor:     'bg-sky-400/5',
    tabBg:       'bg-sky-400/10',
  },
  {
    id:          'insider',
    label:       'Insider Threat',
    description: 'Privileged access abuse, data theft, and insider-driven incidents',
    glyph:       '◐',
    textColor:   'text-purple-400',
    borderColor: 'border-purple-400/40',
    bgColor:     'bg-purple-400/5',
    tabBg:       'bg-purple-400/10',
  },
  {
    id:          'apt',
    label:       'Advanced Threats',
    description: 'Nation-state actors, zero-days, and advanced persistent threats',
    glyph:       '✦',
    textColor:   'text-rose-400',
    borderColor: 'border-rose-400/40',
    bgColor:     'bg-rose-400/5',
    tabBg:       'bg-rose-400/10',
  },
  {
    id:          'ai_fraud',
    label:       'AI-Enabled Threats',
    description: 'Jailbreaks, prompt injection, model/data poisoning, and AI-driven fraud',
    glyph:       '⬢',
    textColor:   'text-cyan-400',
    borderColor: 'border-cyan-400/40',
    bgColor:     'bg-cyan-400/5',
    tabBg:       'bg-cyan-400/10',
  },
  {
    id:          'supply_chain',
    label:       'Supply Chain',
    description: 'Compromised dependencies, CI/CD pipelines, and vendor software',
    glyph:       '⬟',
    textColor:   'text-indigo-400',
    borderColor: 'border-indigo-400/40',
    bgColor:     'bg-indigo-400/5',
    tabBg:       'bg-indigo-400/10',
  },
  {
    id:          'third_party',
    label:       'Third-Party & Vendor Risk',
    description: 'Vendor breaches, managed service provider abuse, and trusted-access compromise',
    glyph:       '▤',
    textColor:   'text-teal-400',
    borderColor: 'border-teal-400/40',
    bgColor:     'bg-teal-400/5',
    tabBg:       'bg-teal-400/10',
  },
  {
    id:          'ot_ics',
    label:       'OT / ICS',
    description: 'Industrial control systems, physical safety, and operational technology intrusions',
    glyph:       '◒',
    textColor:   'text-lime-400',
    borderColor: 'border-lime-400/40',
    bgColor:     'bg-lime-400/5',
    tabBg:       'bg-lime-400/10',
  },
  {
    id:          'ddos',
    label:       'DDoS & Extortion',
    description: 'Denial of service, availability attacks, and extortion threats',
    glyph:       '⬠',
    textColor:   'text-fuchsia-400',
    borderColor: 'border-fuchsia-400/40',
    bgColor:     'bg-fuchsia-400/5',
    tabBg:       'bg-fuchsia-400/10',
  },
]

export const CUSTOM_CATEGORY: ScenarioCategoryDef = {
  id:          'custom',
  label:       'Custom',
  description: 'User-created scenarios from the Campaign Builder',
  glyph:       '◈',
  textColor:   'text-terminal-green',
  borderColor: 'border-terminal-green/40',
  bgColor:     'bg-terminal-green/5',
  tabBg:       'bg-terminal-green/10',
}

export function getCategoryDef(id: string): ScenarioCategoryDef {
  return CATEGORIES.find((c) => c.id === id) ?? CUSTOM_CATEGORY
}
