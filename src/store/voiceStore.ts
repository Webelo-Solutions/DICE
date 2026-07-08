import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface VoiceSettings {
  enabled:  boolean
  voiceURI: string   // empty = browser default
  rate:     number   // 0.6–1.4
  pitch:    number   // 0.6–1.2
}

interface VoiceStore extends VoiceSettings {
  setEnabled:  (v: boolean) => void
  setVoiceURI: (v: string)  => void
  setRate:     (v: number)  => void
  setPitch:    (v: number)  => void
}

export const useVoiceStore = create<VoiceStore>()(
  persist(
    (set) => ({
      enabled:  false,
      voiceURI: '',
      rate:     0.92,
      pitch:    0.88,

      setEnabled:  (enabled)  => set({ enabled }),
      setVoiceURI: (voiceURI) => set({ voiceURI }),
      setRate:     (rate)     => set({ rate }),
      setPitch:    (pitch)    => set({ pitch }),
    }),
    { name: 'dice-voice-settings' },
  ),
)
