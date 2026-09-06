/**
 * Chiffrement des jetons cloud (refresh_token Google / Microsoft).
 * AES-256-GCM — la base ne contient jamais le jeton en clair.
 *
 * Clé : CLOUD_TOKEN_SECRET (Vercel). À défaut, dérivée de la clé service_role
 * Supabase : le jour où cette clé est changée, les jetons deviennent illisibles
 * et les sociétés doivent recliquer sur « Connecter » (dégradation propre).
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const PREFIX = 'v1'

function encryptionKey() {
  const raw =
    process.env.CLOUD_TOKEN_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ''
  if (!raw.trim()) return null
  return createHash('sha256').update(`climazen-cloud-token:${raw.trim()}`).digest()
}

export function tokenEncryptionAvailable() {
  return encryptionKey() !== null
}

/** @returns {string} `v1:<iv>:<tag>:<chiffré>` en base64url */
export function encryptSecret(plain) {
  const value = String(plain || '')
  if (!value) return ''
  const key = encryptionKey()
  if (!key) throw new Error('Chiffrement indisponible : CLOUD_TOKEN_SECRET manquant.')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [PREFIX, iv.toString('base64url'), tag.toString('base64url'), enc.toString('base64url')].join(
    ':',
  )
}

/** @returns {string} chaîne vide si le jeton est illisible (clé changée / valeur corrompue) */
export function decryptSecret(payload) {
  const raw = String(payload || '')
  if (!raw) return ''
  const parts = raw.split(':')
  if (parts.length !== 4 || parts[0] !== PREFIX) return ''
  const key = encryptionKey()
  if (!key) return ''
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(parts[1], 'base64url'))
    decipher.setAuthTag(Buffer.from(parts[2], 'base64url'))
    const dec = Buffer.concat([
      decipher.update(Buffer.from(parts[3], 'base64url')),
      decipher.final(),
    ])
    return dec.toString('utf8')
  } catch {
    return ''
  }
}
