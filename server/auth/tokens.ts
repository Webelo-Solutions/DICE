import { randomBytes, createHash, scryptSync, timingSafeEqual } from 'node:crypto'

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
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function newRoomCode(length = 6): string {
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
