import { randomBytes, createHash, scryptSync, timingSafeEqual } from 'node:crypto'
import { ROOM_CODE_LENGTH } from '../../src/types/room'

// Shared username/password format rules — used by first-run setup, admin user
// creation, and self-service registration alike.
export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{1,31}$/i
export const MIN_PW_LEN  = 8
export const MAX_PW_LEN  = 256

// kv_state key gating self-service registration. Absent/null = disabled (the
// default — an install must opt in by having an admin set a code).
export const REGISTRATION_CODE_KEY = 'registrationInviteCode'

// Bearer tokens: random, opaque. Only the SHA-256 hash is stored server-side;
// the lookup of that hash IS the validation, so there is no signing secret to
// manage. Tokens are URL-safe so they travel cleanly in an Authorization header.
export function newToken(): string {
  return randomBytes(32).toString('base64url')
}
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// Room join codes: short and human-typeable. Alphabet excludes ambiguous
// characters (no 0/O/1/I).
//
// Eight characters, not six. A room code is the ONLY thing standing between a
// stranger and a live session — the spectator view is deliberately login-free —
// and DICE can now be hosted on the internet. Six characters of this alphabet
// is 32^6, about a billion: comfortably safe on a LAN, but only ~30 bits
// against a distributed guesser with unlimited time. Eight is 32^8, roughly a
// trillion, which puts enumeration out of reach for good. The cost is two more
// characters to read aloud, and the lobby's QR and join link carry it anyway.
//
// Existing six-character codes keep working: lookup is an exact match and
// assumes no length.
//
// The modulo below is unbiased only because 32 divides 256 exactly. Changing
// the alphabet to a length that is not a power of two would silently skew
// codes toward its early characters — use rejection sampling if that happens.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function newRoomCode(length = ROOM_CODE_LENGTH): string {
  const bytes = randomBytes(length)
  let code = ''
  for (let i = 0; i < length; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  return code
}

// Facilitator passphrase: salted scrypt (no native deps). Stored as "salt:hash".
export function hashPassphrase(passphrase: string): string {
  const salt = randomBytes(16)
  const derived = scryptSync(passphrase, salt, 32)
  return `${salt.toString('hex')}:${derived.toString('hex')}`
}
export function verifyPassphrase(passphrase: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const derived = scryptSync(passphrase, Buffer.from(saltHex, 'hex'), 32)
  const expected = Buffer.from(hashHex, 'hex')
  return derived.length === expected.length && timingSafeEqual(derived, expected)
}
