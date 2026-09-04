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
 * Mon entreprise — OpenAI reste le moteur actif ;
 * on colle Claude à côté pour tester sans supprimer OpenAI.
 */
export function OpenaiOrgKeyPanel() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [active, setActive] = useState<AiProviderId>('openai')
  const [keys, setKeys] = useState({ openai: false, anthropic: false, gemini: false })
  const [hints, setHints] = useState({ openai: '', anthropic: '', gemini: '' })
  const [openaiInput, setOpenaiInput] = useState('')
  const [claudeInput, setClaudeInput] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const reload = async () => {
    const res = await fetchOrgOpenaiStatus()
    if (!res) {
      setErr('Session requise — reconnectez-vous.')
      setLoading(false)
      return
    }
    setActive((res.provider as AiProviderId) || 'openai')
    if (res.keys) setKeys(res.keys)
    if (res.hints) {
      setHints({
        openai: res.hints.openai || '',
        anthropic: res.hints.anthropic || '',
        gemini: res.hints.gemini || '',
      })
    } else {
      setHints({
        openai: res.keys?.openai && res.provider === 'openai' ? res.hint : res.keys?.openai ? 'enregistrée' : '',
        anthropic:
          res.keys?.anthropic && res.provider === 'anthropic'
            ? res.hint
            : res.keys?.anthropic
              ? 'enregistrée'
              : '',
        gemini:
          res.keys?.gemini && res.provider === 'gemini'
            ? res.hint
            : res.keys?.gemini
              ? 'enregistrée'
              : '',
      })
    }
    if (res.error) setErr(explainApiError(res.error))
    else setErr('')
    setLoading(false)
  }

  useEffect(() => {
    void reload()
  }, [])

  const run = async (
    fn: () => Promise<{ ok: boolean; error?: string; hint?: string; provider?: string }>,
    okMsg: string,
  ) => {
    setBusy(true)
    setErr('')
    setMsg('')
    const result = await fn()
    setBusy(false)
    if (!result.ok) {
      setErr(explainApiError(result.error) || 'Action impossible.')
      return
    }
    setMsg(okMsg)
    setOpenaiInput('')
    setClaudeInput('')
    await reload()
  }

  const saveOpenai = () =>
    void run(
      () =>
        saveOrgAiConfig({
          provider: 'openai',
          apiKey: openaiInput.trim(),
          // Si OpenAI est déjà actif, on reste dessus ; sinon on enregistre seulement la clé
          saveKeyOnly: active !== 'openai',
        }),
      active === 'openai'
        ? 'Clé OpenAI enregistrée (toujours actif).'
        : 'Clé OpenAI enregistrée (Claude / autre reste actif).',
    )

  const saveClaudeKeepOpenai = () =>
    void run(
      () =>
        saveOrgAiConfig({
          provider: 'anthropic',
          apiKey: claudeInput.trim(),
          saveKeyOnly: true, // ← ne change PAS le fournisseur actif
        }),
      'Clé Claude enregistrée. OpenAI reste actif — cliquez « Tester Claude » quand vous voulez.',
    )

  const activateClaude = () =>
    void run(
      () =>
        saveOrgAiConfig({
          provider: 'anthropic',
          apiKey: claudeInput.trim() || undefined,
          providerOnly: !claudeInput.trim() && keys.anthropic,
        }),
      'Claude est maintenant ACTIF (site + Lola). OpenAI est gardé en secours — vous pouvez y revenir.',
    )

  const activateOpenai = () =>
    void run(
      () =>
        saveOrgAiConfig({
          provider: 'openai',
          providerOnly: true,
        }),
      'Retour sur OpenAI (actif). La clé Claude est toujours enregistrée.',
    )

  const removeClaudeOnly = () => {
    if (!confirm('Retirer uniquement la clé Claude ? OpenAI n’est pas touché.')) return
    void (async () => {
      setBusy(true)
      setErr('')
      setMsg('')
      const cleared = await saveOrgAiConfig({
        provider: 'anthropic',
        clearKey: true,
        saveKeyOnly: true,
      })
      if (!cleared.ok) {
        setBusy(false)
        setErr(explainApiError(cleared.error) || 'Action impossible.')
        return
      }
      // Si Claude était actif → revenir à OpenAI automatiquement
      if (active === 'anthropic' && keys.openai) {
        await saveOrgAiConfig({ provider: 'openai', providerOnly: true })
      }
      setBusy(false)
      setMsg('Clé Claude retirée. OpenAI inchangé (et réactivé si besoin).')
      await reload()
    })()
  }

  const clearAll = () => {
    if (!confirm('Retirer TOUTES les clés IA (OpenAI + Claude) ?')) return
    void run(() => clearOrgOpenaiKey(), 'Toutes les clés retirées.')
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
            Intelligence IA — OpenAI + test Claude
          </h2>
          <p className="mt-1 text-sm text-violet-900/85">
            Pour l’instant <strong>OpenAI reste le moteur</strong>. Vous collez Claude à côté pour
            tester. Si Claude convient, basculez ; sinon vous restez sur OpenAI.
          </p>
        </div>
      </div>

      <AiLearningInfoNotice variant="full" className="mt-3" dismissible />

      <p className="mt-3 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-900">
        Actif maintenant :{' '}
        {active === 'anthropic' ? 'Claude' : active === 'gemini' ? 'Gemini' : 'OpenAI'}
        {active === 'openai' && keys.openai ? ' ✓' : ''}
        {active === 'anthropic' && keys.anthropic ? ' ✓' : ''}
      </p>

      {/* ——— OpenAI (garder) ——— */}
      <div className="mt-4 rounded-xl border-2 border-violet-300 bg-white p-4">
        <h3 className="font-semibold text-violet-950">
          OpenAI <span className="text-xs font-bold text-teal-700">(garder pour le moment)</span>
        </h3>
        <p className="mt-1 text-xs text-muted">
          {keys.openai
            ? `Clé présente${hints.openai ? ` · ${hints.openai}` : ''}`
            : 'Aucune clé OpenAI — collez-en une pour continuer à faire tourner l’assistant.'}
        </p>
        <ol className="mt-2 space-y-1 text-sm text-ink">
          <li>
            <SetupLink href={LOLA_SETUP_LINKS.openaiKeys.href}>
              {LOLA_SETUP_LINKS.openaiKeys.label}
            </SetupLink>
          </li>
        </ol>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block font-extrabold text-violet-950">
            ↓ Coller / mettre à jour la clé OpenAI (sk-…)
          </span>
          <input
            type="password"
            autoComplete="off"
            value={openaiInput}
            onChange={(e) => setOpenaiInput(e.target.value)}
            placeholder="sk-proj-… ou sk-…"
            className="h-11 w-full rounded-xl border-2 border-violet-300 bg-white px-3 font-mono text-sm"
          />
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !openaiInput.trim()}
            onClick={saveOpenai}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-violet-800 px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Enregistrer OpenAI
          </button>
          {active !== 'openai' && keys.openai ? (
            <button
              type="button"
              disabled={busy}
              onClick={activateOpenai}
              className="inline-flex min-h-10 items-center rounded-xl border border-violet-400 bg-white px-4 text-sm font-semibold text-violet-900"
            >
              Revenir sur OpenAI
            </button>
          ) : null}
        </div>
      </div>

      {/* ——— Claude (test) ——— */}
      <div className="mt-4 rounded-xl border-2 border-amber-300 bg-amber-50/50 p-4">
        <h3 className="font-semibold text-amber-950">
          Claude (Anthropic){' '}
          <span className="text-xs font-bold text-amber-800">— coller pour tester</span>
        </h3>
        <p className="mt-1 text-xs text-amber-950/80">
          Enregistrer la clé <strong>ne coupe pas OpenAI</strong>. Ensuite seulement : « Tester
          Claude ». Si ça ne va pas → « Revenir sur OpenAI ».
        </p>
        <ol className="mt-2 space-y-1 text-sm text-ink">
          <li>
            A.{' '}
            <SetupLink href={LOLA_SETUP_LINKS.anthropicSignup.href}>
              {LOLA_SETUP_LINKS.anthropicSignup.label}
            </SetupLink>
            {' · '}
            <SetupLink href="https://www.anthropic.com/pricing">Voir les tarifs</SetupLink>
          </li>
          <li>
            B.{' '}
            <SetupLink href={LOLA_SETUP_LINKS.anthropicKeys.href}>
              {LOLA_SETUP_LINKS.anthropicKeys.label}
            </SetupLink>{' '}
            — clé <strong>sk-ant-…</strong>
          </li>
        </ol>
        {keys.anthropic ? (
          <p className="mt-2 text-sm font-semibold text-teal-800">
            Clé Claude déjà enregistrée
            {hints.anthropic ? ` · ${hints.anthropic}` : ''}
          </p>
        ) : null}
        <label className="mt-3 block text-sm">
          <span className="mb-1 block font-extrabold text-amber-950">
            ↓ Coller la clé Claude ici (sk-ant-…)
          </span>
          <input
            type="password"
            autoComplete="off"
            value={claudeInput}
            onChange={(e) => setClaudeInput(e.target.value)}
            placeholder="sk-ant-…"
            className="h-11 w-full rounded-xl border-2 border-amber-400 bg-white px-3 font-mono text-sm"
          />
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !claudeInput.trim()}
            onClick={saveClaudeKeepOpenai}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border-2 border-amber-600 bg-white px-4 text-sm font-bold text-amber-950 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Enregistrer Claude (garder OpenAI actif)
          </button>
          <button
            type="button"
            disabled={busy || (!claudeInput.trim() && !keys.anthropic)}
            onClick={activateClaude}
            className="inline-flex min-h-10 items-center rounded-xl bg-amber-700 px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            Tester Claude (activer)
          </button>
          {keys.anthropic ? (
            <button
              type="button"
              disabled={busy}
              onClick={removeClaudeOnly}
              className="inline-flex min-h-10 items-center rounded-xl border border-line bg-white px-3 text-sm font-semibold text-danger"
            >
              Retirer Claude seulement
            </button>
          ) : null}
        </div>
      </div>

      {(keys.openai || keys.anthropic || keys.gemini) && (
        <button
          type="button"
          disabled={busy}
          onClick={clearAll}
          className="mt-4 text-xs font-semibold text-danger underline"
        >
          Tout retirer (OpenAI + Claude)
        </button>
      )}

      {msg ? <p className="mt-2 text-sm font-semibold text-teal-800">{msg}</p> : null}
      {err ? <p className="mt-2 text-sm font-semibold text-rose-700">{err}</p> : null}
    </section>
  )
}
