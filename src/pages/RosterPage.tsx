import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { useRoomStore } from '../store/roomStore'
import { roomApi } from '../api/rooms'
import { CharacterCard } from '../components/CharacterCard'
import { Tooltip } from '../components/Tooltip'
import type { TimerDifficulty } from '../types/game'
import { TIMER_DIFFICULTY_SECONDS } from '../types/game'

const MODE_INFO = {
  solo:      'You control every selected character yourself, working through the incident at the full round-timer pace. Any number of characters, including just one.',
  team:      'Same as Solo — you control every selected character — but requires 2+ and cuts the round timer by 30s, to simulate a real team moving faster with more hands on deck. Want live teammates instead? Host or join a room from the main menu.',
  adversary: 'One of your selected characters becomes the threat actor, acting against the rest of the team — a red-team-vs-blue-team exercise. Needs at least 2 characters.',
}

// Small "ⓘ" trigger for a mode's Tooltip — positioned as a sibling over its
// mode button (see the `relative`/`absolute` wrapper at each call site) so it
// doesn't sit inside the button and interfere with launching the mode on click.
function ModeInfo({ text }: { text: string }) {
  return (
    <Tooltip text={text}>
      <span
        role="button"
        tabIndex={0}
        className="w-3.5 h-3.5 rounded-full border border-current text-[9px] leading-[13px]
          text-center opacity-60 hover:opacity-100 transition-opacity cursor-help select-none"
      >
        i
      </span>
    </Tooltip>
  )
}

const DIFFICULTIES: { value: TimerDifficulty; label: string; desc: string }[] = [
  { value: 'rookie',  label: 'Rookie',   desc: '3 min — read, think, discuss' },
  { value: 'analyst', label: 'Analyst',  desc: '2 min — comfortable working pace' },
  { value: 'senior',  label: 'Senior',   desc: '90 sec — experienced responder' },
  { value: 'elite',   label: 'Elite',    desc: '60 sec — under fire' },
  { value: 'none',    label: 'No Timer', desc: 'Training mode — no pressure' },
]

