import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useVoiceStore } from '../store/voiceStore'

const SUPPORTED = typeof window !== 'undefined' && 'speechSynthesis' in window

// Splits a text block into sentences for natural-paced narration.
function extractSentences(text: string): string[] {
  const raw = text.match(/[^.!?]*[.!?]+(?:\s|$)/g) ?? []
  const trimmed = raw.map((s) => s.trim()).filter(Boolean)
  return trimmed.length > 0 ? trimmed : (text.trim() ? [text.trim()] : [])
}

export function useVoiceDM() {
  const { enabled, voiceURI, rate, pitch } = useVoiceStore()

  const queueRef          = useRef<string[]>([])
  const isSpeakingRef     = useRef(false)
  const sentenceBufferRef = useRef('')

  // ── Drain / speak ─────────────────────────────────────────────────────────

  // Ref trick: onend always calls the latest drain even if deps changed mid-speech.
  const drainRef = useRef<() => void>(() => {})

  const drain = useCallback(() => {
    if (!SUPPORTED || isSpeakingRef.current || queueRef.current.length === 0) return

    const text = queueRef.current.shift()!
    if (!text?.trim()) { drainRef.current(); return }

    isSpeakingRef.current = true

    const utt   = new SpeechSynthesisUtterance(text)
    const voice = voiceURI
      ? window.speechSynthesis.getVoices().find((v) => v.voiceURI === voiceURI) ?? null
      : null
    if (voice) utt.voice = voice
    utt.rate  = rate
    utt.pitch = pitch

    utt.onend   = () => { isSpeakingRef.current = false; drainRef.current() }
    utt.onerror = () => { isSpeakingRef.current = false; drainRef.current() }

    window.speechSynthesis.speak(utt)
  }, [voiceURI, rate, pitch])

  useLayoutEffect(() => { drainRef.current = drain })

  // ── Public API ─────────────────────────────────────────────────────────────

  const cancel = useCallback(() => {
    if (!SUPPORTED) return
    window.speechSynthesis.cancel()
    queueRef.current          = []
    sentenceBufferRef.current = ''
    isSpeakingRef.current     = false
  }, [])

  // Enqueue a single sentence and kick the drain loop.
  const enqueue = useCallback((sentence: string) => {
    if (!enabled || !SUPPORTED) return
    queueRef.current.push(sentence)
    drainRef.current()
  }, [enabled])

  // Speak a complete block of text all at once (post-stream call).
  const speak = useCallback((text: string) => {
    if (!enabled || !SUPPORTED) return
    cancel()
    for (const s of extractSentences(text)) enqueue(s)
  }, [enabled, cancel, enqueue])

  // Receive a streaming narration chunk — buffers until a sentence boundary,
  // then enqueues the complete sentence. Call after each streaming chunk.
  const speakChunk = useCallback((chunk: string) => {
    if (!enabled || !SUPPORTED) return
    sentenceBufferRef.current += chunk

    // Pull all complete sentences out of the buffer
    const re = /[^.!?]*[.!?]+(?:\s|$)/g
    let match: RegExpExecArray | null
    let cursor = 0
    while ((match = re.exec(sentenceBufferRef.current)) !== null) {
      const sentence = match[0].trim()
      if (sentence) enqueue(sentence)
      cursor = re.lastIndex
    }
    sentenceBufferRef.current = sentenceBufferRef.current.slice(cursor)
  }, [enabled, enqueue])

  // Call once after streaming is complete to speak any remaining partial sentence.
  const flushChunks = useCallback(() => {
    if (!SUPPORTED) return
    const remainder = sentenceBufferRef.current.trim()
    if (remainder) enqueue(remainder)
    sentenceBufferRef.current = ''
  }, [enqueue])

  // ── Side-effects ───────────────────────────────────────────────────────────

  // Cancel when voice is toggled off.
  useEffect(() => { if (!enabled) cancel() }, [enabled, cancel])

  // Chrome bug: speechSynthesis silently stops after ~15 s. Pause/resume to keep it alive.
  useEffect(() => {
    if (!SUPPORTED) return
    const id = setInterval(() => {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause()
        window.speechSynthesis.resume()
      }
    }, 14_000)
    return () => clearInterval(id)
  }, [])

  // Cancel on unmount.
  useEffect(() => cancel, [cancel])

  return { speak, speakChunk, flushChunks, cancel }
}
