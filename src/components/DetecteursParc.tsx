import { type FormEvent, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import { detecteurForUser } from '../lib/detecteurs'
import type { DetecteurManuel } from '../lib/types'
import type { UserAccount } from '../lib/auth'
import { Field } from '../pages/ClientsPage'

type Props = {
  /** Liste équipe (owner) pour le sélecteur d’attribution */
  team?: UserAccount[]
}

export function DetecteursParc({ team = [] }: Props) {
  const { data, upsertDetecteur, deleteDetecteur } = useStore()
  const { user, isOwner } = useAuth()
  const detecteurs = data.detecteurs || []
  const mine = detecteurForUser(data, user?.id)

  const [editId, setEditId] = useState<string | null>(null)
  const [identification, setIdentification] = useState('')
  const [controleDate, setControleDate] = useState('')
  const [assigneeUserId, setAssigneeUserId] = useState('')
  const [notes, setNotes] = useState('')
  const [saved, setSaved] = useState(false)

  const resetForm = () => {
    setEditId(null)
    setIdentification('')
    setControleDate('')
    setAssigneeUserId('')
    setNotes('')
  }

  const startEdit = (d: DetecteurManuel) => {
    setEditId(d.id)
    setIdentification(d.identification)
    setControleDate(d.controleDate || '')
    setAssigneeUserId(d.assigneeUserId || '')
    setNotes(d.notes || '')
  }

  const onSave = (e: FormEvent) => {
    e.preventDefault()
    if (!identification.trim()) return
    const member = team.find((m) => m.id === assigneeUserId)
    upsertDetecteur({
      id: editId || undefined,
      identification: identification.trim(),
      controleDate,
      assigneeUserId: assigneeUserId || undefined,
      assigneeName: member?.fullName || undefined,
      notes: notes.trim() || undefined,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    resetForm()
  }

  const onUpdateMyControle = (e: FormEvent) => {
    e.preventDefault()
    if (!mine || mine.id === 'company-default') return
    upsertDetecteur({
      id: mine.id,
      identification: mine.identification,
      controleDate,
      assigneeUserId: mine.assigneeUserId,
      assigneeName: mine.assigneeName,
      notes: mine.notes,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  useEffect(() => {
    if (!isOwner && mine && mine.id !== 'company-default') {
      setControleDate(mine.controleDate || '')
    }
  }, [isOwner, mine?.id, mine?.controleDate])

  if (!isOwner) {
    return (
      <div className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-display mb-1 text-lg font-semibold">Mon détecteur manuel [5]</h2>
        <p className="mb-4 text-sm text-muted">
          Détecteur qui vous est attribué — prérempli automatiquement sur vos CERFA d’étanchéité.
        </p>
        {mine ? (
          <form onSubmit={onUpdateMyControle} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 rounded-xl bg-mist px-3 py-2 text-sm">
              <span className="text-muted">Identification / réf. : </span>
              <strong>{mine.identification}</strong>
              {mine.id === 'company-default' && (
                <span className="ml-2 text-xs text-muted">(détecteur société — non nominatif)</span>
              )}
            </div>
            {mine.id !== 'company-default' ? (
              <>
                <Field
                  label="Contrôlé le"
                  type="date"
                  value={controleDate}
                  onChange={setControleDate}
                />
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-ink hover:bg-accent-hover"
                  >
                    Mettre à jour le contrôle
                  </button>
                </div>
              </>
            ) : (
              <p className="sm:col-span-2 text-sm text-muted">
                Demandez au gérant de vous attribuer un détecteur dans le parc (Mon entreprise).
              </p>
            )}
            {saved && <p className="sm:col-span-2 text-sm text-accent">Enregistré.</p>}
          </form>
        ) : (
          <p className="text-sm text-danger">
            Aucun détecteur attribué. Le gérant doit vous en attribuer un dans Mon entreprise → Parc
            détecteurs.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-white p-5">
      <div>
        <h2 className="font-display mb-1 text-lg font-semibold">Parc détecteurs manuels [5]</h2>
        <p className="text-sm text-muted">
          Si plusieurs détecteurs : attribuez-en un à chaque technicien. Le CERFA reprend celui de
          l’opérateur connecté.
        </p>
      </div>

      <ul className="divide-y divide-line rounded-xl border border-line">
        {detecteurs.length === 0 && (
          <li className="px-4 py-3 text-sm text-muted">Aucun détecteur enregistré.</li>
        )}
        {detecteurs.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <div className="font-medium">{d.identification}</div>
              <div className="text-xs text-muted">
                Contrôlé le {d.controleDate || '—'}
                {' · '}
                {d.assigneeName
                  ? `Attribué à ${d.assigneeName}`
                  : 'Non attribué (fallback société)'}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => startEdit(d)}
                className="rounded-full border border-line px-3 py-1 text-xs font-semibold hover:bg-mist"
              >
                Modifier
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Supprimer le détecteur ${d.identification} ?`)) deleteDetecteur(d.id)
                }}
                className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-xs font-semibold text-danger hover:bg-red-50"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={onSave} className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
        <h3 className="font-display text-sm font-semibold sm:col-span-2">
          {editId ? 'Modifier le détecteur' : 'Ajouter un détecteur'}
        </h3>
        <Field
          label="Identification / réf. *"
          value={identification}
          onChange={setIdentification}
          required
        />
        <Field label="Contrôlé le" type="date" value={controleDate} onChange={setControleDate} />
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-muted">Attribué au technicien</span>
          <select
            className="w-full rounded-xl border border-line bg-white px-3 py-2"
            value={assigneeUserId}
            onChange={(e) => setAssigneeUserId(e.target.value)}
          >
            <option value="">— Non attribué (fallback société) —</option>
            {team
              .filter((m) => m.active !== false)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName} ({m.role === 'owner' ? 'gérant' : 'opérateur'})
                </option>
              ))}
          </select>
        </label>
        <Field
          label="Notes (optionnel)"
          value={notes}
          onChange={setNotes}
          className="sm:col-span-2"
        />
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-ink hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" />
            {editId ? 'Enregistrer' : 'Ajouter'}
          </button>
          {editId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-muted hover:bg-mist"
            >
              Annuler
            </button>
          )}
          {saved && <span className="self-center text-sm text-accent">Enregistré.</span>}
        </div>
      </form>
    </div>
  )
}
