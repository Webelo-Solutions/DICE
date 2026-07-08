import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCampaignStore } from '../store/campaignStore'
import { useGameStore }     from '../store/gameStore'
import { ALL_SCENARIOS }    from '../data/scenarios'
import type { ScenarioPack, ScenarioAct, Inject, Clue } from '../types/game'
import type { Campaign, CustomScenario } from '../types/campaign'
import type { OrgProfile } from '../types/orgProfile'
import { INITIAL_ORG_PROFILE, ORG_PROFILE_CHOICES } from '../types/orgProfile'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return crypto.randomUUID() }

const DIFF_LABEL = ['', 'Novice', 'Analyst', 'Senior', 'Expert', 'Elite']
const DIFF_COLOR = ['', 'text-terminal-green', 'text-terminal-blue', 'text-terminal-amber', 'text-orange-400', 'text-terminal-red']

const STATUS_LABEL: Record<Campaign['status'], string> = {
  draft:     'Draft',
  active:    'Active',
  completed: 'Completed',
  abandoned: 'Abandoned',
}
const STATUS_COLOR: Record<Campaign['status'], string> = {
  draft:     'text-terminal-dim',
  active:    'text-terminal-green',
  completed: 'text-terminal-blue',
  abandoned: 'text-terminal-red',
}

function blankAct(n: number): ScenarioAct {
  return { number: n, seed: '', primaryObjective: '', clues: [], bossEvent: null, injectIds: [] }
}

function blankInject(): Inject {
  return { id: uid(), act: 1, trigger: 'discretion', description: '', mechanicalEffect: '' }
}

function blankScenario(): CustomScenario {
  const now = Date.now()
  return {
    id:                 'CUSTOM-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
    title:              '',
    threatType:         '',
    difficulty:         2,
    recommendedPlayers: '2–4',
    estimatedMinutes:   60,
    scenarioClockStart: 90,
    summary:            '',
    victoryCondition:   '',
    failureCondition:   '',
    killChainStages:    ['initial_access', 'execution', 'persistence', 'exfiltration', 'impact'],
    acts:               [blankAct(1), blankAct(2), blankAct(3)],
    injects:            [],
    isCustom:           true,
    createdAt:          now,
    updatedAt:          now,
  }
}

function blankCampaign(): Campaign {
  const now = Date.now()
  return {
    id:                   uid(),
    name:                 '',
    description:          '',
    scenarioSequence:     [],
    characterIds:         [],
    status:               'draft',
    currentScenarioIndex: 0,
    completedScenarioIds: [],
    notes:                '',
    orgProfile:           { ...INITIAL_ORG_PROFILE },
    createdAt:            now,
    updatedAt:            now,
  }
}

// ─── Org Profile field grouping for the editor UI ─────────────────────────────

const ORG_PROFILE_GROUPS: Array<{ title: string; fields: Array<{ key: keyof Omit<OrgProfile, 'notes'>; label: string; placeholder: string }> }> = [
  {
    title: 'Detection & Response',
    fields: [
      { key: 'siem',        label: 'SIEM',          placeholder: 'Microsoft Sentinel' },
      { key: 'edr',         label: 'EDR',           placeholder: 'Defender for Endpoint' },
      { key: 'soar',        label: 'SOAR',          placeholder: 'Tines / leave blank if none' },
      { key: 'threatIntel', label: 'Threat Intel',  placeholder: 'Recorded Future / blank if none' },
    ],
  },
  {
    title: 'Identity & Access',
    fields: [
      { key: 'identity', label: 'Identity Provider', placeholder: 'Entra ID + AD' },
      { key: 'mfa',      label: 'MFA',               placeholder: 'Microsoft Authenticator' },
    ],
  },
  {
    title: 'Network & Email',
    fields: [
      { key: 'network', label: 'Network / NGFW', placeholder: 'Palo Alto' },
      { key: 'email',   label: 'Email Security', placeholder: 'M365 + Defender for Office' },
    ],
  },
  {
    title: 'Endpoint & Cloud',
    fields: [
      { key: 'configMgmt',    label: 'Config Mgmt',   placeholder: 'Intune' },
      { key: 'vulnMgmt',      label: 'Vuln Mgmt',     placeholder: 'Tenable / blank if none' },
      { key: 'cloudProvider', label: 'Cloud Posture', placeholder: 'Azure-primary' },
      { key: 'forensics',     label: 'Forensics',     placeholder: 'Velociraptor' },
    ],
  },
  {
    title: 'Process',
    fields: [
      { key: 'ticketing', label: 'Ticketing / Paging', placeholder: 'ServiceNow' },
    ],
  },
]

// ─── Shared UI atoms ──────────────────────────────────────────────────────────

const inputCls = `w-full bg-transparent border border-terminal-border focus:border-terminal-green
  text-white text-sm px-3 py-2 rounded focus:outline-none placeholder-terminal-dim transition-colors`

const labelCls = 'text-[10px] text-terminal-dim tracking-widest uppercase mb-1 block'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-xs font-bold text-terminal-green tracking-widest uppercase">{children}</span>
      <div className="flex-1 h-px bg-terminal-border" />
    </div>
  )
}

