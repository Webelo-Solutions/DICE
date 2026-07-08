import type { CharacterClass, StatKey } from '../types/game'

export interface SubAction {
  id:      string
  label:   string   // chip label
  detail:  string   // pre-fills rationale textarea
  dcHint:  number   // approximate DC — DM still has final say
}

export interface ClassAction {
  id:          string
  label:       string
  description: string
  stat:        StatKey
  subActions:  SubAction[]
}

export interface ClassActionSet {
  primary:   ClassAction[]
  secondary: ClassAction[]
}

export const CLASS_ACTIONS: Record<CharacterClass, ClassActionSet> = {

  Analyst: {
    primary: [
      {
        id: 'analyze_logs', label: 'Analyze Logs',
        description: 'Review log data for anomalies and suspicious patterns',
        stat: 'vigilance',
        subActions: [
          { id: 'al_raw',      label: 'Pull raw events',        dcHint: 8,  detail: 'Query {{SIEM}} for the last 4 hours of events from the affected host — authentication, process, and network activity.' },
          { id: 'al_cross',    label: 'Cross-correlate sources', dcHint: 12, detail: 'Join endpoint logs with network flow data to reconstruct the sequence of events that preceded the alert.' },
          { id: 'al_gaps',     label: 'Check for log gaps',      dcHint: 14, detail: 'Inspect ingestion timestamps for gaps that may indicate log deletion, forwarding failure, or attacker tampering.' },
          { id: 'al_timeline', label: 'Build event timeline',    dcHint: 16, detail: 'Reconstruct a minute-by-minute sequence across SIEM, EDR, and DNS logs to establish a definitive attack timeline.' },
        ],
      },
      {
        id: 'correlate_alerts', label: 'Correlate Alerts',
        description: 'Cross-reference SIEM alerts to identify a pattern or campaign',
        stat: 'analysis',
        subActions: [
          { id: 'ca_cluster',   label: 'Cluster by IOC',          dcHint: 10, detail: 'Group related alerts by shared source IP, file hash, or domain to identify a campaign pattern across the environment.' },
          { id: 'ca_campaign',  label: 'Match to known campaign',  dcHint: 12, detail: 'Compare this alert\'s TTPs against known threat actor profiles in the intel feed and search for prior campaign matches.' },
          { id: 'ca_killchain', label: 'Map to kill chain',        dcHint: 14, detail: 'Identify which MITRE ATT&CK tactic this alert cluster represents and determine where the attacker is in the kill chain.' },
          { id: 'ca_fp',        label: 'Rule out false positive',  dcHint: 10, detail: 'Assess whether alert volume and signature match are consistent with a tuning issue or a genuine threat cluster.' },
        ],
      },
      {
        id: 'triage_alert', label: 'Triage Alert',
        description: 'Assess the severity and validity of an incoming alert',
        stat: 'vigilance',
        subActions: [
          { id: 'ta_raw',    label: 'Score from raw event',     dcHint: 8,  detail: 'Pull the raw log behind the alert and assess fidelity — is this a real event or a noisy detection rule firing on benign activity?' },
          { id: 'ta_edr',    label: 'Verify on-host in EDR',    dcHint: 10, detail: 'Open the affected endpoint in {{EDR}}, pull the process tree around the alert trigger time, and check parent process context.' },
          { id: 'ta_scope',  label: 'Assess blast radius',      dcHint: 10, detail: 'Determine scope: how many hosts have triggered this same alert signature in the last 24 hours, and are they clustered?' },
          { id: 'ta_fp',     label: 'Check false positive list', dcHint: 8,  detail: 'Search the team\'s false positive repository for this exact alert signature and check its historical true-positive rate.' },
        ],
      },
      {
        id: 'identify_iocs', label: 'Identify IOCs',
        description: 'Extract indicators of compromise from available evidence',
        stat: 'analysis',
        subActions: [
          { id: 'ioc_hash',   label: 'Extract file hashes',     dcHint: 10, detail: 'Use a sandbox or static analysis tool to pull SHA-256 and MD5 hashes from the suspected artifact.' },
          { id: 'ioc_net',    label: 'Pull network indicators',  dcHint: 12, detail: 'Extract C2 domains, destination IPs, and JA3 fingerprints from captured network traffic or EDR telemetry.' },
          { id: 'ioc_persist',label: 'Find persistence IOCs',    dcHint: 12, detail: 'Check autoruns, scheduled tasks, and registry run keys on the affected host for attacker-established persistence.' },
          { id: 'ioc_cred',   label: 'Identify credential IOCs', dcHint: 14, detail: 'Determine which accounts were accessed, modified, or created during the suspected compromise window.' },
        ],
      },
      {
        id: 'query_siem', label: 'Query SIEM',
        description: 'Run a targeted search across the SIEM data lake',
        stat: 'vigilance',
        subActions: [
          { id: 'qs_keyword', label: 'Keyword search',         dcHint: 8,  detail: 'Run a targeted keyword search for the identified domain, hash, or username across all indexed log sources.' },
          { id: 'qs_hunt',    label: 'Write hunt query',       dcHint: 14, detail: 'Author a structured hunt query in {{SIEM}} to surface a specific behavioral pattern across the full data lake.' },
          { id: 'qs_coverage',label: 'Verify log coverage',    dcHint: 10, detail: 'Confirm which sources are actively forwarding to the SIEM and identify any coverage gaps in the affected environment.' },
          { id: 'qs_session', label: 'Reconstruct user session',dcHint: 12, detail: 'Pull all events attributed to the suspect account across the relevant time window and reconstruct their session.' },
        ],
      },
    ],
    secondary: [
      { id: 'document_findings', label: 'Document Findings', description: 'Record observations and timeline entries for the incident record', stat: 'analysis', subActions: [] },
      { id: 'escalate_to_lead',  label: 'Escalate to Lead',  description: 'Hand off the alert to a senior analyst or team lead',           stat: 'command',   subActions: [] },
    ],
  },

  Hunter: {
    primary: [
      {
        id: 'threat_hunt', label: 'Threat Hunt',
        description: 'Proactively search the environment for hidden adversary activity',
        stat: 'analysis',
        subActions: [
          { id: 'th_proc',   label: 'Hunt process anomalies',    dcHint: 12, detail: 'Search for abnormal parent-child process relationships — e.g., Office spawning PowerShell, or cmd.exe launched from a web server process.' },
          { id: 'th_lolbin', label: 'Hunt LOLBIN abuse',         dcHint: 14, detail: 'Look for legitimate binaries being weaponized: certutil downloading files, mshta executing remote scripts, or wscript running unusual payloads.' },
          { id: 'th_beacon', label: 'Hunt for beaconing',        dcHint: 16, detail: 'Analyze JA3 fingerprints and outbound connection intervals in network flows for periodic beaconing patterns consistent with C2.' },
          { id: 'th_cred',   label: 'Hunt credential dumping',   dcHint: 14, detail: 'Search EDR telemetry for LSASS memory access patterns or known credential dumping tool signatures across all managed endpoints.' },
        ],
      },
      {
        id: 'pivot_on_ioc', label: 'Pivot on IOC',
        description: 'Trace connections from a known indicator to additional hosts/accounts',
        stat: 'analysis',
        subActions: [
          { id: 'pi_pdns',  label: 'Passive DNS expansion',      dcHint: 10, detail: 'Query passive DNS records to find all domains that have resolved to the identified IP and trace infrastructure relationships.' },
          { id: 'pi_hosts', label: 'Find all affected hosts',    dcHint: 10, detail: 'Search the SIEM for every endpoint that has communicated with the identified indicator in the past 30 days.' },
          { id: 'pi_hash',  label: 'Trace hash to execution',    dcHint: 12, detail: 'Locate every machine where this file hash has been seen and determine when and how it executed.' },
          { id: 'pi_acct',  label: 'Pivot from account activity',dcHint: 12, detail: 'Pull all activity attributed to the suspect user or service account across the environment to map their full footprint.' },
        ],
      },
      {
        id: 'memory_forensics', label: 'Memory Forensics',
        description: 'Analyze live or captured process memory for injected code or artifacts',
        stat: 'analysis',
        subActions: [
          { id: 'mf_lsass',   label: 'Dump and parse LSASS',    dcHint: 14, detail: 'Use Velociraptor to remotely capture LSASS memory and parse it for cached credential artifacts without interrupting the host.' },
          { id: 'mf_inject',  label: 'Find injected code',       dcHint: 16, detail: 'Scan process memory for PE headers in unexpected regions or unlinked DLLs that indicate process injection.' },
          { id: 'mf_network', label: 'Carve network artifacts',  dcHint: 14, detail: 'Extract recent socket connections and DNS cache entries from a live memory image to identify active C2 channels.' },
          { id: 'mf_entropy', label: 'Find encrypted payloads',  dcHint: 16, detail: 'Identify high-entropy memory regions that may contain packed, encrypted, or staged malware waiting for execution.' },
        ],
      },
      {
        id: 'edr_investigation', label: 'EDR Investigation',
        description: 'Deep-dive endpoint telemetry for process trees, file events, and network connections',
        stat: 'analysis',
        subActions: [
          { id: 'edr_tree',    label: 'Review process tree',       dcHint: 10, detail: 'Trace the full parent-child process chain in the EDR console from the alert event back to the original execution entry point.' },
          { id: 'edr_net',     label: 'Check network connections', dcHint: 10, detail: 'Review all outbound connections initiated by the affected process in the EDR telemetry and identify external destinations.' },
          { id: 'edr_files',   label: 'Inspect file events',       dcHint: 12, detail: 'Look for large file creation events, unusual archive activity, or staging in temp directories that indicate data collection.' },
          { id: 'edr_persist', label: 'Find persistence via EDR',  dcHint: 12, detail: 'Check scheduled task creation, registry run key writes, and service installs on the affected host for attacker persistence.' },
        ],
      },
      {
        id: 'trace_lateral_movement', label: 'Trace Lateral Movement',
        description: 'Map attacker movement across systems using authentication and network logs',
        stat: 'stealth',
        subActions: [
          { id: 'lm_auth',  label: 'Map authentication events',  dcHint: 14, detail: 'Pull Windows Security Event 4624/4625 across the domain to trace the account\'s authentication path and identify compromised hosts.' },
          { id: 'lm_smb',   label: 'Identify admin share access', dcHint: 12, detail: 'Check for unexpected SMB connections using ADMIN$, C$, or IPC$ paths from non-admin workstations or anomalous source IPs.' },
          { id: 'lm_rdp',   label: 'Trace RDP session chains',   dcHint: 14, detail: 'Follow Remote Desktop connection events across hosts in sequence to reconstruct the attacker\'s hop-by-hop pivot path.' },
          { id: 'lm_pth',   label: 'Check pass-the-hash',        dcHint: 16, detail: 'Look for NTLM authentication events originating from hosts that don\'t normally authenticate via NTLM — a pass-the-hash indicator.' },
        ],
      },
    ],
    secondary: [
      { id: 'review_logs',  label: 'Review Logs',  description: 'Check log sources for events relevant to an active hunt', stat: 'vigilance', subActions: [] },
      { id: 'submit_intel', label: 'Submit Intel', description: 'Share hunt findings with the broader team',              stat: 'command',   subActions: [] },
    ],
  },

  Responder: {
    primary: [
      {
        id: 'isolate_host', label: 'Isolate Host',
        description: 'Cut off a compromised endpoint from the network',
        stat: 'agility',
        subActions: [
          { id: 'ih_edr',   label: 'EDR remote containment', dcHint: 8,  detail: 'Push network isolation command via CrowdStrike or Defender for Endpoint to cut the host from the network while preserving EDR telemetry.' },
          { id: 'ih_vlan',  label: 'VLAN isolation',          dcHint: 12, detail: 'Coordinate with network engineering to move the affected host to a quarantine VLAN or disable the switchport.' },
          { id: 'ih_vpn',   label: 'VPN disconnect and block', dcHint: 10, detail: 'Terminate the affected user\'s VPN session and block their credential from re-authenticating to the VPN gateway.' },
          { id: 'ih_gpo',   label: 'Disable via GPO',          dcHint: 14, detail: 'Push a targeted Group Policy update to disable the network adapter on the affected host class across the environment.' },
        ],
      },
      {
        id: 'contain_threat', label: 'Contain Threat',
        description: 'Apply an immediate containment measure to stop spread',
        stat: 'agility',
        subActions: [
          { id: 'ct_kill',    label: 'Kill malicious process',     dcHint: 10, detail: 'Use EDR remote execution to terminate the identified malicious process across all affected endpoints simultaneously.' },
          { id: 'ct_account', label: 'Disable compromised account', dcHint: 10, detail: 'Disable the account in Active Directory, force a token invalidation, and revoke all active sessions.' },
          { id: 'ct_sinkhole',label: 'DNS sinkhole C2 domain',     dcHint: 10, detail: 'Push the identified C2 domain to the internal DNS sinkhole to redirect all callback attempts to a controlled IP.' },
          { id: 'ct_session', label: 'Revoke active sessions',     dcHint: 12, detail: 'Force termination of all active sessions belonging to the compromised account across all systems and cloud services.' },
        ],
      },
      {
        id: 'block_traffic', label: 'Block Network Traffic',
        description: 'Push a firewall or ACL rule to block malicious traffic',
        stat: 'agility',
        subActions: [
          { id: 'bt_perimeter', label: 'Perimeter firewall block', dcHint: 8,  detail: 'Submit an emergency block rule for the C2 IP to the edge NGFW — get the change approved and pushed within this turn.' },
          { id: 'bt_waf',       label: 'Apply WAF rule',           dcHint: 14, detail: 'Write and deploy a WAF signature to block the observed exploit pattern at the application layer.' },
          { id: 'bt_segment',   label: 'Segment affected subnet',  dcHint: 16, detail: 'Work with network ops to apply ACLs that restrict east-west movement between the affected subnet and crown jewel systems.' },
          { id: 'bt_egress',    label: 'Block egress path',        dcHint: 14, detail: 'Coordinate to null-route or BGP-blackhole traffic destined for the attacker\'s identified egress range.' },
        ],
      },
      {
        id: 'quarantine_artifact', label: 'Quarantine Artifact',
        description: 'Secure a malicious file, process, or account from further use',
        stat: 'agility',
        subActions: [
          { id: 'qa_sandbox', label: 'Submit to sandbox',       dcHint: 8,  detail: 'Send the suspected file to an automated sandbox for full behavioral detonation and report extraction.' },
          { id: 'qa_hash',    label: 'Hash and preserve',       dcHint: 8,  detail: 'Compute SHA-256 and MD5 of the artifact, document chain-of-custody, and store in the evidence repository.' },
          { id: 'qa_fleet',   label: 'Quarantine fleet-wide',   dcHint: 12, detail: 'Use EDR to search for and quarantine every copy of the identified artifact across all managed endpoints.' },
          { id: 'qa_acl',     label: 'Lock down directory',     dcHint: 12, detail: 'Apply restrictive ACLs to the artifact\'s parent directory to prevent further staging or exfiltration from that path.' },
        ],
      },
      {
        id: 'deploy_countermeasure', label: 'Deploy Countermeasure',
        description: 'Activate a prepared defensive control or runbook step',
        stat: 'fortitude',
        subActions: [
          { id: 'dc_soar',    label: 'Trigger SOAR playbook',    dcHint: 8,  detail: 'Activate the pre-built automated containment playbook in the SOAR platform for this incident type.' },
          { id: 'dc_edr_sig', label: 'Push EDR signature',       dcHint: 12, detail: 'Deploy a new custom IOA or IOC rule to CrowdStrike across all managed hosts to catch future variants.' },
          { id: 'dc_logging', label: 'Enable enhanced logging',  dcHint: 10, detail: 'Increase audit policy verbosity on domain controllers and crown jewel systems to capture attacker activity at higher fidelity.' },
          { id: 'dc_honey',   label: 'Deploy honeypot asset',    dcHint: 16, detail: 'Stand up a pre-configured decoy asset in the affected network segment to monitor and alert on further attacker movement.' },
        ],
      },
    ],
    secondary: [
      { id: 'coordinate_containment', label: 'Coordinate Containment', description: 'Align the containment plan with the broader team',         stat: 'command',  subActions: [] },
      { id: 'document_incident',      label: 'Document Incident',      description: 'Record the incident timeline and containment actions taken', stat: 'analysis', subActions: [] },
    ],
  },

  Engineer: {
    primary: [
      {
        id: 'deploy_script', label: 'Deploy Script',
        description: 'Execute an automation or response script across affected systems',
        stat: 'agility',
        subActions: [
          { id: 'ds_ansible',  label: 'Ansible / SCCM push',      dcHint: 10, detail: 'Push a targeted remediation script to the affected host class via Ansible or SCCM configuration management.' },
          { id: 'ds_psremote', label: 'PSRemoting one-liner',      dcHint: 12, detail: 'Use PowerShell remoting to execute a targeted command on the affected endpoints without deploying a full agent.' },
          { id: 'ds_vql',      label: 'Velociraptor VQL artifact', dcHint: 14, detail: 'Deploy a custom Velociraptor VQL hunt artifact to collect specific forensic data at scale across the fleet.' },
          { id: 'ds_api',      label: 'Trigger via API',           dcHint: 12, detail: 'Call the platform API directly to push a response action — faster than using the GUI under time pressure.' },
        ],
      },
      {
        id: 'configure_firewall', label: 'Configure Firewall',
        description: 'Modify firewall rules, ACLs, or WAF policies',
        stat: 'agility',
        subActions: [
          { id: 'cf_block',    label: 'Emergency block rule',     dcHint: 10, detail: 'Add a blocking ACL entry for the C2 IP or subnet to the edge NGFW — draft, get change approved, and push this turn.' },
          { id: 'cf_waf',      label: 'WAF exploit signature',    dcHint: 14, detail: 'Write and deploy a WAF rule to block the observed exploit pattern at the application layer before the next request lands.' },
          { id: 'cf_segment',  label: 'Microsegmentation policy', dcHint: 16, detail: 'Apply internal firewall rules to restrict east-west movement between the affected segment and critical infrastructure.' },
          { id: 'cf_egress',   label: 'Tighten egress rules',     dcHint: 12, detail: 'Audit current outbound allow rules and remove overly permissive entries that give the attacker egress options.' },
        ],
      },
      {
        id: 'patch_vulnerability', label: 'Patch Vulnerability',
        description: 'Apply a fix or workaround to an exploited or at-risk system',
        stat: 'fortitude',
        subActions: [
          { id: 'pv_hotfix',   label: 'Apply emergency hotfix',   dcHint: 12, detail: 'Deploy the vendor-provided patch to the exploited service on the affected host — get it staged and applied this turn.' },
          { id: 'pv_vpatch',   label: 'Virtual patch via WAF/IPS', dcHint: 10, detail: 'Apply a compensating control at the network or application layer to block exploitation while the proper patch is staged.' },
          { id: 'pv_disable',  label: 'Disable vulnerable component', dcHint: 10, detail: 'Temporarily disable or uninstall the affected service to eliminate the attack surface while a patch is prepared.' },
          { id: 'pv_validate', label: 'Validate patch coverage',  dcHint: 12, detail: 'Confirm the patch applied successfully and verify the vulnerable version is no longer present across the affected host class.' },
        ],
      },
      {
        id: 'restore_system', label: 'Restore System',
        description: 'Bring a compromised system back to a known-good state',
        stat: 'fortitude',
        subActions: [
          { id: 'rs_snapshot', label: 'Restore from snapshot',    dcHint: 10, detail: 'Revert the affected system from its most recent verified backup or VM snapshot after confirming the snapshot predates compromise.' },
          { id: 'rs_rebuild',  label: 'Rebuild from golden image', dcHint: 14, detail: 'Provision a fresh instance from the hardened base image, re-join to the domain, and restore from clean backups.' },
          { id: 'rs_validate', label: 'Validate before rejoining', dcHint: 12, detail: 'Run integrity checks and a full AV/EDR scan on the restored system before returning it to the production network.' },
          { id: 'rs_rto',      label: 'Coordinate RTO with owner', dcHint: 8,  detail: 'Work with the system owner and business unit to prioritize restoration order based on business impact and dependencies.' },
        ],
      },
      {
        id: 'automate_response', label: 'Automate Response',
        description: 'Build or trigger a SOAR playbook to handle a repeating task',
        stat: 'agility',
        subActions: [
          { id: 'ar_build',   label: 'Build new SOAR playbook',   dcHint: 14, detail: 'Create a new automated runbook in the SOAR platform to handle recurring detections of this type — wire up enrichment and response steps.' },
          { id: 'ar_trigger', label: 'Trigger existing playbook', dcHint: 8,  detail: 'Kick off the existing automation workflow with the current incident\'s IOCs pre-loaded for immediate enrichment and action.' },
          { id: 'ar_detect',  label: 'Write detection rule',      dcHint: 16, detail: 'Author a new SIEM or EDR detection rule based on the specific TTPs observed, tuned to minimize false positives.' },
          { id: 'ar_tip',     label: 'Pipe IOCs to TIP',          dcHint: 12, detail: 'Push identified indicators into the threat intel platform for automated blocking across all integrated controls.' },
        ],
      },
    ],
    secondary: [
      { id: 'analyze_logs',    label: 'Analyze Logs',    description: 'Review logs for technical indicators relevant to an engineering task', stat: 'vigilance', subActions: [] },
      { id: 'monitor_network', label: 'Monitor Network', description: 'Watch traffic patterns and sensor data for anomalies',                stat: 'vigilance', subActions: [] },
    ],
  },

  'Intel Officer': {
    primary: [
      {
        id: 'osint_research', label: 'OSINT Research',
        description: 'Gather open-source intelligence on infrastructure, actors, or malware',
        stat: 'stealth',
        subActions: [
          { id: 'os_whois',   label: 'WHOIS / passive DNS',     dcHint: 8,  detail: 'Query WHOIS and passive DNS databases to profile the registrant history and IP infrastructure associated with the C2 domain.' },
          { id: 'os_forums',  label: 'Search threat actor forums',dcHint: 14, detail: 'Query underground forum archives and dark web sources for the identified handle, tool, or infrastructure cluster.' },
          { id: 'os_malware', label: 'VirusTotal / MalwareBazaar',dcHint: 8,  detail: 'Submit the identified hashes to VirusTotal and MalwareBazaar and pull enrichment reports from the open malware repositories.' },
          { id: 'os_shodan',  label: 'Shodan / Censys mapping', dcHint: 12, detail: 'Identify co-hosted infrastructure and similar server fingerprints using Shodan or Censys internet scanning data.' },
        ],
      },
      {
        id: 'attribution_analysis', label: 'Attribution Analysis',
        description: 'Link observed TTPs and infrastructure to known threat actor groups',
        stat: 'analysis',
        subActions: [
          { id: 'aa_attack', label: 'Match TTPs to ATT&CK group', dcHint: 12, detail: 'Compare observed techniques and sub-techniques against ATT&CK group profiles to produce a ranked list of attribution candidates.' },
          { id: 'aa_malware',label: 'Correlate malware family',   dcHint: 14, detail: 'Search threat intel reports and sandboxes for prior use of this malware family and its associated threat actor.' },
          { id: 'aa_infra',  label: 'Infrastructure overlap',     dcHint: 14, detail: 'Compare C2 infrastructure characteristics — hosting provider, SSL cert patterns, registrar — against known actor profiles.' },
          { id: 'aa_rfi',    label: 'Submit external RFI',        dcHint: 16, detail: 'Submit a formal request for information to your ISAC or intel-sharing community for additional context on the observed activity.' },
        ],
      },
      {
        id: 'dark_web_recon', label: 'Dark Web Recon',
        description: 'Covertly monitor underground forums and markets for related activity',
        stat: 'stealth',
        subActions: [
          { id: 'dw_paste',  label: 'Monitor paste sites',       dcHint: 12, detail: 'Search Pastebin, BreachForums, and similar platforms for data matching your organization\'s assets or the identified IOCs.' },
          { id: 'dw_creds',  label: 'Check credential markets',  dcHint: 14, detail: 'Query breach databases and dark web credential markets for accounts from your domain that may have been compromised.' },
          { id: 'dw_chatter',label: 'Monitor actor chatter',     dcHint: 16, detail: 'Search known actor forums and Telegram channels for mentions of your organization, your IP ranges, or the identified campaign.' },
          { id: 'dw_leak',   label: 'Check ransomware leak sites',dcHint: 14, detail: 'Inspect active ransomware leak sites and dark web data markets for your organization\'s exfiltrated data already listed for sale.' },
        ],
      },
      {
        id: 'profile_threat_actor', label: 'Profile Threat Actor',
        description: 'Build a TTPs dossier on the adversary using known intelligence',
        stat: 'analysis',
        subActions: [
          { id: 'pt_navigator',label: 'Build ATT&CK Navigator layer', dcHint: 10, detail: 'Map all observed techniques into an ATT&CK Navigator layer to visualize coverage gaps and identify the actor\'s preferred TTPs.' },
          { id: 'pt_reports',  label: 'Pull prior actor reporting',   dcHint: 10, detail: 'Retrieve all available threat reports, advisories, and IOC sets for this threat group from your intel platform.' },
          { id: 'pt_motive',   label: 'Assess motivation',           dcHint: 12, detail: 'Based on targeting profile and observed TTPs, infer whether this is financially, espionage, disruption, or hacktivism-motivated.' },
          { id: 'pt_tier',     label: 'Estimate capability tier',    dcHint: 14, detail: 'Score the actor\'s operational security, tooling maturity, and target selection against standard capability tiers.' },
        ],
      },
      {
        id: 'submit_intel_report', label: 'Submit Intel Report',
        description: 'Deliver actionable intelligence and context to the response team',
        stat: 'command',
        subActions: [
          { id: 'ir_stix',  label: 'Package as STIX/TAXII',      dcHint: 12, detail: 'Format IOCs and observed TTPs into a machine-readable STIX bundle for automated distribution to integrated platforms.' },
          { id: 'ir_brief', label: 'Write leadership threat brief',dcHint: 10, detail: 'Produce a one-page executive-level brief: actor profile, likely objectives, confidence level, and recommended defensive posture.' },
          { id: 'ir_share', label: 'Share IOCs to ISAC',          dcHint: 10, detail: 'Push identified indicators through the threat-sharing community for broader defensive benefit across the sector.' },
          { id: 'ir_annot', label: 'Annotate incident timeline',   dcHint: 8,  detail: 'Enrich the working incident timeline with threat actor context mapped to each observed event for the debrief record.' },
        ],
      },
    ],
    secondary: [
      { id: 'correlate_iocs', label: 'Correlate IOCs', description: 'Cross-reference indicators against threat intel feeds',  stat: 'analysis', subActions: [] },
      { id: 'brief_team',     label: 'Brief Team',     description: 'Share threat actor context and situational awareness',   stat: 'command',  subActions: [] },
    ],
  },

  Commander: {
    primary: [
      {
        id: 'coordinate_team', label: 'Coordinate Team',
        description: 'Direct the overall response effort and align team priorities',
        stat: 'command',
        subActions: [
          { id: 'ct_sync',     label: '5-min status sync',        dcHint: 10, detail: 'Pull each functional lead for a rapid heads-up: what are you doing, what\'s blocked, what do you need from me right now?' },
          { id: 'ct_swimlane', label: 'Assign swim lanes',         dcHint: 12, detail: 'Explicitly divide the response effort into named ownership areas, confirm each lead accepts, and broadcast the division.' },
          { id: 'ct_conflict', label: 'Resolve resource conflict', dcHint: 14, detail: 'Arbitrate between team members competing for the same tooling, access, or attention — make the call and unblock the critical path.' },
          { id: 'ct_priority', label: 'Set priority order',        dcHint: 10, detail: 'Define the top three actions for the next 30 minutes and communicate the priority order clearly to all tracks.' },
        ],
      },
      {
        id: 'escalate_to_ciso', label: 'Escalate to CISO',
        description: 'Engage executive leadership and initiate executive comms',
        stat: 'command',
        subActions: [
          { id: 'ec_sitrep',  label: 'Draft executive SITREP',   dcHint: 12, detail: 'Write a 5-sentence situation report: what happened, what\'s confirmed, blast radius, what we\'re doing, and what we need.' },
          { id: 'ec_bridge',  label: 'Stand up exec bridge call', dcHint: 14, detail: 'Initiate the executive notification bridge and deliver the initial briefing to the CISO, CTO, and Legal.' },
          { id: 'ec_decision',label: 'Frame a binary decision',   dcHint: 14, detail: 'Identify the response action requiring CISO authority and present it as a clear binary choice with explicit tradeoffs.' },
          { id: 'ec_timeline',label: 'Manage CISO expectations',  dcHint: 16, detail: 'Set realistic containment timeline expectations with the CISO without triggering premature escalation to the board.' },
        ],
      },
      {
        id: 'brief_leadership', label: 'Brief Leadership',
        description: 'Provide a concise status update to key stakeholders',
        stat: 'command',
        subActions: [
          { id: 'bl_verbal',  label: '3-min verbal SBAR update',  dcHint: 10, detail: 'Deliver a structured verbal situation report using SBAR — Situation, Background, Assessment, Recommendation — to the on-call VP.' },
          { id: 'bl_slide',   label: 'Prepare status slide',      dcHint: 12, detail: 'Produce a one-page visual summary of current status, what\'s contained, what\'s open, and next actions for leadership consumption.' },
          { id: 'bl_translate',label: 'Translate for non-technical',dcHint: 14, detail: 'Field technical questions from non-technical leadership and translate findings into business-impact language without losing accuracy.' },
          { id: 'bl_async',   label: 'Push async status update',  dcHint: 8,  detail: 'Push a written update through the agreed leadership channel without pulling key responders out of the response to attend a briefing.' },
        ],
      },
      {
        id: 'assign_resources', label: 'Assign Resources',
        description: 'Allocate team capacity and tooling to the highest-priority tasks',
        stat: 'command',
        subActions: [
          { id: 'ar_oncall',   label: 'Activate on-call tier',      dcHint: 8,  detail: 'Page the next tier of on-call coverage, brief them on current scope and priorities, and assign them to a specific track.' },
          { id: 'ar_retainer', label: 'Engage IR retainer firm',    dcHint: 12, detail: 'Initiate the call with the contracted IR firm, provide scope and current evidence, and get them stood up with access.' },
          { id: 'ar_redirect', label: 'Redirect from lower-priority',dcHint: 12, detail: 'Make the call to deprioritize a secondary work thread and redirect that capacity to the critical path — and communicate why.' },
          { id: 'ar_unblock',  label: 'Identify and clear blocker', dcHint: 14, detail: 'Diagnose why a key action is stalled — access issue, approval chain, tooling gap — and apply authority to clear it this turn.' },
        ],
      },
      {
        id: 'declare_incident', label: 'Declare Incident',
        description: 'Formally invoke the incident response plan and crisis procedures',
        stat: 'fortitude',
        subActions: [
          { id: 'di_invoke',   label: 'Invoke IR plan',              dcHint: 10, detail: 'Trigger formal IR plan activation, notify all required parties on the contact list, and open the incident management ticket.' },
          { id: 'di_warroom',  label: 'Stand up war room',           dcHint: 12, detail: 'Activate the incident bridge, assign functional roles, confirm attendance from all required functions, and set the cadence.' },
          { id: 'di_regclock', label: 'Start regulatory clock',      dcHint: 14, detail: 'Identify applicable notification requirements — GDPR 72hr, SEC 4-day — document the trigger time, and assign the notification owner.' },
          { id: 'di_voluntary',label: 'Recommend voluntary notif.',  dcHint: 16, detail: 'Make the case to legal and leadership for a voluntary customer notification ahead of the regulatory requirement window.' },
        ],
      },
    ],
    secondary: [
      { id: 'track_progress',     label: 'Track Progress',      description: 'Monitor team status, blockers, and response timeline',     stat: 'vigilance', subActions: [] },
      { id: 'communicate_status', label: 'Communicate Status',  description: 'Push a status update to stakeholders or a war-room channel', stat: 'command',   subActions: [] },
    ],
  },

}
