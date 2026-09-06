import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, CloudOff, Copy, Loader2 } from 'lucide-react'
import {
  CLOUD_CONNECT_BUTTON_LABELS,
  CLOUD_PROVIDER_LABELS,
  CLOUD_REDIRECT_CONSOLE_HINTS,
  cloudCallbackMessage,
  disconnectCloud,
  explainCloudApiError,
  fetchCloudConnections,
  startCloudOauth,
  testCloudWrite,
  type CloudConnectionsStatus,
  type CloudProviderId,
} from '../lib/cloudOauth'
import { cloudKindFromUrl } from '../lib/cloudLinkGuard'

const PROVIDERS: CloudProviderId[] = ['google', 'microsoft']

function providerFromManualLink(url: string): CloudProviderId | undefined {
  const kind = cloudKindFromUrl(url)
  if (kind === 'drive') return 'google'
  if (kind === 'onedrive' || kind === 'sharepoint') return 'microsoft'
  return undefined
}

/**
 * Un lien collé ne prouve rien : seul un vrai test d’écriture, avec le compte
 * cloud connecté en OAuth, prouve que ClimaZEN peut déposer les documents.
 */
export function CloudWriteTest({
  lienDossier,
  disabled,
  className = '',
}: {
  lienDossier?: string
  disabled?: boolean
  className?: string
}) {
  const [busy, setBusy] = useState(false)
  const [ok, setOk] = useState<boolean | null>(null)
  const [message, setMessage] = useState('')
  const [detail, setDetail] = useState('')

  const provider = useMemo(() => providerFromManualLink(lienDossier || ''), [lienDossier])

  const run = () => {
    setBusy(true)
    setMessage('')
    setDetail('')
    setOk(null)
    const url = (lienDossier || '').trim()
    void testCloudWrite({ url: url || undefined, provider })
      .then((res) => {
        setOk(res.ok)
        setMessage(res.message)
        setDetail(res.detail || '')
      })
      .catch((e: unknown) => {
        setOk(false)
        setMessage(e instanceof Error ? e.message : 'Test impossible.')
      })
      .finally(() => setBusy(false))
  }

  return (
    <div className={className}>
      <button
        type="button"
        disabled={Boolean(disabled) || busy}
        onClick={run}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Tester la connexion et les droits
      </button>
      <p className="mt-1.5 text-xs text-muted">
        ClimaZEN dépose un fichier d’essai dans le dossier, puis le supprime.
      </p>
      {message ? (
        <p className={`mt-2 text-sm font-semibold ${ok ? 'text-teal-800' : 'text-rose-700'}`}>
          {message}
        </p>
      ) : null}
      {detail ? <p className="mt-1 text-xs text-muted">{detail}</p> : null}
    </div>
  )
}

function UriACopier({ uri }: { uri: string }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    void navigator.clipboard
      ?.writeText(uri)
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => setCopied(false))
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <code className="break-all rounded bg-white px-2 py-1 font-mono text-[11px] text-ink">
        {uri}
      </code>
      <button
        type="button"
        onClick={copy}
        className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-line bg-white px-2 font-semibold text-ink"
      >
        <Copy className="h-3.5 w-3.5" />
        {copied ? 'Copié' : 'Copier'}
      </button>
    </div>
  )
}

/**
 * Réglage d’installation, replié : Google et Microsoft refusent la connexion
 * (redirect_uri_mismatch / invalid_request) tant que ces URI ne sont pas
 * déclarées au caractère près. On les affiche telles que le serveur les envoie.
 */
function CloudDepannage({ redirectUris }: { redirectUris: Record<CloudProviderId, string> }) {
  return (
    <details className="rounded-xl border border-line bg-foam p-3 text-xs text-muted">
      <summary className="cursor-pointer font-semibold text-ink">
        Google ou Microsoft refuse la connexion ?
      </summary>
      <p className="mt-2">
        Ces adresses de retour doivent être déclarées à l’identique dans la console du fournisseur,
        sans espace ni barre oblique finale. Comptez quelques minutes avant de réessayer.
      </p>
      {PROVIDERS.filter((provider) => redirectUris[provider]).map((provider) => (
        <div key={provider} className="mt-3">
          <p className="font-semibold text-ink">{CLOUD_PROVIDER_LABELS[provider]}</p>
          <UriACopier uri={redirectUris[provider]} />
          <p className="mt-1">{CLOUD_REDIRECT_CONSOLE_HINTS[provider]}</p>
        </div>
      ))}
    </details>
  )
}

/**
 * Mon entreprise — vraie connexion OAuth2 aux clouds société.
 * Le bouton ne renvoie plus vers une page externe : il lance le consentement du
 * fournisseur, puis ClimaZEN garde un refresh_token chiffré côté serveur.
 */
