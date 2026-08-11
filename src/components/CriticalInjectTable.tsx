// Full inline CRUD editor for a list of CriticalInjectEntry objects. Originally
// built for CampaignBuilder's per-scenario authoring; scenarios now reference
// catalog entries by id (see CriticalInjectIdPicker) instead of embedding them,
// so this component's only remaining use is the admin injects-catalog editor
// (src/pages/AdminInjectsCatalog.tsx), editing standalone catalog entries.
import type { CriticalInjectEntry } from '../types/game'
import type { NPCRole } from '../types/npc'
import { NPC_PROFILES } from '../types/npc'
import { Field, SectionTitle, IconBtn, inputCls } from './formAtoms'

export function CriticalInjectTable({
  heading, itemLabel, entries, npcRoles, onSet, onAdd, onDel,
}: {
  heading:   string
  itemLabel: string
  entries:   CriticalInjectEntry[]
  npcRoles:  NPCRole[]
  onSet: (i: number, updates: Partial<CriticalInjectEntry>) => void
  onAdd: () => void
  onDel: (i: number) => void
}) {
  return (
    <div>
      <SectionTitle>{heading}</SectionTitle>
      <div className="space-y-3">
        {entries.map((entry, i) => {
          const npcEffect = entry.npcEffect
          const tempEffect = entry.temporaryEffect
          return (
            <div key={entry.id} className="rounded border border-terminal-border bg-terminal-surface/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-terminal-dim tracking-widest">{itemLabel.toUpperCase()} {i + 1}</span>
                <IconBtn onClick={() => onDel(i)} danger>Remove</IconBtn>
              </div>

              <Field label="Description">
                <textarea className={`${inputCls} h-16 resize-none`} value={entry.description}
                  onChange={(e) => onSet(i, { description: e.target.value })}
                  placeholder="What happens when this is drawn?" />
              </Field>

              <label className="flex items-center gap-2 text-xs text-gray-300">
                <input type="checkbox" checked={!!entry.advanceKillChainStage}
                  onChange={(e) => onSet(i, { advanceKillChainStage: e.target.checked || undefined })} />
                Advance attacker one kill-chain stage
              </label>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Add Complication (optional)">
                  <input className={inputCls} value={entry.complicationsAdded?.[0] ?? ''}
                    onChange={(e) => onSet(i, { complicationsAdded: e.target.value ? [e.target.value] : undefined })}
                    placeholder="e.g. backup_infra_unstable" />
                </Field>
                <Field label="Remove Complication (optional)">
                  <input className={inputCls} value={entry.complicationsRemoved?.[0] ?? ''}
                    onChange={(e) => onSet(i, { complicationsRemoved: e.target.value ? [e.target.value] : undefined })}
                    placeholder="e.g. backup_infra_unstable" />
                </Field>
              </div>

              <label className="flex items-center gap-2 text-xs text-gray-300">
                <input type="checkbox" checked={!!npcEffect}
                  onChange={(e) => onSet(i, {
                    npcEffect: e.target.checked ? { role: npcRoles[0], trustDelta: 0 } : undefined,
                  })} />
                Involves an NPC
              </label>
              {npcEffect && (
                <div className="grid grid-cols-2 gap-3 pl-5 border-l border-terminal-border/50">
                  <Field label="NPC">
                    {npcRoles.length === 0 ? (
                      <div className={`${inputCls} text-terminal-dim`}>— none cast —</div>
                    ) : (
                      <select className={inputCls} value={npcEffect.role}
                        onChange={(e) => onSet(i, { npcEffect: { ...npcEffect, role: e.target.value as NPCRole } })}>
                        {npcRoles.map((role) => (
                          <option key={role} value={role}>{NPC_PROFILES.find((p) => p.role === role)?.title ?? role}</option>
                        ))}
                      </select>
                    )}
                  </Field>
                  <Field label="Trust Delta">
                    <input type="number" className={inputCls} value={npcEffect.trustDelta}
                      onChange={(e) => onSet(i, { npcEffect: { ...npcEffect, trustDelta: Number(e.target.value) } })} />
                  </Field>
                  <Field label="New Fact They Learn (optional)">
                    <input className={inputCls} value={npcEffect.awarenessAdded?.[0] ?? ''}
                      onChange={(e) => onSet(i, {
                        npcEffect: { ...npcEffect, awarenessAdded: e.target.value ? [e.target.value] : undefined },
                      })} />
                  </Field>
                  <label className="flex items-center gap-2 text-xs text-gray-300 self-end pb-2">
                    <input type="checkbox" checked={!!npcEffect.forceIntroduced}
                      onChange={(e) => onSet(i, {
                        npcEffect: { ...npcEffect, forceIntroduced: e.target.checked || undefined },
                      })} />
                    Force Introduced
                  </label>
                </div>
              )}

              <label className="flex items-center gap-2 text-xs text-gray-300">
                <input type="checkbox" checked={!!tempEffect}
                  onChange={(e) => onSet(i, {
                    temporaryEffect: e.target.checked ? { description: '', durationRounds: 1 } : undefined,
                  })} />
                Grants a temporary effect
              </label>
              {tempEffect && (
                <div className="grid grid-cols-3 gap-3 pl-5 border-l border-terminal-border/50">
                  <div className="col-span-2">
                    <Field label="Effect Description">
                      <input className={inputCls} value={tempEffect.description}
                        onChange={(e) => onSet(i, { temporaryEffect: { ...tempEffect, description: e.target.value } })}
                        placeholder="An outside consultant is available this round" />
                    </Field>
                  </div>
                  <Field label="Lasts (rounds)">
                    <input type="number" min={1} max={10} className={inputCls} value={tempEffect.durationRounds}
                      onChange={(e) => onSet(i, {
                        temporaryEffect: { ...tempEffect, durationRounds: Number(e.target.value) },
                      })} />
                  </Field>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <button type="button" onClick={onAdd}
        className="mt-3 text-xs text-terminal-green hover:text-white border border-dashed border-terminal-green/30
          hover:border-terminal-green px-3 py-1.5 rounded w-full transition-colors">
        + Add {itemLabel}
      </button>
    </div>
  )
}
