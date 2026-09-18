/**
 * Trackdéchets — jeton API personnel de l'utilisateur (Mon entreprise) et
 * création automatique des BSFF. Aucune API publique n'expose de jeton
 * ClimaZEN partagé : chaque société colle SON jeton, généré par elle-même sur
 * trackdechets.beta.gouv.fr (Mon compte → Applications et API).
 */

async function authHeaders(): Promise<Record<string, string>> {
  const { getSupabase, isSupabaseConfigured } = await import('./supabase')
  if (!isSupabaseConfigured()) return {}
  try {
    const sb = getSupabase()
    const { data } = await sb.auth.getSession()
    const token = data.session?.access_token
    if (!token) return {}
    return { Authorization: `Bearer ${token}` }
  } catch {
    return {}
  }
}

export type TrackdechetsStatus = {
  ok: boolean
  hasToken: boolean
  hint: string
  enabled: boolean
  canEdit?: boolean
  error?: string
  code?: string
}

export async function fetchTrackdechetsStatus(): Promise<TrackdechetsStatus | null> {
  const headers = await authHeaders()
  if (!headers.Authorization) return null
  const res = await fetch('/api/trackdechets-token', { headers })
  const data = (await res.json()) as TrackdechetsStatus
  if (!res.ok) {
    return { ok: false, hasToken: false, hint: '', enabled: false, error: data.error, code: data.code }
  }
  return data
}

export async function saveTrackdechetsToken(
  token: string,
  opts?: { enabled?: boolean },
): Promise<TrackdechetsStatus> {
  const headers = await authHeaders()
  if (!headers.Authorization) return { ok: false, hasToken: false, hint: '', enabled: false, error: 'Session requise.' }
  const res = await fetch('/api/trackdechets-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ token, enabled: opts?.enabled }),
  })
  const data = (await res.json()) as TrackdechetsStatus
  if (!res.ok) return { ok: false, hasToken: false, hint: '', enabled: false, error: data.error }
  return data
}

export async function setTrackdechetsEnabled(enabled: boolean): Promise<TrackdechetsStatus> {
  const headers = await authHeaders()
  if (!headers.Authorization) return { ok: false, hasToken: false, hint: '', enabled: false, error: 'Session requise.' }
  const res = await fetch('/api/trackdechets-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ enabled }),
  })
  const data = (await res.json()) as TrackdechetsStatus
  if (!res.ok) return { ok: false, hasToken: false, hint: '', enabled: false, error: data.error }
  return data
}

export async function clearTrackdechetsToken(): Promise<{ ok: boolean; error?: string }> {
  const headers = await authHeaders()
  if (!headers.Authorization) return { ok: false, error: 'Session requise.' }
  const res = await fetch('/api/trackdechets-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ clear: true }),
  })
  const data = (await res.json()) as { ok?: boolean; error?: string }
  if (!res.ok) return { ok: false, error: data.error || `Erreur ${res.status}` }
  return { ok: true }
}

export type BsffEmitterInfo = { nom: string; siret: string; adresse: string; telephone?: string; email?: string }
export type BsffDestinataireInfo = {
  nom: string
  siret: string
  adresse: string
  codeCap: string
  codeOperation: string
}
export type BsffTransporteurInfo = { nom?: string; siret: string; adresse?: string }

export type BsffCreatePayload = {
  numeroContenant: string
  codeDechet: string
  denominationAdr?: string
  quantiteKg: number
  emitter: BsffEmitterInfo
  destinataire: BsffDestinataireInfo
  transporteur: BsffTransporteurInfo
}

/** Statuts Trackdéchets (BsffStatus) — jamais « terminé » tant que le destinataire n’a pas traité. */
export const BSFF_STATUS_LABELS: Record<string, string> = {
  INITIAL: 'BSFF émis — en attente transport/traitement',
  SIGNED_BY_EMITTER: 'BSFF émis — en attente transport/traitement',
  SENT: 'Signé transporteur — en transit',
  RECEIVED: 'Reçu par le destinataire — en attente acceptation',
  ACCEPTED: 'Accepté par le destinataire — en attente traitement',
  REFUSED: 'Refusé par le destinataire',
  PARTIALLY_REFUSED: 'Partiellement refusé par le destinataire',
  INTERMEDIATELY_PROCESSED: 'Traitement intermédiaire en cours',
  PROCESSED: 'Traité (régénération / destruction effectuée)',
}

