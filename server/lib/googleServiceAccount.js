/**
 * Compte de service ClimaZEN (option secours).
 * Le client colle un lien de dossier et le partage en Éditeur avec cet e-mail :
 * ClimaZEN écrit alors sans OAuth, avec ses propres identifiants.
 */

import { createSign } from 'node:crypto'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SERVICE_ACCOUNT_SCOPE = 'https://www.googleapis.com/auth/drive'

function parseServiceAccountJson() {
  const raw = String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim()
  if (!raw) return null
  try {
    const json = JSON.parse(raw)
    if (json?.client_email && json?.private_key) return json
  } catch {
    return null
  }
  return null
}

/** @returns {{ email: string, privateKey: string } | null} */
export function googleServiceAccountCredentials() {
  const json = parseServiceAccountJson()
  if (json) {
    return { email: String(json.client_email), privateKey: String(json.private_key) }
  }
  const email = String(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim()
  const privateKey = String(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '')
    .trim()
    .replace(/\\n/g, '\n')
  if (!email || !privateKey) return null
  return { email, privateKey }
}

/**
 * E-mail à communiquer au client pour le partage « Éditeur ».
 * CLIMAZEN_SERVICE_ACCOUNT_EMAIL permet d’afficher un alias lisible.
 */
export function serviceAccountEmail() {
  const explicit = String(process.env.CLIMAZEN_SERVICE_ACCOUNT_EMAIL || '').trim()
  if (explicit) return explicit
  return googleServiceAccountCredentials()?.email || ''
}

export function googleServiceAccountConfigured() {
  return googleServiceAccountCredentials() !== null
}

function base64url(input) {
  return Buffer.from(input).toString('base64url')
}

/** Jeton d’accès Drive du compte de service (JWT bearer, RS256). */
export async function googleServiceAccountAccessToken() {
  const creds = googleServiceAccountCredentials()
  if (!creds) {
    throw new Error(
      'Compte de service Google non configuré : ajoutez GOOGLE_SERVICE_ACCOUNT_JSON (ou GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) sur Vercel.',
    )
  }
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(
    JSON.stringify({
      iss: creds.email,
      scope: SERVICE_ACCOUNT_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  )
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${claims}`)
  const signature = signer.sign(creds.privateKey).toString('base64url')
  const assertion = `${header}.${claims}.${signature}`

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.access_token) {
    const msg = data?.error_description || data?.error || `HTTP ${res.status}`
    throw new Error(`Compte de service Google refusé : ${String(msg).slice(0, 200)}`)
  }
  return String(data.access_token)
}
