import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  clearInvoicingCredentials,
  fetchInvoicingStatus,
  saveInvoicingCredentials,
  setInvoicingEnabled,
  setInvoicingFranchiseTva,
  testInvoicingConnection,
} from '../lib/invoicing'
import { INVOICING_PROVIDERS, type InvoicingProviderId } from '../lib/invoicingProviders'

function explainApiError(raw: string | undefined): string {
  const e = String(raw || '').trim()
  if (!e) return ''
  if (/service role non configur/i.test(e)) {
    return 'Ajoutez SUPABASE_SERVICE_ROLE_KEY sur Vercel (Supabase → Settings → API → service_role), puis Redeploy.'
  }
  if (/sql_missing|organization_invoicing_secrets|absente/i.test(e)) {
    return 'Exécutez supabase/invoicing-secrets.sql dans Supabase SQL Editor.'
  }
  return e
}

/**
 * Mon entreprise — facturation électronique Factur-X, multi-prestataire
 * (cahier des charges §7). Chaque société choisit son prestataire (FactPulse
 * aujourd'hui ; IOPOLE / B2Brouter à venir) et colle SES identifiants —
 * jamais de prestataire imposé ni d'identifiant partagé par ClimaZEN.
 * Désactivé par défaut : sans identifiants ni activation, rien ne change —
 * la facturation reste manuelle ou via Tiime/Pennylane (section
 * « Facturation » ci-dessous).
 */
