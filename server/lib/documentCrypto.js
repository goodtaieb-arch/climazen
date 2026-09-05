/**
 * AES-256-GCM (CZENC1) — même format que src/lib/documentCrypto.ts
 */

import crypto from 'node:crypto'

const MAGIC = Buffer.from('CZENC1')
const SALT_LEN = 16
const IV_LEN = 12
const ITERATIONS = 120_000
const KEY_LEN = 32
const TAG_LEN = 16

export function magicBytesMatch(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf)
  if (b.length < MAGIC.length) return false
  return b.subarray(0, MAGIC.length).equals(MAGIC)
}

export function motDePasseExcelValide(password) {
  return String(password || '').trim().length >= 8
}

function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(String(password), salt, ITERATIONS, KEY_LEN, 'sha256')
}

export function chiffrerCopieSecoursBuffer(plainBuf, password) {
  const pwd = String(password || '').trim()
  if (pwd.length < 8) throw new Error('Mot de passe Excel : 8 caractères minimum.')
  const salt = crypto.randomBytes(SALT_LEN)
  const iv = crypto.randomBytes(IV_LEN)
  const key = deriveKey(pwd, salt)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plainBuf), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([MAGIC, salt, iv, enc, tag])
}

export function dechiffrerCopieSecoursBuffer(encBuf, password) {
  const pwd = String(password || '').trim()
  if (!pwd) throw new Error('Mot de passe Excel manquant.')
  const b = Buffer.isBuffer(encBuf) ? encBuf : Buffer.from(encBuf)
  if (!magicBytesMatch(b)) throw new Error('Fichier Excel non chiffré ou format inconnu.')
  const salt = b.subarray(MAGIC.length, MAGIC.length + SALT_LEN)
  const iv = b.subarray(MAGIC.length + SALT_LEN, MAGIC.length + SALT_LEN + IV_LEN)
  const rest = b.subarray(MAGIC.length + SALT_LEN + IV_LEN)
  if (rest.length <= TAG_LEN) throw new Error('Fichier Excel corrompu.')
  const data = rest.subarray(0, rest.length - TAG_LEN)
  const tag = rest.subarray(rest.length - TAG_LEN)
  const key = deriveKey(pwd, salt)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  try {
    return Buffer.concat([decipher.update(data), decipher.final()])
  } catch {
    throw new Error('Mot de passe Excel incorrect, ou fichier corrompu.')
  }
}
