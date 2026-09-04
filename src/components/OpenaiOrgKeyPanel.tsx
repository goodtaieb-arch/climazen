import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  clearOrgOpenaiKey,
  fetchOrgOpenaiStatus,
  saveOrgAiConfig,
  type AiProviderId,
} from '../lib/orgOpenai'
import { LOLA_SETUP_LINKS } from '../lib/lolaSetupLinks'
import { SetupLink } from './SetupLink'
import { AiLearningInfoNotice } from './AiLearningInfoNotice'

const PROVIDERS: {
  id: AiProviderId
  label: string
  recommend?: string
  placeholder: string
  modelHint: string
}[] = [
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    recommend: 'Recommandé — plus à l’aise avec consignes longues et français métier',
    placeholder: 'sk-ant-…',
    modelHint: 'Claude Sonnet (défaut)',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    placeholder: 'sk-proj-… ou sk-…',
    modelHint: 'gpt-4o-mini (défaut)',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    placeholder: 'Clé AI Studio…',
    modelHint: 'gemini-2.5-flash (défaut)',
  },
]

function explainApiError(raw: string | undefined): string {
  const e = String(raw || '').trim()
  if (!e) return ''
  if (/invalid api key/i.test(e)) {
    return (
      'Clé Supabase service_role invalide sur Vercel. ' +
      'Dans Vercel, SUPABASE_SERVICE_ROLE_KEY doit être la clé « service_role » Supabase (eyJ…), ' +
      'PAS la clé IA. Puis Redeploy.'
    )
  }
  if (/service role non configur/i.test(e)) {
    return (
      'Ajoutez SUPABASE_SERVICE_ROLE_KEY sur Vercel (Supabase → Settings → API → service_role), puis Redeploy.'
    )
  }
  if (/sql_missing|organization_ai_secrets|absente|multi-IA|ai-org-providers/i.test(e)) {
    return (
      'Exécutez supabase/ai-org-openai.sql puis supabase/ai-org-providers.sql dans Supabase SQL Editor.'
    )
  }
  return e
}

/**
 * Étape 1 — choisir le fournisseur IA + coller la clé (site + Lola).
 */
