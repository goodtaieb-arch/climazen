import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { clearOrgOpenaiKey, fetchOrgOpenaiStatus, saveOrgOpenaiKey } from '../lib/orgOpenai'
import { LOLA_SETUP_LINKS } from '../lib/lolaSetupLinks'
import { SetupLink } from './SetupLink'
import { AiLearningInfoNotice } from './AiLearningInfoNotice'

/**
 * Étape 1 — une clé OpenAI (site + Lola). Liens officiels pile sur la bonne page.
 */
export function OpenaiOrgKeyPanel() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [hasKey, setHasKey] = useState(false)
  const [hint, setHint] = useState('')
  const [canEdit, setCanEdit] = useState(false)
  const [keyInput, setKeyInput] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const reload = async () => {
    const res = await fetchOrgOpenaiStatus()
    if (!res) {
      setLoading(false)
      return
    }
    setHasKey(res.hasKey)
    setHint(res.hint)
    setCanEdit(res.canEdit)
    if (res.error) setErr(res.error)
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
      setErr(result.error || 'Enregistrement impossible.')
      return
    }
    setKeyInput('')
    setHasKey(true)
    setHint(result.hint || '')
    setMsg('Étape 1 OK — clé enregistrée.')
  }

  const clear = async () => {
    if (!confirm('Retirer la clé OpenAI de cette société ?')) return
    setBusy(true)
    setErr('')
    setMsg('')
    const result = await clearOrgOpenaiKey()
    setBusy(false)
    if (!result.ok) {
      setErr(result.error || 'Suppression impossible.')
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
          {' — '}cliquez <strong>Create new secret key</strong>, copiez, collez ici.
        </li>
      </ol>

      {hasKey ? (
        <p className="mt-3 text-sm font-semibold text-teal-800">
          Clé active {hint ? `· ${hint}` : ''}
        </p>
      ) : null}

      {canEdit ? (
        <>
          <label className="mt-3 block text-sm">
            <span className="mb-1 block font-semibold text-ink">Coller la clé ici</span>
            <input
              type="password"
              autoComplete="off"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="sk-…"
              className="h-11 w-full rounded-xl border border-line bg-white px-3 font-mono text-sm"
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
              Enregistrer
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
        </>
      ) : (
        <p className="mt-3 text-xs text-muted">Seul le gérant peut coller la clé.</p>
      )}

      {msg ? <p className="mt-2 text-sm font-semibold text-teal-800">{msg}</p> : null}
      {err ? <p className="mt-2 text-sm text-rose-700">{err}</p> : null}
    </section>
  )
}
