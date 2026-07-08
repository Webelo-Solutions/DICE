// crypto.randomUUID is restricted to SECURE CONTEXTS (HTTPS or localhost).
// LAN clients reach DICE over plain HTTP (http://<host-LAN-IP>:3001), which the
// browser treats as an insecure origin — so window.crypto.randomUUID is missing
// there and every `crypto.randomUUID()` call throws "is not a function".
//
// crypto.getRandomValues IS available in insecure contexts, so we polyfill
// randomUUID from it (producing real RFC 4122 v4 UUIDs). Every existing
// callsite keeps working with no further refactor. On secure origins the
// platform's own randomUUID is left untouched.

if (typeof globalThis.crypto?.randomUUID !== 'function') {
  const cryptoObj = globalThis.crypto as Crypto | undefined
  const getRandom = cryptoObj?.getRandomValues?.bind(cryptoObj)

  const fill = (b: Uint8Array): Uint8Array => {
    if (getRandom) return getRandom(b)
    // Last-ditch fallback (insecure context AND no crypto at all — very rare).
    for (let i = 0; i < b.length; i++) b[i] = (Math.random() * 256) & 0xff
    return b
  }

  const randomUUID = (): `${string}-${string}-${string}-${string}-${string}` => {
    const b = new Uint8Array(16)
    fill(b)
    b[6] = (b[6] & 0x0f) | 0x40   // version 4
    b[8] = (b[8] & 0x3f) | 0x80   // RFC 4122 variant
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}` as `${string}-${string}-${string}-${string}-${string}`
  }

  try {
    Object.defineProperty(cryptoObj as Crypto, 'randomUUID', {
      value:        randomUUID,
      writable:     true,
      configurable: true,
    })
  } catch {
    // Some environments freeze the Crypto instance; fall back to wrapping it.
    ;(globalThis as unknown as { crypto: Crypto }).crypto =
      Object.assign(Object.create(cryptoObj ?? {}), { randomUUID })
  }
}
