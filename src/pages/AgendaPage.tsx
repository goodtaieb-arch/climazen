import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardList,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import { SearchField, matchesQuery } from '../components/SearchField'
import { MobileFab } from '../components/MobileFab'
import { TechnicienAssignField } from '../components/TechnicienAssignField'
import { AgenceFilterChips } from '../components/AgenceSelect'
import {
  AGENDA_STATUT_LABELS,
  AGENDA_TYPE_LABELS,
  agendaSortDate,
  blankAgendaEvent,
  compareProgrammeHeure,
  formatHeure,
  formatJourCourt,
  isAgendaDueSoon,
  isAgendaOverdue,
  mailtoHref,
  startOfWeekMonday,
  telHref,
  todayIsoLocal,
  addDaysToIso,
  weekDatesFrom,
  type AgendaEvent,
  type AgendaEventType,
  type AgendaStatut,
} from '../lib/agenda'
import {
  TYPE_OT_LABELS,
  formatOtAvancement,
  formatOtNumero,
  isOtCloture,
  labelTechsOt,
  syncTechsOt,
  techIdsOt,
  type OrdreTravail,
} from '../lib/ordreTravail'
import {
  agenceEffective,
  agencesDuMembre,
  labelAgence,
  matchAgenceFilter,
} from '../lib/agences'
import { isBureauUi } from '../lib/uiMode'
import { extraAssigneesFromData, mergeTeamMembers } from '../lib/teamMembers'
import type { UserAccount } from '../lib/auth'
import {
  couleurPlanning,
  dateDansSemaine,
  isHorsOtType,
  otSansCreneau,
  techsLignesJour,
  titreDefautHorsOt,
  typesAgendaPourSaisie,
  visibleAgendaPour,
} from '../lib/agendaPlanning'
import { dossierForUser } from '../lib/rhDocuments'
import {
  labelSecteurCourt,
  secteursOt,
  secteurOtDepuisPoste,
  type PostePersonnelId,
} from '../lib/postePersonnel'

