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
  X,
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
  agendaCouvreDate,
  isAgendaDueSoon,
  isAgendaOverdue,
  isIndispoType,
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
  STATUT_OT_LABELS,
  compareOtPrioritePlanning,
  formatOtAvancement,
  formatOtNumero,
  isOtCloture,
  labelTechsOt,
  prioriteTypeOt,
  syncTechsOt,
  techIdsOt,
  type OrdreTravail,
  type StatutOt,
  type TypeOt,
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
  DUREES_PLANNING_PRESETS,
  DUREE_PLANNING_DEFAUT,
  JOUR_PLANNING_DEBUT_H,
  JOUR_PLANNING_FIN_H,
  couleurPlanning,
  dureeMinutesEffectif,
  heuresFriseJour,
  isHorsOtType,
  labelDureeMinutes,
  labelIndispoCourte,
  otSansCreneau,
  techEstIndispo,
  indisposTechSurDate,
  techsLignesJour,
  timelinePlacement,
  titreDefautHorsOt,
  typesAgendaPourSaisie,
  visibleAgendaPour,
} from '../lib/agendaPlanning'
import { alertesOtContratFinMois, dateDerniereInterventionPourOt, NIVEAU_VISITE_LABELS, type NiveauVisite } from '../lib/contratOtAuto'
import { dossierForUser } from '../lib/rhDocuments'
import {
  calculerJournee,
  parsePointageEvents,
  parsePointageRegles,
} from '../lib/pointage'
import {
  STATUT_LIVE_OT_CLASS,
  avancementTechVsPlanning,
  blocsPlanifiesDuTech,
  labelAvancementTech,
  nowMarkerPct,
  statutLiveOtPourTech,
} from '../lib/pointageAvancement'
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
      dureeMinutes?: number
      title: string
      event: AgendaEvent
    }
  | {
      kind: 'ot'
      id: string
      date: string
      heure?: string
      dureeMinutes?: number
      title: string
      otId: string
      typeOt?: string
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
  /** OT sélectionné pour pose / déplacement / multi-tech sur la frise. */
  const [otAPlacerId, setOtAPlacerId] = useState<string | null>(null)
  /** Durée choisie avant pose (2 h / ½ jour / 1 jour…). */
  const [dureePose, setDureePose] = useState(DUREE_PLANNING_DEFAUT)
  /** Bande OT ouverte par défaut — reste visible quel que soit le jour. */
  const [otPoolOpen, setOtPoolOpen] = useState(true)
  /** Filtres bande OT à poser. */
  const [filterTypeOt, setFilterTypeOt] = useState<TypeOt | 'tous'>('tous')
  const [filterSiteId, setFilterSiteId] = useState<string>('tous')

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

  const pointageEvents = useMemo(
    () => parsePointageEvents(data.pointageEvents),
    [data.pointageEvents],
  )
  const pointageRegles = useMemo(
    () => parsePointageRegles(data.pointageRegles),
    [data.pointageRegles],
  )
  const [nowTick, setNowTick] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNowTick(Date.now()), 60_000)
    return () => window.clearInterval(t)
  }, [])

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
        dureeMinutes: e.dureeMinutes,
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
        dureeMinutes: o.dureeMinutes,
        title: o.action || TYPE_OT_LABELS[o.typeOt] || 'OT',
        otId: o.id,
        typeOt: o.typeOt,
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

  /** Tous les OT sans créneau (métier / région) — la bande reste visible tous les jours. */
  const otsSansPlanningBase = useMemo(() => {
    const list = (data.ordresTravail || []).filter((o) => {
      if (!otSansCreneau(o) || !visibleAgendaPour(visOpts, o)) return false
      if (!matchAgence(agenceOfOt(o))) return false
      if (!matchSecteur({ secteur: o.secteur, technicienUserId: o.technicienUserId })) return false
      return true
    })
    return list.sort(compareOtPrioritePlanning)
  }, [
    data.ordresTravail,
    bureau,
    user?.id,
    filterTechId,
    filterSecteur,
    filterAgences,
  ]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Sites de la région sélectionnée (pour le déroulant bande OT). */
  const sitesRegionPool = useMemo(() => {
    const sites = (data.chantiers || []).filter((s) => {
      if (s.statut === 'archive') return false
      const client = data.clients.find((c) => c.id === s.clientId)
      const ag = agenceEffective({
        agenceCode: s.agenceCode || client?.agenceCode,
        codePostal: s.codePostal || client?.codePostal,
      })
      return matchAgence(ag)
    })
    return sites
      .slice()
      .sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr'))
  }, [data.chantiers, data.clients, filterAgences]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (filterSiteId === 'tous') return
    if (!sitesRegionPool.some((s) => s.id === filterSiteId)) setFilterSiteId('tous')
  }, [sitesRegionPool, filterSiteId])

  const otsSansPlanning = useMemo(() => {
    return otsSansPlanningBase.filter((o) => {
      if (filterTypeOt !== 'tous' && o.typeOt !== filterTypeOt) return false
      if (filterSiteId !== 'tous' && o.chantierId !== filterSiteId) return false
      return true
    })
  }, [otsSansPlanningBase, filterTypeOt, filterSiteId])

  /** Dernière intervention par OT (bande à poser) — surtout contrats mensuels. */
  const derniereIntervParOtId = useMemo(() => {
    const map = new Map<string, string>()
    const ots = data.ordresTravail || []
    const sitesById = new Map((data.chantiers || []).map((s) => [s.id, s]))
    for (const ot of otsSansPlanning) {
      if (!ot.contratOtKey && ot.typeOt !== 'maintenance' && ot.typeOt !== 'entretien') {
        continue
      }
      const d = dateDerniereInterventionPourOt(ot, {
        ordresTravail: ots,
        derniereMaintenanceSite: sitesById.get(ot.chantierId || '')?.derniereMaintenanceDate,
      })
      if (d) map.set(ot.id, d)
    }
    return map
  }, [otsSansPlanning, data.ordresTravail, data.chantiers])

  const otContratFinMois = useMemo(
    () => alertesOtContratFinMois(data.ordresTravail || []),
    [data.ordresTravail],
  )

  const otAPlacer = useMemo(
    () => (otAPlacerId ? (data.ordresTravail || []).find((o) => o.id === otAPlacerId) : null),
    [otAPlacerId, data.ordresTravail],
  )

  useEffect(() => {
    if (!otAPlacer) return
    setDureePose(dureeMinutesEffectif(otAPlacer.dureeMinutes))
  }, [otAPlacer?.id, otAPlacer?.dureeMinutes]) // eslint-disable-line react-hooks/exhaustive-deps

  const programmeForDate = (iso: string) => {
    const day = iso.slice(0, 10)
    return programmeVisible.filter((p) => {
      if (p.kind === 'agenda' && isIndispoType(p.event.type)) {
        return agendaCouvreDate(p.event, day)
      }
      return p.date === day
    })
  }

  /** Clique sur un tech : filtre la frise sur ce tech (jour ou semaine). */
  const focusTechJour = (techId: string) => {
    setFilterTechId(techId)
    setFilterSecteur('tous')
  }

  const placerOtSurCreneau = (techId: string, heureH: number, dateIso: string) => {
    if (!otAPlacer || !bureau) return
    const day = dateIso.slice(0, 10)
    if (techEstIndispo(data.agendaEvents, techId, day)) {
      const abs = indisposTechSurDate(data.agendaEvents, techId, day)[0]
      setSyncMsg(
        `Impossible : tech en ${labelIndispoCourte(abs || { type: 'vacances', title: 'vacances' })} — ne pas poser d’OT.`,
      )
      return
    }
    const heure = `${String(heureH).padStart(2, '0')}:00`
    const noms: Record<string, string> = {}
    for (const t of team) noms[t.id] = t.fullName || t.email || ''
    const existing = techIdsOt(otAPlacer)
    const ids = existing.includes(techId) ? existing : [...existing, techId]
    const primary = ids[0] || techId
    planifierOt(otAPlacer, {
      date: day,
      heure,
      dureeMinutes: dureeMinutesEffectif(dureePose),
      technicienUserIds: ids,
      technicienUserId: primary,
      technicien: noms[primary] || '',
    })
    setOtAPlacerId(null)
  }

  /** Croix rouge : retire le tech, ou enlève l’heure (OT revient dans la bande). */
  const retirerOtDuTech = (otId: string, techId: string) => {
    if (!bureau) return
    const ot = (data.ordresTravail || []).find((o) => o.id === otId)
    if (!ot) return
    const noms: Record<string, string> = {}
    for (const t of team) noms[t.id] = t.fullName || t.email || ''
    const ids = techIdsOt(ot)
    if (ids.length > 1 && ids.includes(techId)) {
      const next = ids.filter((id) => id !== techId)
      planifierOt(ot, {
        technicienUserIds: next,
        technicienUserId: next[0],
        technicien: noms[next[0]] || '',
      })
      setSyncMsg(`${formatOtNumero(ot.numero)} retiré de ${noms[techId] || 'ce tech'}.`)
      return
    }
    planifierOt(ot, { heure: '' })
    setSyncMsg(`${formatOtNumero(ot.numero)} retiré du planning (sans heure).`)
    if (otAPlacerId === otId) setOtAPlacerId(null)
  }

  const appliquerDureePose = (minutes: number) => {
    setDureePose(minutes)
    if (!otAPlacer || !bureau) return
    if (!(otAPlacer.heure || '').trim()) return
    planifierOt(otAPlacer, { dureeMinutes: minutes })
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
      if (isIndispoType(typePrefill)) {
        base.heure = undefined
        base.dureeMinutes = undefined
        base.dateFin = datePrefill || base.date
      }
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
    if (isIndispoType(form.type) && !form.technicienUserId) {
      alert('Choisissez le technicien concerné par les vacances / congés.')
      return
    }
    const dateFin =
      isIndispoType(form.type) && form.dateFin && form.dateFin >= form.date
        ? form.dateFin
        : isIndispoType(form.type)
          ? form.date
          : undefined
    upsertAgendaEvent({
      ...form,
      id: existing?.id,
      heure: isIndispoType(form.type) ? undefined : (form.heure || '').trim() || undefined,
      dureeMinutes: isIndispoType(form.type)
        ? undefined
        : dureeMinutesEffectif(form.dureeMinutes),
      dateFin,
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
      isIndispoType(form.type)
        ? 'Vacances / congé enregistrés — aucun OT ne pourra être posé sur ces jours.'
        : isHorsOtType(form.type)
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
      dureeMinutes?: number
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
    const day = String(patch.date ?? ot.date ?? '').slice(0, 10)
    const heureVal = patch.heure !== undefined ? patch.heure : ot.heure
    if (day && String(heureVal || '').trim()) {
      for (const tid of ids) {
        if (techEstIndispo(data.agendaEvents, tid, day)) {
          const abs = indisposTechSurDate(data.agendaEvents, tid, day)[0]
          setSyncMsg(
            `OT non planifié : ${noms[tid] || 'tech'} est en ${labelIndispoCourte(
              abs || { type: 'vacances', title: 'vacances' },
            )}.`,
          )
          return
        }
      }
    }
    const synced = syncTechsOt({
      technicienUserIds: ids,
      noms,
      technicien: patch.technicien ?? ot.technicien,
    })
    const duree =
      patch.dureeMinutes !== undefined
        ? dureeMinutesEffectif(patch.dureeMinutes)
        : ot.dureeMinutes
    upsertOrdreTravail({
      ...ot,
      id: ot.id,
      date: patch.date ?? ot.date,
      heure: patch.heure !== undefined ? patch.heure : ot.heure,
      dureeMinutes: duree,
      ...synced,
      secteur:
        ot.secteur || secteurOtDepuisPoste(posteOf(synced.technicienUserId)),
    })
    setSyncMsg(
      patch.heure !== undefined
        ? patch.heure
          ? `${formatOtNumero(ot.numero)} calé ${patch.date || ot.date} à ${patch.heure} (${labelDureeMinutes(duree)}).`
          : `${formatOtNumero(ot.numero)} sans créneau (retiré de la frise).`
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
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-ink">
                {isIndispoType(form.type) ? 'Début' : 'Jour d’intervention'}
              </span>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="h-11 w-full rounded-xl border border-line px-3"
              />
            </label>
            {isIndispoType(form.type) ? (
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-ink">Fin (incluse)</span>
                <input
                  type="date"
                  value={form.dateFin || form.date}
                  min={form.date}
                  onChange={(e) => setForm({ ...form, dateFin: e.target.value })}
                  className="h-11 w-full rounded-xl border border-line px-3"
                />
              </label>
            ) : (
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-ink">Heure (optionnel)</span>
                <input
                  type="time"
                  value={formatHeure(form.heure)}
                  onChange={(e) => setForm({ ...form, heure: e.target.value })}
                  className="h-11 w-full rounded-xl border border-line px-3"
                />
              </label>
            )}
            {!isIndispoType(form.type) ? (
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-ink">Durée</span>
                <select
                  value={dureeMinutesEffectif(form.dureeMinutes)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      dureeMinutes: Number(e.target.value) || DUREE_PLANNING_DEFAUT,
                    })
                  }
                  className="h-11 w-full rounded-xl border border-line bg-white px-3"
                >
                  {DUREES_PLANNING_PRESETS.map((m) => (
                    <option key={m} value={m}>
                      {labelDureeMinutes(m)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="flex items-end pb-2 text-xs font-semibold text-amber-900 sm:col-span-1">
                Journée(s) bloquée(s) — aucun OT posable.
              </p>
            )}
            {!isIndispoType(form.type) ? (
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-ink">Rappel appel</span>
                <input
                  type="date"
                  value={form.dateRappel || form.date}
                  onChange={(e) => setForm({ ...form, dateRappel: e.target.value })}
                  className="h-11 w-full rounded-xl border border-line px-3"
                />
              </label>
            ) : null}
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
                  if (isIndispoType(type)) {
                    setForm({
                      ...form,
                      type,
                      title: nextTitle || AGENDA_TYPE_LABELS[type],
                      heure: undefined,
                      dureeMinutes: undefined,
                      dateFin: form.dateFin || form.date,
                    })
                    return
                  }
                  setForm({
                    ...form,
                    type,
                    title: nextTitle,
                    dateFin: undefined,
                  })
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
              label={
                isIndispoType(form.type)
                  ? 'Technicien en absence *'
                  : 'Technicien (secteur)'
              }
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

  const liveOtFor = (
    otId: string,
    techId: string,
    heure?: string,
    dureeMinutes?: number,
    otStatut?: string,
    date = cursorDate,
  ) =>
    statutLiveOtPourTech({
      otId,
      otStatut,
      heure,
      dureeMinutes,
      events: pointageEvents,
      userId: techId,
      date,
      now: new Date(nowTick),
    })

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
                <span className="font-semibold opacity-80">
                  {' '}
                  · {labelDureeMinutes(item.dureeMinutes)}
                </span>
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
            {user?.id ? (
              (() => {
                const live = liveOtFor(
                  item.otId,
                  user.id,
                  item.heure,
                  item.dureeMinutes,
                  item.statut,
                )
                return (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUT_LIVE_OT_CLASS[live.statut]}`}
                  >
                    {live.label}
                  </span>
                )
              })()
            ) : item.statut ? (
              <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase text-ink">
                {STATUT_OT_LABELS[item.statut as StatutOt] || item.statut}
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
    const idsRaw = techsLignesJour({
      team,
      posteOf,
      taskTechIds: items.flatMap((it) => itemTechIds(it)),
      // Bureau : filtre tech du sélecteur (sinon tous + métier / région).
      filterTechId: bureau
        ? filterTechId && filterTechId !== 'tous'
          ? filterTechId
          : undefined
        : user?.id,
      filterSecteur: bureau ? filterSecteur : undefined,
      filterAgenceCodes: bureau ? filterAgences : undefined,
      agenceOf: agenceOfTech,
    })
    const unassigned = items.filter((it) => itemTechIds(it).length === 0)
    const heures = heuresFriseJour()
    const nowPct = nowMarkerPct(iso, new Date(nowTick))
    const ids = [...idsRaw].sort((a, b) => {
      const ca = items.filter((it) => itemTechIds(it).includes(a)).length
      const cb = items.filter((it) => itemTechIds(it).includes(b)).length
      if ((ca === 0) !== (cb === 0)) return ca === 0 ? -1 : 1
      if (filterTechId === a) return -1
      if (filterTechId === b) return 1
      return (team.find((t) => t.id === a)?.fullName || '').localeCompare(
        team.find((t) => t.id === b)?.fullName || '',
        'fr',
      )
    })
    if (ids.length === 0 && unassigned.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-line bg-white px-4 py-8 text-center text-sm text-muted">
          Aucun tech terrain à afficher. Renseignez les postes dans Équipe, ou ajoutez une
          intervention.
        </div>
      )
    }

    const openItem = (it: ProgrammeItem) => {
      if (it.kind === 'agenda') {
        navigate(`/app/agenda?id=${encodeURIComponent(it.event.id)}`)
      } else {
        navigate(`/app/appel?ot=${encodeURIComponent(it.otId)}`)
      }
    }

    const renderBlock = (it: ProgrammeItem, techId: string) => {
      const place = timelinePlacement(it.heure, it.dureeMinutes)
      if (!place) return null
      const otFull =
        it.kind === 'ot' ? (data.ordresTravail || []).find((o) => o.id === it.otId) : null
      const c = couleurPlanning({
        horsOtType: it.kind === 'agenda' ? it.event.type : undefined,
        typeOt: it.kind === 'ot' ? it.typeOt || otFull?.typeOt : undefined,
        secteur: it.kind === 'ot' ? it.secteur || posteOf(techId) : posteOf(techId),
        technicienUserId: techId,
      })
      const label =
        it.kind === 'ot'
          ? `${formatOtNumero(it.numero)} · ${it.title}`
          : it.title
      const prio =
        it.kind === 'ot' ? prioriteTypeOt(it.typeOt || otFull?.typeOt) : 9
      const selected = it.kind === 'ot' && otAPlacerId === it.otId
      const clientNom =
        it.kind === 'ot'
          ? data.clients.find((c) => c.id === it.clientId)?.raisonSociale
          : undefined
      const siteNom =
        it.kind === 'ot'
          ? data.chantiers.find((c) => c.id === it.chantierId)?.nom
          : undefined
      const live =
        it.kind === 'ot'
          ? liveOtFor(it.otId, techId, it.heure, it.dureeMinutes, it.statut, iso)
          : null
      return (
        <div
          key={it.id}
          style={{ left: `${place.leftPct}%`, width: `${place.widthPct}%`, zIndex: selected ? 25 : 10 - prio }}
          className={`absolute top-1 bottom-1 overflow-hidden rounded-lg border shadow-sm transition hover:z-20 hover:brightness-95 ${c.border} ${c.bg} ${
            selected ? 'ring-2 ring-teal-600' : ''
          } ${live?.statut === 'en_retard' ? 'ring-1 ring-amber-500' : ''}`}
        >
          {live && live.pctRempli > 0 ? (
            <span
              className="pointer-events-none absolute inset-y-0 left-0 bg-black/15"
              style={{ width: `${Math.min(100, live.pctRempli)}%` }}
            />
          ) : null}
          {bureau && it.kind === 'ot' ? (
            <button
              type="button"
              title="Retirer du planning"
              aria-label="Retirer du planning"
              onClick={(e) => {
                e.stopPropagation()
                retirerOtDuTech(it.otId, techId)
              }}
              className="absolute right-0.5 top-0.5 z-30 grid h-5 w-5 place-items-center rounded-full bg-red-600 text-white shadow hover:bg-red-700"
            >
              <X className="h-3 w-3" strokeWidth={3} />
            </button>
          ) : null}
          <button
            type="button"
            title={
              bureau && it.kind === 'ot'
                ? `${formatHeure(it.heure) || ''} · ${labelDureeMinutes(it.dureeMinutes)} — ${label}${live ? ` · ${live.label}` : ''}. Cliquez pour déplacer / ajouter un tech.`
                : `${formatHeure(it.heure) || ''} · ${labelDureeMinutes(it.dureeMinutes)} — ${label}${live ? ` · ${live.label}` : ''}`
            }
            onClick={(e) => {
              e.stopPropagation()
              if (bureau && it.kind === 'ot') {
                setOtAPlacerId(selected ? null : it.otId)
                setOtPoolOpen(true)
                return
              }
              openItem(it)
            }}
            onDoubleClick={(e) => {
              e.stopPropagation()
              openItem(it)
            }}
            className="absolute inset-0 overflow-hidden px-1.5 py-0.5 pr-6 text-left"
          >
            <span className="block truncate text-[10px] font-extrabold leading-tight text-ink">
              {formatHeure(it.heure)}
              <span className="font-semibold text-muted"> · {labelDureeMinutes(it.dureeMinutes)}</span>
            </span>
            <span className={`block truncate text-[11px] font-semibold leading-tight ${c.text}`}>
              {it.kind === 'ot' ? `${formatOtNumero(it.numero)} · ` : ''}
              {it.title}
            </span>
            {live ? (
              <span
                className={`mt-0.5 inline-block truncate rounded px-1 text-[8px] font-extrabold uppercase ${STATUT_LIVE_OT_CLASS[live.statut]}`}
              >
                {live.label}
                {live.pctRempli > 0 && live.statut !== 'planifie' ? ` ${live.pctRempli}%` : ''}
              </span>
            ) : clientNom || siteNom ? (
              <span className="block truncate text-[9px] font-medium text-muted">
                {[clientNom, siteNom].filter(Boolean).join(' · ')}
              </span>
            ) : null}
          </button>
        </div>
      )
    }

    return (
      <div className="space-y-2">
        {bureau && otAPlacer ? (
          <div className="space-y-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-medium text-teal-950">
            <p>
              {(otAPlacer.heure || '').trim() ? 'Déplacez / prolongez' : 'Posez'}{' '}
              <strong>{formatOtNumero(otAPlacer.numero)}</strong> (
              {TYPE_OT_LABELS[otAPlacer.typeOt] || otAPlacer.typeOt}
              ) : cliquez une <strong>heure</strong> sur la ligne du tech (plusieurs techs
              possibles) ·{' '}
              <button type="button" className="underline" onClick={() => setOtAPlacerId(null)}>
                Annuler
              </button>
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase text-teal-800">Durée</span>
              {DUREES_PLANNING_PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => appliquerDureePose(m)}
                  className={`rounded-full border px-2 py-1 text-[11px] font-bold ${
                    dureePose === m
                      ? 'border-teal-700 bg-teal-700 text-white'
                      : 'border-teal-300 bg-white text-teal-950'
                  }`}
                >
                  {labelDureeMinutes(m)}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <div className="min-w-[52rem]">
            <div className="flex border-b border-line bg-slate-50/80">
              <div className="w-36 shrink-0 border-r border-line px-2 py-2 text-[10px] font-bold uppercase text-muted sm:w-44">
                Technicien
              </div>
              <div className="relative min-h-[1.75rem] flex-1">
                {heures.map((h) => (
                  <div
                    key={h}
                    className="absolute top-0 bottom-0 border-l border-line/70"
                    style={{
                      left: `${((h - JOUR_PLANNING_DEBUT_H) / (JOUR_PLANNING_FIN_H - JOUR_PLANNING_DEBUT_H)) * 100}%`,
                      width: `${(1 / (JOUR_PLANNING_FIN_H - JOUR_PLANNING_DEBUT_H)) * 100}%`,
                    }}
                  >
                    <span className="pl-1 text-[10px] font-bold text-muted">{`${String(h).padStart(2, '0')}h`}</span>
                  </div>
                ))}
              </div>
            </div>
            {ids.map((id) => {
              const t = team.find((x) => x.id === id)
              const poste = posteOf(id)
              const col = couleurPlanning({ secteur: poste, technicienUserId: id })
              const mine = items.filter((it) => itemTechIds(it).includes(id))
              const timed = mine
                .filter((it) => Boolean(formatHeure(it.heure)))
                .slice()
                .sort((a, b) => {
                  if (a.kind === 'ot' && b.kind === 'ot') {
                    const oa = (data.ordresTravail || []).find((o) => o.id === a.otId)
                    const ob = (data.ordresTravail || []).find((o) => o.id === b.otId)
                    const p = prioriteTypeOt(oa?.typeOt) - prioriteTypeOt(ob?.typeOt)
                    if (p !== 0) return p
                  }
                  return compareProgrammeHeure(a, b)
                })
              const untimed = mine.filter((it) => !formatHeure(it.heure))
              const highlighted = filterTechId === id
              const journee = calculerJournee({
                events: pointageEvents,
                userId: id,
                date: iso,
                regles: pointageRegles,
                now: new Date(nowTick).toISOString(),
              })
              const av = avancementTechVsPlanning({
                userId: id,
                date: iso,
                events: pointageEvents,
                blocs: blocsPlanifiesDuTech(data.ordresTravail || [], {
                  userId: id,
                  date: iso,
                }),
                regles: pointageRegles,
                now: new Date(nowTick).toISOString(),
                journee,
              })
              const avLabel = labelAvancementTech(av)
              const absences = indisposTechSurDate(data.agendaEvents, id, iso)
              const enVacances = absences.length > 0
              const labelVac = enVacances
                ? labelIndispoCourte(absences[0])
                : ''
              return (
                <div
                  key={id}
                  className={`border-b border-line last:border-b-0 ${highlighted ? 'ring-2 ring-inset ring-teal-500/50' : ''}`}
                >
                  <div className="flex">
                    <button
                      type="button"
                      onClick={() => focusTechJour(id)}
                      className={`flex w-36 shrink-0 flex-col justify-center gap-0.5 border-r border-line px-2 py-2 text-left sm:w-44 ${enVacances ? 'bg-amber-50' : col.bg}`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${enVacances ? 'bg-amber-600' : col.dot}`} />
                        <span className={`truncate text-xs font-bold ${enVacances ? 'text-amber-950' : col.text}`}>
                          {t?.fullName || nomTech(id)}
                        </span>
                      </span>
                      <span className="flex flex-wrap gap-1">
                        {labelSecteurCourt(poste) ? (
                          <span className={`rounded px-1 py-0.5 text-[8px] font-bold uppercase ${col.badge}`}>
                            {labelSecteurCourt(poste)}
                          </span>
                        ) : null}
                        {labelAgence(agenceOfTech(id)) ? (
                          <span className="rounded bg-white/80 px-1 py-0.5 text-[8px] font-bold text-ink">
                            {labelAgence(agenceOfTech(id))}
                          </span>
                        ) : null}
                      </span>
                      <span
                        className={`text-[9px] font-bold uppercase ${
                          enVacances
                            ? 'text-amber-800'
                            : av.enRetard
                              ? 'text-amber-800'
                              : 'text-muted'
                        }`}
                      >
                        {enVacances
                          ? labelVac
                          : `${avLabel}${
                              av.statutLabel && av.statutLabel !== 'Libre'
                                ? ` · ${av.statutLabel}`
                                : ''
                            }`}
                      </span>
                    </button>
                    <div
                      className={[
                        'relative h-[4.75rem] flex-1 bg-[linear-gradient(to_right,rgb(15_23_42_/_0.04)_1px,transparent_1px)] bg-[length:calc(100%/12)_100%]',
                        otAPlacer && !enVacances ? 'cursor-cell' : '',
                        enVacances ? 'bg-amber-100/80' : '',
                      ].join(' ')}
                    >
                      {enVacances ? (
                        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-2">
                          <span className="rounded-lg border border-amber-500 bg-amber-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-amber-950">
                            {labelVac} — OT bloqués
                          </span>
                        </div>
                      ) : null}
                      {heures.map((h) => (
                        <button
                          key={`g-${id}-${h}`}
                          type="button"
                          disabled={!otAPlacer || enVacances}
                          title={
                            enVacances
                              ? labelVac
                              : otAPlacer
                                ? `Placer à ${String(h).padStart(2, '0')}:00`
                                : undefined
                          }
                          onClick={() => {
                            if (otAPlacer && !enVacances) placerOtSurCreneau(id, h, iso)
                          }}
                          className={[
                            'absolute top-0 bottom-0 border-l border-line/40',
                            otAPlacer && !enVacances
                              ? 'z-[5] hover:bg-teal-400/25'
                              : 'pointer-events-none',
                          ].join(' ')}
                          style={{
                            left: `${((h - JOUR_PLANNING_DEBUT_H) / (JOUR_PLANNING_FIN_H - JOUR_PLANNING_DEBUT_H)) * 100}%`,
                            width: `${(1 / (JOUR_PLANNING_FIN_H - JOUR_PLANNING_DEBUT_H)) * 100}%`,
                          }}
                        />
                      ))}
                      {timed.map((it) => renderBlock(it, id))}
                      {nowPct != null ? (
                        <span
                          className="pointer-events-none absolute top-0 bottom-0 z-20 w-0.5 bg-rose-600"
                          style={{ left: `${nowPct}%` }}
                          title="Maintenant"
                        />
                      ) : null}
                      {timed.length === 0 && !otAPlacer && !enVacances ? (
                        <p className="pointer-events-none absolute inset-0 flex items-center px-3 text-[11px] text-muted">
                          Libre — sélectionnez un OT ci-dessus puis cliquez une heure.
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {untimed.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 border-t border-dashed border-line bg-white px-2 py-1.5 pl-[calc(9rem+0.5rem)] sm:pl-[calc(11rem+0.5rem)]">
                      {untimed.map((it) => {
                        const c = couleurPlanning({
                          horsOtType: it.kind === 'agenda' ? it.event.type : undefined,
                          typeOt: it.kind === 'ot' ? it.typeOt : undefined,
                          secteur: it.kind === 'ot' ? it.secteur || poste : poste,
                          technicienUserId: id,
                        })
                        return (
                          <button
                            key={it.id}
                            type="button"
                            onClick={() => {
                              if (bureau && it.kind === 'ot') {
                                setOtAPlacerId(it.otId)
                                setOtPoolOpen(true)
                                return
                              }
                              openItem(it)
                            }}
                            className={`rounded-lg border px-2 py-1 text-left text-[11px] ${c.border} ${c.bg}`}
                          >
                            <span className="font-bold text-muted">Sans heure · </span>
                            <span className={`font-semibold ${c.text}`}>{it.title}</span>
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
        {unassigned.length > 0 && !bureau ? (
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
                ? 'Vue jour : techs filtrés par métier / région. Sélectionnez un OT (bande compacte) puis cliquez une heure. Priorité : dépannage → installation → maintenance.'
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

      {bureau && otContratFinMois.length > 0 ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <p className="font-semibold">
            Fin de mois dans {otContratFinMois[0].joursRestants} j —{' '}
            {otContratFinMois.length} OT contrat encore à poser / faire
          </p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {otContratFinMois.slice(0, 5).map((a) => (
              <li key={a.otId}>
                <button
                  type="button"
                  className="font-bold underline"
                  onClick={() => {
                    setOtAPlacerId(a.otId)
                    setOtPoolOpen(true)
                    setView('jour')
                    if (a.date) setCursorDate(a.date.slice(0, 10))
                  }}
                >
                  {formatOtNumero(a.numero)}
                </button>
                {a.visiteNiveau
                  ? ` · ${NIVEAU_VISITE_LABELS[a.visiteNiveau as NiveauVisite]}`
                  : ''}{' '}
                — {a.action || 'Maintenance contrat'}
              </li>
            ))}
          </ul>
        </div>
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
              // Ne pas forcer la vue Jour : utile pour planifier la semaine d’un seul tech.
            }}
            className="h-10 min-w-[12rem] rounded-xl border border-line bg-white px-3 text-sm font-semibold"
            title="Filtrer la frise sur un technicien"
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
              ['vacances', 'Vacances'],
              ['conge', 'Congé'],
              ['maladie', 'Maladie'],
              ['formation', 'Formation'],
              ['rdv_garage', 'RDV garage'],
              ['hors_ot_libre', 'Événement libre'],
            ] as const
          ).map(([type, label]) => (
            <button
              key={type}
              type="button"
              onClick={() => openNew(cursorDate, type)}
              className={[
                'rounded-full border px-3 py-1.5 text-xs font-bold',
                type === 'vacances' || type === 'conge' || type === 'maladie'
                  ? 'border-amber-400 bg-amber-50 text-amber-950'
                  : 'border-line bg-white',
              ].join(' ')}
            >
              + {label}
            </button>
          ))}
        </div>
      ) : null}

      {view !== 'rappels' ? (
        <section className="rounded-2xl border border-dashed border-line bg-white p-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOtPoolOpen((o) => !o)}
              className="inline-flex min-h-10 min-w-[10rem] flex-1 items-center gap-2 rounded-xl border border-line bg-mist/40 px-3 text-left text-sm font-semibold text-ink sm:flex-none"
            >
              <ClipboardList className="h-4 w-4 shrink-0 text-muted" />
              <span className="min-w-0 truncate">
                {bureau ? 'OT à poser' : 'Mes OT sans planning'}
                <span className="ml-1.5 font-bold text-teal-800">
                  ({otsSansPlanning.length}
                  {otsSansPlanning.length !== otsSansPlanningBase.length
                    ? `/${otsSansPlanningBase.length}`
                    : ''}
                  )
                </span>
              </span>
              <span className="text-[11px] font-bold uppercase text-muted">
                {otPoolOpen || otAPlacerId ? 'Replier' : 'Ouvrir'}
              </span>
            </button>
            <label className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line bg-white px-2 text-[11px] font-bold text-muted">
              Type
              <select
                value={filterTypeOt}
                onChange={(e) => setFilterTypeOt(e.target.value as TypeOt | 'tous')}
                className="max-w-[9.5rem] rounded-lg border-0 bg-transparent py-1 text-xs font-semibold text-ink outline-none"
                aria-label="Filtrer par type d’OT"
              >
                <option value="tous">Tous</option>
                {(
                  [
                    'depanage',
                    'installation',
                    'maintenance',
                    'entretien',
                    'controle_etancheite',
                    'demantelement',
                    'devis',
                  ] as TypeOt[]
                ).map((t) => (
                  <option key={t} value={t}>
                    {TYPE_OT_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-flex min-h-10 min-w-0 flex-1 items-center gap-1.5 rounded-xl border border-line bg-white px-2 text-[11px] font-bold text-muted sm:max-w-xs">
              Site
              <select
                value={filterSiteId}
                onChange={(e) => setFilterSiteId(e.target.value)}
                className="min-w-0 flex-1 truncate rounded-lg border-0 bg-transparent py-1 text-xs font-semibold text-ink outline-none"
                aria-label="Filtrer par site de la région"
              >
                <option value="tous">
                  Tous les sites
                  {filterAgences.length ? ` (${filterAgences.join(', ')})` : ''}
                </option>
                {sitesRegionPool.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nom || 'Site'}
                    {s.ville ? ` — ${s.ville}` : ''}
                  </option>
                ))}
              </select>
            </label>
            {otAPlacer ? (
              <button
                type="button"
                onClick={() => setOtAPlacerId(null)}
                className="rounded-full border border-teal-300 bg-teal-50 px-3 py-2 text-xs font-bold text-teal-950"
              >
                Annuler pose {formatOtNumero(otAPlacer.numero)}
              </button>
            ) : null}
          </div>
          {(otPoolOpen || otAPlacerId) && (
            <>
              <p className="mt-2 text-[11px] text-muted">
                {bureau
                  ? 'Sans créneau · priorité dépannage → install → maintenance. Cliquez un OT, durée, puis une heure. Sur Maint. contrat : « dern. » = dernière intervention du site (pour caler un intervalle régulier). Bloc posé : clic = déplacer / + tech ; croix rouge = retirer.'
                  : 'OT affectés à vous, pas encore calés.'}
              </p>
              {otsSansPlanning.length === 0 ? (
                <p className="mt-2 text-xs text-muted">Aucun OT sans créneau pour ces filtres.</p>
              ) : (
                <div className="mt-2 max-h-[min(50vh,28rem)] space-y-1 overflow-y-auto">
                  {otsSansPlanning.map((ot) => {
                    const selected = otAPlacerId === ot.id
                    const prio = prioriteTypeOt(ot.typeOt)
                    const col = couleurPlanning({ typeOt: ot.typeOt })
                    const clientNom =
                      data.clients.find((c) => c.id === ot.clientId)?.raisonSociale || '—'
                    const siteNom =
                      data.chantiers.find((c) => c.id === ot.chantierId)?.nom || '—'
                    const typeCourt =
                      prio === 0
                        ? 'Dép.'
                        : prio === 1
                          ? 'Inst.'
                          : prio === 2
                            ? 'Maint.'
                            : TYPE_OT_LABELS[ot.typeOt]?.slice(0, 6) || 'OT'
                    const action = (ot.action || '').trim()
                    const derniereInterv = derniereIntervParOtId.get(ot.id)
                    const titleLine = [
                      typeCourt,
                      formatOtNumero(ot.numero),
                      ot.date ? formatFr(ot.date) : '',
                      derniereInterv ? `dern. interv. ${formatFr(derniereInterv)}` : '',
                      clientNom,
                      siteNom,
                      action,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                    return (
                      <button
                        key={ot.id}
                        type="button"
                        title={titleLine}
                        onClick={() => {
                          if (!bureau) {
                            navigate(`/app/appel?ot=${encodeURIComponent(ot.id)}`)
                            return
                          }
                          setOtAPlacerId(selected ? null : ot.id)
                          setOtPoolOpen(true)
                          setView('jour')
                        }}
                        className={`flex w-full items-center gap-1.5 overflow-hidden rounded-lg border px-2 py-1.5 text-left text-[11px] leading-tight ${col.border} ${col.bg} ${
                          selected ? 'ring-2 ring-teal-600' : 'hover:brightness-95'
                        }`}
                      >
                        <span className={`shrink-0 font-extrabold uppercase ${col.text}`}>
                          {typeCourt}
                        </span>
                        <span className="shrink-0 font-extrabold text-ink">
                          {formatOtNumero(ot.numero)}
                        </span>
                        {ot.date ? (
                          <span className="hidden shrink-0 font-semibold text-muted sm:inline">
                            {formatFr(ot.date)}
                          </span>
                        ) : null}
                        {derniereInterv ? (
                          <span
                            className="shrink-0 rounded bg-white/70 px-1 py-0.5 text-[10px] font-bold text-amber-900"
                            title={`Dernière intervention sur ce site : ${formatFr(derniereInterv)} — caler le prochain créneau à un intervalle comparable.`}
                          >
                            dern. {formatFr(derniereInterv)}
                          </span>
                        ) : null}
                        <span className={`min-w-0 truncate font-semibold ${col.text}`}>
                          {clientNom}
                          <span className="font-medium text-muted"> · {siteNom}</span>
                          {action ? (
                            <span className="font-normal text-ink/70"> · {action}</span>
                          ) : null}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}
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
            <div className="flex flex-wrap items-center gap-2">
              {bureau && filterTechId && filterTechId !== 'tous' ? (
                <p className="text-xs font-semibold text-teal-800">
                  Filtré : {team.find((t) => t.id === filterTechId)?.fullName || '1 tech'}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => openNew(cursorDate)}
                className="inline-flex min-h-10 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-900"
              >
                <Plus className="h-3.5 w-3.5" /> Ajouter ce jour
              </button>
            </div>
          </div>
          {renderLignesTechJour(cursorDate)}
          {!bureau ? (
            programmeForDate(cursorDate).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-white px-4 py-8 text-center text-sm text-muted">
                Rien de prévu ce jour. Ajoute une intervention ou un OT daté aujourd’hui.
              </div>
            ) : (
              <div className="grid gap-3">
                {programmeForDate(cursorDate).map(renderProgrammeCard)}
              </div>
            )
          ) : null}
        </section>
      )}

      {view === 'semaine' && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">Programme de la semaine</h2>
            {bureau && filterTechId && filterTechId !== 'tous' ? (
              <p className="text-xs font-semibold text-teal-800">
                Filtré : {team.find((t) => t.id === filterTechId)?.fullName || '1 tech'}
                {' · '}
                <button
                  type="button"
                  className="underline"
                  onClick={() => setFilterTechId('tous')}
                >
                  Voir tous les techs
                </button>
              </p>
            ) : null}
          </div>
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
    dureeMinutes?: number
    technicien?: string
    technicienUserId?: string
    technicienUserIds?: string[]
  }) => void
}) {
  const [date, setDate] = useState(ot.date || todayIsoLocal())
  const [heure, setHeure] = useState(formatHeure(ot.heure))
  const [duree, setDuree] = useState(() => dureeMinutesEffectif(ot.dureeMinutes))
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
          dureeMinutes: duree,
          technicien: tech,
          technicienUserId: techId,
          technicienUserIds: techIds,
        })
      }}
    >
      <div className="grid gap-2 sm:grid-cols-[1fr_7rem_7rem]">
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
      <label className="block text-xs">
        <span className="mb-0.5 block font-bold uppercase text-muted">Durée</span>
        <select
          value={duree}
          onChange={(e) => setDuree(Number(e.target.value) || DUREE_PLANNING_DEFAUT)}
          className="h-10 w-full rounded-lg border border-line bg-white px-2 text-sm"
        >
          {DUREES_PLANNING_PRESETS.map((m) => (
            <option key={m} value={m}>
              {labelDureeMinutes(m)}
            </option>
          ))}
        </select>
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
