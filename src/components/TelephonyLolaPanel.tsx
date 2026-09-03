import { useEffect, useState } from 'react'
import { Copy, Loader2 } from 'lucide-react'
import { fetchTelephonyConfig, saveTelephonyConfig } from '../lib/telephony'
import { LOLA_SETUP_LINKS, LOLA_WEBHOOK_URL } from '../lib/lolaSetupLinks'
import { SetupLink } from './SetupLink'

/**
 * Étape 2 — un numéro Twilio. Liens officiels pile sur la bonne page.
 */
export function TelephonyLolaPanel() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState(LOLA_WEBHOOK_URL)
  const [inboundNumber, setInboundNumber] = useState('')
  const [lolaEnabled, setLolaEnabled] = useState(true)
  const [managerEmail, setManagerEmail] = useState('')

  useEffect(() => {
    void fetchTelephonyConfig().then((res) => {
      if (!res) {
        setLoading(false)
        return
      }
      setWebhookUrl(res.webhookUrl || LOLA_WEBHOOK_URL)
      if (res.config) {
        setInboundNumber(res.config.inboundE164)
        setLolaEnabled(res.config.lolaEnabled)
        setManagerEmail(res.config.managerNotifyEmail || '')
      }
      setLoading(false)
    })
  }, [])

  const copyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setErr('Copie impossible — sélectionnez l’URL à la main.')
    }
  }

  const save = async () => {
    setBusy(true)
    setErr('')
    setMsg('')
    const result = await saveTelephonyConfig({
      inboundNumber,
      provider: 'twilio',
      lolaEnabled,
      managerNotifyEmail: managerEmail.trim() || undefined,
    })
    setBusy(false)
    if (!result.ok) {
      setErr(result.error || 'Enregistrement impossible.')
      return
    }
    setMsg(`Étape 2 OK — numéro ${result.inboundE164 || inboundNumber}`)
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
      </p>
    )
  }

  return (
    <section className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-600 text-sm font-extrabold text-white">
          2
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold text-indigo-950">
            Numéro Twilio
          </h2>
          <p className="mt-1 text-sm text-indigo-900/85">
            Un numéro France pour recevoir les appels. Rien d’autre à installer.
          </p>
        </div>
      </div>

      <ol className="mt-4 space-y-2 text-sm text-ink">
        <li>
          <span className="font-semibold">A.</span>{' '}
          <SetupLink href={LOLA_SETUP_LINKS.twilioSignup.href}>
            {LOLA_SETUP_LINKS.twilioSignup.label}
          </SetupLink>
        </li>
        <li>
          <span className="font-semibold">B.</span>{' '}
          <SetupLink href={LOLA_SETUP_LINKS.twilioBuyNumber.href}>
            {LOLA_SETUP_LINKS.twilioBuyNumber.label}
          </SetupLink>
          {' — '}pays <strong>France</strong>, case <strong>Voice</strong>, puis Buy.
        </li>
        <li>
          <span className="font-semibold">C.</span>{' '}
          <SetupLink href={LOLA_SETUP_LINKS.twilioMyNumbers.href}>
            {LOLA_SETUP_LINKS.twilioMyNumbers.label}
          </SetupLink>
          {' — '}cliquez le numéro → <strong>A call comes in</strong> → Webhook → collez
          l’adresse ci-dessous → Save.
        </li>
      </ol>

      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-2">
        <code className="min-w-0 flex-1 break-all text-xs font-semibold text-ink">{webhookUrl}</code>
        <button
          type="button"
          onClick={() => void copyWebhook()}
          className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-line px-2 text-xs font-bold"
        >
          <Copy className="h-3.5 w-3.5" />
          {copied ? 'Copié' : 'Copier'}
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-semibold text-ink">D. Coller le numéro ici (+33…)</span>
          <input
            value={inboundNumber}
            onChange={(e) => setInboundNumber(e.target.value)}
            placeholder="+33612345678"
            className="h-11 w-full rounded-xl border border-line bg-white px-3"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-semibold text-ink">
            E-mail fallback gérant (si aucun responsable secteur)
          </span>
          <input
            type="email"
            value={managerEmail}
            onChange={(e) => setManagerEmail(e.target.value)}
            placeholder="responsable@societe.fr"
            className="h-11 w-full rounded-xl border border-line bg-white px-3"
          />
          <span className="mt-1 block text-[11px] text-muted">
            Sinon la notification part au responsable / pilote dont les métiers couvrent le
            secteur de l’appel (Équipe → poste + métiers couverts).
          </span>
        </label>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm font-medium text-ink">
        <input
          type="checkbox"
          checked={lolaEnabled}
          onChange={(e) => setLolaEnabled(e.target.checked)}
          className="h-4 w-4 rounded border-line"
        />
        Activer Lola
      </label>

      <button
        type="button"
        disabled={busy || !inboundNumber.trim()}
        onClick={() => void save()}
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-700 px-5 text-sm font-bold text-white disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Enregistrer
      </button>

      {msg ? <p className="mt-2 text-sm font-semibold text-teal-800">{msg}</p> : null}
      {err ? <p className="mt-2 text-sm text-rose-700">{err}</p> : null}
    </section>
  )
}