function formatFr(iso?: string) {
  if (!iso) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${m[3]}/${m[2]}/${m[1]}`
}

type ViewMode = 'jour' | 'semaine' | 'rappels' | 'tous'

type ProgrammeItem =
  | {
      kind: 'agenda'
      id: string
      date: string
      heure?: string
      title: string
      event: AgendaEvent
    }
  | {
      kind: 'ot'
      id: string
      date: string
      heure?: string
      title: string
      otId: string
      clientId?: string
      chantierId?: string
      statut: string
      typeLabel: string
      numero: string
      avancement?: string
      technicienUserId?: string
      technicienUserIds?: string[]
      technicien?: string
      secteur?: PostePersonnelId
      agenceCode?: string
    }

export function AgendaPage() {
  const {
    data,
    upsertAgendaEvent,
    deleteAgendaEvent,
    syncAgendaFromSources,
    upsertOrdreTravail,
    peutVoirIdentitesRh,
  } = useStore()
  const { user, isOwner, listTeam } = useAuth()
  const bureau = isBureauUi({ isOwner: Boolean(isOwner), peutVoirIdentitesRh })
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const editId = params.get('id') || ''
  const [q, setQ] = useState('')
  const [view, setView] = useState<ViewMode>('jour')
  const [cursorDate, setCursorDate] = useState(() => todayIsoLocal())
  const [formOpen, setFormOpen] = useState(params.get('new') === '1')
  const [syncMsg, setSyncMsg] = useState('')
  const [filterTechId, setFilterTechId] = useState('tous')
  const [filterSecteur, setFilterSecteur] = useState<PostePersonnelId | 'tous'>('tous')
  const [filterAgences, setFilterAgences] = useState<string[]>([])
  const [agenceFilterReady, setAgenceFilterReady] = useState(false)
  const [remoteTeam, setRemoteTeam] = useState<UserAccount[]>([])

  const existing = useMemo(
    () => (data.agendaEvents || []).find((e) => e.id === editId) || null,
    [data.agendaEvents, editId],
  )

  const [form, setForm] = useState(() => blankAgendaEvent())

  useEffect(() => {
    if (!existing) return
    const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = existing
    setForm({ ...blankAgendaEvent(), ...rest })
    setFormOpen(true)
  }, [existing?.id, existing?.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const n = syncAgendaFromSources()
    if (n > 0) setSyncMsg(`${n} OT / rappel(s) généré(s) depuis les contrats.`)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false
    void listTeam()
      .then((members) => {
        if (!cancelled) setRemoteTeam(members)
      })
      .catch(() => {
        if (!cancelled) setRemoteTeam([])
      })
    return () => {
      cancelled = true
    }
  }, [listTeam])

  const team = useMemo(
    () =>
      mergeTeamMembers({
        user,
        remote: remoteTeam,
        dossiers: data.personnelDossiers,
        extraAssignees: extraAssigneesFromData(data),
        retiredIds: data.personnelRetiresUserIds,
        orgId: user?.organizationId,
      }),
    [user, remoteTeam, data],
  )

  const posteOf = (userId?: string) =>
    dossierForUser(data.personnelDossiers, userId)?.poste

  const agenceOfTech = (userId?: string) =>
    dossierForUser(data.personnelDossiers, userId)?.agenceCode

  const mesAgences = useMemo(
    () =>
      agencesDuMembre({
        agenceCode: dossierForUser(data.personnelDossiers, user?.id)?.agenceCode,
        agencesCouvertes: dossierForUser(data.personnelDossiers, user?.id)
          ?.agencesCouvertes,
      }),
    [data.personnelDossiers, user?.id],
  )

  useEffect(() => {
    if (agenceFilterReady) return
    if (!bureau) {
      setAgenceFilterReady(true)
      return
    }
    if (mesAgences.length) setFilterAgences(mesAgences)
    setAgenceFilterReady(true)
  }, [bureau, mesAgences, agenceFilterReady])

  const agenceOfOt = (o: {
    agenceCode?: string
    clientId?: string
    chantierId?: string
  }) => {
    const client = data.clients.find((c) => c.id === o.clientId)
    const site = data.chantiers.find((c) => c.id === o.chantierId)
    return agenceEffective({
      agenceCode: o.agenceCode || site?.agenceCode || client?.agenceCode,
      codePostal: site?.codePostal || client?.codePostal,
    })
  }

  const matchAgence = (agence?: string) => matchAgenceFilter(agence, filterAgences)

  const weekDates = useMemo(() => weekDatesFrom(cursorDate), [cursorDate])

  const agencesDispo = useMemo(() => {
    const set = new Set<string>(mesAgences)
    for (const o of data.ordresTravail || []) {
      const a = agenceOfOt(o)
      if (a) set.add(a)
    }
    for (const d of data.personnelDossiers || []) {
      for (const a of agencesDuMembre({
        agenceCode: d.agenceCode,
        agencesCouvertes: d.agencesCouvertes,
      })) {
        set.add(a)
      }
    }
    return [...set].sort()
  }, [data.ordresTravail, data.personnelDossiers, data.clients, data.chantiers, mesAgences]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Programme = hors OT + rappels + OT calés (avec heure). */
  const visOpts = {
    bureau,
    userId: user?.id,
    filterTechId: bureau ? filterTechId : undefined,
  }

  const programmeAll = useMemo((): ProgrammeItem[] => {
    const events: ProgrammeItem[] = (data.agendaEvents || [])
      .filter((e) => e.statut !== 'annule')
      .filter((e) => visibleAgendaPour(visOpts, e))
      .filter((e) =>
        matchAgence(
          agenceOfOt({ clientId: e.clientId, chantierId: e.chantierId }) ||
            agenceOfTech(e.technicienUserId),
        ),
      )
      .map((e) => ({
        kind: 'agenda' as const,
        id: `ag-${e.id}`,
        date: (e.date || '').slice(0, 10),
        heure: e.heure,
        title: e.title,
        event: e,
      }))

    const ots: ProgrammeItem[] = (data.ordresTravail || [])
      .filter((o) => !isOtCloture(o.statut))
      .filter((o) => Boolean((o.heure || '').trim()))
      .filter((o) => visibleAgendaPour(visOpts, o))
      .filter((o) => matchAgence(agenceOfOt(o)))
      .map((o) => ({
        kind: 'ot' as const,
        id: `ot-${o.id}`,
        date: (o.date || '').slice(0, 10),
        heure: o.heure,
        title: o.action || TYPE_OT_LABELS[o.typeOt] || 'OT',
        otId: o.id,
        clientId: o.clientId,
        chantierId: o.chantierId,
        statut: o.statut,
        typeLabel: TYPE_OT_LABELS[o.typeOt],
        numero: o.numero,
        avancement: formatOtAvancement(o) || undefined,
        technicienUserId: o.technicienUserId,
        technicienUserIds: o.technicienUserIds,
        technicien: o.technicien,
        secteur: o.secteur,
        agenceCode: o.agenceCode,
      }))

    return [...events, ...ots].sort((a, b) => {
      const d = a.date.localeCompare(b.date)
      if (d !== 0) return d
      return compareProgrammeHeure(a, b)
    })
  }, [data.agendaEvents, data.ordresTravail, bureau, user?.id, filterTechId, filterAgences]) // eslint-disable-line react-hooks/exhaustive-deps

  const matchSecteur = (item: { secteur?: string; technicienUserId?: string }) => {
    if (!bureau || filterSecteur === 'tous') return true
    if (item.secteur === filterSecteur) return true
    return posteOf(item.technicienUserId) === filterSecteur
  }

  const programmeVisible = useMemo(
    () =>
      programmeAll.filter((p) =>
        matchSecteur(
          p.kind === 'ot'
            ? { secteur: p.secteur, technicienUserId: p.technicienUserId }
            : { technicienUserId: p.event.technicienUserId },
        ),
      ),
    [programmeAll, filterSecteur, bureau, data.personnelDossiers], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const otsSansPlanning = useMemo(() => {
    const focusTech = bureau && filterTechId !== 'tous'
    return (data.ordresTravail || []).filter((o) => {
      if (!otSansCreneau(o) || !visibleAgendaPour(visOpts, o)) return false
      if (!matchAgence(agenceOfOt(o))) return false
      if (!matchSecteur({ secteur: o.secteur, technicienUserId: o.technicienUserId })) return false
      if (focusTech && !dateDansSemaine(o.date, weekDates)) return false
      return true
    })
  }, [data.ordresTravail, bureau, user?.id, filterTechId, filterSecteur, filterAgences, weekDates]) // eslint-disable-line react-hooks/exhaustive-deps

  const programmeForDate = (iso: string) =>
    programmeVisible.filter((p) => p.date === iso.slice(0, 10))

  const ouvrirSemaineTech = (techId: string) => {
    setFilterTechId(techId)
    setFilterSecteur('tous')
    setView('semaine')
  }

  const rappelsList = useMemo(() => {
    return [...(data.agendaEvents || [])]
      .filter((e) => visibleAgendaPour(visOpts, e))
      .filter((e) => {
        const client = data.clients.find((c) => c.id === e.clientId)
        const site = data.chantiers.find((c) => c.id === e.chantierId)
        if (
          !matchesQuery(
            [e.title, e.notes, client?.raisonSociale, site?.nom, e.statut].filter(Boolean).join(' '),
            q,
          )
        ) {
          return false
        }
        if (
          !matchAgence(
            agenceOfOt({ clientId: e.clientId, chantierId: e.chantierId }) ||
              agenceOfTech(e.technicienUserId),
          )
        ) {
          return false
        }
        if (view === 'tous') return e.statut !== 'annule'
        return (
          (e.statut === 'a_faire' || e.statut === 'contacte') &&
          (isAgendaOverdue(e) || isAgendaDueSoon(e, 21))
        )
      })
      .sort((a, b) => agendaSortDate(a).localeCompare(agendaSortDate(b)))
  }, [data.agendaEvents, data.clients, data.chantiers, q, view, bureau, user?.id, filterTechId, filterAgences])

  const onSync = () => {
    const n = syncAgendaFromSources()
    setSyncMsg(
      n > 0
        ? `${n} OT / rappel(s) ajouté(s) depuis les contrats.`
        : 'Agenda à jour (OT de maintenance et rappels déjà synchronisés).',
    )
  }

  const openNew = (datePrefill?: string, typePrefill?: AgendaEventType) => {
    const base = blankAgendaEvent()
    if (datePrefill) {
      base.date = datePrefill
      base.dateRappel = datePrefill
    } else if (view === 'jour' || view === 'semaine') {
      base.date = cursorDate
      base.dateRappel = cursorDate
    }
    if (typePrefill) {
      base.type = typePrefill
      base.title = titreDefautHorsOt(typePrefill)
    }
    if (!bureau && user?.id) {
      base.technicienUserId = user.id
      base.technicien = user.fullName || user.email || ''
    } else if (filterTechId && filterTechId !== 'tous') {
      const m = team.find((t) => t.id === filterTechId)
      base.technicienUserId = filterTechId
      base.technicien = m?.fullName || ''
    }
    setForm(base)
    setFormOpen(true)
    navigate('/app/agenda?new=1')
  }

  const onSave = (e: FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) {
      alert('Indiquez un titre.')
      return
    }
    upsertAgendaEvent({
      ...form,
      id: existing?.id,
      heure: (form.heure || '').trim() || undefined,
      dateRappel: form.dateRappel || form.date,
      createdByUserId: form.createdByUserId || user?.id,
      technicienUserId: form.technicienUserId || (!bureau ? user?.id : form.technicienUserId),
      technicien:
        form.technicien ||
        team.find((t) => t.id === form.technicienUserId)?.fullName ||
        user?.fullName,
    })
    if (form.date) setCursorDate(form.date.slice(0, 10))
    setFormOpen(false)
    navigate('/app/agenda', { replace: true })
    setSyncMsg(
      isHorsOtType(form.type)
        ? 'Action hors OT enregistrée.'
        : 'Intervention enregistrée dans le programme.',
    )
    setView('jour')
  }

  const setStatut = (ev: AgendaEvent, statut: AgendaStatut) => {
    upsertAgendaEvent({ ...ev, id: ev.id, statut })
  }

  const planifierOt = (
    ot: OrdreTravail,
    patch: {
      date?: string
      heure?: string
      technicien?: string
      technicienUserId?: string
      technicienUserIds?: string[]
    },
  ) => {
    const noms: Record<string, string> = {}
    for (const t of team) {
      noms[t.id] = t.fullName || t.email || ''
    }
    const ids =
      patch.technicienUserIds !== undefined
        ? patch.technicienUserIds
        : techIdsOt({
            technicienUserId: patch.technicienUserId ?? ot.technicienUserId,
            technicienUserIds: ot.technicienUserIds,
          })
    const synced = syncTechsOt({
      technicienUserIds: ids,
      noms,
      technicien: patch.technicien ?? ot.technicien,
    })
    upsertOrdreTravail({
      ...ot,
      id: ot.id,
      date: patch.date ?? ot.date,
      heure: patch.heure !== undefined ? patch.heure : ot.heure,
      ...synced,
      secteur:
        ot.secteur || secteurOtDepuisPoste(posteOf(synced.technicienUserId)),
    })
    setSyncMsg(
      patch.heure
        ? `${formatOtNumero(ot.numero)} calé ${patch.date || ot.date} à ${patch.heure}.`
        : `${formatOtNumero(ot.numero)} mis à jour.`,
    )
  }

  const nomTech = (id?: string, fallback?: string) =>
    team.find((t) => t.id === id)?.fullName || fallback || 'Non affecté'

  if (formOpen) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setFormOpen(false)
              navigate('/app/agenda')
            }}
            className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line bg-white px-3 text-sm font-semibold"
          >
            <ArrowLeft className="h-4 w-4" /> Agenda
          </button>
          <h1 className="font-display text-xl font-bold">
            {existing
              ? 'Modifier'
              : isHorsOtType(form.type)
                ? 'Action hors OT'
                : 'Planifier une intervention'}
          </h1>
        </div>

        <form onSubmit={onSave} className="space-y-3 rounded-2xl border border-line bg-white p-4">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink">
              {form.type === 'hors_ot_libre' ? 'Événement (champ libre) *' : 'Titre *'}
            </span>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="h-11 w-full rounded-xl border border-line px-3"
              placeholder={
                form.type === 'hors_ot_libre'
                  ? 'Ex. Formation SST, RDV contrôle technique, réunion…'
                  : isHorsOtType(form.type)
                    ? AGENDA_TYPE_LABELS[form.type]
                    : 'Ex. Maintenance clim — Site école'
              }
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-ink">Jour d’intervention</span>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="h-11 w-full rounded-xl border border-line px-3"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-ink">Heure (optionnel)</span>
              <input
                type="time"
                value={formatHeure(form.heure)}
                onChange={(e) => setForm({ ...form, heure: e.target.value })}
                className="h-11 w-full rounded-xl border border-line px-3"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-ink">Rappel appel</span>
              <input
                type="date"
                value={form.dateRappel || form.date}
                onChange={(e) => setForm({ ...form, dateRappel: e.target.value })}
                className="h-11 w-full rounded-xl border border-line px-3"
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-ink">Type</span>
              <select
                value={form.type}
                onChange={(e) => {
                  const type = e.target.value as AgendaEventType
                  const nextTitle =
                    !form.title.trim() || form.title === titreDefautHorsOt(form.type)
                      ? titreDefautHorsOt(type)
                      : form.title
                  setForm({ ...form, type, title: nextTitle })
                }}
                className="h-11 w-full rounded-xl border border-line bg-white px-3"
              >
                {typesAgendaPourSaisie({ bureau }).map((t) => (
                  <option key={t} value={t}>
                    {AGENDA_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-ink">Statut</span>
              <select
                value={form.statut}
                onChange={(e) => setForm({ ...form, statut: e.target.value as AgendaStatut })}
                className="h-11 w-full rounded-xl border border-line bg-white px-3"
              >
                {(Object.keys(AGENDA_STATUT_LABELS) as AgendaStatut[]).map((s) => (
                  <option key={s} value={s}>
                    {AGENDA_STATUT_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {bureau ? (
            <TechnicienAssignField
              label="Technicien (secteur)"
              technicien={form.technicien || ''}
              technicienUserId={form.technicienUserId}
              onChange={(next) =>
                setForm({
                  ...form,
                  technicien: next.technicien,
                  technicienUserId: next.technicienUserId,
                })
              }
            />
          ) : (
            <p className="text-xs text-muted">
              Signalé pour vous — le bureau le voit sur votre planning.
            </p>
          )}
          {!isHorsOtType(form.type) ? (
            <>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink">Client</span>
            <select
              value={form.clientId || ''}
              onChange={(e) =>
                setForm({ ...form, clientId: e.target.value || undefined, chantierId: undefined })
              }
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            >
              <option value="">—</option>
              {data.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.raisonSociale}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink">Site</span>
            <select
              value={form.chantierId || ''}
              onChange={(e) => setForm({ ...form, chantierId: e.target.value || undefined })}
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
              disabled={!form.clientId}
            >
              <option value="">—</option>
              {data.chantiers
                .filter((s) => s.clientId === form.clientId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nom}
                  </option>
                ))}
            </select>
          </label>
            </>
          ) : null}
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink">Notes</span>
            <textarea
              rows={3}
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full rounded-xl border border-line px-3 py-2"
              placeholder={
                isHorsOtType(form.type)
                  ? 'Détail libre (le bureau peut préciser formation, garage…)'
                  : 'Accès, contact sur place, matériel…'
              }
            />
          </label>
          <button
            type="submit"
            className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#0f766e] px-5 text-sm font-bold text-white"
          >
            Enregistrer au programme
          </button>
        </form>
      </div>
    )
  }

  const renderProgrammeCard = (item: ProgrammeItem) => {
    if (item.kind === 'ot') {
      const client = data.clients.find((c) => c.id === item.clientId)
      const site = data.chantiers.find((c) => c.id === item.chantierId)
      const col = couleurPlanning({
        secteur: item.secteur || posteOf(item.technicienUserId),
        technicienUserId: item.technicienUserId,
      })
      const otFull = (data.ordresTravail || []).find((o) => o.id === item.otId)
      return (
        <article
          key={item.id}
          className={`rounded-2xl border p-4 shadow-sm ${col.border} ${col.bg}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${col.badge}`}>
              OT
            </span>
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-extrabold text-ink">
              {formatOtNumero(item.numero)}
            </span>
            {formatHeure(item.heure) ? (
              <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-extrabold text-white">
                {formatHeure(item.heure)}
              </span>
            ) : null}
            <span className="text-[10px] font-bold uppercase text-muted">{item.typeLabel}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${col.badge}`}>
              {labelTechsOt(item, nomTech(item.technicienUserId, item.technicien))}
            </span>
            {labelAgence(agenceOfOt(item)) ? (
              <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold text-ink">
                {labelAgence(agenceOfOt(item))}
              </span>
            ) : null}
            {labelSecteurCourt(item.secteur || posteOf(item.technicienUserId)) ? (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${col.badge}`}>
                {labelSecteurCourt(item.secteur || posteOf(item.technicienUserId))}
              </span>
            ) : null}
            {item.avancement ? (
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-amber-950">
                {item.avancement}
              </span>
            ) : null}
          </div>
          <p className={`mt-1 font-display text-base font-semibold ${col.text}`}>{item.title}</p>
          <p className="text-sm text-muted">
            {client?.raisonSociale || 'Client —'}
            {site ? ` · ${site.nom}` : ''}
          </p>
          {bureau && otFull ? (
            <OtPlanifierInline
              ot={otFull}
              highlightAgence={agenceOfOt(otFull)}
              onPlan={(patch) => planifierOt(otFull, patch)}
            />
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to={`/app/appel?ot=${encodeURIComponent(item.otId)}`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#0f766e] px-3 text-xs font-bold text-white"
            >
              <ClipboardList className="h-3.5 w-3.5" /> Ouvrir l’OT
            </Link>
          </div>
        </article>
      )
    }

    const ev = item.event
    const client = data.clients.find((c) => c.id === ev.clientId)
    const site = data.chantiers.find((c) => c.id === ev.chantierId)
    const overdue = isAgendaOverdue(ev)
    const tel = telHref(client?.telephone)
    const mail = mailtoHref(
      client?.email,
      `RDV — ${site?.nom || client?.raisonSociale || ''}`,
      `Bonjour,\n\nIntervention prévue le ${formatFr(ev.date)}${
        formatHeure(ev.heure) ? ` à ${formatHeure(ev.heure)}` : ''
      }.\n\nCordialement`,
    )
    const heure = formatHeure(ev.heure)
    const col = couleurPlanning({
      horsOtType: ev.type,
      secteur: posteOf(ev.technicienUserId),
      technicienUserId: ev.technicienUserId,
    })
    const hors = isHorsOtType(ev.type)

    return (
      <article
        key={item.id}
        className={[
          'rounded-2xl border p-4 shadow-sm',
          hors || ev.technicienUserId ? `${col.border} ${col.bg}` : overdue ? 'border-amber-300 bg-amber-50/40' : 'border-line bg-white',
        ].join(' ')}
      >
        <div className="flex flex-wrap items-center gap-2">
          {heure ? (
            <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-extrabold text-white">
              {heure}
            </span>
          ) : (
            <span className="rounded-full bg-mist px-2 py-0.5 text-[10px] font-bold uppercase text-muted">
              Heure libre
            </span>
          )}
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${col.badge}`}>
            {AGENDA_TYPE_LABELS[ev.type] || ev.type}
          </span>
          {ev.technicienUserId ? (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${col.badge}`}>
              {nomTech(ev.technicienUserId, ev.technicien)}
            </span>
          ) : null}
          <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold uppercase text-muted">
            {AGENDA_STATUT_LABELS[ev.statut]}
          </span>
        </div>
        <p className="mt-1 font-display text-base font-semibold text-ink">{ev.title}</p>
        {client || site ? (
          <p className="text-sm text-muted">
            {client?.raisonSociale || 'Client —'}
            {site ? ` · ${site.nom}` : ''}
          </p>
        ) : ev.notes ? (
          <p className="text-sm text-muted">{ev.notes}</p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          {tel ? (
            <a
              href={tel}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white sm:flex-none"
            >
              <Phone className="h-3.5 w-3.5" /> Appeler
            </a>
          ) : null}
          {mail ? (
            <a
              href={mail}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-white px-3 text-xs font-bold"
            >
              <Mail className="h-3.5 w-3.5" /> E-mail
            </a>
          ) : null}
          {ev.clientId && !hors ? (
            <Link
              to={`/app/appel?client=${encodeURIComponent(ev.clientId)}${
                ev.chantierId ? `&chantier=${encodeURIComponent(ev.chantierId)}` : ''
              }${ev.contratId ? `&contrat=${encodeURIComponent(ev.contratId)}` : ''}`}
              className="inline-flex min-h-11 items-center rounded-xl border border-line px-3 text-xs font-semibold"
            >
              Créer OT
            </Link>
          ) : null}
          <Link
            to={`/app/agenda?id=${encodeURIComponent(ev.id)}`}
            className="inline-flex min-h-11 items-center rounded-xl border border-line px-3 text-xs font-semibold"
          >
            Modifier
          </Link>
          {ev.statut !== 'fait' ? (
            <button
              type="button"
              onClick={() => setStatut(ev, 'fait')}
              className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-line px-3 text-xs font-semibold"
            >
              <Check className="h-3.5 w-3.5" /> Fait
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              if (confirm('Supprimer cet événement ?')) deleteAgendaEvent(ev.id)
            }}
            className="inline-flex min-h-11 items-center rounded-xl border border-line px-3 text-xs font-semibold text-danger"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </article>
    )
  }

  const itemTechIds = (it: ProgrammeItem) =>
    it.kind === 'ot'
      ? techIdsOt({
          technicienUserId: it.technicienUserId,
          technicienUserIds: it.technicienUserIds,
        })
      : it.event.technicienUserId
        ? [it.event.technicienUserId]
        : []

  const renderLignesTechJour = (iso: string) => {
    const items = programmeForDate(iso)
    const ids = techsLignesJour({
      team,
      posteOf,
      taskTechIds: items.flatMap((it) => itemTechIds(it)),
      filterTechId: bureau ? filterTechId : user?.id,
      filterSecteur: bureau ? filterSecteur : undefined,
      filterAgenceCodes: bureau ? filterAgences : undefined,
      agenceOf: agenceOfTech,
    })
    const unassigned = items.filter((it) => itemTechIds(it).length === 0)
    if (ids.length === 0 && unassigned.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-line bg-white px-4 py-8 text-center text-sm text-muted">
          Aucun tech terrain à afficher. Renseignez les postes dans Équipe, ou ajoutez une
          intervention.
        </div>
      )
    }
    return (
      <div className="space-y-2">
        {ids.map((id) => {
          const t = team.find((x) => x.id === id)
          const poste = posteOf(id)
          const col = couleurPlanning({ secteur: poste, technicienUserId: id })
          const mine = items.filter((it) => itemTechIds(it).includes(id))
          return (
            <div key={id} className={`rounded-2xl border p-2.5 ${col.border} ${col.bg}`}>
              <button
                type="button"
                onClick={() => ouvrirSemaineTech(id)}
                className="flex w-full flex-wrap items-center gap-2 text-left"
              >
                <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />
                <span className={`font-bold ${col.text}`}>
                  {t?.fullName || nomTech(id)}
                </span>
                {labelSecteurCourt(poste) ? (
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${col.badge}`}>
                    {labelSecteurCourt(poste)}
                  </span>
                ) : null}
                {labelAgence(agenceOfTech(id)) ? (
                  <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[9px] font-bold text-ink">
                    {labelAgence(agenceOfTech(id))}
                  </span>
                ) : null}
                <span className="ml-auto text-[10px] font-bold uppercase text-muted">
                  {mine.length === 0
                    ? 'Libre'
                    : `${mine.length} tâche${mine.length > 1 ? 's' : ''}`}
                </span>
              </button>
              {mine.length === 0 ? (
                <p className="mt-1 px-1 text-[11px] text-muted">
                  Rien de calé aujourd’hui — tapez le nom pour la semaine sans planning.
                </p>
              ) : (
                <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                  {mine.map((it) => {
                    const c = couleurPlanning({
                      horsOtType: it.kind === 'agenda' ? it.event.type : undefined,
                      secteur:
                        it.kind === 'ot' ? it.secteur || poste : poste,
                      technicienUserId: id,
                    })
                    return (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => {
                          if (it.kind === 'agenda') {
                            navigate(`/app/agenda?id=${encodeURIComponent(it.event.id)}`)
                          } else {
                            navigate(`/app/appel?ot=${encodeURIComponent(it.otId)}`)
                          }
                        }}
                        className={`shrink-0 rounded-xl border bg-white px-2.5 py-1.5 text-left ${c.border}`}
                      >
                        <span className="block text-[10px] font-extrabold text-ink">
                          {formatHeure(it.heure) || '—'}
                        </span>
                        <span className={`block max-w-[11rem] truncate text-xs font-semibold ${c.text}`}>
                          {it.kind === 'ot' ? `${formatOtNumero(it.numero)} · ` : ''}
                          {it.title}
                        </span>
                        {itemTechIds(it).length > 1 ? (
                          <span className="block text-[9px] font-bold uppercase text-muted">
                            {itemTechIds(it).length} techs
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
        {unassigned.length > 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-2.5">
            <p className="text-xs font-bold uppercase text-muted">Non affecté</p>
            <div className="mt-2 grid gap-2">{unassigned.map(renderProgrammeCard)}</div>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-50 text-teal-800">
            <CalendarDays className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Agenda</h1>
            <p className="mt-0.5 text-sm text-muted">
              {bureau
                ? 'Filtrez par région (06, 13…). Plusieurs techs sur la même OT. Un renfort d’une autre région reste visible.'
                : 'Vos OT affectés (même sans créneau) + vos actions hors OT.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSync}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-semibold"
          >
            <RefreshCw className="h-4 w-4" /> Sync contrats
          </button>
          <button
            type="button"
            onClick={() => openNew()}
            className="hidden min-h-11 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-ink md:inline-flex"
          >
            <Plus className="h-4 w-4" /> {bureau ? 'Événement' : 'Hors OT'}
          </button>
        </div>
      </div>

      {syncMsg ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {syncMsg}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['jour', 'Jour'],
            ['semaine', 'Semaine'],
            ['rappels', 'À contacter'],
            ['tous', 'Tous'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={[
              'rounded-full px-3 py-1.5 text-xs font-bold',
              view === id ? 'bg-accent text-ink' : 'border border-line text-muted',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {bureau ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-white p-3">
          <span className="text-xs font-bold uppercase text-muted">Métier</span>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setFilterSecteur('tous')}
              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                filterSecteur === 'tous'
                  ? 'border-ink bg-ink text-white'
                  : 'border-line bg-white text-muted'
              }`}
            >
              Tous
            </button>
            {secteursOt().map((s) => {
              const c = couleurPlanning({ secteur: s.id })
              const on = filterSecteur === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setFilterSecteur(on ? 'tous' : s.id)
                    setFilterTechId('tous')
                  }}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${c.border} ${c.bg} ${c.text} ${
                    on ? 'ring-2 ring-ink/40' : ''
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                  {labelSecteurCourt(s.id)}
                </button>
              )
            })}
          </div>
          <select
            value={filterTechId}
            onChange={(e) => {
              setFilterTechId(e.target.value)
              if (e.target.value !== 'tous') setView('semaine')
            }}
            className="h-10 min-w-[12rem] rounded-xl border border-line bg-white px-3 text-sm font-semibold"
          >
            <option value="tous">Tous les techs</option>
            {team.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName || t.email}
                {labelSecteurCourt(posteOf(t.id)) ? ` · ${labelSecteurCourt(posteOf(t.id))}` : ''}
                {labelAgence(agenceOfTech(t.id)) ? ` · ${labelAgence(agenceOfTech(t.id))}` : ''}
              </option>
            ))}
          </select>
          <AgenceFilterChips
            className="w-full"
            selected={filterAgences}
            onChange={setFilterAgences}
            codes={agencesDispo}
          />
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['pause_repas', 'Pause'],
              ['deplacement_hors_ot', 'Déplacement'],
              ['bureau_atelier', 'Atelier'],
              ['fournisseur', 'Fournisseur'],
            ] as const
          ).map(([type, label]) => (
            <button
              key={type}
              type="button"
              onClick={() => openNew(cursorDate, type)}
              className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink"
            >
              + {label}
            </button>
          ))}
        </div>
      )}

      {bureau ? (
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['formation', 'Formation'],
              ['rdv_garage', 'RDV garage'],
              ['hors_ot_libre', 'Événement libre'],
            ] as const
          ).map(([type, label]) => (
            <button
              key={type}
              type="button"
              onClick={() => openNew(cursorDate, type)}
              className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-bold"
            >
              + {label}
            </button>
          ))}
        </div>
      ) : null}

      {otsSansPlanning.length > 0 && view !== 'rappels' ? (
        <section className="space-y-2 rounded-2xl border border-dashed border-line bg-white p-4">
          <h2 className="font-display text-lg font-semibold">
            {bureau && filterTechId !== 'tous'
              ? `Sans planning · semaine de ${nomTech(filterTechId)}`
              : bureau
                ? 'OT sans créneau — à affecter / caler'
                : 'Mes OT sans planning'}
          </h2>
          <p className="text-xs text-muted">
            {bureau
              ? 'OT ouverts sans heure. Choisissez le tech, le jour et l’heure.'
              : 'OT affectés à vous, pas encore calés à une heure. Ils restent visibles ici.'}
          </p>
          <ul className="space-y-2">
            {otsSansPlanning.map((ot) => {
              const col = couleurPlanning({
                secteur: ot.secteur || posteOf(ot.technicienUserId),
                technicienUserId: ot.technicienUserId,
              })
              const client = data.clients.find((c) => c.id === ot.clientId)
              return (
                <li
                  key={ot.id}
                  className={`rounded-xl border p-3 ${col.border} ${col.bg}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${col.badge}`}>
                      OT
                    </span>
                    <span className="text-sm font-bold">{formatOtNumero(ot.numero)}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{ot.action || TYPE_OT_LABELS[ot.typeOt]}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${col.badge}`}>
                      {labelTechsOt(ot, nomTech(ot.technicienUserId, ot.technicien))}
                    </span>
                    {labelSecteurCourt(ot.secteur) ? (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${col.badge}`}>
                        {labelSecteurCourt(ot.secteur)}
                      </span>
                    ) : null}
                    {labelAgence(agenceOfOt(ot)) ? (
                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold text-ink">
                        {labelAgence(agenceOfOt(ot))}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {client?.raisonSociale || ''}
                    {ot.date ? ` · date ${formatFr(ot.date)}` : ' · pas de date'}
                  </p>
                  {bureau ? (
                    <OtPlanifierInline
                      ot={ot}
                      highlightAgence={agenceOfOt(ot)}
                      onPlan={(patch) => planifierOt(ot, patch)}
                    />
                  ) : (
                    <Link
                      to={`/app/appel?ot=${encodeURIComponent(ot.id)}`}
                      className="mt-2 inline-flex min-h-9 items-center rounded-full bg-[#0f766e] px-3 text-[11px] font-bold text-white"
                    >
                      Ouvrir
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {(view === 'jour' || view === 'semaine') && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-white p-3">
          <button
            type="button"
            onClick={() =>
              setCursorDate(
                addDaysToIso(cursorDate, view === 'semaine' ? -7 : -1),
              )
            }
            className="grid h-11 w-11 place-items-center rounded-xl border border-line"
            aria-label="Précédent"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          {view === 'jour' ? (
            <input
              type="date"
              value={cursorDate}
              onChange={(e) => setCursorDate(e.target.value)}
              className="h-11 min-w-0 flex-1 rounded-xl border border-line px-3 font-semibold"
            />
          ) : (
            <div className="min-w-0 flex-1 text-center">
              <p className="text-sm font-extrabold text-ink">
                Semaine du {formatFr(startOfWeekMonday(cursorDate))}
              </p>
              <p className="text-xs text-muted">
                {formatFr(weekDates[0])} → {formatFr(weekDates[6])}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={() =>
              setCursorDate(
                addDaysToIso(cursorDate, view === 'semaine' ? 7 : 1),
              )
            }
            className="grid h-11 w-11 place-items-center rounded-xl border border-line"
            aria-label="Suivant"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCursorDate(todayIsoLocal())}
            className="h-11 rounded-xl border border-line px-3 text-xs font-bold"
          >
            Aujourd’hui
          </button>
        </div>
      )}

      {view === 'jour' && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">
              Programme · {formatJourCourt(cursorDate)}
            </h2>
            <button
              type="button"
              onClick={() => openNew(cursorDate)}
              className="inline-flex min-h-10 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-900"
            >
              <Plus className="h-3.5 w-3.5" /> Ajouter ce jour
            </button>
          </div>
          {bureau ? (
            renderLignesTechJour(cursorDate)
          ) : programmeForDate(cursorDate).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-white px-4 py-8 text-center text-sm text-muted">
              Rien de prévu ce jour. Ajoute une intervention ou un OT daté aujourd’hui.
            </div>
          ) : (
            <div className="grid gap-3">
              {programmeForDate(cursorDate).map(renderProgrammeCard)}
            </div>
          )}
        </section>
      )}

      {view === 'semaine' && (
        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold">Programme de la semaine</h2>
          {weekDates.map((day) => {
            const items = programmeForDate(day)
            const isToday = day === todayIsoLocal()
            return (
              <div
                key={day}
                className={[
                  'rounded-2xl border p-3',
                  isToday ? 'border-teal-300 bg-teal-50/40' : 'border-line bg-white',
                ].join(' ')}
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCursorDate(day)
                      setView('jour')
                    }}
                    className="text-left"
                  >
                    <span className="font-display text-base font-bold text-ink">
                      {formatJourCourt(day)}
                    </span>
                    {isToday ? (
                      <span className="ml-2 text-[10px] font-bold uppercase text-teal-800">
                        Aujourd’hui
                      </span>
                    ) : null}
                    <span className="ml-2 text-xs text-muted">
                      {items.length} intervention{items.length > 1 ? 's' : ''}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openNew(day)}
                    className="inline-flex min-h-9 items-center gap-1 rounded-full border border-line px-2.5 text-[11px] font-bold"
                  >
                    <Plus className="h-3 w-3" /> Planifier
                  </button>
                </div>
                {bureau ? (
                  renderLignesTechJour(day)
                ) : items.length === 0 ? (
                  <p className="px-1 text-xs text-muted">Libre</p>
                ) : (
                  <ul className="space-y-1.5">
                    {items.map((it) => {
                      const col = couleurPlanning({
                        horsOtType: it.kind === 'agenda' ? it.event.type : undefined,
                        secteur:
                          it.kind === 'ot'
                            ? it.secteur || posteOf(it.technicienUserId)
                            : posteOf(it.event.technicienUserId),
                        technicienUserId:
                          it.kind === 'ot' ? it.technicienUserId : it.event.technicienUserId,
                      })
                      const badge =
                        it.kind === 'ot'
                          ? 'OT'
                          : isHorsOtType(it.event.type)
                            ? AGENDA_TYPE_LABELS[it.event.type]
                            : 'Agenda'
                      return (
                      <li key={it.id}>
                        <button
                          type="button"
                          onClick={() => {
                            if (it.kind === 'agenda') {
                              navigate(`/app/agenda?id=${encodeURIComponent(it.event.id)}`)
                            } else {
                              navigate(`/app/appel?ot=${encodeURIComponent(it.otId)}`)
                            }
                          }}
                          className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm ${col.border} ${col.bg}`}
                        >
                          <span className="w-12 shrink-0 text-xs font-extrabold text-ink">
                            {formatHeure(it.heure) || '—'}
                          </span>
                          <span className={`min-w-0 flex-1 truncate font-semibold ${col.text}`}>
                            {it.kind === 'ot' ? `${formatOtNumero(it.numero)} · ` : ''}
                            {it.title}
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${col.badge}`}
                          >
                            {badge}
                          </span>
                        </button>
                      </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </section>
      )}

      {(view === 'rappels' || view === 'tous') && (
        <>
          <SearchField
            value={q}
            onChange={setQ}
            placeholder="Client, site, titre…"
            testId="agenda-search"
          />
          <div className="grid gap-3">
            {rappelsList.map((ev) => {
              const item: ProgrammeItem = {
                kind: 'agenda',
                id: `ag-${ev.id}`,
                date: ev.date,
                heure: ev.heure,
                title: ev.title,
                event: ev,
              }
              return renderProgrammeCard(item)
            })}
            {rappelsList.length === 0 && (
              <div className="rounded-2xl border border-dashed border-line bg-white px-4 py-10 text-center text-sm text-muted">
                Aucun rappel. Signez un contrat puis « Sync contrats », ou planifiez une
                intervention.
              </div>
            )}
          </div>
        </>
      )}

      <MobileFab label="Planifier" onClick={() => openNew()} />
    </div>
  )
}

function OtPlanifierInline({
  ot,
  onPlan,
  highlightAgence,
}: {
  ot: OrdreTravail
  highlightAgence?: string
  onPlan: (patch: {
    date?: string
    heure?: string
    technicien?: string
    technicienUserId?: string
    technicienUserIds?: string[]
  }) => void
}) {
  const [date, setDate] = useState(ot.date || todayIsoLocal())
  const [heure, setHeure] = useState(formatHeure(ot.heure))
  const [tech, setTech] = useState(ot.technicien || '')
  const [techId, setTechId] = useState(ot.technicienUserId)
  const [techIds, setTechIds] = useState(() => techIdsOt(ot))

  return (
    <form
      className="mt-2 grid gap-2"
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        if (!heure.trim()) {
          alert('Indiquez une heure pour caler l’OT sur le planning.')
          return
        }
        onPlan({
          date: date || ot.date,
          heure: heure.trim(),
          technicien: tech,
          technicienUserId: techId,
          technicienUserIds: techIds,
        })
      }}
    >
      <div className="grid gap-2 sm:grid-cols-[1fr_7rem]">
      <label className="block text-xs">
        <span className="mb-0.5 block font-bold uppercase text-muted">Date</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-10 w-full rounded-lg border border-line bg-white px-2 text-sm"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-0.5 block font-bold uppercase text-muted">Heure</span>
        <input
          type="time"
          required
          value={heure}
          onChange={(e) => setHeure(e.target.value)}
          className="h-10 w-full rounded-lg border border-line bg-white px-2 text-sm"
        />
      </label>
      </div>
      <TechnicienAssignField
        multi
        highlightAgence={highlightAgence || ot.agenceCode}
        label="Affecter (plusieurs techs)"
        technicien={tech}
        technicienUserId={techId}
        technicienUserIds={techIds}
        onChange={(next) => {
          setTech(next.technicien)
          setTechId(next.technicienUserId)
          setTechIds(next.technicienUserIds || [])
        }}
      />
      <button
        type="submit"
        className="h-10 rounded-lg bg-ink px-3 text-xs font-bold text-white"
      >
        Planifier
      </button>
    </form>
  )
}
