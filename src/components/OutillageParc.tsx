import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Mail, Phone, Plus, Trash2, UserPlus, Wrench } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import {
  checklistOutillageObligatoire,
  outillageLabel,
  outillagesForUser,
} from '../lib/outillage'
import {
  OUTILLAGE_CATALOG,
  OUTILLAGE_TYPE_OPTIONS,
  type OutillageTypeId,
} from '../lib/outillageCatalog'
import { isDetecteurControleExpire, type Outillage } from '../lib/types'
import type { UserAccount } from '../lib/auth'
import { Field } from '../pages/ClientsPage'
import { dossierForUser } from '../lib/rhDocuments'

type Props = {
  team?: UserAccount[]
}

export function OutillageParc({ team: teamProp }: Props) {
  const { data, upsertOutillage, deleteOutillage } = useStore()
  const { user, isOwner, organization, listTeam } = useAuth()
  const outillages = data.outillages || []
  const mine = outillagesForUser(data, user?.id)
  const orgId = user?.organizationId || organization?.id || ''

  const [teamRemote, setTeamRemote] = useState<UserAccount[]>([])
  const [teamError, setTeamError] = useState('')
  const [teamLoading, setTeamLoading] = useState(false)
  const [teamLoaded, setTeamLoaded] = useState(false)

  const [editId, setEditId] = useState<string | null>(null)
  const [type, setType] = useState<OutillageTypeId>('pompe_vide')
  const [identification, setIdentification] = useState('')
  const [marque, setMarque] = useState('')
  const [modele, setModele] = useState('')
  const [controleDate, setControleDate] = useState('')
  const [assigneeUserId, setAssigneeUserId] = useState('')
  const [notes, setNotes] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const typeDef = OUTILLAGE_CATALOG[type]

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
    const onFocus = () => void loadTeam()
    window.addEventListener('focus', onFocus)
    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
    }
  }, [isOwner, loadTeam])

  const team = useMemo(() => {
    const retired = new Set(data.personnelRetiresUserIds || [])
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
      if (!id || retired.has(id)) return
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
    for (const o of outillages) {
      if (o.assigneeUserId) {
        add({ id: o.assigneeUserId, fullName: o.assigneeName, role: 'operateur', active: true })
      }
    }
    for (const m of teamRemote) add(m)
    for (const m of teamProp || []) add(m)
    return [...map.values()].filter((m) => m.active !== false)
  }, [teamProp, teamRemote, user, orgId, data.personnelDossiers, data.personnelRetiresUserIds, outillages])

  const isSolo = teamLoaded && !teamError && team.length <= 1

  useEffect(() => {
    if (!isOwner || editId || !user?.id) return
    if (!assigneeUserId) setAssigneeUserId(user.id)
  }, [isOwner, editId, user?.id, assigneeUserId])

  const resetForm = () => {
    setEditId(null)
    setType('pompe_vide')
    setIdentification('')
    setMarque('')
    setModele('')
    setControleDate('')
    setAssigneeUserId(user?.id || '')
    setNotes('')
    setFormError('')
  }

  const startEdit = (o: Outillage) => {
    setEditId(o.id)
    setType(o.type)
    setIdentification(o.identification)
    setMarque(o.marque || '')
    setModele(o.modele || '')
    setControleDate(o.controleDate || '')
    setAssigneeUserId(o.assigneeUserId || '')
    setNotes(o.notes || '')
    setFormError('')
    window.setTimeout(() => {
      document.getElementById('outillage-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
  }

  const resolveAssigneeName = (uid: string) => {
    if (!uid) return undefined
    const member = team.find((m) => m.id === uid)
    if (member?.fullName) return member.fullName
    if (uid === user?.id) return user.fullName || user.email || 'Moi'
    const existing = outillages.find((o) => o.assigneeUserId === uid)
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
    const idTrim = identification.trim()
    if (!idTrim) {
      setFormError('Indiquez une identification (n° série, étiquette interne…).')
      return
    }
    const def = OUTILLAGE_CATALOG[type]
    if (def.needsControleDate && !controleDate.trim()) {
      setFormError(`Date de contrôle / étalonnage obligatoire pour « ${def.label} ».`)
      return
    }
    if (controleDate.trim() && isDetecteurControleExpire(controleDate) && def.needsControleDate) {
      setFormError(`Contrôle expiré (> 1 an). Mettez à jour avant d'enregistrer.`)
      return
    }
    setSaving(true)
    try {
      const finalAssigneeId = assigneeUserId || user?.id || ''
      await upsertOutillage({
        id: editId || undefined,
        type,
        identification: idTrim,
        marque: marque.trim() || undefined,
        modele: modele.trim() || undefined,
        controleDate: controleDate.trim() || undefined,
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

  const AssigneeDetails = ({ uid }: { uid?: string }) => {
    const contact = assigneeContact(uid)
    if (!contact) return <span className="text-muted">Non attribué</span>
    return (
      <div className="text-xs text-muted">
        <span className="font-medium text-ink">{contact.name}</span>
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

  const ChecklistBlock = ({ userId }: { userId?: string }) => {
    const rows = checklistOutillageObligatoire(data, userId)
    const missing = rows.filter((r) => !r.ok).length
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-950">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          5 outils obligatoires frigoriste
          {missing === 0 ? (
            <span className="ml-auto inline-flex items-center gap-1 text-emerald-800">
              <CheckCircle2 className="h-4 w-4" /> Complet
            </span>
          ) : (
            <span className="ml-auto text-amber-900">{missing} manquant{missing > 1 ? 's' : ''}</span>
          )}
        </div>
        <ul className="space-y-1.5 text-sm">
          {rows.map((r) => (
            <li key={r.typeId} className="flex items-start gap-2">
              {r.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-amber-400" />
              )}
              <span className={r.ok ? 'text-ink' : 'text-amber-950'}>
                {r.label}
                {r.item ? (
                  <span className="block text-xs text-muted">{r.item.identification}</span>
                ) : null}
                {r.controleExpire ? (
                  <span className="ml-1 text-xs font-semibold text-danger">(contrôle expiré)</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (!isOwner) {
    return (
      <div className="space-y-4 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-display mb-1 flex items-center gap-2 text-lg font-semibold">
          <Wrench className="h-5 w-5 text-accent" />
          Mon outillage
        </h2>
        <p className="text-sm text-muted">
          Matériel qui vous est affecté par le gérant (pompe à vide, station, détecteur…).
        </p>
        <ChecklistBlock userId={user?.id} />
        {mine.length === 0 ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Aucun outillage ne vous est affecté. Le gérant peut vous en attribuer dans Mon profil.
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {mine.map((o) => {
              const def = OUTILLAGE_CATALOG[o.type]
              const expired = o.controleDate && def.needsControleDate && isDetecteurControleExpire(o.controleDate)
              return (
                <li key={o.id} className="px-4 py-3">
                  <div className="font-medium">{def.label}</div>
                  <div className="text-sm text-muted">
                    {o.identification}
                    {o.marque || o.modele ? ` · ${[o.marque, o.modele].filter(Boolean).join(' ')}` : ''}
                  </div>
                  {o.controleDate ? (
                    <div className="text-xs text-muted">
                      Contrôle / étalonnage : {o.controleDate}
                      {expired ? <span className="ml-1 font-semibold text-danger">(expiré)</span> : null}
                    </div>
                  ) : null}
                  {o.notes ? <p className="mt-1 text-xs text-muted">{o.notes}</p> : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-white p-5">
      <div>
        <h2 className="font-display mb-1 flex items-center gap-2 text-lg font-semibold">
          <Wrench className="h-5 w-5 text-accent" />
          Parc outillage
        </h2>
        <p className="text-sm text-muted">
          Attribuez le matériel terrain à chaque technicien. Menu déroulant par type — inclut les 5
          outils obligatoires frigoriste et le détecteur de fuite (CERFA).
        </p>
      </div>

      <ChecklistBlock userId={assigneeUserId || user?.id} />

      <ul className="divide-y divide-line rounded-xl border border-line">
        {outillages.length === 0 && (
          <li className="px-4 py-3 text-sm text-muted">Aucun outillage — ajoutez-en un ci-dessous.</li>
        )}
        {outillages.map((o) => {
          const def = OUTILLAGE_CATALOG[o.type]
          const expired = o.controleDate && def.needsControleDate && isDetecteurControleExpire(o.controleDate)
          return (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{def.label}</span>
                  {def.obligatoire ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                      Obligatoire
                    </span>
                  ) : null}
                </div>
                <div className="text-sm text-muted">{outillageLabel(o)}</div>
                {o.controleDate ? (
                  <div className="text-xs text-muted">
                    Contrôle : {o.controleDate}
                    {expired ? <span className="ml-1 font-semibold text-danger">(expiré)</span> : null}
                  </div>
                ) : null}
                <div className="mt-1">
                  {o.assigneeUserId ? (
                    <>
                      <span className="text-xs text-muted">Attribué à </span>
                      <AssigneeDetails uid={o.assigneeUserId} />
                    </>
                  ) : (
                    <span className="text-xs text-muted">Non attribué</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(o)}
                  className="min-h-10 rounded-full border border-line px-3 py-1 text-xs font-semibold hover:bg-mist"
                >
                  Modifier
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm(`Supprimer « ${def.label} » ${o.identification} ?`)) return
                    void deleteOutillage(o.id).catch((err) =>
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
        id="outillage-form"
        onSubmit={(e) => void onSave(e)}
        className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2"
      >
        <h3 className="font-display text-sm font-semibold sm:col-span-2">
          {editId ? 'Modifier l’outillage' : 'Ajouter un outillage'}
        </h3>

        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-semibold text-ink">Type d’outillage *</span>
          <select
            className="h-12 w-full rounded-xl border border-line bg-white px-3 text-base md:h-11 md:text-sm"
            value={type}
            onChange={(e) => setType(e.target.value as OutillageTypeId)}
          >
            <optgroup label="Obligatoires frigoriste (5)">
              {OUTILLAGE_TYPE_OPTIONS.filter((t) => t.obligatoire).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Autre matériel terrain">
              {OUTILLAGE_TYPE_OPTIONS.filter((t) => !t.obligatoire).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </optgroup>
          </select>
          {typeDef.hint ? <p className="mt-1 text-xs text-muted">{typeDef.hint}</p> : null}
        </label>

        <Field
          label="Identification (n° série / étiquette) *"
          value={identification}
          onChange={setIdentification}
          required
        />
        <Field label="Marque" value={marque} onChange={setMarque} />
        <Field label="Modèle" value={modele} onChange={setModele} />

        {typeDef.needsControleDate ? (
          <Field
            label="Date contrôle / étalonnage *"
            type="date"
            value={controleDate}
            onChange={setControleDate}
            required
          />
        ) : (
          <Field
            label="Date contrôle / maintenance (optionnel)"
            type="date"
            value={controleDate}
            onChange={setControleDate}
          />
        )}

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
              <UserPlus className="h-3.5 w-3.5" /> M'affecter
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
              {isSolo ? 'Un seul compte — voir ' : 'Comptes dans '}
              <Link to="/app/equipe" className="font-semibold text-accent underline">
                Équipe
              </Link>
            </span>
          </div>
        </label>

        <Field label="Notes (optionnel)" value={notes} onChange={setNotes} className="sm:col-span-2" />

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
            {saving ? 'Enregistrement…' : 'Enregistrer outillage'}
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
              Outillage enregistré dans le cloud.
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
