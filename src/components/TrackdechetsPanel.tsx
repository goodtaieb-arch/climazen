import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  clearTrackdechetsToken,
  fetchTrackdechetsStatus,
  saveTrackdechetsToken,
  setTrackdechetsEnabled,
  testTrackdechetsConnection,
} from '../lib/trackdechets'

function explainApiError(raw: string | undefined): string {
  const e = String(raw || '').trim()
  if (!e) return ''
  if (/service role non configur/i.test(e)) {
    return 'Ajoutez SUPABASE_SERVICE_ROLE_KEY sur Vercel (Supabase → Settings → API → service_role), puis Redeploy.'
  }
  if (/sql_missing|organization_trackdechets_secrets|absente/i.test(e)) {
    return 'Exécutez supabase/trackdechets-secrets.sql dans Supabase SQL Editor.'
  }
  return e
}

/**
 * Mon entreprise — jeton API Trackdéchets personnel (généré par l'utilisateur
 * lui-même sur trackdechets.beta.gouv.fr) + activation de la création
 * automatique des BSFF. Désactivé par défaut : sans jeton ni activation, rien
 * ne change dans Stock Fluides (saisie manuelle de « Réf. BSFF » comme avant).
 */
export function TrackdechetsPanel() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [hasToken, setHasToken] = useState(false)
  const [hint, setHint] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [tokenInput, setTokenInput] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const reload = async () => {
    const res = await fetchTrackdechetsStatus()
    if (!res) {
      setErr('Session requise — reconnectez-vous.')
      setLoading(false)
      return
    }
    setHasToken(Boolean(res.hasToken))
    setHint(res.hint || '')
    setEnabled(Boolean(res.enabled))
    if (res.error) setErr(explainApiError(res.error))
    else setErr('')
    setLoading(false)
  }

  useEffect(() => {
    void reload()
  }, [])

  const testConnection = async () => {
    setBusy(true)
    setErr('')
    setMsg('')
    const res = await testTrackdechetsConnection(tokenInput.trim() || undefined)
    setBusy(false)
    if (!res.ok) {
      setErr(explainApiError(res.error) || 'Test impossible.')
      return
    }
    if (res.valid) {
      setMsg(`Connexion Trackdéchets OK${res.me?.name ? ` — ${res.me.name}` : ''}.`)
    } else {
      setErr(res.error || 'Jeton invalide ou expiré.')
    }
  }

  const saveToken = async () => {
    const token = tokenInput.trim()
    if (!token) return
    setBusy(true)
    setErr('')
    setMsg('')
    const res = await saveTrackdechetsToken(token)
    setBusy(false)
    if (!res.ok) {
      setErr(explainApiError(res.error) || 'Enregistrement impossible.')
      return
    }
    setMsg('Jeton Trackdéchets enregistré.')
    setTokenInput('')
    await reload()
  }

  const toggleEnabled = async (next: boolean) => {
    setBusy(true)
    setErr('')
    setMsg('')
    const res = await setTrackdechetsEnabled(next)
    setBusy(false)
    if (!res.ok) {
      setErr(explainApiError(res.error) || 'Action impossible.')
      return
    }
    setMsg(next ? 'Création automatique des BSFF activée.' : 'Création automatique désactivée.')
    await reload()
  }

  const removeToken = () => {
    if (!confirm('Retirer le jeton Trackdéchets ? La création automatique des BSFF sera désactivée.')) return
    void (async () => {
      setBusy(true)
      setErr('')
      setMsg('')
      const res = await clearTrackdechetsToken()
      setBusy(false)
      if (!res.ok) {
        setErr(explainApiError(res.error) || 'Action impossible.')
        return
      }
      setMsg('Jeton retiré.')
      await reload()
    })()
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
      </p>
    )
  }

  return (
    <section className="rounded-2xl border border-teal-200 bg-teal-50/40 p-5">
      <h2 className="font-display text-lg font-semibold text-teal-950">
        Trackdéchets — création automatique des BSFF
      </h2>
      <p className="mt-1 text-sm text-teal-900/85">
        Optionnel. Collez <strong>votre</strong> jeton personnel (généré par vous sur
        trackdechets.beta.gouv.fr → Mon compte → Applications et API → Jeton d’accès à l’API).
        ClimaZEN relaie vos actions avec vos propres droits — pas de jeton partagé. Sans jeton ni
        activation, rien ne change : le champ « Réf. BSFF » reste saisi à la main comme aujourd’hui.
      </p>

      <p className="mt-3 text-sm">
        {hasToken ? (
          <span className="font-semibold text-teal-800">
            Jeton enregistré{hint ? ` · ${hint}` : ''}
          </span>
        ) : (
          <span className="text-muted">Aucun jeton enregistré.</span>
        )}
      </p>

      <label className="mt-3 block text-sm">
        <span className="mb-1 block font-semibold text-teal-950">
          {hasToken ? 'Remplacer le jeton' : 'Coller le jeton Trackdéchets'}
        </span>
        <input
          type="password"
          autoComplete="off"
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          placeholder="Jeton d’accès à l’API Trackdéchets"
          className="h-11 w-full rounded-xl border border-teal-300 bg-white px-3 font-mono text-sm"
        />
      </label>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !tokenInput.trim()}
          onClick={() => void testConnection()}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-teal-400 bg-white px-4 text-sm font-semibold text-teal-900 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Tester la connexion
        </button>
        {hasToken ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void testConnection()}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-teal-400 bg-white px-4 text-sm font-semibold text-teal-900 disabled:opacity-50"
          >
            Tester le jeton enregistré
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy || !tokenInput.trim()}
          onClick={() => void saveToken()}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          Enregistrer le jeton
        </button>
        {hasToken ? (
          <button
            type="button"
            disabled={busy}
            onClick={removeToken}
            className="inline-flex min-h-10 items-center rounded-xl border border-line bg-white px-3 text-sm font-semibold text-danger"
          >
            Retirer le jeton
          </button>
        ) : null}
      </div>

      <label className="mt-4 flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          disabled={busy || !hasToken}
          onChange={(e) => void toggleEnabled(e.target.checked)}
          className="h-5 w-5 rounded border-teal-400"
        />
        <span className="font-semibold text-teal-950">
          Activer la création automatique des BSFF
        </span>
      </label>
      {!hasToken ? (
        <p className="mt-1 text-xs text-muted">Enregistrez d’abord un jeton pour pouvoir activer.</p>
      ) : null}

      {msg ? <p className="mt-3 text-sm font-semibold text-teal-800">{msg}</p> : null}
      {err ? <p className="mt-3 text-sm font-semibold text-rose-700">{err}</p> : null}
    </section>
  )
}