export function OpenaiOrgKeyPanel() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [hasKey, setHasKey] = useState(false)
  const [hint, setHint] = useState('')
  const [provider, setProvider] = useState<AiProviderId>('anthropic')
  const [keys, setKeys] = useState({ openai: false, anthropic: false, gemini: false })
  const [keyInput, setKeyInput] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const meta = PROVIDERS.find((p) => p.id === provider) || PROVIDERS[0]

  const reload = async () => {
    const res = await fetchOrgOpenaiStatus()
    if (!res) {
      setErr('Session requise — reconnectez-vous.')
      setLoading(false)
      return
    }
    setHasKey(res.hasKey)
    setHint(res.hint)
    if (res.provider) setProvider(res.provider)
    if (res.keys) setKeys(res.keys)
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
    const result = await saveOrgAiConfig({
      provider,
      apiKey: keyInput.trim() || undefined,
      providerOnly: !keyInput.trim() && (keys[provider] || false),
    })
    setBusy(false)
    if (!result.ok) {
      setErr(explainApiError(result.error) || 'Enregistrement impossible.')
      return
    }
    setKeyInput('')
    setHasKey(Boolean(result.hint) || true)
    setHint(result.hint || '')
    setMsg(
      `Étape 1 OK — ${meta.label} actif. Même config pour l’assistant et Lola.`,
    )
    await reload()
  }

  const clear = async () => {
    if (!confirm('Retirer toutes les clés IA de cette société ?')) return
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
    setKeys({ openai: false, anthropic: false, gemini: false })
    setMsg('Clés retirées.')
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
            Intelligence IA (fournisseur)
          </h2>
          <p className="mt-1 text-sm text-violet-900/85">
            Choisissez le moteur : Claude (souvent plus précis sur le métier), OpenAI ou Gemini. Une
            clé pour tout — assistant dans l’app + Lola. Facturé sur{' '}
            <strong>votre</strong> compte fournisseur.
          </p>
        </div>
      </div>

      <AiLearningInfoNotice variant="full" className="mt-3" dismissible />

      <fieldset className="mt-4">
        <legend className="mb-2 text-sm font-extrabold text-violet-950">Fournisseur actif</legend>
        <div className="flex flex-col gap-2">
          {PROVIDERS.map((p) => (
            <label
              key={p.id}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 px-3 py-2.5 ${
                provider === p.id
                  ? 'border-violet-600 bg-white'
                  : 'border-violet-200/80 bg-white/60'
              }`}
            >
              <input
                type="radio"
                name="ai-provider"
                className="mt-1"
                checked={provider === p.id}
                onChange={() => {
                  setProvider(p.id)
                  setKeyInput('')
                  setMsg('')
                }}
              />
              <span>
                <span className="font-semibold text-violet-950">{p.label}</span>
                {keys[p.id] ? (
                  <span className="ml-2 text-xs font-semibold text-teal-700">clé OK</span>
                ) : null}
                {p.recommend ? (
                  <span className="mt-0.5 block text-xs text-violet-800/90">{p.recommend}</span>
                ) : (
                  <span className="mt-0.5 block text-xs text-muted">{p.modelHint}</span>
                )}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <ol className="mt-4 space-y-2 text-sm text-ink">
        {provider === 'anthropic' ? (
          <>
            <li>
              <span className="font-semibold">A.</span>{' '}
              <SetupLink href={LOLA_SETUP_LINKS.anthropicSignup.href}>
                {LOLA_SETUP_LINKS.anthropicSignup.label}
              </SetupLink>
            </li>
            <li>
              <span className="font-semibold">B.</span>{' '}
              <SetupLink href={LOLA_SETUP_LINKS.anthropicKeys.href}>
                {LOLA_SETUP_LINKS.anthropicKeys.label}
              </SetupLink>
              {' — '}créez une clé <strong>sk-ant-…</strong>
            </li>
          </>
        ) : null}
        {provider === 'openai' ? (
          <>
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
          </>
        ) : null}
        {provider === 'gemini' ? (
          <>
            <li>
              <span className="font-semibold">A.</span>{' '}
              <SetupLink href={LOLA_SETUP_LINKS.geminiKeys.href}>
                {LOLA_SETUP_LINKS.geminiKeys.label}
              </SetupLink>
            </li>
          </>
        ) : null}
      </ol>

      {hasKey && provider ? (
        <p className="mt-3 text-sm font-semibold text-teal-800">
          Actif : {meta.label}
          {hint ? ` · ${hint}` : ''}
        </p>
      ) : null}

      <label className="mt-4 block text-sm">
        <span className="mb-1 block font-extrabold text-violet-950">
          ↓ Coller la clé {meta.label} ici
        </span>
        <input
          type="password"
          autoComplete="off"
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          placeholder={meta.placeholder}
          className="h-12 w-full rounded-xl border-2 border-violet-400 bg-white px-3 font-mono text-sm shadow-sm"
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || (!keyInput.trim() && !keys[provider])}
          onClick={() => void save()}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-800 px-5 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {keyInput.trim() ? 'Enregistrer la clé' : 'Activer ce fournisseur'}
        </button>
        {hasKey || keys.openai || keys.anthropic || keys.gemini ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void clear()}
            className="inline-flex min-h-11 items-center rounded-xl border border-line bg-white px-4 text-sm font-semibold text-danger"
          >
            Tout retirer
          </button>
        ) : null}
      </div>

      {msg ? <p className="mt-2 text-sm font-semibold text-teal-800">{msg}</p> : null}
      {err ? <p className="mt-2 text-sm font-semibold text-rose-700">{err}</p> : null}
    </section>
  )
}
