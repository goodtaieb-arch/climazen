/**
 * Connexions cloud société — Google Drive (OAuth2) et Microsoft OneDrive /
 * SharePoint (Entra ID). Le navigateur ne voit jamais de refresh_token :
 * il demande une URL d’autorisation au serveur, puis suit la redirection.
 */

export type CloudProviderId = 'google' | 'microsoft'

export const CLOUD_PROVIDER_LABELS: Record<CloudProviderId, string> = {
  google: 'Google Drive',
  microsoft: 'OneDrive / SharePoint',
}

export const CLOUD_CONNECT_BUTTON_LABELS: Record<CloudProviderId, string> = {
  google: 'Connecter Google Drive',
  microsoft: 'Connecter OneDrive',
}

/** Scope Google demandé — fichiers créés / ouverts par ClimaZEN uniquement. */
export const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

/** Scopes Microsoft Graph demandés. */
export const MICROSOFT_SCOPES = ['Files.ReadWrite.All', 'offline_access'] as const

/** Où déclarer l’URI de redirection, côté console du fournisseur. */
export const CLOUD_REDIRECT_CONSOLE_HINTS: Record<CloudProviderId, string> = {
  google:
    'Google Cloud Console → API et services → Identifiants → votre ID client OAuth → « URI de redirection autorisés ».',
  microsoft:
    'Microsoft Entra ID → Inscriptions d’applications → votre application → Authentification → plateforme « Web » → « URI de redirection ».',
}

export type CloudConnectionState = {
  connected: boolean
  needsReconnect: boolean
  accountLabel: string
  scope: string
  connectedAt: string
}

export type CloudConnectionsStatus = {
  ok: boolean
  canEdit: boolean
  connections: Record<CloudProviderId, CloudConnectionState>
  available: Record<CloudProviderId, boolean>
  /** URI de redirection exacte à déclarer chez Google / Microsoft. */
  redirectUris: Record<CloudProviderId, string>
  error?: string
  code?: string
}

export type CloudWriteTestResult = {
  ok: boolean
  message: string
  detail?: string
  cleaned?: boolean
  provider?: CloudProviderId
}

const EMPTY_STATE: CloudConnectionState = {
  connected: false,
  needsReconnect: false,
  accountLabel: '',
  scope: '',
  connectedAt: '',
}

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

/** Message affiché au retour du fournisseur (?cloud=…&status=…). */
export function cloudCallbackMessage(params: URLSearchParams): {
  provider: CloudProviderId
  ok: boolean
  message: string
} | null {
  const raw = params.get('cloud')
  if (raw !== 'google' && raw !== 'microsoft') return null
  const provider: CloudProviderId = raw
  const label = CLOUD_PROVIDER_LABELS[provider]
  if (params.get('status') === 'connected') {
    const compte = (params.get('compte') || '').trim()
    return {
      provider,
      ok: true,
      message: compte
        ? `${label} connecté — compte ${compte}. ClimaZEN peut y déposer vos documents.`
        : `${label} connecté. ClimaZEN peut y déposer vos documents.`,
    }
  }
  if (params.get('status') !== 'error') return null
  const detail = (params.get('detail') || '').trim()
  const texte = cloudCallbackErrorText(params.get('reason'))
  return {
    provider,
    ok: false,
    message: detail ? `${label} : ${texte} (${detail})` : `${label} : ${texte}`,
  }
}

export function cloudCallbackErrorText(reason?: string | null): string {
  switch (String(reason || '')) {
    case 'access_denied':
      return 'accès refusé sur la page du fournisseur. Si Google affiche « accès bloqué », l’écran de consentement OAuth est encore en mode Test : publiez-le, ou ajoutez ce compte aux testeurs.'
    case 'state_invalid':
      return 'lien de connexion invalide ou déjà utilisé. Relancez « Connecter ».'
    case 'state_expired':
      return 'lien de connexion expiré (10 minutes). Relancez « Connecter ».'
    case 'no_code':
      return 'aucun code d’autorisation renvoyé. Relancez « Connecter ».'
    case 'no_refresh_token':
      return 'aucun refresh_token renvoyé. Révoquez l’accès ClimaZEN dans votre compte cloud, puis reconnectez-vous.'
    case 'not_configured':
      return 'connexion non configurée côté serveur (identifiants OAuth manquants sur Vercel).'
    case 'provider_not_configured':
      return 'identifiants OAuth absents sur Vercel. Vérifiez que les variables sont cochées pour l’environnement Production, puis relancez un déploiement.'
    case 'supabase_missing':
      return 'SUPABASE_SERVICE_ROLE_KEY absent sur Vercel : le serveur ne peut pas enregistrer le jeton.'
    case 'sql_missing':
      return 'tables absentes : exécutez supabase/cloud-oauth.sql dans Supabase.'
    case 'exchange_failed':
      return 'le fournisseur a refusé d’échanger le code contre un jeton. Vérifiez le Client secret sur Vercel, puis relancez « Connecter ».'
    case 'save_failed':
      return 'jetons obtenus mais impossible de les enregistrer dans Supabase. Vérifiez SUPABASE_SERVICE_ROLE_KEY et les tables cloud.'
    case 'callback_failed':
      return 'le retour du fournisseur a échoué côté serveur.'
    default:
      return 'connexion impossible. Réessayez.'
  }
}

