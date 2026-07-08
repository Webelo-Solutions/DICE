import { useState } from 'react'
import type { Character, CharacterClass, StatKey } from '../types/game'
import { HeadshotAvatar } from './HeadshotAvatar'

const STAT_LABELS: Record<StatKey, string> = {
  vigilance: 'VIG',
  agility:   'AGI',
  analysis:  'ANA',
  fortitude: 'FOR',
  stealth:   'STL',
  command:   'CMD',
}

const CLASS_COLOR: Record<string, string> = {
  'Analyst':       'text-terminal-blue',
  'Hunter':        'text-terminal-green',
  'Responder':     'text-terminal-amber',
  'Engineer':      'text-purple-400',
  'Intel Officer': 'text-cyan-400',
  'Commander':     'text-orange-400',
}

const ALL_CLASSES: CharacterClass[] = [
  'Analyst', 'Hunter', 'Responder', 'Engineer', 'Intel Officer', 'Commander',
]

interface Props {
  character:    Character
  isActive?:    boolean
  compact?:     boolean
  onUploadHeadshot?: (dataUrl: string) => void
  onEdit?: (name: string, cls: CharacterClass) => void
}

export function CharacterCard({ character, isActive, compact, onUploadHeadshot, onEdit }: Props) {
  const classColor = CLASS_COLOR[character.class] ?? 'text-white'
  const [editing,   setEditing]   = useState(false)
  const [editName,  setEditName]  = useState(character.name)
  const [editClass, setEditClass] = useState<CharacterClass>(character.class)

  function openEdit() {
    setEditName(character.name)
    setEditClass(character.class)
    setEditing(true)
  }

  function commitEdit() {
    const trimmed = editName.trim()
    if (trimmed && onEdit) onEdit(trimmed, editClass)
    setEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter')  commitEdit()
    if (e.key === 'Escape') setEditing(false)
  }

  return (
    <div className={`rounded border font-mono transition-all duration-200 ${
      isActive
        ? 'border-terminal-green bg-terminal-green/5'
        : 'border-terminal-border bg-terminal-surface'
    } ${compact ? 'p-2' : 'p-4'}`}>

      {/* Full view: headshot + name row */}
      {!compact && (
        <div className="flex items-center gap-4 mb-3">
          <HeadshotAvatar
            characterClass={character.class}
            name={character.name}
            headshot={character.headshot}
            onUpload={onUploadHeadshot}
            size="lg"
          />
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-white truncate">{character.name}</div>
            <div className={`text-xs font-semibold ${classColor}`}>{character.class}</div>
            <div className="text-xs text-terminal-dim mt-1">LVL {character.level} · {character.xp} XP</div>
            {onUploadHeadshot && (
              <div className="text-[10px] text-terminal-dim mt-1 opacity-60">
                Click portrait to upload photo
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compact view: header without headshot */}
      {compact && (
        <div className="mb-2">
          {editing ? (
            <div className="space-y-1.5">
              <input
                autoFocus
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-terminal-bg border border-terminal-green/50 rounded px-2 py-1
                  text-xs text-white font-mono focus:outline-none focus:border-terminal-green"
              />
              <select
                value={editClass}
                onChange={(e) => setEditClass(e.target.value as CharacterClass)}
                onKeyDown={handleKeyDown}
                className="w-full bg-terminal-bg border border-terminal-border rounded px-2 py-1
                  text-[11px] text-gray-300 font-mono focus:outline-none focus:border-terminal-green/50"
              >
                {ALL_CLASSES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <div className="flex gap-1.5">
                <button
                  onClick={commitEdit}
                  className="flex-1 py-0.5 rounded border border-terminal-green/40 bg-terminal-green/10
                    text-terminal-green text-[10px] font-semibold tracking-widest hover:bg-terminal-green/20 transition-all"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-2 py-0.5 rounded border border-terminal-border text-terminal-dim
                    text-[10px] hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2 group">
              <div className="flex items-center gap-2 min-w-0">
                <HeadshotAvatar
                  characterClass={character.class}
                  name={character.name}
                  headshot={character.headshot}
                  size="sm"
                />
                <div className="min-w-0">
                  <div className={`text-xs font-bold truncate ${isActive ? 'text-white' : 'text-gray-300'}`}>
                    {character.name}
                  </div>
                  <div className={`text-[10px] font-semibold ${classColor}`}>{character.class}</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className="text-[10px] text-terminal-dim">LVL {character.level}</div>
                {onEdit && (
                  <button
                    onClick={openEdit}
                    title="Edit name & role"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-terminal-dim
                      hover:text-terminal-green text-[10px] leading-none"
                  >
                    ✎
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-1 mb-2">
        {(Object.entries(STAT_LABELS) as [StatKey, string][]).map(([key, label]) => (
          <div key={key} className="text-center">
            <div className="text-terminal-dim text-[10px] tracking-widest">{label}</div>
            <div className={`text-sm font-bold ${
              character.stats[key] >= 4 ? 'text-terminal-green' :
              character.stats[key] >= 3 ? 'text-white' :
              'text-terminal-dim'
            }`}>
              {character.stats[key]}
            </div>
          </div>
        ))}
      </div>

      {!compact && (
        <>
          <div className="mb-2">
            <div className="text-[10px] text-terminal-dim tracking-widest mb-1">SKILLS</div>
            <div className="flex flex-wrap gap-1">
              {character.skills.map((s) => (
                <span key={s.name} className="text-[10px] px-1.5 py-0.5 rounded bg-terminal-muted text-gray-400">
                  {s.name} {s.level > 1 ? s.level : ''}
                </span>
              ))}
            </div>
          </div>

          {character.traits.length > 0 && (
            <div>
              <div className="text-[10px] text-terminal-dim tracking-widest mb-1">TRAITS</div>
              <div className="flex flex-wrap gap-1">
                {character.traits.map((t) => (
                  <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-terminal-green/10 text-terminal-green/80 border border-terminal-green/20">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
