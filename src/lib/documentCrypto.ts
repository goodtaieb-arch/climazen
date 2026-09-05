/**
 * Chiffrement AES-256-GCM de la copie Excel de secours.
 * Mot de passe gérant → fichier .xlsx.enc dans le coffre (jamais en clair).
 */

const MAGIC = 'CZENC1'
const SALT_LEN = 16
const IV_LEN = 12
const ITERATIONS = 120_000

function textBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

function asBuf(u: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(u.byteLength)
  out.set(u)
  return out
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', asBuf(textBytes(password)), 'PBKDF2', false, [
    'deriveKey',
  ])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: asBuf(salt), iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function copieSecoursEstChiffree(blob: Blob): Promise<boolean> {
  const buf = await blob.arrayBuffer()
  return magicBytesMatch(buf)
}

export function magicBytesMatch(buf: ArrayBuffer): boolean {
  if (buf.byteLength < MAGIC.length) return false
  const head = new Uint8Array(buf, 0, MAGIC.length)
  const want = textBytes(MAGIC)
  for (let i = 0; i < want.length; i++) {
    if (head[i] !== want[i]) return false
  }
  return true
}

export async function chiffrerCopieSecours(blob: Blob, password: string): Promise<Blob> {
  const pwd = (password || '').trim()
  if (pwd.length < 8) {
    throw new Error('Mot de passe Excel : 8 caractères minimum.')
  }
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN))
  const key = await deriveKey(pwd, salt)
  const plain = asBuf(new Uint8Array(await blob.arrayBuffer()))
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: asBuf(iv) }, key, plain),
  )
  const magic = textBytes(MAGIC)
  const out = new Uint8Array(magic.length + salt.length + iv.length + cipher.length)
  out.set(magic, 0)
  out.set(salt, magic.length)
  out.set(iv, magic.length + salt.length)
  out.set(cipher, magic.length + salt.length + iv.length)
  return new Blob([out], { type: 'application/octet-stream' })
}

export async function dechiffrerCopieSecours(blob: Blob, password: string): Promise<Blob> {
  const pwd = (password || '').trim()
  if (!pwd) throw new Error('Mot de passe Excel manquant.')
  const buf = await blob.arrayBuffer()
  if (!magicBytesMatch(buf)) {
    throw new Error('Fichier Excel non chiffré ou format inconnu.')
  }
  const magicLen = MAGIC.length
  const salt = new Uint8Array(buf, magicLen, SALT_LEN)
  const iv = new Uint8Array(buf, magicLen + SALT_LEN, IV_LEN)
  const cipher = new Uint8Array(buf, magicLen + SALT_LEN + IV_LEN)
  const key = await deriveKey(pwd, salt)
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: asBuf(iv) },
      key,
      asBuf(cipher),
    )
    return new Blob([plain], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
  } catch {
    throw new Error('Mot de passe Excel incorrect, ou fichier corrompu.')
  }
}

export function motDePasseExcelValide(password?: string | null): boolean {
  return (password || '').trim().length >= 8
}