function IconBtn({
  onClick, title, children, danger, disabled,
}: { onClick: () => void; title?: string; children: React.ReactNode; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`px-1.5 py-0.5 rounded border text-[11px] transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        danger
          ? 'border-terminal-red/30 text-terminal-red/60 hover:text-terminal-red hover:border-terminal-red/60'
          : 'border-terminal-border text-terminal-dim hover:text-white hover:border-terminal-dim'
      }`}
    >
      {children}
    </button>
  )
}

// ─── Scenario Editor Form ────────────────────────────────────────────────────

interface SEProps {
  initial:   CustomScenario
  onSave:    (s: CustomScenario) => void
  onDelete?: () => void
  isNew:     boolean
}

function ScenarioEditorForm({ initial, onSave, onDelete, isNew }: SEProps) {
  const [sc, setSc] = useState<CustomScenario>(initial)

  // Reset form when a different scenario is selected
  useEffect(() => { setSc(initial) }, [initial.id])

  const setField = <K extends keyof CustomScenario>(k: K, v: CustomScenario[K]) =>
    setSc((s) => ({ ...s, [k]: v }))

  // ── Kill chain helpers ──
  const setStage = (i: number, val: string) =>
    setField('killChainStages', sc.killChainStages.map((s, idx) => idx === i ? val : s))
  const addStage  = () => setField('killChainStages', [...sc.killChainStages, ''])
  const delStage  = (i: number) => setField('killChainStages', sc.killChainStages.filter((_, idx) => idx !== i))
  const moveStage = (i: number, dir: -1 | 1) => {
    const arr = [...sc.killChainStages]
    ;[arr[i], arr[i + dir]] = [arr[i + dir], arr[i]]
    setField('killChainStages', arr)
  }

  // ── Act helpers ──
  const setAct = (i: number, updates: Partial<ScenarioAct>) =>
    setField('acts', sc.acts.map((a, idx) => idx === i ? { ...a, ...updates } : a))
  const addAct = () =>
    setField('acts', [...sc.acts, blankAct(sc.acts.length + 1)])
  const delAct = (i: number) =>
    setField('acts', sc.acts.filter((_, idx) => idx !== i).map((a, idx) => ({ ...a, number: idx + 1 })))
  const setClueText = (actIdx: number, clueIdx: number, text: string) =>
    setAct(actIdx, { clues: sc.acts[actIdx].clues.map((c, ci) => ci === clueIdx ? { ...c, text } : c) })
  const setClueId = (actIdx: number, clueIdx: number, techniqueId: string, techniqueName: string) =>
    setAct(actIdx, { clues: sc.acts[actIdx].clues.map((c, ci) =>
      ci === clueIdx ? { ...c, techniqueId: techniqueId || undefined, techniqueName: techniqueName || undefined } : c
    ) })
  const addClue = (actIdx: number) =>
    setAct(actIdx, { clues: [...sc.acts[actIdx].clues, { text: '' } as Clue] })
  const delClue = (actIdx: number, clueIdx: number) =>
    setAct(actIdx, { clues: sc.acts[actIdx].clues.filter((_, ci) => ci !== clueIdx) })

  // ── Inject helpers ──
  const setInject = (i: number, updates: Partial<Inject>) =>
    setField('injects', sc.injects.map((inj, idx) => idx === i ? { ...inj, ...updates } : inj))
  const addInject = () => setField('injects', [...sc.injects, blankInject()])
  const delInject = (i: number) => setField('injects', sc.injects.filter((_, idx) => idx !== i))

  const handleSave = () => onSave({ ...sc, updatedAt: Date.now() })

  return (
    <div className="space-y-8 pb-10">
      {/* ── Basic Info ── */}
      <div>
        <SectionTitle>Basic Info</SectionTitle>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Field label="Scenario ID">
            <input className={inputCls} value={sc.id}
              onChange={(e) => setField('id', e.target.value.toUpperCase())} placeholder="CUSTOM-01" />
          </Field>
          <Field label="Title">
            <input className={inputCls} value={sc.title}
              onChange={(e) => setField('title', e.target.value)} placeholder="Operation Darkfall" />
          </Field>
          <Field label="Threat Type">
            <input className={inputCls} value={sc.threatType}
              onChange={(e) => setField('threatType', e.target.value)} placeholder="Ransomware / APT / Insider…" />
          </Field>
          <Field label="Difficulty">
            <select className={inputCls} value={sc.difficulty}
              onChange={(e) => setField('difficulty', Number(e.target.value) as 1|2|3|4|5)}>
              {([1,2,3,4,5] as const).map((d) => (
                <option key={d} value={d}>{d} — {DIFF_LABEL[d]}</option>
              ))}
            </select>
          </Field>
          <Field label="Recommended Players">
            <input className={inputCls} value={sc.recommendedPlayers}
              onChange={(e) => setField('recommendedPlayers', e.target.value)} placeholder="2–4" />
          </Field>
          <Field label="Est. Duration (min)">
            <input className={inputCls} type="number" min={15} max={300} value={sc.estimatedMinutes}
              onChange={(e) => setField('estimatedMinutes', Number(e.target.value))} />
          </Field>
          <Field label="Scenario Clock Start (min)">
            <input className={inputCls} type="number" min={30} max={480} value={sc.scenarioClockStart}
              onChange={(e) => setField('scenarioClockStart', Number(e.target.value))} />
          </Field>
        </div>

        <div className="space-y-3">
          <Field label="Summary">
            <textarea className={`${inputCls} h-20 resize-none`} value={sc.summary}
              onChange={(e) => setField('summary', e.target.value)}
              placeholder="Brief description of the incident and starting conditions…" />
          </Field>
          <Field label="Victory Condition">
            <textarea className={`${inputCls} h-16 resize-none`} value={sc.victoryCondition}
              onChange={(e) => setField('victoryCondition', e.target.value)}
              placeholder="What must the team accomplish to win?" />
          </Field>
          <Field label="Failure Condition">
            <textarea className={`${inputCls} h-16 resize-none`} value={sc.failureCondition}
              onChange={(e) => setField('failureCondition', e.target.value)}
              placeholder="What triggers a defeat?" />
          </Field>
        </div>
      </div>

      {/* ── Kill Chain ── */}
      <div>
        <SectionTitle>Kill Chain Stages</SectionTitle>
        <div className="space-y-2">
          {sc.killChainStages.map((stage, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[10px] text-terminal-dim w-5 text-right flex-shrink-0">{i + 1}</span>
              <input className={`${inputCls} flex-1`} value={stage}
                onChange={(e) => setStage(i, e.target.value)}
                placeholder="stage_name" />
              <IconBtn onClick={() => moveStage(i, -1)} title="Move up"   disabled={i === 0}>↑</IconBtn>
              <IconBtn onClick={() => moveStage(i,  1)} title="Move down" disabled={i === sc.killChainStages.length - 1}>↓</IconBtn>
              <IconBtn onClick={() => delStage(i)} danger title="Remove">✕</IconBtn>
            </div>
          ))}
        </div>
        <button type="button" onClick={addStage}
          className="mt-3 text-xs text-terminal-green hover:text-white border border-dashed border-terminal-green/30
            hover:border-terminal-green px-3 py-1.5 rounded w-full transition-colors">
          + Add Stage
        </button>
      </div>

      {/* ── Acts ── */}
      <div>
        <SectionTitle>Acts</SectionTitle>
        <div className="space-y-4">
          {sc.acts.map((act, ai) => (
            <div key={ai} className="rounded border border-terminal-border bg-terminal-surface/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-terminal-amber tracking-widest">ACT {act.number}</span>
                {sc.acts.length > 1 && (
                  <IconBtn onClick={() => delAct(ai)} danger title="Remove act">Remove Act</IconBtn>
                )}
              </div>

              <Field label="Primary Objective">
                <textarea className={`${inputCls} h-14 resize-none`} value={act.primaryObjective}
                  onChange={(e) => setAct(ai, { primaryObjective: e.target.value })}
                  placeholder="What must the team accomplish in this act?" />
              </Field>

              <Field label="Boss Event (optional)">
                <input className={inputCls} value={act.bossEvent ?? ''}
                  onChange={(e) => setAct(ai, { bossEvent: e.target.value || null })}
                  placeholder="Major escalation that happens at end of act…" />
              </Field>

              <div>
                <label className={labelCls}>Intelligence Clues</label>
                <div className="space-y-2">
                  {act.clues.map((clue, ci) => (
                    <div key={ci} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <input className={`${inputCls} flex-1`} value={clue.text}
                          onChange={(e) => setClueText(ai, ci, e.target.value)}
                          placeholder="Clue or intel available to players…" />
                        <IconBtn onClick={() => delClue(ai, ci)} danger>✕</IconBtn>
                      </div>
                      <div className="flex items-center gap-1.5 pl-0.5">
                        <input
                          className="bg-terminal-bg border border-terminal-border/50 rounded px-2 py-0.5
                            text-[10px] text-terminal-blue font-mono w-24 focus:outline-none
                            focus:border-terminal-blue/50 placeholder-terminal-dim/30"
                          value={clue.techniqueId ?? ''}
                          onChange={(e) => setClueId(ai, ci, e.target.value, clue.techniqueName ?? '')}
                          placeholder="T1059.001"
                        />
                        <input
                          className="bg-terminal-bg border border-terminal-border/50 rounded px-2 py-0.5
                            text-[10px] text-terminal-dim font-mono flex-1 focus:outline-none
                            focus:border-terminal-border placeholder-terminal-dim/30"
                          value={clue.techniqueName ?? ''}
                          onChange={(e) => setClueId(ai, ci, clue.techniqueId ?? '', e.target.value)}
                          placeholder="Technique name (optional)"
                        />
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => addClue(ai)}
                    className="text-[11px] text-terminal-dim hover:text-terminal-green transition-colors">
                    + Add clue
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={addAct}
          className="mt-3 text-xs text-terminal-green hover:text-white border border-dashed border-terminal-green/30
            hover:border-terminal-green px-3 py-1.5 rounded w-full transition-colors">
          + Add Act
        </button>
      </div>

      {/* ── Injects ── */}
      <div>
        <SectionTitle>Threat Injects</SectionTitle>
        <div className="space-y-3">
          {sc.injects.map((inj, ii) => (
            <div key={ii} className="rounded border border-terminal-border bg-terminal-surface/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-terminal-dim tracking-widest">INJECT {ii + 1}</span>
                <IconBtn onClick={() => delInject(ii)} danger>Remove</IconBtn>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Act">
                  <select className={inputCls} value={inj.act}
                    onChange={(e) => setInject(ii, { act: Number(e.target.value) })}>
                    {sc.acts.map((a) => <option key={a.number} value={a.number}>Act {a.number}</option>)}
                  </select>
                </Field>
                <Field label="Trigger">
                  <select className={inputCls} value={inj.trigger}
                    onChange={(e) => setInject(ii, { trigger: e.target.value as Inject['trigger'] })}>
                    <option value="mandatory">Mandatory</option>
                    <option value="discretion">DM Discretion</option>
                  </select>
                </Field>
              </div>
              <Field label="Description">
                <textarea className={`${inputCls} h-16 resize-none`} value={inj.description}
                  onChange={(e) => setInject(ii, { description: e.target.value })}
                  placeholder="What happens? Describe the inject event…" />
              </Field>
              <Field label="Mechanical Effect">
                <input className={inputCls} value={inj.mechanicalEffect}
                  onChange={(e) => setInject(ii, { mechanicalEffect: e.target.value })}
                  placeholder="e.g. All rolls this round at DC +3, or clock -15 min" />
              </Field>
            </div>
          ))}
        </div>
        <button type="button" onClick={addInject}
          className="mt-3 text-xs text-terminal-green hover:text-white border border-dashed border-terminal-green/30
            hover:border-terminal-green px-3 py-1.5 rounded w-full transition-colors">
          + Add Inject
        </button>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center gap-3 pt-2 border-t border-terminal-border">
        <button type="button" onClick={handleSave}
          className="flex-1 py-2.5 rounded border border-terminal-green bg-terminal-green/10
            text-terminal-green text-sm font-bold tracking-widest hover:bg-terminal-green/20 transition-colors">
          {isNew ? 'Save Scenario' : 'Save Changes'}
        </button>
        {!isNew && onDelete && (
          <button type="button" onClick={onDelete}
            className="px-4 py-2.5 rounded border border-terminal-red/30 text-terminal-red/70
              text-sm hover:border-terminal-red hover:text-terminal-red transition-colors">
            Delete
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Campaign Editor Form ────────────────────────────────────────────────────

interface CEProps {
  initial:   Campaign
  onSave:    (c: Campaign) => void
  onDelete?: () => void
  onPlay:    (c: Campaign) => void
  isNew:     boolean
}

function CampaignEditorForm({ initial, onSave, onDelete, onPlay, isNew }: CEProps) {
  const [camp, setCamp] = useState<Campaign>(initial)
  const [orgProfileOpen, setOrgProfileOpen] = useState(false)
  const roster          = useGameStore((s) => s.roster)
  const { customScenarios } = useCampaignStore()
  const allScenarios    = [...ALL_SCENARIOS, ...customScenarios]

  useEffect(() => { setCamp(initial) }, [initial.id])

  const setField = <K extends keyof Campaign>(k: K, v: Campaign[K]) =>
    setCamp((c) => ({ ...c, [k]: v }))

  const orgProfile = camp.orgProfile ?? INITIAL_ORG_PROFILE
  const setOrgProfileField = (key: keyof OrgProfile, value: string) =>
    setField('orgProfile', { ...orgProfile, [key]: value })
  const orgProfileFilledCount = Object.entries(orgProfile)
    .filter(([k, v]) => k !== 'notes' && typeof v === 'string' && v.trim().length > 0).length

  const toggleScenario = (id: string) => {
    const seq = camp.scenarioSequence
    if (seq.includes(id)) {
      setField('scenarioSequence', seq.filter((s) => s !== id))
    } else {
      setField('scenarioSequence', [...seq, id])
    }
  }

  const moveScenario = (i: number, dir: -1 | 1) => {
    const arr = [...camp.scenarioSequence]
    ;[arr[i], arr[i + dir]] = [arr[i + dir], arr[i]]
    setField('scenarioSequence', arr)
  }

  const toggleCharacter = (id: string) => {
    const ids = camp.characterIds
    setField('characterIds', ids.includes(id) ? ids.filter((c) => c !== id) : [...ids, id])
  }

  const handleSave = () => onSave({ ...camp, updatedAt: Date.now() })

  const nextScenario = allScenarios.find((s) => s.id === camp.scenarioSequence[camp.currentScenarioIndex])
  const canPlay = camp.scenarioSequence.length > 0 && camp.status !== 'completed' && camp.status !== 'abandoned'

  return (
    <div className="space-y-8 pb-10">
      {/* ── Progress banner (existing campaigns) ── */}
      {!isNew && camp.scenarioSequence.length > 0 && (
        <div className="rounded border border-terminal-border bg-terminal-surface/60 p-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] text-terminal-dim tracking-widest uppercase mb-0.5">Campaign Progress</div>
            <div className="text-sm font-semibold text-white">
              Scenario {Math.min(camp.currentScenarioIndex + 1, camp.scenarioSequence.length)} of {camp.scenarioSequence.length}
            </div>
            {nextScenario && (
              <div className="text-xs text-terminal-dim mt-0.5">Next: {nextScenario.title}</div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-bold ${STATUS_COLOR[camp.status]}`}>
              {STATUS_LABEL[camp.status]}
            </span>
            {canPlay && (
              <button onClick={() => onPlay(camp)}
                className="px-4 py-2 rounded border border-terminal-green bg-terminal-green/10
                  text-terminal-green text-xs font-bold tracking-widest hover:bg-terminal-green/20 transition-colors">
                ▶ Play Next
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Basic Info ── */}
      <div>
        <SectionTitle>Campaign Info</SectionTitle>
        <div className="space-y-4">
          <Field label="Campaign Name">
            <input className={inputCls} value={camp.name}
              onChange={(e) => setField('name', e.target.value)} placeholder="Operation Blackout Arc" />
          </Field>
          <Field label="Description">
            <textarea className={`${inputCls} h-20 resize-none`} value={camp.description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="Narrative premise — what ties these scenarios together?" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Status">
              <select className={inputCls} value={camp.status}
                onChange={(e) => setField('status', e.target.value as Campaign['status'])}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="abandoned">Abandoned</option>
              </select>
            </Field>
          </div>
          <Field label="Facilitator Notes">
            <textarea className={`${inputCls} h-16 resize-none`} value={camp.notes}
              onChange={(e) => setField('notes', e.target.value)}
              placeholder="Private notes for the facilitator…" />
          </Field>
        </div>
      </div>

      {/* ── Organizational Profile ── */}
      <div>
        <button
          type="button"
          onClick={() => setOrgProfileOpen((v) => !v)}
          className="w-full flex items-center gap-3 mb-4 group"
        >
          <span className="text-xs font-bold text-terminal-green tracking-widest uppercase">
            Organizational Profile
          </span>
          <span className="text-[10px] text-terminal-dim">
            {orgProfileFilledCount > 0
              ? `${orgProfileFilledCount} of ${ORG_PROFILE_GROUPS.reduce((n, g) => n + g.fields.length, 0)} set`
              : 'unconfigured — DM will use generic defaults'}
          </span>
          <div className="flex-1 h-px bg-terminal-border" />
          <span className="text-terminal-dim group-hover:text-white transition-colors text-xs">
            {orgProfileOpen ? '▾' : '▸'}
          </span>
        </button>

        {orgProfileOpen && (
          <div className="space-y-5">
            <p className="text-[11px] text-terminal-dim leading-relaxed">
              Name the tools this team actually uses. The DM will narrate inside this stack and avoid
              referencing tools you don't own. Leave a field blank to signal a capability gap — the DM
              will narrate it as a manual workaround.
            </p>

            {ORG_PROFILE_GROUPS.map((group) => (
              <div key={group.title}>
                <div className="text-[10px] text-terminal-amber/80 tracking-widest uppercase mb-2">
                  {group.title}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {group.fields.map(({ key, label, placeholder }) => {
                    const datalistId = `orgprofile-${key}`
                    return (
                      <Field key={key} label={label}>
                        <input
                          className={inputCls}
                          value={orgProfile[key]}
                          list={datalistId}
                          onChange={(e) => setOrgProfileField(key, e.target.value)}
                          placeholder={placeholder}
                        />
                        <datalist id={datalistId}>
                          {ORG_PROFILE_CHOICES[key].map((opt) => (
                            <option key={opt} value={opt} />
                          ))}
                        </datalist>
                      </Field>
                    )
                  })}
                </div>
              </div>
            ))}

            <Field label="Notes (compliance regime, hybrid quirks, known gaps)">
              <textarea
                className={`${inputCls} h-20 resize-none`}
                value={orgProfile.notes}
                onChange={(e) => setOrgProfileField('notes', e.target.value)}
                placeholder="e.g., HIPAA-regulated; AD trust to legacy domain; no DLP in place"
              />
            </Field>
          </div>
        )}
      </div>

      {/* ── Scenario Sequence ── */}
      <div>
        <SectionTitle>Scenario Sequence</SectionTitle>

        {/* Ordered list of selected scenarios */}
        {camp.scenarioSequence.length > 0 && (
          <div className="space-y-2 mb-4">
            {camp.scenarioSequence.map((id, i) => {
              const sc = allScenarios.find((s) => s.id === id)
              if (!sc) return null
              const isDone = camp.completedScenarioIds.includes(id)
              const isCurrent = i === camp.currentScenarioIndex && !isDone
              return (
                <div key={id}
                  className={`flex items-center gap-3 px-3 py-2 rounded border ${
                    isCurrent ? 'border-terminal-green/40 bg-terminal-green/5'
                    : isDone  ? 'border-terminal-border bg-terminal-muted/20 opacity-60'
                    : 'border-terminal-border bg-terminal-surface/40'
                  }`}>
                  <span className="text-[10px] text-terminal-dim w-4 text-center flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{sc.title}</div>
                    <div className="text-[10px] text-terminal-dim">{sc.id} · {DIFF_LABEL[sc.difficulty]}</div>
                  </div>
                  {isDone  && <span className="text-[10px] text-terminal-blue">✓ Done</span>}
                  {isCurrent && <span className="text-[10px] text-terminal-green animate-pulse">▶ Next</span>}
                  <IconBtn onClick={() => moveScenario(i, -1)} title="Move up"   disabled={i === 0}>↑</IconBtn>
                  <IconBtn onClick={() => moveScenario(i,  1)} title="Move down" disabled={i === camp.scenarioSequence.length - 1}>↓</IconBtn>
                  <IconBtn onClick={() => toggleScenario(id)} danger title="Remove">✕</IconBtn>
                </div>
              )
            })}
          </div>
        )}

        {/* Scenario picker */}
        <div>
          <label className={labelCls}>Add Scenarios</label>
          <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
            {allScenarios
              .filter((s) => !camp.scenarioSequence.includes(s.id))
              .map((s) => (
                <button key={s.id} type="button" onClick={() => toggleScenario(s.id)}
                  className="w-full text-left flex items-center gap-3 px-3 py-2 rounded border
                    border-terminal-border hover:border-terminal-green/40 hover:bg-terminal-green/5
                    transition-colors group">
                  <span className="text-[10px] text-terminal-dim w-20 flex-shrink-0">{s.id}</span>
                  <span className="flex-1 text-xs text-white truncate">{s.title}</span>
                  <span className={`text-[10px] flex-shrink-0 ${DIFF_COLOR[s.difficulty]}`}>
                    {DIFF_LABEL[s.difficulty]}
                  </span>
                  <span className="text-[10px] text-terminal-green opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    + Add
                  </span>
                </button>
              ))}
          </div>
        </div>
      </div>

      {/* ── Roster Assignment ── */}
      {roster.length > 0 && (
        <div>
          <SectionTitle>Assigned Roster</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {roster.map((char) => {
              const assigned = camp.characterIds.includes(char.id)
              return (
                <button key={char.id} type="button" onClick={() => toggleCharacter(char.id)}
                  className={`flex items-center gap-3 px-3 py-2 rounded border text-left transition-colors ${
                    assigned
                      ? 'border-terminal-green/40 bg-terminal-green/5 text-white'
                      : 'border-terminal-border text-terminal-dim hover:border-terminal-dim'
                  }`}>
                  <span className={`text-[10px] font-bold w-3 flex-shrink-0 ${assigned ? 'text-terminal-green' : 'text-transparent'}`}>✓</span>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">{char.name}</div>
                    <div className="text-[10px] text-terminal-dim truncate">{char.class} · Lvl {char.level}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex items-center gap-3 pt-2 border-t border-terminal-border">
        <button type="button" onClick={handleSave}
          className="flex-1 py-2.5 rounded border border-terminal-green bg-terminal-green/10
            text-terminal-green text-sm font-bold tracking-widest hover:bg-terminal-green/20 transition-colors">
          {isNew ? 'Create Campaign' : 'Save Changes'}
        </button>
        {!isNew && onDelete && (
          <button type="button" onClick={onDelete}
            className="px-4 py-2.5 rounded border border-terminal-red/30 text-terminal-red/70
              text-sm hover:border-terminal-red hover:text-terminal-red transition-colors">
            Delete
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'campaigns' | 'scenarios'

export function CampaignBuilder() {
  const navigate = useNavigate()
  const {
    campaigns, customScenarios,
    addCampaign, updateCampaign, deleteCampaign,
    addCustomScenario, updateCustomScenario, deleteCustomScenario,
  } = useCampaignStore()

  const [tab,             setTab]             = useState<Tab>('campaigns')
  const [selectedCampId,  setSelectedCampId]  = useState<string | null>(null)
  const [selectedScId,    setSelectedScId]    = useState<string | null>(null)
  const [isNewCamp,       setIsNewCamp]       = useState(false)
  const [isNewSc,         setIsNewSc]         = useState(false)
  const [draftCampaign,   setDraftCampaign]   = useState<Campaign | null>(null)
  const [draftScenario,   setDraftScenario]   = useState<CustomScenario | null>(null)

  const activeCampaign = isNewCamp ? draftCampaign
    : campaigns.find((c) => c.id === selectedCampId) ?? null

  const activeScenario = isNewSc ? draftScenario
    : customScenarios.find((s) => s.id === selectedScId) ?? null

  // ── Campaign handlers ──
  const handleNewCampaign = () => {
    const blank = blankCampaign()
    setDraftCampaign(blank)
    setIsNewCamp(true)
    setSelectedCampId(null)
    setTab('campaigns')
  }

  const handleSaveCampaign = (c: Campaign) => {
    if (isNewCamp) {
      addCampaign(c)
      setIsNewCamp(false)
      setSelectedCampId(c.id)
      setDraftCampaign(null)
    } else {
      updateCampaign(c.id, c)
    }
  }

  const handleDeleteCampaign = () => {
    if (!selectedCampId) return
    deleteCampaign(selectedCampId)
    setSelectedCampId(null)
  }

  const handlePlayCampaign = (c: Campaign) => {
    const allScenarios = [...ALL_SCENARIOS, ...customScenarios]
    const sc = allScenarios.find((s) => s.id === c.scenarioSequence[c.currentScenarioIndex])
    if (!sc) return
    useGameStore.setState((s) => ({
      session: {
        id:                     'pending',
        scenario:               sc,
        players:                s.roster.filter((r) => c.characterIds.includes(r.id)),
        mode:                   c.characterIds.length > 1 ? 'team' : 'solo',
        initiativeOrder:        [],
        currentTurnPlayerId:    '',
        act:                    1,
        round:                  1,
        scenarioClockRemaining: sc.scenarioClockStart,
        attackerProgress:       [sc.killChainStages[0]],
        activeComplications:    [],
        lastRoll:               null,
        roundTimerExpired:      false,
        phase:                  'init',
        status:                 'setup',
        timerDifficulty:        'analyst',
        startedAt:              0,
        npcs:                   [],
      },
      activeOrgProfile: c.orgProfile ?? null,
    }))
    updateCampaign(c.id, { status: 'active' })
    navigate('/roster')
  }

  // ── Scenario handlers ──
  const handleNewScenario = () => {
    const blank = blankScenario()
    setDraftScenario(blank)
    setIsNewSc(true)
    setSelectedScId(null)
    setTab('scenarios')
  }

  const handleForkScenario = (sc: ScenarioPack) => {
    const now = Date.now()
    const forked: CustomScenario = {
      ...sc,
      id:        'CUSTOM-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
      title:     sc.title + ' (Custom)',
      isCustom:  true,
      createdAt: now,
      updatedAt: now,
    }
    setDraftScenario(forked)
    setIsNewSc(true)
    setSelectedScId(null)
    setTab('scenarios')
  }

  const handleSaveScenario = (s: CustomScenario) => {
    if (isNewSc) {
      addCustomScenario(s)
      setIsNewSc(false)
      setSelectedScId(s.id)
      setDraftScenario(null)
    } else {
      updateCustomScenario(s.id, s)
    }
  }

  const handleDeleteScenario = () => {
    if (!selectedScId) return
    deleteCustomScenario(selectedScId)
    setSelectedScId(null)
  }

  return (
    <div className="h-screen bg-terminal-bg font-mono flex flex-col overflow-hidden">
      {/* ── Top bar ── */}
      <div className="border-b border-terminal-border bg-terminal-surface px-6 py-3 flex items-center gap-6 flex-shrink-0">
        <button onClick={() => navigate('/')}
          className="text-xs text-terminal-dim hover:text-terminal-green transition-colors flex-shrink-0">
          ← Back
        </button>
        <div>
          <div className="text-sm font-bold text-white tracking-widest">CAMPAIGN BUILDER</div>
          <div className="text-[10px] text-terminal-dim">Design campaigns and custom scenarios</div>
        </div>

        {/* Tabs */}
        <div className="ml-auto flex border border-terminal-border rounded overflow-hidden">
          {(['campaigns', 'scenarios'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-xs font-semibold tracking-widest uppercase transition-colors ${
                tab === t
                  ? 'bg-terminal-green/10 text-terminal-green border-r border-terminal-border'
                  : 'text-terminal-dim hover:text-white'
              }`}>
              {t === 'campaigns' ? `Campaigns (${campaigns.length})` : `Scenarios (${customScenarios.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body: sidebar + editor ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left list panel ── */}
        <div className="w-64 flex-shrink-0 border-r border-terminal-border flex flex-col">
          {/* New button */}
          <div className="p-3 border-b border-terminal-border flex-shrink-0">
            {tab === 'campaigns' ? (
              <button onClick={handleNewCampaign}
                className="w-full py-2 rounded border border-dashed border-terminal-green/40
                  text-terminal-green text-xs font-bold tracking-widest hover:bg-terminal-green/5 transition-colors">
                + New Campaign
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={handleNewScenario}
                  className="flex-1 py-2 rounded border border-dashed border-terminal-green/40
                    text-terminal-green text-xs font-bold tracking-widest hover:bg-terminal-green/5 transition-colors">
                  + New
                </button>
                <button
                  onClick={() => {}}
                  title="Fork a built-in scenario to customize it"
                  className="px-2 py-2 rounded border border-terminal-border text-terminal-dim text-xs
                    hover:border-terminal-dim hover:text-white transition-colors relative group"
                >
                  Fork ↗
                  <div className="absolute left-0 top-full mt-1 w-48 bg-terminal-surface border border-terminal-border
                    rounded shadow-lg p-1 hidden group-focus-within:block z-20">
                    {ALL_SCENARIOS.map((s) => (
                      <button key={s.id} onClick={() => handleForkScenario(s)}
                        className="w-full text-left px-2 py-1.5 text-[10px] text-terminal-dim
                          hover:text-white hover:bg-terminal-green/5 rounded transition-colors">
                        {s.title}
                      </button>
                    ))}
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {tab === 'campaigns' && (
              <>
                {/* New (unsaved) draft at top */}
                {isNewCamp && (
                  <button
                    onClick={() => {}}
                    className="w-full text-left px-4 py-3 border-b border-terminal-border
                      bg-terminal-green/5 border-l-2 border-l-terminal-green">
                    <div className="text-xs font-semibold text-terminal-green">New Campaign</div>
                    <div className="text-[10px] text-terminal-dim">Unsaved</div>
                  </button>
                )}
                {campaigns.length === 0 && !isNewCamp && (
                  <div className="p-4 text-[11px] text-terminal-dim text-center mt-4">
                    No campaigns yet.<br/>Click "+ New Campaign" to start.
                  </div>
                )}
                {campaigns.map((c) => (
                  <button key={c.id}
                    onClick={() => { setSelectedCampId(c.id); setIsNewCamp(false) }}
                    className={`w-full text-left px-4 py-3 border-b border-terminal-border transition-colors
                      hover:bg-terminal-surface/60 ${
                      selectedCampId === c.id && !isNewCamp
                        ? 'bg-terminal-surface border-l-2 border-l-terminal-green'
                        : 'border-l-2 border-l-transparent'
                    }`}>
                    <div className="text-xs font-semibold text-white truncate">{c.name || 'Unnamed Campaign'}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] ${STATUS_COLOR[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                      <span className="text-[10px] text-terminal-dim">{c.scenarioSequence.length} scenarios</span>
                    </div>
                  </button>
                ))}
              </>
            )}

            {tab === 'scenarios' && (
              <>
                {isNewSc && (
                  <button className="w-full text-left px-4 py-3 border-b border-terminal-border
                    bg-terminal-green/5 border-l-2 border-l-terminal-green">
                    <div className="text-xs font-semibold text-terminal-green">New Scenario</div>
                    <div className="text-[10px] text-terminal-dim">Unsaved</div>
                  </button>
                )}

                {/* Built-in scenarios (read-only label) */}
                <div className="px-4 py-2 text-[9px] text-terminal-dim tracking-widest uppercase bg-terminal-muted/20 border-b border-terminal-border">
                  Built-in ({ALL_SCENARIOS.length})
                </div>
                {ALL_SCENARIOS.map((s) => (
                  <div key={s.id}
                    className="w-full text-left px-4 py-3 border-b border-terminal-border
                      border-l-2 border-l-transparent opacity-60">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white truncate flex-1">{s.title}</span>
                      <button onClick={() => handleForkScenario(s)}
                        className="text-[9px] text-terminal-green hover:underline flex-shrink-0">
                        Fork
                      </button>
                    </div>
                    <div className="text-[10px] text-terminal-dim">{s.id}</div>
                  </div>
                ))}

                {/* Custom scenarios */}
                {customScenarios.length > 0 && (
                  <div className="px-4 py-2 text-[9px] text-terminal-dim tracking-widest uppercase bg-terminal-muted/20 border-b border-terminal-border">
                    Custom ({customScenarios.length})
                  </div>
                )}
                {customScenarios.length === 0 && !isNewSc && (
                  <div className="p-4 text-[11px] text-terminal-dim text-center mt-2">
                    No custom scenarios.<br/>Click "+ New" or fork a built-in.
                  </div>
                )}
                {customScenarios.map((s) => (
                  <button key={s.id}
                    onClick={() => { setSelectedScId(s.id); setIsNewSc(false) }}
                    className={`w-full text-left px-4 py-3 border-b border-terminal-border transition-colors
                      hover:bg-terminal-surface/60 ${
                      selectedScId === s.id && !isNewSc
                        ? 'bg-terminal-surface border-l-2 border-l-terminal-green'
                        : 'border-l-2 border-l-transparent'
                    }`}>
                    <div className="text-xs font-semibold text-white truncate">{s.title || 'Untitled'}</div>
                    <div className="text-[10px] text-terminal-dim">{s.id}</div>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* ── Right editor panel ── */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'campaigns' && activeCampaign && (
            <CampaignEditorForm
              key={activeCampaign.id}
              initial={activeCampaign}
              isNew={isNewCamp}
              onSave={handleSaveCampaign}
              onDelete={isNewCamp ? undefined : handleDeleteCampaign}
              onPlay={handlePlayCampaign}
            />
          )}
          {tab === 'campaigns' && !activeCampaign && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <div className="text-4xl text-terminal-dim/30">◎</div>
              <div className="text-sm text-terminal-dim">Select a campaign or create a new one</div>
            </div>
          )}

          {tab === 'scenarios' && activeScenario && (
            <ScenarioEditorForm
              key={activeScenario.id}
              initial={activeScenario}
              isNew={isNewSc}
              onSave={handleSaveScenario}
              onDelete={isNewSc ? undefined : handleDeleteScenario}
            />
          )}
          {tab === 'scenarios' && !activeScenario && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="text-4xl text-terminal-dim/30">◈</div>
              <div className="space-y-1">
                <div className="text-sm text-terminal-dim">Select a custom scenario to edit</div>
                <div className="text-[11px] text-terminal-dim/60">or fork a built-in scenario as a starting point</div>
              </div>
              <div className="flex gap-3">
                <button onClick={handleNewScenario}
                  className="px-4 py-2 rounded border border-terminal-green/40 text-terminal-green
                    text-xs font-bold tracking-widest hover:bg-terminal-green/10 transition-colors">
                  + New Scenario
                </button>
                <button onClick={() => handleForkScenario(ALL_SCENARIOS[0])}
                  className="px-4 py-2 rounded border border-terminal-border text-terminal-dim
                    text-xs hover:border-terminal-dim hover:text-white transition-colors">
                  Fork Built-in
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
