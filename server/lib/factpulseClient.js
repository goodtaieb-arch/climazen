/**
 * Client REST FactPulse (facturation électronique, jeton JWT personnel de la
 * société). https://factpulse.fr — doc : factpulse.fr/documentation-api/
 *
 * Authentification : POST /api/token/ { username, password, client_uid? }
 * → { access, refresh }. Le jeton d'accès (30 min) est utilisé pour vérifier
 * la connexion via GET /api/v1/me. Jamais de jeton FactPulse partagé par
 * ClimaZEN : chaque société utilise son propre abonnement.
 */

function apiUrl() {
  return (process.env.FACTPULSE_API_URL || 'https://factpulse.fr').replace(/\/$/, '')
}

/**
 * @param {string} email
 * @param {string} password
 * @param {string} [clientUid]
 * @returns {Promise<{ access: string, refresh: string }>}
 */
export async function getFactpulseToken(email, password, clientUid) {
  const body = { username: String(email || '').trim(), password: String(password || '') }
  if (clientUid) body.client_uid = clientUid

  let res
  try {
    res = await fetch(`${apiUrl()}/api/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (err) {
    throw new Error(`Impossible de joindre FactPulse (${err instanceof Error ? err.message : 'réseau'}).`)
  }

  let json = null
  try {
    json = await res.json()
  } catch {
    json = null
  }

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Email ou mot de passe FactPulse incorrect.')
    }
    const detail = json?.detail || json?.error || `HTTP ${res.status}`
    throw new Error(`FactPulse a refusé la connexion (${detail}).`)
  }

  if (!json?.access) {
    throw new Error('FactPulse n’a pas renvoyé de jeton d’accès.')
  }
  return { access: json.access, refresh: json.refresh || '' }
}

/**
 * Vérifie que les identifiants sont valides et que le jeton fonctionne —
 * utilisé par « Tester la connexion ». Renvoie les infos de compte FactPulse
 * (quota inclus) si le jeton est accepté.
 */
export async function testFactpulseCredentials(email, password, clientUid) {
  const { access } = await getFactpulseToken(email, password, clientUid)

  let res
  try {
    res = await fetch(`${apiUrl()}/api/v1/me`, {
      headers: { Authorization: `Bearer ${access}` },
    })
  } catch (err) {
    throw new Error(`Impossible de joindre FactPulse (${err instanceof Error ? err.message : 'réseau'}).`)
  }

  let json = null
  try {
    json = await res.json()
  } catch {
    json = null
  }

  if (!res.ok) {
    const detail = json?.detail || json?.error || `HTTP ${res.status}`
    throw new Error(`Jeton FactPulse refusé (${detail}).`)
  }

  return {
    email: json?.email || json?.username || String(email || '').trim(),
    quota: json?.quota ?? json?.quota_remaining ?? undefined,
  }
}
