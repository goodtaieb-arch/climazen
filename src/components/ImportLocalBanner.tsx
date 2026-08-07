import { useMemo, useState } from 'react'
import {
  findLocalOrgDataCandidates,
  isAppDataEmpty,
  markLocalImportDone,
  wasLocalImportDone,
} from '../lib/auth'
import { useAuth } from '../lib/AuthContext'
import { useStore } from '../lib/store'

/** Propose d’importer les anciennes données localStorage vers le cloud (une fois). */
export function ImportLocalBanner() {
  const { user } = useAuth()
  const { data, replaceData, loading } = useStore()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [error, setError] = useState('')

  const candidates = useMemo(() => findLocalOrgDataCandidates(), [user?.organizationId, done])

  if (!user?.organizationId || loading || done || hidden) return null
  if (wasLocalImportDone(user.organizationId)) return null
  if (!isAppDataEmpty(data)) return null
  if (candidates.length === 0) return null

  // Préférer le plus gros jeu de données
  const best = [...candidates].sort(
    (a, b) =>
      b.data.clients.length +
      b.data.chantiers.length +
      b.data.interventions.length -
      (a.data.clients.length + a.data.chantiers.length + a.data.interventions.length),
  )[0]

  const onImport = async () => {
    setBusy(true)
    setError('')
    try {
      await replaceData(best.data)
      markLocalImportDone(user.organizationId)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import impossible')
    } finally {
      setBusy(false)
    }
  }

  const onSkip = () => {
    markLocalImportDone(user.organizationId)
    setHidden(true)
  }

  return (
    <div className="mb-4 rounded-2xl border border-accent/40 bg-accent-soft/60 px-4 py-3 text-sm text-slate">
      <div className="font-display font-semibold">Données locales détectées sur cet appareil</div>
      <p className="mt-1 text-muted">
        Importez-les vers le cloud pour les retrouver aussi sur téléphone (
        {best.data.clients.length} client(s), {best.data.chantiers.length} chantier(s),{' '}
        {best.data.interventions.length} intervention(s)).
      </p>
      {error && <p className="mt-2 text-danger">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onImport()}
          className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-ink hover:bg-accent-hover disabled:opacity-60"
        >
          {busy ? 'Import…' : 'Importer mes données'}
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-muted hover:bg-white"
        >
          Plus tard
        </button>
      </div>
    </div>
  )
}
