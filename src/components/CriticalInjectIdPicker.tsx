// Scenario-side authoring UI for the global injects catalog: pick which
// catalog entries a scenario draws from on a natural 20/1, rather than
// authoring full entries inline (that now happens once, centrally, in the
// admin injects-catalog editor — see CriticalInjectTable/AdminInjectsCatalog).
import { useInjectsCatalogStore } from '../store/injectsCatalogStore'
import type { NPCRole } from '../types/npc'
import { NPC_PROFILES } from '../types/npc'
import { SectionTitle } from './formAtoms'

export function CriticalInjectIdPicker({
  heading, kind, selectedIds, npcRoles, onToggle,
}: {
  heading:     string
  kind:        'critical_hit' | 'critical_fail'
  selectedIds: string[]
  npcRoles:    NPCRole[]
  onToggle:    (id: string) => void
}) {
  const catalog = useInjectsCatalogStore((s) => s.entries).filter((e) => e.kind === kind)

  return (
    <div>
      <SectionTitle>{heading}</SectionTitle>
      {catalog.length === 0 ? (
        <div className="text-xs text-terminal-dim italic">
          No catalog entries of this kind yet — add some under Admin &gt; Injects Catalog.
        </div>
      ) : (
        <div className="space-y-2">
          {catalog.map((entry) => {
            const checked = selectedIds.includes(entry.id)
            const npcTitle = entry.npcEffect
              ? NPC_PROFILES.find((p) => p.role === entry.npcEffect!.role)?.title ?? entry.npcEffect.role
              : null
            const npcWarning = entry.npcEffect && !npcRoles.includes(entry.npcEffect.role)
            return (
              <label key={entry.id}
                className="flex items-start gap-2 rounded border border-terminal-border bg-terminal-surface/50 p-3 cursor-pointer">
                <input type="checkbox" checked={checked} onChange={() => onToggle(entry.id)} className="mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-300">{entry.description}</div>
                  {npcTitle && (
                    <div className={`text-[10px] mt-1 ${npcWarning ? 'text-terminal-red' : 'text-terminal-dim'}`}>
                      {npcWarning ? '⚠ ' : ''}Involves {npcTitle}
                      {npcWarning ? ' — not cast into this scenario' : ''}
                    </div>
                  )}
                </div>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
