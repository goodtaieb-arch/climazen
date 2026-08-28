import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Car, Mail, Phone, Plus, Trash2, UserPlus } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import { voitureForUser, VOITURE_DOCUMENTS, formatDateFrCourt, voitureDocumentLabel } from '../lib/voitures'
import { dossierForUser } from '../lib/rhDocuments'
import { mergeTeamMembers } from '../lib/teamMembers'
import { isAssuranceExpiree, isCtExpire, type Voiture, type VoitureDocumentId } from '../lib/types'
import type { UserAccount } from '../lib/auth'
import { Field } from '../pages/ClientsPage'
import { ReceptionMaterielBlock } from './ReceptionMaterielBlock'

type Props = {
  /** Liste équipe (owner) pour le sélecteur d'attribution — sinon chargée ici */
  team?: UserAccount[]
}

function voitureTitre(v: Voiture) {
  const vehicule = [v.marque, v.modele].filter(Boolean).join(' ')
  return vehicule ? `${v.matricule} — ${vehicule}` : v.matricule
}

export function VoituresParc({ team: teamProp }: Props) {
  const { data, upsertVoiture, deleteVoiture } = useStore()
  const { user, isOwner, organization, listTeam } = useAuth()
  const voitures = data.voitures || []
  const mine = voitureForUser(data, user?.id)
  const orgId = user?.organizationId || organization?.id || ''

  const [teamRemote, setTeamRemote] = useState<UserAccount[]>([])
  const [teamError, setTeamError] = useState('')
  const [teamLoading, setTeamLoading] = useState(false)
  const [teamLoaded, setTeamLoaded] = useState(false)

  const [editId, setEditId] = useState<string | null>(null)
  const [matricule, setMatricule] = useState('')
  const [marque, setMarque] = useState('')
  const [modele, setModele] = useState('')
  const [controleTechniqueDate, setControleTechniqueDate] = useState('')
  const [assuranceDate, setAssuranceDate] = useState('')
  const [assigneeUserId, setAssigneeUserId] = useState('')
  const [notes, setNotes] = useState('')
  const [documentsFournis, setDocumentsFournis] = useState<VoitureDocumentId[]>([])
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
      setTeamError(err instanceof Error ? err.message : "Impossible de charger l'équipe")
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

  const team = useMemo(
    () =>
      mergeTeamMembers({
        user,
        remote: [...(teamRemote || []), ...(teamProp || [])],
        dossiers: data.personnelDossiers,
        extraAssignees: voitures
          .filter((v) => v.assigneeUserId)
          .map((v) => ({ id: v.assigneeUserId, name: v.assigneeName })),
        retiredIds: data.personnelRetiresUserIds,
        orgId,
      }),
    [
      teamProp,
      teamRemote,
      user,
      orgId,
      data.personnelDossiers,
      data.personnelRetiresUserIds,
      voitures,
    ],
  )

  const isSolo = teamLoaded && !teamError && team.length <= 1

  useEffect(() => {
    if (!isOwner || editId || !user?.id) return
    if (!assigneeUserId) setAssigneeUserId(user.id)
  }, [isOwner, editId, user?.id, assigneeUserId, teamLoading])

  const resetForm = () => {
    setEditId(null)
    setMatricule('')
    setMarque('')
    setModele('')
    setControleTechniqueDate('')
    setAssuranceDate('')
    setAssigneeUserId(user?.id || '')
    setNotes('')
    setDocumentsFournis([])
    setFormError('')
  }

  const startEdit = (v: Voiture) => {
    setEditId(v.id)
    setMatricule(v.matricule)
    setMarque(v.marque)
    setModele(v.modele || '')
    setControleTechniqueDate(v.controleTechniqueDate || '')
    setAssuranceDate(v.assuranceDate || '')
    setAssigneeUserId(v.assigneeUserId || '')
    setNotes(v.notes || '')
    setDocumentsFournis(v.documentsFournis || [])
    setFormError('')
    window.setTimeout(() => {
      document.getElementById('voiture-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
  }

  const resolveAssigneeName = (uid: string) => {
    if (!uid) return undefined
    const member = team.find((m) => m.id === uid)
    if (member?.fullName) return member.fullName
    if (uid === user?.id) return user.fullName || user.email || 'Moi'
    const existing = voitures.find((v) => v.assigneeUserId === uid)
    return existing?.assigneeName
  }

  const assigneeContact = (uid?: string) => {
    if (!uid) return null
    const member = team.find((m) => m.id === uid)
    const dossier = dossierForUser(data.personnelDossiers, uid)
    return {
      name: member?.fullName || dossier?.userName || 'Technicien',
      email: member?.email || '',
      telephone: dossier?.telephone || '',
    }
  }

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setFormError('')
    const matTrim = matricule.trim()
    const marqueTrim = marque.trim()
    if (!matTrim) {
      setFormError("Indiquez l'immatriculation (matricule) du véhicule.")
      return
    }
    if (!marqueTrim) {
      setFormError('Indiquez la marque du véhicule.')
      return
    }
    setSaving(true)
    try {
      const finalAssigneeId = assigneeUserId || user?.id || ''
      await upsertVoiture({
        id: editId || undefined,
        matricule: matTrim,
        marque: marqueTrim,
        modele: modele.trim() || undefined,
        controleTechniqueDate: controleTechniqueDate.trim() || undefined,
        assuranceDate: assuranceDate.trim() || undefined,
        assigneeUserId: finalAssigneeId || undefined,
        assigneeName: resolveAssigneeName(finalAssigneeId),
        documentsFournis,
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

  const AssigneeDetails = ({ uid }: { uid?: string }) => {
    const contact = assigneeContact(uid)
    if (!contact) return <span className="text-muted">Non attribué</span>
    return (
      <div className="text-xs text-muted">
        <Link
          to={`/app/equipe/${uid}`}
          className="font-medium text-accent underline-offset-2 hover:underline"
        >
          {contact.name}
        </Link>
        {contact.email ? (
          <span className="ml-1 inline-flex items-center gap-0.5">
            <Mail className="inline h-3 w-3" />
            {contact.email}
          </span>
        ) : null}
        {contact.telephone ? (
          <span className="ml-1 inline-flex items-center gap-0.5">
            <Phone className="inline h-3 w-3" />
            {contact.telephone}
          </span>
        ) : null}
      </div>
    )
  }

  if (!isOwner) {
    return (
      <div className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-display mb-1 flex items-center gap-2 text-lg font-semibold">
          <Car className="h-5 w-5 text-accent" />
          Mon véhicule
        </h2>
        <p className="mb-4 text-sm text-muted">
          Véhicule de service qui vous est affecté par le gérant.
        </p>
        {mine ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-mist px-4 py-3">
              <div className="font-medium">{voitureTitre(mine)}</div>
              <div className="mt-1 text-xs text-muted">
                {mine.controleTechniqueDate ? (
                  <>
                    CT le {mine.controleTechniqueDate}
                    {isCtExpire(mine.controleTechniqueDate) ? (
                      <span className="ml-1 font-semibold text-danger">(expiré)</span>
                    ) : null}
                  </>
                ) : (
                  'CT non renseigné'
                )}
                {' · '}
                {mine.assuranceDate ? (
                  <>
                    Assurance jusqu'au {mine.assuranceDate}
                    {isAssuranceExpiree(mine.assuranceDate) ? (
                      <span className="ml-1 font-semibold text-danger">(expirée)</span>
                    ) : null}
                  </>
                ) : (
                  'Assurance non renseignée'
                )}
              </div>
              {mine.documentsFournis?.length ? (
                <div className="mt-2 text-xs text-muted">
                  Documents prévus : {mine.documentsFournis.map(voitureDocumentLabel).join(', ')}
                </div>
              ) : null}
              <div className="mt-2 text-xs">
                {mine.receptionAt ? (
                  <span className="font-semibold text-emerald-800">
                    Réceptionné le {formatDateFrCourt(mine.receptionAt)}
                  </span>
                ) : (
                  <span className="font-semibold text-amber-800">
                    À réceptionner — état des lieux + documents
                  </span>
                )}
              </div>
            </div>
            {mine.notes ? (
              <p className="text-sm text-muted">
                <span className="font-semibold text-ink">Notes : </span>
                {mine.notes}
              </p>
            ) : null}
            {user?.id ? <ReceptionMaterielBlock userId={user.id} kinds={['voiture']} /> : null}
          </div>
        ) : (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Aucun véhicule ne vous est affecté. Le gérant peut vous en attribuer un dans Mon profil
            (parc véhicules).
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-white p-5">
      <div>
        <h2 className="font-display mb-1 flex items-center gap-2 text-lg font-semibold">
          <Car className="h-5 w-5 text-accent" />
          Flotte véhicules
        </h2>
        <p className="text-sm text-muted">
          Ajoutez un véhicule (marque, matricule, CT, assurance), cochez les documents remis avec,
          puis affectez-le à un technicien. L’opérateur valide la réception par un état des lieux
          (PDF conservé). Cliquez le nom pour ouvrir le dossier.
        </p>
      </div>

      <ul className="divide-y divide-line rounded-xl border border-line">
        {voitures.length === 0 && (
          <li className="px-4 py-3 text-sm text-muted">Aucun véhicule enregistré — ajoutez-en un ci-dessous.</li>
        )}
        {voitures.map((v) => {
          const ctExpired = isCtExpire(v.controleTechniqueDate)
          const assuranceExpired = isAssuranceExpiree(v.assuranceDate)
          return (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <div className="font-medium">{voitureTitre(v)}</div>
                <div className="text-xs text-muted">
                  {v.controleTechniqueDate ? (
                    <>
                      CT le {v.controleTechniqueDate}
                      {ctExpired ? <span className="ml-1 font-semibold text-danger">(expiré)</span> : null}
                    </>
                  ) : (
                    'CT non renseigné'
                  )}
                  {' · '}
                  {v.assuranceDate ? (
                    <>
                      Assurance jusqu'au {v.assuranceDate}
                      {assuranceExpired ? (
                        <span className="ml-1 font-semibold text-danger">(expirée)</span>
                      ) : null}
                    </>
                  ) : (
                    'Assurance non renseignée'
                  )}
                </div>
                <div className="mt-1">
                  {v.assigneeUserId ? (
                    <>
                      <span className="text-xs text-muted">Attribué à </span>
                      <AssigneeDetails uid={v.assigneeUserId} />
                      <div className="mt-0.5 text-xs">
                        {v.receptionAt ? (
                          <span className="font-semibold text-emerald-800">
                            Réceptionné le {formatDateFrCourt(v.receptionAt)}
                          </span>
                        ) : (
                          <span className="font-semibold text-amber-800">
                            En attente d’état des lieux
                          </span>
                        )}
                      </div>
                      {v.documentsFournis?.length ? (
                        <div className="mt-0.5 text-xs text-muted">
                          Docs : {v.documentsFournis.map(voitureDocumentLabel).join(', ')}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-xs text-muted">Non attribué</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(v)}
                  className="min-h-10 rounded-full border border-line px-3 py-1 text-xs font-semibold hover:bg-mist"
                >
                  Modifier
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm(`Supprimer le véhicule ${v.matricule} ?`)) return
                    void deleteVoiture(v.id).catch((err) =>
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
        id="voiture-form"
        onSubmit={(e) => void onSave(e)}
        className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2"
      >
        <h3 className="font-display text-sm font-semibold sm:col-span-2">
          {editId ? 'Modifier le véhicule' : 'Ajouter un véhicule'}
        </h3>
        <Field
          label="Immatriculation (matricule) *"
          value={matricule}
          onChange={setMatricule}
          required
        />
        <Field label="Marque *" value={marque} onChange={setMarque} required />
        <Field label="Modèle" value={modele} onChange={setModele} />
        <Field
          label="Contrôle technique"
          type="date"
          value={controleTechniqueDate}
          onChange={setControleTechniqueDate}
        />
        <Field
          label="Assurance (fin de validité)"
          type="date"
          value={assuranceDate}
          onChange={setAssuranceDate}
        />
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-semibold text-ink">Attribué au technicien</span>
          <select
            className="h-12 w-full rounded-xl border border-line bg-white px-3 text-base md:h-11 md:text-sm"
            value={assigneeUserId}
            onChange={(e) => setAssigneeUserId(e.target.value)}
          >
            <option value="">— Non attribué —</option>
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.fullName || m.email}
                {m.id === user?.id ? ' (moi)' : ''}
                {m.role === 'owner' ? ' · gérant' : ' · opérateur'}
              </option>
            ))}
          </select>
          {assigneeUserId ? (
            <div className="mt-2 rounded-xl bg-mist px-3 py-2">
              <AssigneeDetails uid={assigneeUserId} />
            </div>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={assignToMe}
              className="inline-flex min-h-10 items-center gap-1 rounded-full border border-line bg-white px-3 text-xs font-semibold active:bg-mist"
            >
              <UserPlus className="h-3.5 w-3.5" /> M'affecter ce véhicule
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
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1.5 block font-semibold text-ink">
            Documents / accessoires remis avec le véhicule
          </span>
          <p className="mb-2 text-xs text-muted">
            Cochez ce que l’opérateur emporte (carte grise, assurance, clés, badge…). Il confirmera
            à la réception ce qu’il a réellement pris — le PDF d’état des lieux les liste.
          </p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {VOITURE_DOCUMENTS.map((d) => {
              const checked = documentsFournis.includes(d.id)
              return (
                <li key={d.id}>
                  <label className="flex min-h-10 cursor-pointer items-start gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={checked}
                      onChange={() =>
                        setDocumentsFournis((prev) =>
                          prev.includes(d.id) ? prev.filter((x) => x !== d.id) : [...prev, d.id],
                        )
                      }
                    />
                    <span>{d.label}</span>
                  </label>
                </li>
              )
            })}
          </ul>
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
            {saving ? 'Enregistrement…' : 'Enregistrer véhicule'}
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
              Véhicule enregistré dans le cloud.
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