export function RosterPage() {
  const navigate = useNavigate()
  const { roster, library, addCharacter, removeCharacter, updateCharacter, initSession } = useGameStore()
  const selectedScenario = useGameStore((s) => s.session?.scenario ?? null)

  // Copy a library (pack-imported) character into the roster as a user-owned
  // character (fresh id, no pack provenance) so it persists if the pack is removed.
  const addFromLibrary = (id: string) => {
    const src = library.find((c) => c.id === id)
    if (src) addCharacter({ ...src, id: crypto.randomUUID() })
  }

  const [difficulty,   setDifficulty]   = useState<TimerDifficulty>('analyst')
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set())

  const allSelected  = roster.length > 0 && roster.every((c) => selectedIds.has(c.id))
  const noneSelected = roster.every((c) => !selectedIds.has(c.id))

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll   = () => setSelectedIds(new Set(roster.map((c) => c.id)))
  const deselectAll = () => setSelectedIds(new Set())

  const selectedPlayers = roster.filter((c) => selectedIds.has(c.id))

  const timerLabel = (mode: 'solo' | 'team') => {
    if (difficulty === 'none') return 'No timer'
    const base = TIMER_DIFFICULTY_SECONDS[difficulty]
    const secs = mode === 'team' ? Math.max(45, base - 30) : base
    return secs >= 60 ? `${secs / 60} min` : `${secs}s`
  }

  const handleLaunch = (mode: 'solo' | 'team') => {
    if (!selectedScenario || selectedPlayers.length === 0) return
    initSession(selectedScenario, selectedPlayers, mode, difficulty)
    navigate('/game')
  }

  // ── Room mode: the team is auto-built from joined players (Option B) ───────
  const membership = useRoomStore((s) => s.membership)
  const roomParticipants = useRoomStore((s) => s.participants)
  const isRoomFacilitator = membership?.role === 'facilitator'
  const roomPlayers = roomParticipants
    .filter((p) => p.role === 'player' && p.character)
    .map((p) => p.character!)

  if (isRoomFacilitator) {
    const launchRoom = () => {
      if (!selectedScenario || roomPlayers.length === 0 || !membership) return
      // Hand the AI key to the server (held in memory) so the DM runs server-side.
      const cfg = useGameStore.getState().providerConfig
      if (cfg) roomApi.setDmProvider(membership.code, membership.token, cfg).catch((e) => console.error('[dm-provider]', e))
      initSession(selectedScenario, roomPlayers, roomPlayers.length > 1 ? 'team' : 'solo', difficulty)
      navigate('/game')
    }
    return (
      <div className="min-h-screen bg-terminal-bg p-8 font-mono">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => navigate('/scenarios')} className="text-xs text-terminal-dim hover:text-terminal-green mb-6 block">← Back to Scenarios</button>
          <h1 className="text-2xl font-bold text-white mb-1">TEAM ROSTER</h1>
          {selectedScenario && <p className="text-sm text-terminal-dim mb-1">Scenario: <span className="text-terminal-green">{selectedScenario.title}</span></p>}
          <p className="text-xs text-terminal-dim mb-5">Your team is built from the players in the room. As facilitator you run the DM.</p>

          <div className="rounded border border-terminal-border bg-terminal-surface/60 overflow-hidden mb-6">
            <div className="px-4 py-2.5 border-b border-terminal-border flex items-center justify-between">
              <span className="text-xs font-bold text-terminal-green tracking-widest uppercase">Players</span>
              <span className="text-[10px] text-terminal-dim">{roomPlayers.length}</span>
            </div>
            {roomPlayers.length === 0 ? (
              <div className="px-4 py-4 text-xs text-terminal-dim italic">No players have joined yet. Share the room code, then start once players are in.</div>
            ) : (
              <div className="divide-y divide-terminal-border">
                {roomPlayers.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-sm text-white flex-1 truncate">{c.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded border border-terminal-blue/40 bg-terminal-blue/10 text-terminal-blue">{c.class}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mb-5">
            <div className="text-xs text-terminal-dim tracking-widest uppercase mb-3">Round Timer Pressure</div>
            <div className="grid grid-cols-5 gap-2">
              {DIFFICULTIES.map((d) => (
                <button key={d.value} onClick={() => setDifficulty(d.value)}
                  className={`py-2 px-1 rounded border text-center transition-all ${difficulty === d.value
                    ? 'border-terminal-green bg-terminal-green/10 text-terminal-green'
                    : 'border-terminal-border bg-terminal-surface text-terminal-dim hover:border-terminal-dim'}`}>
                  <div className="text-xs font-semibold">{d.label}</div>
                  <div className="text-[10px] mt-0.5 leading-tight opacity-70">{d.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <button onClick={launchRoom} disabled={!selectedScenario || roomPlayers.length === 0}
            className="w-full py-3 rounded border border-terminal-green bg-terminal-green/10 text-terminal-green
              font-bold text-sm tracking-widest uppercase hover:bg-terminal-green/20
              disabled:opacity-30 disabled:cursor-not-allowed transition-all">
            ▶ Begin Session · {roomPlayers.length} player{roomPlayers.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-terminal-bg p-8 font-mono">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => navigate('/scenarios')}
          className="text-xs text-terminal-dim hover:text-terminal-green mb-6 block transition-colors"
        >
          ← Back to Scenarios
        </button>

        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">TEAM ROSTER</h1>
            {selectedScenario && (
              <p className="text-sm text-terminal-dim">
                Scenario: <span className="text-terminal-green">{selectedScenario.title}</span>
              </p>
            )}
          </div>
          <button
            onClick={() => navigate('/create')}
            disabled={roster.length >= 6}
            className="px-3 py-1.5 text-xs font-semibold tracking-widest uppercase
              bg-terminal-green/10 border border-terminal-green/40 text-terminal-green
              hover:bg-terminal-green/20 hover:border-terminal-green
              disabled:opacity-30 disabled:cursor-not-allowed rounded transition-all"
          >
            + Add Character
          </button>
        </div>

        {/* Selection count + bulk toggle */}
        {roster.length > 1 && (
          <div className="flex items-center gap-3 mb-5">
            <span className="text-xs text-terminal-dim">
              <span className="text-white font-semibold">{selectedPlayers.length}</span>
              {' '}of {roster.length} selected for this session
            </span>
            <button
              onClick={allSelected ? deselectAll : selectAll}
              className="text-[10px] text-terminal-green/70 hover:text-terminal-green underline
                underline-offset-2 decoration-dotted transition-colors"
            >
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
          </div>
        )}

        {roster.length === 0 ? (
          <div className="rounded border border-terminal-border bg-terminal-surface p-8 text-center">
            <p className="text-terminal-dim text-sm mb-3">No characters yet.</p>
            <button
              onClick={() => navigate('/create')}
              className="text-terminal-green text-sm hover:underline"
            >
              Create your first character →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 mb-8">
            {roster.map((c) => {
              const isSelected = selectedIds.has(c.id)
              return (
                <div
                  key={c.id}
                  onClick={() => toggleSelect(c.id)}
                  className={`relative group cursor-pointer rounded-lg transition-all duration-150 ${
                    isSelected
                      ? 'ring-2 ring-terminal-green ring-offset-2 ring-offset-terminal-bg'
                      : 'opacity-50 hover:opacity-75'
                  }`}
                >
                  {/* Selection badge */}
                  <div className={`absolute top-2 left-2 z-10 w-5 h-5 rounded-full border flex items-center
                    justify-center transition-all duration-150 flex-shrink-0 ${
                    isSelected
                      ? 'bg-terminal-green border-terminal-green'
                      : 'bg-terminal-surface border-terminal-border group-hover:border-terminal-dim'
                  }`}>
                    {isSelected && (
                      <span className="text-[9px] text-black font-black leading-none">✓</span>
                    )}
                  </div>

                  <CharacterCard
                    character={c}
                    onUploadHeadshot={(dataUrl) => updateCharacter(c.id, { headshot: dataUrl })}
                  />

                  {/* Remove button — stopPropagation so it doesn't toggle selection */}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeCharacter(c.id) }}
                    className="absolute top-2 right-2 z-10 text-terminal-dim hover:text-terminal-red
                      text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove character"
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Character Library — characters imported from content packs */}
        {library.length > 0 && (
          <div className="mb-8">
            <div className="text-xs text-terminal-dim tracking-widest uppercase mb-1">
              Character Library
            </div>
            <p className="text-[11px] text-terminal-dim/70 mb-3">
              Imported from content packs. Add one to your roster to play it — your copy stays even if the pack is removed.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {library.map((c) => (
                <div key={c.id}>
                  <CharacterCard character={c} />
                  <button
                    onClick={() => addFromLibrary(c.id)}
                    disabled={roster.length >= 6}
                    title={roster.length >= 6 ? 'Roster is full (6)' : ''}
                    className="mt-2 w-full py-1.5 rounded border border-terminal-blue/40 bg-terminal-blue/5
                      text-terminal-blue text-[11px] font-semibold tracking-widest uppercase
                      hover:bg-terminal-blue/15 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    ↑ Add to Roster
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {roster.length > 0 && selectedScenario && (
          <div className="space-y-5">
            {/* Timer difficulty */}
            <div>
              <div className="text-xs text-terminal-dim tracking-widest uppercase mb-3">
                Round Timer Pressure
              </div>
              <div className="grid grid-cols-5 gap-2">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setDifficulty(d.value)}
                    className={`py-2 px-1 rounded border text-center transition-all duration-150 ${
                      difficulty === d.value
                        ? 'border-terminal-green bg-terminal-green/10 text-terminal-green'
                        : 'border-terminal-border bg-terminal-surface text-terminal-dim hover:border-terminal-dim hover:text-gray-300'
                    }`}
                  >
                    <div className="text-xs font-semibold">{d.label}</div>
                    <div className="text-[10px] mt-0.5 leading-tight opacity-70">{d.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Mode launch */}
            <div>
              <div className="text-xs text-terminal-dim tracking-widest uppercase mb-3">
                Session Mode
              </div>
              {noneSelected && (
                <p className="text-xs text-terminal-amber/80 mb-3">
                  Select at least one character to launch a session.
                </p>
              )}
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <button
                    onClick={() => handleLaunch('solo')}
                    disabled={selectedPlayers.length === 0}
                    className="w-full py-3 rounded border border-terminal-border bg-terminal-surface
                      hover:border-terminal-green/50 text-sm font-semibold text-gray-300
                      hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    Solo
                    <div className="text-xs text-terminal-dim font-normal mt-0.5">
                      {timerLabel('solo')} round timer
                    </div>
                  </button>
                  <div className="absolute top-2 right-2 text-terminal-dim">
                    <ModeInfo text={MODE_INFO.solo} />
                  </div>
                </div>
                <div className="relative flex-1">
                  <button
                    onClick={() => handleLaunch('team')}
                    disabled={selectedPlayers.length < 2}
                    className="w-full py-3 rounded border border-terminal-green/40 bg-terminal-green/5
                      hover:bg-terminal-green/10 hover:border-terminal-green text-sm font-semibold text-terminal-green
                      disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    Team
                    <div className="text-xs text-terminal-green/60 font-normal mt-0.5">
                      {timerLabel('team')} · {selectedPlayers.length} player{selectedPlayers.length !== 1 ? 's' : ''}
                    </div>
                  </button>
                  <div className="absolute top-2 right-2 text-terminal-green">
                    <ModeInfo text={MODE_INFO.team} />
                  </div>
                </div>
              </div>

              {/* Adversary Mode */}
              <div className="pt-3 border-t border-terminal-border relative">
                <button
                  onClick={() => navigate('/adversary')}
                  disabled={roster.length < 2}
                  className="w-full py-3 rounded border border-terminal-red/40 bg-terminal-red/5
                    hover:bg-terminal-red/10 hover:border-terminal-red/70
                    text-sm font-semibold text-terminal-red/80 hover:text-terminal-red
                    disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  ⚔ Adversary Mode
                  <div className="text-xs text-terminal-red/50 font-normal mt-0.5">
                    One player is the threat actor
                  </div>
                </button>
                <div className="absolute top-5 right-2 text-terminal-red/70">
                  <ModeInfo text={MODE_INFO.adversary} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