export function InvoicingPanel() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [provider, setProvider] = useState<InvoicingProviderId>('factpulse')
  const [hasCredentials, setHasCredentials] = useState(false)
  const [email, setEmail] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [franchiseTva, setFranchiseTva] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [clientUidInput, setClientUidInput] = useState('')
  const [testedOk, setTestedOk] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const providerMeta = INVOICING_PROVIDERS.find((p) => p.id === provider) || INVOICING_PROVIDERS[0]

  const reload = async () => {
    const res = await fetchInvoicingStatus()
    if (!res) {
      setErr('Session requise — reconnectez-vous.')
      setLoading(false)
      return
    }
    setProvider(res.provider || 'factpulse')
    setHasCredentials(Boolean(res.hasCredentials))
    setEmail(res.email || '')
    setEnabled(Boolean(res.enabled))
    setFranchiseTva(Boolean(res.franchiseTva))
    setTestedOk(Boolean(res.enabled))
    if (res.error) setErr(explainApiError(res.error))
    else setErr('')
    setLoading(false)
  }

  useEffect(() => {
    void reload()
  }, [])

  const changeProvider = (next: InvoicingProviderId) => {
    setProvider(next)
    setTestedOk(false)
    setMsg('')
    setErr('')
  }

  const testConnection = async () => {
    setBusy(true)
    setErr('')
    setMsg('')
    const res = await testInvoicingConnection({
      provider,
      email: emailInput.trim() || undefined,
      password: passwordInput || undefined,
      clientUid: clientUidInput.trim() || undefined,
    })
    setBusy(false)
    if (!res.ok) {
      setErr(explainApiError(res.error) || 'Test impossible.')
      return
    }
    if (res.valid) {
      setTestedOk(true)
      setMsg(`Connexion ${providerMeta.label} OK${res.me?.email ? ` — ${res.me.email}` : ''}.`)
    } else {
      setTestedOk(false)
      setErr(res.error || 'Identifiants invalides.')
    }
  }

  const saveCredentials = async () => {
    const emailTrim = emailInput.trim()
    const password = passwordInput
    if (!emailTrim || !password) return
    setBusy(true)
    setErr('')
    setMsg('')
    const res = await saveInvoicingCredentials({
      provider,
      email: emailTrim,
      password,
      clientUid: clientUidInput.trim() || undefined,
    })
    setBusy(false)
    if (!res.ok) {
      setErr(explainApiError(res.error) || 'Enregistrement impossible.')
      return
    }
    setMsg(`Identifiants ${providerMeta.label} enregistrés.`)
    setPasswordInput('')
    await reload()
  }

  const toggleEnabled = async (next: boolean) => {
    setBusy(true)
    setErr('')
    setMsg('')
    const res = await setInvoicingEnabled(next)
    setBusy(false)
    if (!res.ok) {
      setErr(explainApiError(res.error) || 'Action impossible.')
      return
    }
    setMsg(next ? 'Facturation électronique activée.' : 'Facturation électronique désactivée.')
    await reload()
  }

  const toggleFranchiseTva = async (next: boolean) => {
    setBusy(true)
    setErr('')
    setMsg('')
    const res = await setInvoicingFranchiseTva(next)
    setBusy(false)
    if (!res.ok) {
      setErr(explainApiError(res.error) || 'Action impossible.')
      return
    }
    await reload()
  }

  const removeCredentials = () => {
    if (!confirm('Retirer ces identifiants ? La facturation électronique sera désactivée.')) return
    void (async () => {
      setBusy(true)
      setErr('')
      setMsg('')
      const res = await clearInvoicingCredentials()
      setBusy(false)
      if (!res.ok) {
        setErr(explainApiError(res.error) || 'Action impossible.')
        return
      }
      setMsg('Identifiants retirés.')
      setTestedOk(false)
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
        Facturation électronique (Factur-X)
      </h2>
      <p className="mt-1 text-sm text-teal-900/85">
        Optionnel. Chaque société choisit <strong>son</strong> prestataire agréé et achète <strong>son propre</strong>{' '}
        abonnement — ClimaZEN ne facture rien pour ce service et ne mutualise rien, ni n'impose de prestataire.
        Mêmes principes que Trackdéchets ci-dessus. Sans identifiants ni activation, rien ne change : la
        facturation reste manuelle ou via Tiime/Pennylane (section « Facturation » plus bas).
      </p>

      <label className="mt-3 block text-sm">
        <span className="mb-1 block font-semibold text-teal-950">Prestataire</span>
        <select
          value={provider}
          onChange={(e) => changeProvider(e.target.value as InvoicingProviderId)}
          className="h-11 w-full max-w-xs rounded-xl border border-teal-300 bg-white px-3 text-sm sm:w-auto"
        >
          {INVOICING_PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
              {p.available ? '' : ' (bientôt disponible)'}
            </option>
          ))}
        </select>
      </label>

      {!providerMeta.available ? (
        <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {providerMeta.label} n'est pas encore intégré dans ClimaZEN — bientôt disponible.{' '}
          <a href={providerMeta.url} target="_blank" rel="noreferrer" className="underline">
            En savoir plus
          </a>
          .
        </p>
      ) : (
        <>
          <p className="mt-3 text-sm text-teal-900/85">
            Créez votre abonnement sur{' '}
            <a href={providerMeta.url} target="_blank" rel="noreferrer" className="underline">
              {providerMeta.url.replace(/^https:\/\//, '')}
            </a>{' '}
            puis collez vos identifiants (email + mot de passe, client_uid optionnel — Configuration → Clients sur
            le tableau de bord {providerMeta.label}).
          </p>

          <p className="mt-3 text-sm">
            {hasCredentials ? (
              <span className="font-semibold text-teal-800">
                Identifiants enregistrés{email ? ` · ${email}` : ''}
              </span>
            ) : (
              <span className="text-muted">Aucun identifiant enregistré.</span>
            )}
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-semibold text-teal-950">
                {hasCredentials ? 'Remplacer l’email' : `Email ${providerMeta.label}`}
              </span>
              <input
                type="email"
                autoComplete="off"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="dev@example.com"
                className="h-11 w-full rounded-xl border border-teal-300 bg-white px-3 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-teal-950">
                {hasCredentials ? 'Remplacer le mot de passe' : `Mot de passe ${providerMeta.label}`}
              </span>
              <input
                type="password"
                autoComplete="off"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                className="h-11 w-full rounded-xl border border-teal-300 bg-white px-3 font-mono text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-teal-950">client_uid (optionnel)</span>
              <input
                type="text"
                autoComplete="off"
                value={clientUidInput}
                onChange={(e) => setClientUidInput(e.target.value)}
                placeholder="550e8400-e29b-41d4-a716-446655440000"
                className="h-11 w-full rounded-xl border border-teal-300 bg-white px-3 font-mono text-sm"
              />
            </label>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || (!emailInput.trim() && !hasCredentials) || (!passwordInput && !hasCredentials)}
              onClick={() => void testConnection()}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-teal-400 bg-white px-4 text-sm font-semibold text-teal-900 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Tester la connexion
            </button>
            <button
              type="button"
              disabled={busy || !emailInput.trim() || !passwordInput}
              onClick={() => void saveCredentials()}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              Enregistrer
            </button>
            {hasCredentials ? (
              <button
                type="button"
                disabled={busy}
                onClick={removeCredentials}
                className="inline-flex min-h-10 items-center rounded-xl border border-line bg-white px-3 text-sm font-semibold text-danger"
              >
                Retirer les identifiants
              </button>
            ) : null}
          </div>

          <label className="mt-4 flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              disabled={busy || !hasCredentials || !testedOk}
              onChange={(e) => void toggleEnabled(e.target.checked)}
              className="h-5 w-5 rounded border-teal-400"
            />
            <span className="font-semibold text-teal-950">Activer la facturation électronique</span>
          </label>
          {!hasCredentials ? (
            <p className="mt-1 text-xs text-muted">Enregistrez d’abord des identifiants pour pouvoir activer.</p>
          ) : !testedOk ? (
            <p className="mt-1 text-xs text-muted">Testez la connexion avec succès pour pouvoir activer.</p>
          ) : null}
        </>
      )}

      <label className="mt-4 flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={franchiseTva}
          disabled={busy}
          onChange={(e) => void toggleFranchiseTva(e.target.checked)}
          className="h-5 w-5 rounded border-teal-400"
        />
        <span className="font-semibold text-teal-950">Société en franchise en base de TVA</span>
      </label>
      <p className="mt-1 text-xs text-muted">
        Auto-entrepreneur ou franchise en base (article 293 B du CGI) — mention « TVA non applicable » sur les
        factures. À confirmer avec votre comptable.
      </p>

      {msg ? <p className="mt-3 text-sm font-semibold text-teal-800">{msg}</p> : null}
      {err ? <p className="mt-3 text-sm font-semibold text-rose-700">{err}</p> : null}
    </section>
  )
}