export function CloudConnectPanel({
  lienDossier,
  redirectPath = '/app/operateur',
}: {
  /** Lien de dossier saisi à la main dans le formulaire (option secours). */
  lienDossier?: string
  redirectPath?: string
}) {
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState<CloudConnectionsStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'' | CloudProviderId>('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const reload = useCallback(async () => {
    const res = await fetchCloudConnections()
    setLoading(false)
    if (!res) {
      setErr('Session requise — reconnectez-vous.')
      return
    }
    setStatus(res)
    if (res.error) setErr(explainCloudApiError(res.error))
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  // Retour du fournisseur : /app/operateur?cloud=google&status=connected
  useEffect(() => {
    const callback = cloudCallbackMessage(params)
    if (!callback) return
    if (callback.ok) {
      setMsg(callback.message)
      setErr('')
      void reload()
    } else {
      setErr(callback.message)
      setMsg('')
    }
    const next = new URLSearchParams(params)
    for (const key of ['cloud', 'status', 'reason', 'compte']) next.delete(key)
    setParams(next, { replace: true })
  }, [params, setParams, reload])

  const connect = (provider: CloudProviderId) => {
    setBusy(provider)
    setErr('')
    setMsg('')
    void startCloudOauth(provider, redirectPath)
      .then((res) => {
        if (!res.ok || !res.authorizeUrl) {
          setBusy('')
          setErr(res.error || 'Connexion impossible.')
          return
        }
        window.location.assign(res.authorizeUrl)
      })
      .catch((e: unknown) => {
        setBusy('')
        setErr(e instanceof Error ? e.message : 'Connexion impossible.')
      })
  }

  const disconnect = (provider: CloudProviderId) => {
    if (!confirm(`Déconnecter ${CLOUD_PROVIDER_LABELS[provider]} ? ClimaZEN oubliera le jeton.`)) {
      return
    }
    setBusy(provider)
    setErr('')
    setMsg('')
    void disconnectCloud(provider)
      .then(async (res) => {
        if (!res.ok) setErr(res.error || 'Déconnexion impossible.')
        else setMsg(`${CLOUD_PROVIDER_LABELS[provider]} déconnecté.`)
        await reload()
      })
      .finally(() => setBusy(''))
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement des connexions cloud…
      </p>
    )
  }

  const canEdit = status?.canEdit !== false
  const redirectUris = status?.redirectUris || { google: '', microsoft: '' }
  const unConnecte = PROVIDERS.some((p) => status?.connections?.[p]?.connected)

  return (
    <div className="space-y-3">
      {PROVIDERS.map((provider) => {
        const state = status?.connections?.[provider]
        const available = status?.available?.[provider] !== false
        const connected = Boolean(state?.connected)
        return (
          <div key={provider} className="rounded-xl border border-line bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold text-ink">{CLOUD_PROVIDER_LABELS[provider]}</h3>
                {connected ? (
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-teal-800">
                    <CheckCircle2 className="h-4 w-4" />
                    Connecté{state?.accountLabel ? ` · ${state.accountLabel}` : ''}
                  </p>
                ) : state?.needsReconnect ? (
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-amber-700">
                    <CloudOff className="h-4 w-4" />
                    Connexion expirée — recliquez sur « Connecter ».
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted">Pas encore connecté.</p>
                )}
                {!available ? (
                  <p className="mt-1 text-xs font-semibold text-amber-700">
                    Service momentanément indisponible — prévenez le support ClimaZEN.
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!canEdit || !available || busy === provider}
                  onClick={() => connect(provider)}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy === provider ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {connected ? 'Reconnecter' : CLOUD_CONNECT_BUTTON_LABELS[provider]}
                </button>
                {connected || state?.needsReconnect ? (
                  <button
                    type="button"
                    disabled={!canEdit || busy === provider}
                    onClick={() => disconnect(provider)}
                    className="inline-flex min-h-10 items-center rounded-xl border border-line bg-white px-3 text-sm font-semibold text-danger disabled:opacity-50"
                  >
                    Déconnecter
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        )
      })}

      {msg ? <p className="text-sm font-semibold text-teal-800">{msg}</p> : null}
      {err ? <p className="text-sm font-semibold text-rose-700">{err}</p> : null}

      {/* Rien à tester tant qu’aucun cloud n’est connecté ni aucun lien collé. */}
      {unConnecte || lienDossier?.trim() ? (
        <CloudWriteTest lienDossier={lienDossier} disabled={!canEdit} />
      ) : null}

      <CloudDepannage redirectUris={redirectUris} />
    </div>
  )
}
