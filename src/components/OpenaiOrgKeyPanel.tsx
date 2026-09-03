import { useEffect, useState } from 'react'
import { KeyRound, Loader2, Shield } from 'lucide-react'
import { clearOrgOpenaiKey, fetchOrgOpenaiStatus, saveOrgOpenaiKey } from '../lib/orgOpenai'

/**
 * Mon entreprise — une clé OpenAI pour le site ET Lola (chaque société paie son usage).
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
    setMsg('Clé enregistrée — Lola et l’assistant du site utilisent OpenAI (votre facture).')
  }

  const clear = async () => {
    if (!confirm('Retirer la clé OpenAI de cette société ? L’IA cloud s’arrête jusqu’à une nouvelle clé.')) {
      return
    }
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
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement clé OpenAI…
      </p>
    )
  }

  return (
    <section className="rounded-2xl border border-violet-200 bg-violet-50/40 p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-700 text-white">
          <KeyRound className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold text-violet-950">
            Clé OpenAI de la société
          </h2>
          <p className="mt-1 text-sm text-violet-900/85">
            <strong>Une seule intelligence</strong> : OpenAI pour l’assistant dans l’app{' '}
            <em>et</em> pour Lola au téléphone. Chaque société colle <strong>sa</strong> clé —
            OpenAI facture <strong>votre</strong> compte, pas ClimaZEN.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
        <Shield className="mb-1 inline h-3.5 w-3.5" />{' '}
        1. Compte sur platform.openai.com → 2. Activer la facturation → 3. Créer une clé API (sk-…)
        → 4. La coller ici. Ne partagez pas cette clé. Elle n’est jamais réaffichée en entier.
      </div>

      {hasKey ? (
        <p className="mt-3 text-sm font-semibold text-teal-800">
          Clé active {hint ? `· ${hint}` : ''} — site + Lola
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted">Aucune clé — l’IA cloud est en guide local uniquement.</p>
      )}

      {canEdit ? (
        <>
          <label className="mt-3 block text-sm">
            <span className="mb-1 block font-semibold text-ink">
              {hasKey ? 'Remplacer la clé' : 'Coller la clé OpenAI'}
            </span>
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
              Enregistrer la clé
            </button>
            {hasKey ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void clear()}
                className="inline-flex min-h-11 items-center rounded-xl border border-line bg-white px-4 text-sm font-semibold text-danger"
              >
                Retirer la clé
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <p className="mt-3 text-xs text-muted">Seul le gérant peut coller ou retirer la clé.</p>
      )}

      {msg ? <p className="mt-2 text-sm font-semibold text-teal-800">{msg}</p> : null}
      {err ? <p className="mt-2 text-sm text-rose-700">{err}</p> : null}
    </section>
  )
}
