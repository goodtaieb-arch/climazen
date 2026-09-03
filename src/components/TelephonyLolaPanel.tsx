import { useEffect, useState } from 'react'
import { Loader2, Phone, Shield } from 'lucide-react'
import {
  fetchTelephonyConfig,
  saveTelephonyConfig,
  TELEPHONY_PROVIDERS,
  type TelephonyProvider,
} from '../lib/telephony'

/**
 * Mon entreprise — numéro entrant Lola (1 numéro = 1 société, pas de mélange).
 */
export function TelephonyLolaPanel() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('https://climazen.fr/api/telephony-inbound')
  const [setupSteps, setSetupSteps] = useState<string[]>([])
  const [provider, setProvider] = useState<TelephonyProvider>('twilio')
  const [inboundNumber, setInboundNumber] = useState('')
  const [lolaEnabled, setLolaEnabled] = useState(false)
  const [managerEmail, setManagerEmail] = useState('')

  useEffect(() => {
    void fetchTelephonyConfig().then((res) => {
      if (!res) {
        setLoading(false)
        return
      }
      setWebhookUrl(res.webhookUrl)
      setSetupSteps(res.setupSteps || [])
      if (res.config) {
        setProvider(res.config.provider)
        setInboundNumber(res.config.inboundE164)
        setLolaEnabled(res.config.lolaEnabled)
        setManagerEmail(res.config.managerNotifyEmail || '')
      }
      setLoading(false)
    })
  }, [])

  const save = async () => {
    setBusy(true)
    setErr('')
    setMsg('')
    const result = await saveTelephonyConfig({
      inboundNumber,
      provider,
      lolaEnabled,
      managerNotifyEmail: managerEmail.trim() || undefined,
    })
    setBusy(false)
    if (!result.ok) {
      setErr(result.error || 'Enregistrement impossible.')
      return
    }
    if (result.setupSteps) setSetupSteps(result.setupSteps)
    setMsg(`Numéro enregistré : ${result.inboundE164 || inboundNumber}`)
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement téléphonie…
      </p>
    )
  }

  return (
    <section className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white">
          <Phone className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold text-indigo-950">
            Accueil téléphonique Lola
          </h2>
          <p className="mt-1 text-sm text-indigo-900/85">
            <strong>Un numéro par société</strong> — les appels sont routés vers votre coffre
            ClimaZEN uniquement. Lola et l’assistant du site utilisent <strong>la même clé
            OpenAI</strong> de votre société (collée ci-dessus) — jamais les données d’une autre
            société.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
        <Shield className="mb-1 inline h-3.5 w-3.5" />{' '}
        <strong>À votre charge :</strong> acheter un numéro chez Twilio (ou Vonage / Plivo).
        ClimaZEN ne vend pas encore de ligne — vous gardez le contrôle et l’isolation.
      </div>

      <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-slate">
        {(setupSteps.length ? setupSteps : [
          'Compte Twilio + numéro français (voice).',
          `Webhook appel entrant → ${webhookUrl}`,
          'Saisir le numéro ci-dessous et activer Lola.',
        ]).map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      <p className="mt-3 text-xs text-muted">
        Webhook ClimaZEN :{' '}
        <code className="rounded bg-white px-1 py-0.5">{webhookUrl}</code>
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-ink">Fournisseur</span>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as TelephonyProvider)}
            className="h-11 w-full rounded-xl border border-line bg-white px-3"
          >
            {TELEPHONY_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-ink">Numéro entrant (+33…)</span>
          <input
            value={inboundNumber}
            onChange={(e) => setInboundNumber(e.target.value)}
            placeholder="+33612345678"
            className="h-11 w-full rounded-xl border border-line bg-white px-3"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-semibold text-ink">E-mail gérant (accord OT Lola)</span>
          <input
            type="email"
            value={managerEmail}
            onChange={(e) => setManagerEmail(e.target.value)}
            placeholder="gerant@societe.fr"
            className="h-11 w-full rounded-xl border border-line bg-white px-3"
          />
        </label>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm font-medium text-ink">
        <input
          type="checkbox"
          checked={lolaEnabled}
          onChange={(e) => setLolaEnabled(e.target.checked)}
          className="h-4 w-4 rounded border-line"
        />
        Activer Lola sur ce numéro
      </label>

      <button
        type="button"
        disabled={busy || !inboundNumber.trim()}
        onClick={() => void save()}
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-700 px-5 text-sm font-bold text-white disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Enregistrer le numéro
      </button>

      {msg ? <p className="mt-2 text-sm font-semibold text-teal-800">{msg}</p> : null}
      {err ? <p className="mt-2 text-sm text-rose-700">{err}</p> : null}
    </section>
  )
}
