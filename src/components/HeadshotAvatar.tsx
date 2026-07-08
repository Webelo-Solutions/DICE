import { useState } from 'react'
import type { CharacterClass } from '../types/game'
import { AvatarLibrary } from './AvatarLibrary'

// ─── Per-class SVG placeholder icons ────────────────────────────────────────

function AnalystIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="8" width="36" height="26" rx="3" />
      <line x1="16" y1="34" x2="14" y2="42" />
      <line x1="32" y1="34" x2="34" y2="42" />
      <line x1="10" y1="42" x2="38" y2="42" />
      <line x1="12" y1="18" x2="22" y2="18" />
      <line x1="12" y1="23" x2="28" y2="23" />
      <line x1="12" y1="28" x2="20" y2="28" />
      <polyline points="28,20 32,24 28,28" />
    </svg>
  )
}

function HunterIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="24" cy="24" r="16" />
      <circle cx="24" cy="24" r="6" />
      <line x1="24" y1="6" x2="24" y2="14" />
      <line x1="24" y1="34" x2="24" y2="42" />
      <line x1="6"  y1="24" x2="14" y2="24" />
      <line x1="34" y1="24" x2="42" y2="24" />
      <circle cx="24" cy="24" r="2" fill="currentColor" />
    </svg>
  )
}

function ResponderIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M24 6 L8 14 L8 28 C8 36 16 42 24 44 C32 42 40 36 40 28 L40 14 Z" />
      <polyline points="21,16 18,26 23,26 19,34 30,22 25,22 28,16" />
    </svg>
  )
}

function EngineerIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="24" cy="24" r="6" />
      <path d="M24 6 L24 12 M24 36 L24 42 M6 24 L12 24 M36 24 L42 24
               M10.1 10.1 L14.3 14.3 M33.7 33.7 L37.9 37.9
               M37.9 10.1 L33.7 14.3 M14.3 33.7 L10.1 37.9" />
    </svg>
  )
}

function IntelOfficerIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 24 C6 24 12 10 24 10 C36 10 42 24 42 24 C42 24 36 38 24 38 C12 38 6 24 6 24 Z" />
      <circle cx="24" cy="24" r="6" />
      <circle cx="24" cy="24" r="2.5" fill="currentColor" />
      <line x1="30" y1="30" x2="38" y2="38" strokeWidth="3" />
      <circle cx="39" cy="39" r="2" fill="currentColor" />
    </svg>
  )
}

function CommanderIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="24,6 28,18 42,18 31,26 35,38 24,30 13,38 17,26 6,18 20,18" />
    </svg>
  )
}

const CLASS_ICON: Record<CharacterClass, React.ReactNode> = {
  'Analyst':       <AnalystIcon />,
  'Hunter':        <HunterIcon />,
  'Responder':     <ResponderIcon />,
  'Engineer':      <EngineerIcon />,
  'Intel Officer': <IntelOfficerIcon />,
  'Commander':     <CommanderIcon />,
}

const CLASS_COLOR: Record<CharacterClass, string> = {
  'Analyst':       'text-terminal-blue   border-terminal-blue/30   bg-terminal-blue/5',
  'Hunter':        'text-terminal-green  border-terminal-green/30  bg-terminal-green/5',
  'Responder':     'text-terminal-amber  border-terminal-amber/30  bg-terminal-amber/5',
  'Engineer':      'text-purple-400      border-purple-400/30      bg-purple-400/5',
  'Intel Officer': 'text-cyan-400        border-cyan-400/30        bg-cyan-400/5',
  'Commander':     'text-orange-400      border-orange-400/30      bg-orange-400/5',
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  characterClass: CharacterClass
  name:           string
  headshot?:      string
  onUpload?:      (dataUrl: string) => void
  size?:          'sm' | 'md' | 'lg'
}

const SIZE = {
  sm: { outer: 'w-12 h-12', text: 'text-[10px]' },
  md: { outer: 'w-20 h-20', text: 'text-xs' },
  lg: { outer: 'w-28 h-28', text: 'text-xs' },
}

export function HeadshotAvatar({ characterClass, name, headshot, onUpload, size = 'md' }: Props) {
  const [showLibrary, setShowLibrary] = useState(false)
  const colors    = CLASS_COLOR[characterClass]
  const sz        = SIZE[size]
  const canUpload = !!onUpload

  const handleSelect = (url: string) => {
    onUpload?.(url)
    setShowLibrary(false)
  }

  return (
    <>
      <div className="flex flex-col items-center gap-1.5">
        <div
          onClick={() => canUpload && setShowLibrary(true)}
          className={`relative ${sz.outer} rounded-full border-2 overflow-hidden flex-shrink-0
            ${colors}
            ${canUpload ? 'cursor-pointer group' : 'cursor-default'}
            transition-all duration-200`}
        >
          {headshot ? (
            <img
              src={headshot}
              alt={name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center p-2.5">
              {CLASS_ICON[characterClass]}
            </div>
          )}

          {canUpload && (
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100
              transition-opacity flex items-center justify-center">
              <span className="text-white text-[9px] font-mono text-center leading-tight px-1">
                {headshot ? 'Change\nAvatar' : 'Choose\nAvatar'}
              </span>
            </div>
          )}
        </div>

        <span className={`${sz.text} font-mono text-terminal-dim text-center leading-tight`}>
          {characterClass}
        </span>
      </div>

      {showLibrary && (
        <AvatarLibrary
          characterClass={characterClass}
          current={headshot}
          onSelect={handleSelect}
          onClose={() => setShowLibrary(false)}
        />
      )}
    </>
  )
}
