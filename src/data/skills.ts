import type { SkillName } from '../types/game'

// Single source of truth for the skill catalog. Character creation lists these;
// the dice engine matches a player's action text against SKILL_KEYWORDS to award
// the skill bonus. Keep ALL_SKILLS and SKILL_KEYWORDS in lockstep with the
// SkillName union in ../types/game.

export const ALL_SKILLS: SkillName[] = [
  // Original ten
  'Log Analysis',
  'Malware Triage',
  'Network Forensics',
  'Endpoint Forensics',
  'Threat Intelligence',
  'OSINT',
  'Scripting/Automation',
  'Cloud IR',
  'Escalation/Comms',
  'Active Defense',
  // Threat-hunter & specialist additions
  'Threat Hunting',
  'Lateral Movement Tracking',
  'Behavioral Analysis',
  'Memory Forensics',
  'Malware Reversing',
  'Detection Engineering',
  'Threat Attribution',
  'Identity Forensics',
  'Data Loss Prevention',
  'Crisis Communications',
]

// Lowercase substrings matched against the player's action text. A match awards
// the skill bonus (+2 at L1–2, +3 at L3). Keep keywords specific enough that
// they don't collide across skills in ways that mis-credit a bonus.
export const SKILL_KEYWORDS: Record<SkillName, string[]> = {
  'Log Analysis':              ['log', 'siem', 'splunk', 'sentinel', 'event', 'audit trail', 'parse'],
  'Malware Triage':            ['malware', 'sample', 'payload', 'sandbox', 'detonate', 'triage', 'suspicious file'],
  'Network Forensics':        ['network', 'pcap', 'packet', 'netflow', 'traffic', 'dns', 'proxy', 'wireshark'],
  'Endpoint Forensics':       ['endpoint', 'edr', 'host', 'disk image', 'artifact', 'prefetch', 'registry', 'mft'],
  'Threat Intelligence':      ['threat intel', 'intelligence', 'ioc', 'indicator', 'feed', 'campaign', 'ttp lookup'],
  'OSINT':                     ['osint', 'open source', 'whois', 'reputation', 'domain lookup', 'public record'],
  'Scripting/Automation':     ['script', 'automate', 'automation', 'playbook', 'soar', 'powershell', 'python', 'api call'],
  'Cloud IR':                  ['cloud', 'aws', 'azure', 'gcp', 's3', 'iam role', 'cloudtrail', 'kubernetes', 'container'],
  'Escalation/Comms':         ['escalate', 'notify', 'report to', 'brief', 'ciso', 'management', 'stakeholder', 'on-call'],
  'Active Defense':            ['contain', 'isolate', 'block', 'quarantine', 'firewall', 'deceive', 'honeypot', 'disrupt'],
  'Threat Hunting':           ['hunt', 'proactive', 'hypothesis', 'sweep', 'beacon', 'baseline', 'anomaly hunt'],
  'Lateral Movement Tracking':['lateral', 'pivot', 'movement', 'smb', 'rdp', 'pass-the-hash', 'kerberos', 'psexec', 'wmi'],
  'Behavioral Analysis':      ['behavior', 'behavioral', 'baseline deviation', 'pattern of life', 'ueba', 'living off the land', 'lolbin'],
  'Memory Forensics':         ['memory', 'lsass', 'volatile', 'injected', 'process dump', 'ram', 'volatility'],
  'Malware Reversing':        ['reverse', 'reversing', 'disassemble', 'decompile', 'unpack', 'static analysis', 'binary analysis'],
  'Detection Engineering':    ['detection rule', 'sigma', 'yara', 'tune', 'tuning', 'write a rule', 'alert logic', 'correlation rule'],
  'Threat Attribution':       ['attribution', 'attribute', 'actor group', 'apt', 'cluster', 'tradecraft', 'who is behind'],
  'Identity Forensics':       ['identity', 'account', 'credential', 'authentication', 'login', 'oauth', 'token theft', 'mfa', 'azure ad', 'entra'],
  'Data Loss Prevention':     ['exfil', 'exfiltration', 'dlp', 'data loss', 'data theft', 'staging', 'upload to', 'leak'],
  'Crisis Communications':    ['crisis comm', 'public statement', 'press', 'legal counsel', 'regulator', 'breach notification', 'executive update', 'war room'],
}
