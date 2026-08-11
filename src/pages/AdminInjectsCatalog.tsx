import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiAdmin } from '../api/admin'
import { refreshInjectsCatalog } from '../api/sync'
import type { CriticalInjectCatalogEntry } from '../types/game'
import { NPC_ROLES } from '../types/npc'
import { CriticalInjectTable } from '../components/CriticalInjectTable'

// /admin/injects-catalog — gated by RequireAdmin in App.tsx. Curates the
// global, install-wide critical-hit/fail inject entries (see
// server/db/schema.ts injectsCatalog). Scenarios reference these by id
// instead of embedding them (src/components/CriticalInjectIdPicker.tsx, used
// in CampaignBuilder/AdminScenarios) — edits here apply everywhere an entry
// is referenced, with no redeploy needed.
export function AdminInjectsCatalog() {
  const navigate = useNavigate()
  const [entries, setEntries] = useState<CriticalInjectCatalogEntry[]>([])
  // Ids that exist server-side as of the last load/save — distinguishes a
  // brand-new local-only entry (just drop it) from a persisted one (needs a
  // DELETE call) when the Remove button is clicked.
  const [persistedIds, setPersistedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const flash = (kind: 'success' | 'error', text: string) => {
    setMsg({ kind, text })
    setTimeout(() => setMsg((m) => (m?.text === text ? null : m)), 4000)
  }

  const load = async () => {
    setLoading(true)
    try {
      const fetched = await apiAdmin.listInjectsCatalog()
      setEntries(fetched)
      setPersistedIds(new Set(fetched.map((e) => e.id)))
    } catch (e) { flash('error', (e as Error).message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const hitEntries  = entries.filter((e) => e.kind === 'critical_hit')
  const failEntries = entries.filter((e) => e.kind === 'critical_fail')

  const setEntry = (kind: CriticalInjectCatalogEntry['kind'], i: number, updates: Partial<CriticalInjectCatalogEntry>) => {
    const target = (kind === 'critical_hit' ? hitEntries : failEntries)[i]
    setEntries((all) => all.map((e) => e.id === target.id ? { ...e, ...updates } : e))
  }
  const addEntry = (kind: CriticalInjectCatalogEntry['kind']) => {
    setEntries((all) => [...all, { id: crypto.randomUUID(), kind, description: '' }])
  }
  const delEntry = async (kind: CriticalInjectCatalogEntry['kind'], i: number) => {
    const target = (kind === 'critical_hit' ? hitEntries : failEntries)[i]
    if (persistedIds.has(target.id)) {
      if (!window.confirm('Delete this entry? This removes it from any scenario that references it.')) return
      try {
        await apiAdmin.deleteInjectCatalogEntry(target.id)
        await refreshInjectsCatalog()
        flash('success', 'Deleted')
      } catch (e) { flash('error', (e as Error).message); return }
    }
    setEntries((all) => all.filter((e) => e.id !== target.id))
  }

  const saveAll = async () => {
    setSaving(true)
    try {
      for (const entry of entries) await apiAdmin.upsertInjectCatalogEntry(entry)
      await refreshInjectsCatalog()
      await load()
      flash('success', 'Catalog saved')
    } catch (e) { flash('error', (e as Error).message) }
    finally { setSaving(false) }
  }

  return (
    <div className="min-h-screen bg-terminal-bg font-mono p-6 pt-12">
      <div className="w-full max-w-3xl mx-auto space-y-6">
        <button onClick={() => navigate('/admin/users')} className="text-xs text-terminal-dim hover:text-terminal-green transition-colors">
          ← Back to Admin
        </button>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] text-terminal-dim tracking-widest uppercase">Admin</div>
            <h1 className="text-xl font-bold text-white">Injects Catalog</h1>
            <p className="text-[11px] text-terminal-dim mt-1">
              Curate the critical-hit/fail events fired on a natural 20/1. Assign these to a scenario under Admin → Scenarios or in Campaign Builder.
            </p>
          </div>
          <button
            onClick={saveAll}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-semibold tracking-widest uppercase
              bg-terminal-green/10 border border-terminal-green/40 text-terminal-green
              hover:bg-terminal-green/20 hover:border-terminal-green rounded transition-all disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>

        {msg && (
          <div className={`rounded border p-3 text-[11px] ${msg.kind === 'success'
            ? 'border-terminal-green/40 bg-terminal-green/10 text-terminal-green'
            : 'border-terminal-red/40 bg-terminal-red/10 text-terminal-red'}`}>
            {msg.text}
          </div>
        )}

        {loading ? (
          <div className="text-xs text-terminal-dim">Loading…</div>
        ) : (
          <div className="space-y-8 pb-10">
            <CriticalInjectTable
              heading="Critical Hit Injects" itemLabel="Crit Hit Inject"
              entries={hitEntries} npcRoles={NPC_ROLES}
              onSet={(i, u) => setEntry('critical_hit', i, u)}
              onAdd={() => addEntry('critical_hit')}
              onDel={(i) => delEntry('critical_hit', i)}
            />
            <CriticalInjectTable
              heading="Critical Fail Injects" itemLabel="Crit Fail Inject"
              entries={failEntries} npcRoles={NPC_ROLES}
              onSet={(i, u) => setEntry('critical_fail', i, u)}
              onAdd={() => addEntry('critical_fail')}
              onDel={(i) => delEntry('critical_fail', i)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