export function labelBsffStatus(status?: string): string {
  if (!status) return ''
  return BSFF_STATUS_LABELS[status] || `Statut Trackdéchets : ${status}`
}

/**
 * Champs obligatoires (brief Trackdéchets, §6) — jamais d'appel API avec un
 * champ manquant. Renvoie la liste des libellés manquants (vide = tout est bon).
 */
export function validateBsffPayload(opts: {
  trackdechetsEnabled: boolean
  operateur: { raisonSociale?: string; siret?: string; adresse?: string }
  numeroContenant?: string
  codeUn?: string
  denominationAdr?: string
  codeDechet?: string
  quantiteKg: number
  destinataire?: BsffDestinataireInfo | null
  transporteurSiret?: string
}): string[] {
  const missing: string[] = []
  if (!opts.trackdechetsEnabled) missing.push('Création automatique des BSFF désactivée (Mon entreprise)')
  if (!opts.operateur.raisonSociale?.trim()) missing.push('Nom de l’entreprise (Mon entreprise)')
  if (!opts.operateur.siret?.trim()) missing.push('SIRET de l’entreprise (Mon entreprise)')
  if (!opts.operateur.adresse?.trim()) missing.push('Adresse de l’entreprise (Mon entreprise)')
  if (!opts.numeroContenant?.trim()) missing.push('N° de bouteille')
  if (!opts.codeUn?.trim()) missing.push('Code UN')
  if (!opts.denominationAdr?.trim()) missing.push('Dénomination ADR')
  if (!opts.codeDechet?.trim()) missing.push('Code déchet')
  if (!(opts.quantiteKg > 0)) missing.push('Quantité (kg) > 0')
  if (!opts.destinataire) {
    missing.push('Partenaire destinataire')
  } else {
    if (!opts.destinataire.siret?.trim()) missing.push('SIRET destinataire')
    if (!opts.destinataire.adresse?.trim()) missing.push('Adresse destinataire')
    if (!opts.destinataire.codeCap?.trim()) missing.push('Code CAP destinataire')
  }
  if (!opts.transporteurSiret?.trim()) missing.push('SIRET transporteur')
  return missing
}

export async function createBsffOnTrackdechets(
  payload: BsffCreatePayload,
): Promise<{ ok: boolean; id?: string; status?: string; error?: string }> {
  const headers = await authHeaders()
  if (!headers.Authorization) return { ok: false, error: 'Session requise.' }
  const res = await fetch('/api/trackdechets-bsff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ action: 'create', payload }),
  })
  const data = (await res.json()) as { ok?: boolean; id?: string; status?: string; error?: string }
  if (!res.ok) return { ok: false, error: data.error || `Erreur ${res.status}` }
  if (!data.ok) return { ok: false, error: data.error || 'Création impossible.' }
  return { ok: true, id: data.id, status: data.status }
}

export async function refreshBsffStatus(
  id: string,
): Promise<{ ok: boolean; status?: string; error?: string }> {
  const headers = await authHeaders()
  if (!headers.Authorization) return { ok: false, error: 'Session requise.' }
  const res = await fetch('/api/trackdechets-bsff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ action: 'status', id }),
  })
  const data = (await res.json()) as { ok?: boolean; status?: string; error?: string }
  if (!res.ok) return { ok: false, error: data.error || `Erreur ${res.status}` }
  if (!data.ok) return { ok: false, error: data.error || 'Actualisation impossible.' }
  return { ok: true, status: data.status }
}

export async function testTrackdechetsConnection(
  token?: string,
): Promise<{ ok: boolean; valid?: boolean; me?: { name?: string; email?: string }; error?: string }> {
  const headers = await authHeaders()
  if (!headers.Authorization) return { ok: false, error: 'Session requise.' }
  const res = await fetch('/api/trackdechets-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ test: true, token: token || undefined }),
  })
  const data = (await res.json()) as {
    ok?: boolean
    valid?: boolean
    me?: { name?: string; email?: string }
    error?: string
  }
  if (!res.ok) return { ok: false, error: data.error || `Erreur ${res.status}` }
  return { ok: true, valid: data.valid, me: data.me, error: data.error }
}
