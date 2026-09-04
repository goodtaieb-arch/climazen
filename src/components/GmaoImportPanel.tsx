import { useRef, useState } from 'react'
import { Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import {
  applyGmaoImport,
  downloadGmaoImportTemplate,
  parseGmaoImportFile,
  previewGmaoImport,
  type GmaoImportPreview,
} from '../lib/gmaoImport'

/**
 * Migrer depuis une autre GMAO — dépôt Excel / CSV → clients, sites, équipements.
 */
export function GmaoImportPanel() {
  const { data, upsertClient, upsertChantier } = useStore()
  const { user } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<GmaoImportPreview | null>(null)
  const [fileName, setFileName] = useState('')
  const [resultMsg, setResultMsg] = useState('')
  const [error, setError] = useState('')

  const onFile = async (file: File | null) => {
    if (!file) return
    setBusy(true)
    setError('')
    setResultMsg('')
    setPreview(null)
    setFileName(file.name)
    try {
      const rows = await parseGmaoImportFile(file)
      setPreview(previewGmaoImport(rows))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lecture du fichier impossible.')
    } finally {
      setBusy(false)
    }
  }

  const runImport = () => {
    if (!preview?.rows.length || preview.errors.length) return
    setBusy(true)
    setError('')
    try {
      const result = applyGmaoImport(preview.rows, data, {
        upsertClient,
        upsertChantier,
        userId: user?.id,
        userName: user?.fullName || user?.email,
      })
      setResultMsg(
        `Import terminé — ${result.clientsCreated} client(s) créé(s), ${result.clientsUpdated} mis à jour · ` +
          `${result.sitesCreated} site(s) créé(s), ${result.sitesUpdated} mis à jour · ` +
          `${result.equipementsAdded} équipement(s).`,
      )
      if (result.errors.length) {
        setError(result.errors.slice(0, 5).join(' · '))
      }
      setPreview(null)
      setFileName('')
      if (inputRef.current) inputRef.current.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import impossible.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-700 text-white">
          <FileSpreadsheet className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold text-emerald-950">
            Migrer depuis une autre GMAO
          </h2>
          <p className="mt-1 text-sm text-emerald-900/85">
            Importez un fichier <strong>Excel (.xlsx)</strong> ou <strong>CSV</strong> — clients,
            sites et équipements sont créés automatiquement. Aucune saisie ligne à ligne.
          </p>
        </div>
      </div>

      <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-slate">
        <li>Téléchargez le modèle ClimaZEN (ou utilisez votre export GMAO si les colonnes collent).</li>
        <li>Remplissez / adaptez le fichier (une ligne = un équipement ou un site).</li>
        <li>Déposez le fichier ici, vérifiez l’aperçu, puis importez.</li>
      </ol>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => downloadGmaoImportTemplate()}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 text-sm font-bold text-emerald-950 hover:bg-emerald-50"
        >
          <Download className="h-4 w-4" />
          Télécharger le modèle Excel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Choisir un fichier
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0] || null)}
        />
      </div>

      {fileName ? (
        <p className="mt-2 text-xs font-medium text-muted">Fichier : {fileName}</p>
      ) : null}

      {preview ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-white p-4 text-sm">
          <p className="font-semibold text-ink">Aperçu</p>
          <p className="mt-1 text-slate">
            {preview.clients} client(s) · {preview.sites} site(s) · {preview.equipements}{' '}
            équipement(s) · {preview.rows.length} ligne(s)
          </p>
          {preview.warnings.length > 0 ? (
            <ul className="mt-2 list-disc pl-5 text-xs text-amber-800">
              {preview.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
          {preview.errors.length > 0 ? (
            <ul className="mt-2 list-disc pl-5 text-xs text-rose-700">
              {preview.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            disabled={busy || preview.errors.length > 0 || !preview.rows.length}
            onClick={runImport}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Importer dans ClimaZEN
          </button>
        </div>
      ) : null}

      {resultMsg ? <p className="mt-3 text-sm font-semibold text-teal-800">{resultMsg}</p> : null}
      {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}

      <p className="mt-3 text-[11px] text-muted">
        Colonnes reconnues : client, site, équipement, marque, modèle, série, fluide, charge…
        Les interventions et le stock existants ne sont pas effacés.
      </p>
    </section>
  )
}