export function explainCloudApiError(raw?: string): string {
  const e = String(raw || '').trim()
  if (!e) return ''
  if (/service role non configur/i.test(e)) {
    return 'Ajoutez SUPABASE_SERVICE_ROLE_KEY sur Vercel (Supabase → Settings → API → service_role), puis Redeploy.'
  }
  if (/cloud_oauth_states|organization_cloud_connections|sql_missing|Tables cloud absentes/i.test(e)) {
    return 'Exécutez supabase/cloud-oauth.sql dans Supabase SQL Editor, puis réessayez.'
  }
  return e
}

export async function fetchCloudConnections(): Promise<CloudConnectionsStatus | null> {
  const headers = await authHeaders()
  if (!headers.Authorization) return null
  const res = await fetch('/api/cloud-oauth', { headers })
  const data = (await res.json().catch(() => ({}))) as Partial<CloudConnectionsStatus> & {
    error?: string
    code?: string
  }
  if (!res.ok) {
    return {
      ok: false,
      canEdit: false,
      connections: { google: EMPTY_STATE, microsoft: EMPTY_STATE },
      available: { google: false, microsoft: false },
      redirectUris: { google: '', microsoft: '' },
      error: data.error || `Erreur ${res.status}`,
      code: data.code,
    }
  }
  return {
    ok: true,
    canEdit: Boolean(data.canEdit),
    connections: {
      google: { ...EMPTY_STATE, ...(data.connections?.google || {}) },
      microsoft: { ...EMPTY_STATE, ...(data.connections?.microsoft || {}) },
    },
    available: {
      google: Boolean(data.available?.google),
      microsoft: Boolean(data.available?.microsoft),
    },
    redirectUris: {
      google: String(data.redirectUris?.google || ''),
      microsoft: String(data.redirectUris?.microsoft || ''),
    },
  }
}

/**
 * Clic sur « Connecter … » : le serveur crée l’état anti-CSRF + PKCE et renvoie
 * l’URL d’autorisation. Le navigateur y est ensuite redirigé.
 */
export async function startCloudOauth(
  provider: CloudProviderId,
  redirectPath = '/app/operateur',
): Promise<{ ok: boolean; authorizeUrl?: string; error?: string }> {
  const headers = await authHeaders()
  if (!headers.Authorization) return { ok: false, error: 'Session requise — reconnectez-vous.' }
  const res = await fetch('/api/cloud-oauth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ action: 'start', provider, redirectPath }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    authorizeUrl?: string
    error?: string
  }
  if (!res.ok || !data.authorizeUrl) {
    return { ok: false, error: explainCloudApiError(data.error) || `Erreur ${res.status}` }
  }
  return { ok: true, authorizeUrl: data.authorizeUrl }
}

export async function disconnectCloud(
  provider: CloudProviderId,
): Promise<{ ok: boolean; error?: string }> {
  const headers = await authHeaders()
  if (!headers.Authorization) return { ok: false, error: 'Session requise — reconnectez-vous.' }
  const res = await fetch('/api/cloud-oauth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ action: 'disconnect', provider }),
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) return { ok: false, error: explainCloudApiError(data.error) || `Erreur ${res.status}` }
  return { ok: true }
}

/** Test d’écriture réel : crée test-climazen.txt sur le dossier visé, puis le supprime. */
export async function testCloudWrite(opts: {
  provider?: CloudProviderId
  url?: string
}): Promise<CloudWriteTestResult> {
  const headers = await authHeaders()
  if (!headers.Authorization) return { ok: false, message: 'Session requise — reconnectez-vous.' }
  const res = await fetch('/api/cloud-oauth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ action: 'test-write', provider: opts.provider, url: opts.url }),
  })
  const data = (await res.json().catch(() => ({}))) as Partial<CloudWriteTestResult> & {
    error?: string
  }
  if (!res.ok) {
    return {
      ok: false,
      message: explainCloudApiError(data.error || data.message) || `Erreur ${res.status}`,
    }
  }
  return {
    ok: Boolean(data.ok),
    message: data.message || (data.ok ? 'Test réussi.' : 'Test échoué.'),
    detail: data.detail,
    cleaned: data.cleaned,
    provider: data.provider,
  }
}
