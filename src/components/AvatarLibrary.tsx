import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { CharacterClass } from '../types/game'
import { AVATAR_LIBRARY, avatarsForClass } from '../data/avatarLibrary'

interface Props {
  characterClass: CharacterClass
  current?:       string
  onSelect:       (url: string) => void
  onClose:        () => void
}

export function AvatarLibrary({ characterClass, current, onSelect, onClose }: Props) {
  const [tab,      setTab]      = useState<'class' | 'all'>('class')
  const [hovered,  setHovered]  = useState<string | null>(null)
  const uploadRef               = useRef<HTMLInputElement>(null)

  const classAvatars = avatarsForClass(characterClass)
  const allAvatars   = AVATAR_LIBRARY
  const displayed    = tab === 'class' ? classAvatars : allAvatars
  const isEmpty      = displayed.length === 0

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result
      if (typeof result === 'string') { onSelect(result); onClose() }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0 }}
          animate={{ scale: 1,    opacity: 1 }}
          exit={{   scale: 0.94, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-lg bg-terminal-bg border border-terminal-border rounded font-mono
            flex flex-col overflow-hidden shadow-2xl max-h-[80vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-terminal-border flex-shrink-0">
            <div>
              <div className="text-sm font-bold text-white">Choose Avatar</div>
              <div className="text-[10px] text-terminal-dim mt-0.5">{characterClass}</div>
            </div>
            <button onClick={onClose} className="text-terminal-dim hover:text-white transition-colors text-sm">✕</button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-terminal-border flex-shrink-0">
            {(['class', 'all'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 text-xs font-semibold tracking-widest uppercase transition-all ${
                  tab === t
                    ? 'text-terminal-green border-b-2 border-terminal-green bg-terminal-green/5'
                    : 'text-terminal-dim hover:text-gray-300'
                }`}
              >
                {t === 'class' ? `${characterClass} (${classAvatars.length})` : `All (${allAvatars.length})`}
              </button>
            ))}
          </div>

          {/* Avatar grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {isEmpty ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="text-terminal-dim text-sm text-center">
                  No avatars found in{' '}
                  <code className="text-terminal-green text-xs">
                    src/assets/avatars/{tab === 'class' ? characterClass.toLowerCase().replace(' ', '-') : '*'}/
                  </code>
                </div>
                <div className="text-[10px] text-terminal-dim text-center max-w-xs leading-relaxed">
                  Drop image files (PNG, JPG, WebP, SVG) into the matching class folder and rebuild.
                  Use "Upload" below to set a custom photo directly.
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                {displayed.map((avatar) => {
                  const isSelected = current === avatar.url
                  const isHov      = hovered === avatar.url
                  return (
                    <button
                      key={avatar.url}
                      onClick={() => { onSelect(avatar.url); onClose() }}
                      onMouseEnter={() => setHovered(avatar.url)}
                      onMouseLeave={() => setHovered(null)}
                      className={`rounded overflow-hidden border-2 transition-all duration-150 ${
                        isSelected
                          ? 'border-terminal-green ring-2 ring-terminal-green/30'
                          : isHov
                          ? 'border-terminal-green/60'
                          : 'border-terminal-border hover:border-terminal-dim'
                      }`}
                    >
                      <div className="relative aspect-square">
                        <img
                          src={avatar.url}
                          alt={avatar.label}
                          className="w-full h-full object-cover"
                        />
                        {isSelected && (
                          <div className="absolute inset-0 flex items-center justify-center bg-terminal-green/20">
                            <span className="text-terminal-green text-lg font-bold">✓</span>
                          </div>
                        )}
                      </div>
                      {/* Class label for "All" tab — sits below the thumbnail
                          (not overlaid on it) so the avatar image is never
                          obscured; a solid background instead of a transparent
                          strip made it hard to see and select on that tab. */}
                      {tab === 'all' && avatar.class && avatar.class !== characterClass && (
                        <div className="bg-terminal-surface text-[8px] text-terminal-dim text-center py-0.5 truncate px-1">
                          {avatar.class}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer — upload option */}
          <div className="flex-shrink-0 border-t border-terminal-border px-5 py-3 flex items-center justify-between gap-3">
            <div className="text-[10px] text-terminal-dim">
              Add images to <code className="text-terminal-green">src/assets/avatars/</code> and rebuild to expand the library.
            </div>
            <button
              onClick={() => uploadRef.current?.click()}
              className="flex-shrink-0 px-4 py-1.5 rounded border border-terminal-border bg-terminal-surface
                text-xs text-gray-300 hover:border-terminal-dim hover:text-white transition-all"
            >
              Upload Custom Photo
            </button>
            <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
