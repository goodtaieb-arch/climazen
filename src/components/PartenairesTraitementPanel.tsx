import { type FormEvent, useState } from 'react'
import { Plus, Star, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { Field } from '../pages/ClientsPage'
import {
  CODE_OPERATION_LABELS,
  type CodeOperationTraitement,
  type PartenaireTraitement,
} from '../lib/types'

const CODE_OPERATIONS = Object.keys(CODE_OPERATION_LABELS) as CodeOperationTraitement[]

const blank = {
  nom: '',
  siret: '',
  adresse: '',
  codeCap: '',
  codeOperation: 'R2' as CodeOperationTraitement,
  codeOperationAutre: '',
  favori: false,
}

/**
 * Annuaire des partenaires de traitement (régénérateurs, recycleurs,
 * destructeurs) — saisi une fois, réutilisé sur chaque BSFF Trackdéchets.
 */
export function PartenairesTraitementPanel() {
  const { data, upsertPartenaireTraitement, deletePartenaireTraitement } = useStore()
  const partenaires = data.partenairesTraitement || []

  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const startEdit = (p: PartenaireTraitement) => {
    setEditId(p.id)
    setForm({
      nom: p.nom,
      siret: p.siret,
      adresse: p.adresse,
      codeCap: p.codeCap,
      codeOperation: p.codeOperation,
      codeOperationAutre: p.codeOperationAutre || '',
      favori: Boolean(p.favori),
    })
    setError('')
  }

  const resetForm = () => {
    setEditId(null)
    setForm(blank)
    setError('')
  }

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.nom.trim() || !form.siret.trim() || !form.adresse.trim() || !form.codeCap.trim()) {
      setError('Nom, SIRET, adresse et code CAP sont obligatoires.')
      return
    }
    setSaving(true)
    try {
      await upsertPartenaireTraitement({ id: editId || undefined, ...form })
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-white p-5">
      <div>
        <h2 className="font-display mb-1 text-lg font-semibold">Partenaires de traitement</h2>
        <p className="text-sm text-muted">
          Régénérateurs, recycleurs, destructeurs — saisis une fois, réutilisés à chaque BSFF
          Trackdéchets. Marquez-en un « favori » pour le proposer en premier sans empêcher d’en
          choisir un autre.
        </p>
      </div>

      <ul className="divide-y divide-line rounded-xl border border-line">
        {partenaires.length === 0 && (
          <li className="px-4 py-3 text-sm text-muted">Aucun partenaire enregistré.</li>
        )}
        {partenaires.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-medium">
                {p.favori ? <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> : null}
                {p.nom}
              </div>
              <div className="text-xs text-muted">
                SIRET {p.siret} · CAP {p.codeCap} ·{' '}
                {p.codeOperation === 'autre'
                  ? p.codeOperationAutre || 'Autre'
                  : CODE_OPERATION_LABELS[p.codeOperation]}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => startEdit(p)}
                className="min-h-10 rounded-full border border-line px-3 py-1 text-xs font-semibold hover:bg-mist"
              >
                Modifier
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!confirm(`Supprimer le partenaire ${p.nom} ?`)) return
                  void deletePartenaireTraitement(p.id)
                }}
                className="inline-flex min-h-10 items-center gap-1 rounded-full border border-line px-3 py-1 text-xs font-semibold text-danger hover:bg-red-50"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={(e) => void onSave(e)} className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
        <h3 className="font-display text-sm font-semibold sm:col-span-2">
          {editId ? 'Modifier le partenaire' : 'Ajouter un partenaire'}
        </h3>
        <Field label="Nom *" value={form.nom} onChange={(v) => setForm({ ...form, nom: v })} required />
        <Field label="SIRET *" value={form.siret} onChange={(v) => setForm({ ...form, siret: v })} required />
        <Field
          label="Adresse *"
          value={form.adresse}
          onChange={(v) => setForm({ ...form, adresse: v })}
          required
          className="sm:col-span-2"
        />
        <Field
          label="Code CAP *"
          value={form.codeCap}
          onChange={(v) => setForm({ ...form, codeCap: v })}
          required
        />
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-ink">Code opération *</span>
          <select
            value={form.codeOperation}
            onChange={(e) => setForm({ ...form, codeOperation: e.target.value as CodeOperationTraitement })}
            className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm"
          >
            {CODE_OPERATIONS.map((c) => (
              <option key={c} value={c}>
                {CODE_OPERATION_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        {form.codeOperation === 'autre' ? (
          <Field
            label="Préciser le code opération"
            value={form.codeOperationAutre}
            onChange={(v) => setForm({ ...form, codeOperationAutre: v })}
            className="sm:col-span-2"
          />
        ) : null}
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={form.favori}
            onChange={(e) => setForm({ ...form, favori: e.target.checked })}
            className="h-5 w-5 rounded border-line"
          />
          <span className="font-semibold text-ink">Favori (proposé en premier)</span>
        </label>
        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger sm:col-span-2">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-accent px-5 text-sm font-semibold text-ink hover:bg-accent-hover disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {saving ? 'Enregistrement…' : editId ? 'Enregistrer' : 'Ajouter'}
          </button>
          {editId && (
            <button
              type="button"
              onClick={resetForm}
              className="min-h-11 rounded-full border border-line px-4 text-sm font-semibold text-muted hover:bg-mist"
            >
              Annuler
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
