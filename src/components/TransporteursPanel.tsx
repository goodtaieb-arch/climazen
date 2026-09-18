import { type FormEvent, useState } from 'react'
import { Plus, Star, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { Field } from '../pages/ClientsPage'
import type { TransporteurExterne } from '../lib/types'

const blank = { nom: '', siret: '', adresse: '', telephone: '', email: '', favori: false }

/**
 * Annuaire des transporteurs externes — saisi une fois, réutilisé sur chaque
 * BSFF Trackdéchets (alternative à l'auto-transport ou à la saisie ponctuelle).
 */
export function TransporteursPanel() {
  const { data, upsertTransporteur, deleteTransporteur } = useStore()
  const transporteurs = data.transporteurs || []

  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const startEdit = (t: TransporteurExterne) => {
    setEditId(t.id)
    setForm({
      nom: t.nom,
      siret: t.siret,
      adresse: t.adresse || '',
      telephone: t.telephone || '',
      email: t.email || '',
      favori: Boolean(t.favori),
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
    if (!form.nom.trim() || !form.siret.trim()) {
      setError('Nom et SIRET sont obligatoires.')
      return
    }
    setSaving(true)
    try {
      await upsertTransporteur({ id: editId || undefined, ...form })
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
        <h2 className="font-display mb-1 text-lg font-semibold">Transporteurs</h2>
        <p className="text-sm text-muted">
          Annuaire réutilisable pour l’évacuation des bouteilles récupérées. Vous pourrez toujours
          choisir l’auto-transport ou saisir un SIRET ponctuel à la place.
        </p>
      </div>

      <ul className="divide-y divide-line rounded-xl border border-line">
        {transporteurs.length === 0 && (
          <li className="px-4 py-3 text-sm text-muted">Aucun transporteur enregistré.</li>
        )}
        {transporteurs.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-medium">
                {t.favori ? <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> : null}
                {t.nom}
              </div>
              <div className="text-xs text-muted">
                SIRET {t.siret}
                {t.telephone ? ` · ${t.telephone}` : ''}
                {t.email ? ` · ${t.email}` : ''}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => startEdit(t)}
                className="min-h-10 rounded-full border border-line px-3 py-1 text-xs font-semibold hover:bg-mist"
              >
                Modifier
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!confirm(`Supprimer le transporteur ${t.nom} ?`)) return
                  void deleteTransporteur(t.id)
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
          {editId ? 'Modifier le transporteur' : 'Ajouter un transporteur'}
        </h3>
        <Field label="Nom *" value={form.nom} onChange={(v) => setForm({ ...form, nom: v })} required />
        <Field label="SIRET *" value={form.siret} onChange={(v) => setForm({ ...form, siret: v })} required />
        <Field label="Adresse" value={form.adresse} onChange={(v) => setForm({ ...form, adresse: v })} />
        <Field label="Téléphone" value={form.telephone} onChange={(v) => setForm({ ...form, telephone: v })} />
        <Field label="E-mail" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
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
