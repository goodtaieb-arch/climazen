import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { clearOrgOpenaiKey, fetchOrgOpenaiStatus, saveOrgOpenaiKey } from '../lib/orgOpenai'
import { LOLA_SETUP_LINKS } from '../lib/lolaSetupLinks'
import { SetupLink } from './SetupLink'
import { AiLearningInfoNotice } from './AiLearningInfoNotice'

function explainApiError(raw: string | undefined): string {
  const e = String(raw || '').trim()
  if (!e) return ''
  if (/invalid api key/i.test(e)) {
    return (
      'Clé Supabase service_role invalide sur Vercel. ' +
      'Dans Vercel, SUPABASE_SERVICE_ROLE_KEY doit être la clé « service_role » Supabase (eyJ…), ' +
      'PAS la clé OpenAI sk-. Puis Redeploy.'
    )
  }
  if (/service role non configur/i.test(e)) {
    return (
      'Ajoutez SUPABASE_SERVICE_ROLE_KEY sur Vercel (Supabase → Settings → API → service_role), puis Redeploy.'
    )
  }
  if (/sql_missing|organization_ai_secrets|absente/i.test(e)) {
    return 'Exécutez supabase/ai-org-openai.sql dans Supabase SQL Editor, puis réessayez.'
  }
  return e
}

/**
 * Étape 1 — une clé OpenAI (site + Lola). Liens officiels pile sur la bonne page.
 * Affiché uniquement au gérant (OperateurPage).
 */
export function OpenaiOrgKeyPanel() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [hasKey, setHasKey] = useState(false)
  const [hint, setHint] = useState('')
  const [keyInput, setKeyInput] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const reload = async () => {
    const res = await fetchOrgOpenaiStatus()
    if (!res) {
      setErr('Session requise — reconnectez-vous.')
      setLoading(false)
      return
    }
    setHasKey(res.hasKey)
    setHint(res.hint)
    if (res.error) setErr(explainApiError(res.error))
    else setErr('')
    setLoading(false)
  }

  useEffect(() => {
    void reload()
  }, [])

  const save = async () => {
    setBusy(true)
    setErr('')
    setMsg('')
    const result = await saveOrgOpenaiKey(keyInput)
    setBusy(false)
    if (!result.ok) {
      setErr(explainApiError(result.error) || 'Enregistrement impossible.')
      return
    }
    setKeyInput('')
    setHasKey(true)
    setHint(result.hint || '')
    setMsg('Étape 1 OK — clé OpenAI enregistrée. Vous pouvez tester l’assistant.')
  }

  const clear = async () => {
    if (!confirm('Retirer la clé OpenAI de cette société ?')) return
    setBusy(true)
    setErr('')
    setMsg('')
    const result = await clearOrgOpenaiKey()
    setBusy(false)
    if (!result.ok) {
      setErr(explainApiError(result.error) || 'Suppression impossible.')
      return
    }
    setHasKey(false)
    setHint('')
    setMsg('Clé retirée.')
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
      </p>
    )
  }

  return (
    <section className="rounded-2xl border border-violet-200 bg-violet-50/40 p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-700 text-sm font-extrabold text-white">
          1
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold text-violet-950">
            Compte OpenAI
          </h2>
          <p className="mt-1 text-sm text-violet-900/85">
            Une clé pour tout : assistant dans l’app + Lola au téléphone. OpenAI facture{' '}
            <strong>votre</strong> société.
          </p>
        </div>
      </div>

      <AiLearningInfoNotice variant="full" className="mt-3" dismissible />

      <ol className="mt-4 space-y-2 text-sm text-ink">
        <li>
          <span className="font-semibold">A.</span>{' '}
          <SetupLink href={LOLA_SETUP_LINKS.openaiSignup.href}>
            {LOLA_SETUP_LINKS.openaiSignup.label}
          </SetupLink>
        </li>
        <li>
          <span className="font-semibold">B.</span>{' '}
          <SetupLink href={LOLA_SETUP_LINKS.openaiBilling.href}>
            {LOLA_SETUP_LINKS.openaiBilling.label}
          </SetupLink>
        </li>
        <li>
          <span className="font-semibold">C.</span>{' '}
          <SetupLink href={LOLA_SETUP_LINKS.openaiKeys.href}>
            {LOLA_SETUP_LINKS.openaiKeys.label}
          </SetupLink>
          {' — '}cliquez <strong>Create new secret key</strong>, copiez.
        </li>
      </ol>

      {hasKey ? (
        <p className="mt-3 text-sm font-semibold text-teal-800">
          Clé active {hint ? `· ${hint}` : ''}
        </p>
      ) : null}

      <label className="mt-4 block text-sm">
        <span className="mb-1 block font-extrabold text-violet-950">
          ↓ Coller la clé OpenAI ici (sk-…)
        </span>
        <input
          type="password"
          autoComplete="off"
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          placeholder="sk-proj-… ou sk-…"
          className="h-12 w-full rounded-xl border-2 border-violet-400 bg-white px-3 font-mono text-sm shadow-sm"
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !keyInput.trim()}
          onClick={() => void save()}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-800 px-5 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Enregistrer la clé
        </button>
        {hasKey ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void clear()}
            className="inline-flex min-h-11 items-center rounded-xl border border-line bg-white px-4 text-sm font-semibold text-danger"
          >
            Retirer
          </button>
        ) : null}
      </div>

      {msg ? <p className="mt-2 text-sm font-semibold text-teal-800">{msg}</p> : null}
      {err ? <p className="mt-2 text-sm font-semibold text-rose-700">{err}</p> : null}
    </section>
  )
}
