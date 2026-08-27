import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2, UserPlus } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import { detecteurForUser } from '../lib/detecteurs'
import { isDetecteurControleExpire, type DetecteurManuel } from '../lib/types'
import type { UserAccount } from '../lib/auth'
import { Field } from '../pages/ClientsPage'

type Props = {
  /** Liste équipe (owner) pour le sélecteur d’attribution — sinon chargée ici */
  team?: UserAccount[]
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function DetecteursParc({ team: teamProp }: Props) {
  const { data, upsertDetecteur, deleteDetecteur } = useStore()
  const { user, isOwner, organization, listTeam } = useAuth()
  const detecteurs = data.detecteurs || []
  const mine = detecteurForUser(data, user?.id)
  const orgId = user?.organizationId || organization?.id || ''

  const [teamRemote, setTeamRemote] = useState<UserAccount[]>([])
  const [teamError, setTeamError] = useState('')
  const [teamLoading, setTeamLoading] = useState(false)
  const [teamLoaded, setTeamLoaded] = useState(false)

  const [editId, setEditId] = useState<string | null>(null)
  const [identification, setIdentification] = useState('')
  const [controleDate, setControleDate] = useState(today)
  const [assigneeUserId, setAssigneeUserId] = useState('')
  const [notes, setNotes] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const loadTeam = useCallback(async () => {
    if (!orgId) return
    setTeamLoading(true)
    setTeamError('')
    try {
      const t = await listTeam()
      setTeamRemote(t)
      setTeamLoaded(true)
    } catch (err) {
      setTeamError(err instanceof Error ? err.message : 'Impossible de charger l’équipe')
      setTeamLoaded(true)
    } finally {
      setTeamLoading(false)
    }
  }, [orgId, listTeam])

  useEffect(() => {
    if (!isOwner) return
    let cancelled = false
    void loadTeam().then(() => {
      if (cancelled) return
    })
    const onFocus = () => {
      void loadTeam()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
    }
  }, [isOwner, loadTeam])

  const team = useMemo(() => {
    const map = new Map<string, UserAccount>()
    const add = (m: {
      id?: string
      email?: string
      username?: string
      fullName?: string
      createdAt?: string
      organizationId?: string
      role?: UserAccount['role']
      active?: boolean
    }) => {
      const id = String(m.id || '').trim()
      if (!id) return
      const prev = map.get(id)
      map.set(id, {
        id,
        email: m.email || prev?.email || '',
        username: m.username || prev?.username || m.email || prev?.email || '',
        fullName: (m.fullName || prev?.fullName || '').trim() || 'Technicien',
        createdAt: m.createdAt || prev?.createdAt || '',
        organizationId: m.organizationId || prev?.organizationId || orgId,
        role: m.role || prev?.role || 'operateur',
        active: m.active ?? prev?.active ?? true,
      })
    }
    if (user) add(user)
    for (const d of data.personnelDossiers || []) {
      add({ id: d.userId, fullName: d.userName, role: 'operateur', active: true })
    }
    for (const det of detecteurs) {
      if (det.assigneeUserId) {
        add({
          id: det.assigneeUserId,
          fullName: det.assigneeName,
          role: 'operateur',
          active: true,
        })
      }
    }
    for (const m of teamRemote) add(m)
    for (const m of teamProp || []) add(m)
    return [...map.values()].filter((m) => m.active !== false)
  }, [teamProp, teamRemote, user, orgId, data.personnelDossiers, detecteurs])

  /** Vrai seulement si l’équipe a bien été chargée et qu’il n’y a qu’un compte. */
  const isSolo = teamLoaded && !teamError && team.length <= 1

  // Nouveau détecteur : pré-affecté au gérant connecté (surtout entreprise solo)
  useEffect(() => {
    if (!isOwner || editId || !user?.id) return
    if (!assigneeUserId) setAssigneeUserId(user.id)
  }, [isOwner, editId, user?.id, assigneeUserId, teamLoading])

  const resetForm = () => {
    setEditId(null)
    setIdentification('')
    setControleDate(today())
    setAssigneeUserId(user?.id || '')
    setNotes('')
    setFormError('')
  }

  const startEdit = (d: DetecteurManuel) => {
    setEditId(d.id)
    setIdentification(d.identification)
    setControleDate(d.controleDate || today())
    setAssigneeUserId(d.assigneeUserId || '')
    setNotes(d.notes || '')
    setFormError('')
    window.setTimeout(() => {
      document.getElementById('detecteur-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
  }

  const resolveAssigneeName = (uid: string) => {
    if (!uid) return undefined
    const member = team.find((m) => m.id === uid)
    if (member?.fullName) return member.fullName
    if (uid === user?.id) return user.fullName || user.email || 'Moi'
    const existing = detecteurs.find((d) => d.assigneeUserId === uid)
    return existing?.assigneeName
  }

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setFormError('')
    const idTrim = identification.trim()
    if (!idTrim) {
      setFormError('Indiquez l’identification / réf. du détecteur.')
      return
    }
    if (!controleDate.trim()) {
      setFormError('Indiquez la date de contrôle (obligatoire, < 1 an pour le CERFA).')
      return
    }
    if (isDetecteurControleExpire(controleDate)) {
      setFormError(
        'Cette date de contrôle a plus d’un an — le CERFA sera refusé. Mettez une date de contrôle récente.',
      )
      return
    }
    setSaving(true)
    try {
      // Solo / non choisi → affecté au gérant (personne qui a la société)
      const finalAssigneeId = assigneeUserId || user?.id || ''
      await upsertDetecteur({
        id: editId || undefined,
        identification: idTrim,
        controleDate: controleDate.trim(),
        assigneeUserId: finalAssigneeId || undefined,
        assigneeName: resolveAssigneeName(finalAssigneeId),
        notes: notes.trim() || undefined,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      resetForm()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Enregistrement impossible')
    } finally {
      setSaving(false)
    }
  }

  const assignToMe = () => {
    if (user?.id) setAssigneeUserId(user.id)
  }

  const onUpdateMyControle = async (e: FormEvent) => {
    e.preventDefault()
    if (!mine || mine.id === 'company-default') return
    if (!controleDate.trim()) {
      setFormError('Date de contrôle requise.')
      return
    }
    if (isDetecteurControleExpire(controleDate)) {
      setFormError('Date de contrôle > 1 an — mettez à jour après le contrôle annuel.')
      return
    }
    setSaving(true)
    try {
      await upsertDetecteur({
        id: mine.id,
        identification: mine.identification,
        controleDate: controleDate.trim(),
        assigneeUserId: mine.assigneeUserId,
        assigneeName: mine.assigneeName,
        notes: mine.notes,
      })
      setFormError('')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Enregistrement impossible')
    } finally {
      setSaving(false)
    }
  }

  /** Opérateur sans détecteur : peut s’en créer un (auto-affecté). */
  const onCreateMine = async (e: FormEvent) => {
    e.preventDefault()
    setFormError('')
    const idTrim = identification.trim()
    if (!idTrim) {
      setFormError('Indiquez l’identification / réf. du détecteur.')
      return
    }
    if (!controleDate.trim()) {
      setFormError('Indiquez la date de contrôle.')
      return
    }
    if (isDetecteurControleExpire(controleDate)) {
      setFormError('Date de contrôle > 1 an — utilisez la date du dernier contrôle.')
      return
    }
    if (!user?.id) {
      setFormError('Session expirée — reconnectez-vous.')
      return
    }
    setSaving(true)
    try {
      await upsertDetecteur({
        identification: idTrim,
        controleDate: controleDate.trim(),
        assigneeUserId: user.id,
        assigneeName: user.fullName || user.email || 'Moi',
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      setIdentification('')
      setControleDate(today())
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Enregistrement impossible')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!isOwner && mine && mine.id !== 'company-default') {
      setControleDate(mine.controleDate || today())
    }
  }, [isOwner, mine?.id, mine?.controleDate])

  if (!isOwner) {
    return (
      <div className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-display mb-1 text-lg font-semibold">Mon détecteur manuel [5]</h2>
        <p className="mb-4 text-sm text-muted">
          Prérempli automatiquement sur vos CERFA. Contrôle annuel obligatoire (&lt; 1 an).
        </p>
        {mine && mine.id !== 'company-default' ? (
          <form onSubmit={(e) => void onUpdateMyControle(e)} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 rounded-xl bg-mist px-3 py-2 text-sm">
              <span className="text-muted">Identification / réf. : </span>
              <strong>{mine.identification}</strong>
            </div>
            <Field
              label="Contrôlé le *"
              type="date"
              value={controleDate}
              onChange={setControleDate}
              required
            />
            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving}
                className="min-h-11 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-ink hover:bg-accent-hover disabled:opacity-60"
              >
                {saving ? 'Enregistrement…' : 'Enregistrer détecteur'}
              </button>
            </div>
            {formError && <p className="sm:col-span-2 text-sm text-danger">{formError}</p>}
            {saved && <p className="sm:col-span-2 text-sm text-accent">Enregistré.</p>}
          </form>
        ) : (
          <form onSubmit={(e) => void onCreateMine(e)} className="grid gap-3 sm:grid-cols-2">
            <p className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Aucun détecteur nominatif. Ajoutez le vôtre ici (ou le gérant vous en attribue un
            dans Mon profil).
            </p>
            <Field
              label="Identification / réf. *"
              value={identification}
              onChange={setIdentification}
              required
            />
            <Field
              label="Contrôlé le *"
              type="date"
              value={controleDate}
              onChange={setControleDate}
              required
            />
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-ink hover:bg-accent-hover disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />{' '}
                {saving ? 'Enregistrement…' : 'Enregistrer détecteur'}
              </button>
            </div>
            {formError && <p className="sm:col-span-2 text-sm text-danger">{formError}</p>}
            {saved && <p className="sm:col-span-2 text-sm text-accent">Détecteur enregistré dans le cloud.</p>}
          </form>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-white p-5">
      <div>
        <h2 className="font-display mb-1 text-lg font-semibold">Parc détecteurs manuels [5]</h2>
        <p className="text-sm text-muted">
          Ajoutez un détecteur, puis affectez-le à un technicien. Le CERFA reprend
          automatiquement celui de l’opérateur connecté. Les comptes restent dans Équipe.
        </p>
      </div>

      <ul className="divide-y divide-line rounded-xl border border-line">
        {detecteurs.length === 0 && (
          <li className="px-4 py-3 text-sm text-muted">Aucun détecteur enregistré — ajoutez-en un ci-dessous.</li>
        )}
        {detecteurs.map((d) => {
          const expired = isDetecteurControleExpire(d.controleDate)
          return (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <div className="font-medium">{d.identification}</div>
                <div className="text-xs text-muted">
                  Contrôlé le {d.controleDate || '—'}
                  {expired ? (
                    <span className="ml-1 font-semibold text-danger">(expiré)</span>
                  ) : null}
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
                  className="min-h-10 rounded-full border border-line px-3 py-1 text-xs font-semibold hover:bg-mist"
                >
                  Modifier
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm(`Supprimer le détecteur ${d.identification} ?`)) return
                    void deleteDetecteur(d.id).catch((err) =>
                      setFormError(err instanceof Error ? err.message : 'Suppression impossible'),
                    )
                  }}
                  className="inline-flex min-h-10 items-center gap-1 rounded-full border border-line px-3 py-1 text-xs font-semibold text-danger hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <form
        id="detecteur-form"
        onSubmit={(e) => void onSave(e)}
        className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2"
      >
        <h3 className="font-display text-sm font-semibold sm:col-span-2">
          {editId ? 'Modifier le détecteur' : 'Ajouter un détecteur'}
        </h3>
        <Field
          label="Identification / réf. *"
          value={identification}
          onChange={setIdentification}
          required
        />
        <Field
          label="Contrôlé le *"
          type="date"
          value={controleDate}
          onChange={setControleDate}
          required
        />
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-semibold text-ink">Attribué au technicien</span>
          <select
            className="h-12 w-full rounded-xl border border-line bg-white px-3 text-base md:h-11 md:text-sm"
            value={assigneeUserId}
            onChange={(e) => setAssigneeUserId(e.target.value)}
          >
            <option value="">— Non attribué (fallback société) —</option>
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.fullName || m.email}
                {m.id === user?.id ? ' (moi)' : ''}
                {m.role === 'owner' ? ' · gérant' : ' · opérateur'}
              </option>
            ))}
          </select>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={assignToMe}
              className="inline-flex min-h-10 items-center gap-1 rounded-full border border-line bg-white px-3 text-xs font-semibold active:bg-mist"
            >
              <UserPlus className="h-3.5 w-3.5" /> M’affecter ce détecteur
            </button>
            {teamLoading && <span className="text-xs text-muted">Chargement équipe…</span>}
            {teamError && (
              <span className="text-xs text-danger">
                {teamError}{' '}
                <button type="button" className="font-semibold underline" onClick={() => void loadTeam()}>
                  Réessayer
                </button>
              </span>
            )}
            <span className="text-xs text-muted">
              {isSolo
                ? 'Un seul compte chargé — les techniciens doivent avoir un compte dans '
                : team.length <= 1
                  ? 'Liste incomplète ? Comptes dans '
                  : 'Comptes dans '}
              <Link to="/app/equipe" className="font-semibold text-accent underline">
                Équipe
              </Link>
              {' · '}
              <button
                type="button"
                className="font-semibold text-accent underline"
                onClick={() => void loadTeam()}
              >
                Recharger la liste
              </button>
            </span>
          </div>
        </label>
        <Field
          label="Notes (optionnel)"
          value={notes}
          onChange={setNotes}
          className="sm:col-span-2"
        />
        {formError && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger sm:col-span-2">
            {formError}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-ink hover:bg-accent-hover disabled:opacity-60 sm:w-auto sm:min-h-11 sm:py-2.5"
          >
            <Plus className="h-4 w-4" />
            {saving ? 'Enregistrement…' : 'Enregistrer détecteur'}
          </button>
          {editId && (
            <button
              type="button"
              onClick={resetForm}
              className="min-h-11 rounded-full border border-line px-4 py-2 text-sm font-semibold text-muted hover:bg-mist"
            >
              Annuler
            </button>
          )}
          {saved && (
            <span className="self-center text-sm font-semibold text-accent">
              Détecteur enregistré dans le cloud.
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
