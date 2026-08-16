import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ClipboardList,
  FileCheck2,
  Plus,
  Pencil,
  RefreshCw,
  Trash2,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  Building2,
  Cpu,
  Layers,
  FileSignature,
  Navigation,
  type LucideIcon,
} from 'lucide-react'
import { openAddressInGps, formatAddressQuery } from '../lib/mapsNav'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import type { Chantier, Equipement, ModeGestion, NatureIntervention, TypeTravaux } from '../lib/types'
import {
  equipAvecFluideFrigorigene,
  MODE_GESTION_LABELS,
  NATURE_LABELS,
  siteAvecFluideFrigorigene,
  TYPE_TRAVAUX_LABELS,
} from '../lib/types'
import {
  modeGestionLabel,
  resolveModeGestion,
  siteHasCerfaASigner,
} from '../lib/siteParc'
import { Field } from './ClientsPage'
import { DecimalField } from '../components/DecimalField'
import { FluideSelect } from '../components/FluideSelect'
import { PlaquePhotoButton } from '../components/PlaquePhotoButton'
import { SearchField, matchesQuery } from '../components/SearchField'
import { SmartSuggestField, type SmartSuggestion } from '../components/SmartSuggestField'
import { MobileFab } from '../components/MobileFab'
import { calcTeqCO2FromFluide, findFluide, formatGwp } from '../lib/fluides'
import type { PlaqueFields } from '../lib/plaqueOcr'
import { equipementsForCerfa, equipmentLabel, allEquipements, syncEquipementsFromFlat, findDuplicateEquipNom, findFirstDuplicateEquipNom } from '../lib/cerfaBatch'
import { buildCerfaPdf } from '../lib/cerfaPdf'
import { saveCerfaPdf } from '../lib/pdfStore'
import { blankFicheMaintenanceClim } from '../lib/ficheMaintenanceClim'
import { nextNumeroIntervention } from '../lib/numeroIntervention'
import { Sites3dIcon } from '../components/Sites3dIcon'

type QuickTone = 'sites' | 'cerfa' | 'teal' | 'muted'

function QuickIconBtn({
  icon: Icon,
  label,
  tone,
  onClick,
  title,
}: {
  icon: LucideIcon
  label: string
  tone: QuickTone
  onClick: () => void
  title?: string
}) {
  const tones: Record<QuickTone, { wrap: string; icon: string }> = {
    sites: { wrap: 'bg-orange-50 border-orange-200', icon: 'text-orange-600' },
    cerfa: { wrap: 'bg-emerald-50 border-emerald-200', icon: 'text-emerald-700' },
    teal: { wrap: 'bg-teal-50 border-teal-200', icon: 'text-teal-700' },
    muted: { wrap: 'bg-white border-line', icon: 'text-slate' },
  }
  const t = tones[tone]
  return (
    <button
      type="button"
      title={title || label}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={[
        'inline-flex min-h-12 min-w-[4.5rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-1.5 active:translate-y-px sm:flex-none sm:min-w-[5rem]',
        t.wrap,
      ].join(' ')}
    >
      <Icon className={['h-5 w-5', t.icon].join(' ')} strokeWidth={2.25} />
      <span className="text-[10px] font-bold leading-tight text-ink">{label}</span>
    </button>
  )
}

const blankEquip = (avecFluide = true): Equipement => ({
  id: crypto.randomUUID(),
  nom: '',
  type: '',
  marque: '',
  modele: '',
  numeroSerie: '',
  avecFluideFrigorigene: avecFluide,
  fluideType: avecFluide ? 'R-448A' : '',
  chargeNominaleKg: 0,
  teqCO2: 0,
  detectionPermanente: false,
})

const blank = (clientId = ''): Omit<Chantier, 'id' | 'createdAt'> => ({
  clientId,
  nom: '',
  adresse: '',
  codePostal: '',
  ville: '',
  typeTravaux: 'maintenance',
  detailTravaux: '',
  modeGestion: 'contrat',
  prochaineControleEtancheite: '',
  avecFluideFrigorigene: true,
  equipementType: '',
  equipementMarque: '',
  equipementModele: '',
  equipementNumeroSerie: '',
  fluideType: 'R-448A',
  chargeNominaleKg: 0,
  teqCO2: 0,
  detectionPermanente: false,
  statut: 'actif',
  notes: '',
  equipements: [blankEquip(true)],
})

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function ChantiersPage() {
  const {
    data,
    upsertChantier,
    deleteChantier,
    validateMaintenanceCerfas,
    upsertIntervention,
    upsertFicheMaintenanceClim,
    createOtForAction,
  } = useStore()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState(() => blank(data.clients[0]?.id || ''))
  const [editId, setEditId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [listFilter, setListFilter] = useState<'tous' | 'contrat' | 'travaux' | 'cerfa'>('tous')
  const [focusSiteId, setFocusSiteId] = useState<string | null>(null)
  const [focusEquipId, setFocusEquipId] = useState<string | null>(null)
  /** Accordéon liste : client ouvert (null = seuls les noms clients) */
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null)
  const [siteMenuOpen, setSiteMenuOpen] = useState(false)
  const [equipQ, setEquipQ] = useState('')
  const [equipIdx, setEquipIdx] = useState(0)
  const [equipFilter, setEquipFilter] = useState('')
  const [clientQuery, setClientQuery] = useState(() => {
    const c = data.clients.find((cl) => cl.id === data.clients[0]?.id)
    return c?.raisonSociale || ''
  })
  const [batchBusy, setBatchBusy] = useState<string | null>(null)
  const [picker, setPicker] = useState<{
    site: Chantier
    mode: 'maintenance' | 'intervention' | 'rapport'
    selected: string[]
    nature: 'maintenance' | 'depanage' | 'controle'
    filter: string
  } | null>(null)
  const [intervChoiceSite, setIntervChoiceSite] = useState<Chantier | null>(null)
  const [equipWork, setEquipWork] = useState<{
    site: Chantier
    equipementId: string
    natures: NatureIntervention[]
    step?: 'choose' | 'cerfa'
  } | null>(null)

  const ALL_NATURES = Object.keys(NATURE_LABELS) as NatureIntervention[]

  const equipements = form.equipements?.length ? form.equipements : syncEquipementsFromFlat(form)
  const currentEquip = equipements[Math.min(equipIdx, equipements.length - 1)] || blankEquip()
  const currentAvecFluide = equipAvecFluideFrigorigene(currentEquip)

  const closeForm = () => {
    setOpen(false)
    setEditId(null)
    setPicker(null)
    setEquipWork(null)
    setEquipFilter('')
    setSiteMenuOpen(false)
  }

  // Clic menu Sites → liste ; Accueil / Clients peuvent préremplir recherche ou ouvrir un nouveau site
  useEffect(() => {
    const st = location.state as {
      travauxList?: number
      search?: string
      newSiteForClientId?: string
    } | null
    if (!st) return
    if (st.travauxList) {
      closeForm()
      setFocusSiteId(null)
      setFocusEquipId(null)
    }
    if (typeof st.newSiteForClientId === 'string' && st.newSiteForClientId) {
      const clientId = st.newSiteForClientId
      const client = data.clients.find((c) => c.id === clientId)
      setEditId(null)
      setEquipIdx(0)
      setEquipFilter('')
      setFocusSiteId(null)
      setFocusEquipId(null)
      setClientQuery(client?.raisonSociale || '')
      setForm(fillAdresseFromClient(clientId, blank(clientId)))
      setOpen(true)
      setQ('')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (typeof st.search === 'string') {
      const search = st.search
      closeForm()
      setQ(search)
      // Ouvrir directement le site si un seul match exact / unique
      const needle = search.trim().toLowerCase()
      const hits = data.chantiers.filter((c) => {
        const client = data.clients.find((cl) => cl.id === c.clientId)
        return matchesQuery(
          [c.nom, c.ville, client?.raisonSociale].filter(Boolean).join(' '),
          search,
        )
      })
      const exact = hits.find((c) => c.nom.trim().toLowerCase() === needle)
      if (exact) {
        setFocusSiteId(exact.id)
        setFocusEquipId(null)
      } else if (hits.length === 1) {
        setFocusSiteId(hits[0].id)
        setFocusEquipId(null)
      } else {
        setFocusSiteId(null)
        setFocusEquipId(null)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state])

  const clientSuggestions: SmartSuggestion[] = useMemo(
    () =>
      data.clients.map((c) => ({
        id: c.id,
        label: c.raisonSociale,
        hint: [c.ville, c.codePostal].filter(Boolean).join(' · ') || undefined,
      })),
    [data.clients],
  )

  const siteSuggestions: SmartSuggestion[] = useMemo(() => {
    const sites = data.chantiers.filter((c) => !form.clientId || c.clientId === form.clientId)
    const seen = new Set<string>()
    const out: SmartSuggestion[] = []
    for (const s of sites) {
      const key = s.nom.trim().toLowerCase()
      if (!key || seen.has(key)) continue
      seen.add(key)
      out.push({
        id: s.id,
        label: s.nom,
        hint: [s.ville, s.adresse].filter(Boolean).join(' · ') || undefined,
      })
    }
    return out
  }, [data.chantiers, form.clientId])

  const equipSuggestions: SmartSuggestion[] = useMemo(() => {
    const seen = new Set<string>()
    const out: SmartSuggestion[] = []
    for (const site of data.chantiers) {
      if (form.clientId && site.clientId !== form.clientId) continue
      for (const eq of allEquipements(site)) {
        const label = (eq.nom || eq.type || '').trim()
        if (!label) continue
        const key = label.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        out.push({
          id: `${site.id}:${eq.id}`,
          label,
          hint: [eq.type && eq.nom !== eq.type ? eq.type : null, eq.marque, eq.modele, eq.fluideType]
            .filter(Boolean)
            .join(' · ') || undefined,
        })
      }
    }
    return out
  }, [data.chantiers, form.clientId])

  const filteredEquipIndices = useMemo(() => {
    if (!equipFilter.trim()) return equipements.map((_, i) => i)
    return equipements
      .map((eq, i) => ({ eq, i }))
      .filter(({ eq }) =>
        matchesQuery(
          [eq.nom, eq.type, eq.marque, eq.modele, eq.fluideType, eq.numeroSerie]
            .filter(Boolean)
            .join(' '),
          equipFilter,
        ),
      )
      .map(({ i }) => i)
  }, [equipements, equipFilter])

  const openPicker = (site: Chantier, mode: 'maintenance' | 'intervention' | 'rapport') => {
    const eqs = mode === 'rapport' ? allEquipements(site) : equipementsForCerfa(site)
    setPicker({
      site,
      mode,
      selected: mode === 'maintenance' ? eqs.map((e) => e.id) : eqs[0] ? [eqs[0].id] : [],
      nature:
        mode === 'maintenance'
          ? 'maintenance'
          : site.typeTravaux === 'controle_etancheite'
            ? 'controle'
            : 'depanage',
      filter: '',
    })
  }

  const naturesForPicker = (nature: 'maintenance' | 'depanage' | 'controle'): NatureIntervention[] => {
    if (nature === 'depanage') return ['entretien_reparation']
    if (nature === 'controle') return ['controle_etancheite_periodique']
    return ['entretien_reparation', 'controle_etancheite_periodique']
  }

  const createFichesRapport = (site: Chantier, equipementIds: string[]) => {
    const eqs = allEquipements(site)
    const selected = equipementIds.filter((id) => eqs.some((e) => e.id === id))
    if (selected.length === 0) {
      alert('Cochez au moins un équipement.')
      return
    }
    const client = data.clients.find((c) => c.id === site.clientId)
    const adresse =
      [site.adresse, site.codePostal, site.ville].filter(Boolean).join(', ') ||
      [client?.adresse, client?.codePostal, client?.ville].filter(Boolean).join(', ')
    const technicien = user?.signataireNom || user?.fullName || user?.email || ''
    const sharedNumero = nextNumeroIntervention(data)
    const createdIds: string[] = []
    selected.forEach((eqId) => {
      const eq = eqs.find((e) => e.id === eqId)
      if (!eq) return
      const base = blankFicheMaintenanceClim()
      const marqueModele = [eq.marque, eq.modele].filter(Boolean).join(' / ')
      const id = upsertFicheMaintenanceClim({
        ...base,
        numero: sharedNumero,
        date: today(),
        technicien,
        clientId: client?.id || site.clientId,
        chantierId: site.id,
        equipementId: eq.id,
        clientNom: client?.raisonSociale || '',
        adresse,
        marqueModele: marqueModele || eq.type || '',
        numeroSerie: eq.numeroSerie || '',
        fluide: eq.fluideType || '',
        quantiteFluideKg:
          eq.chargeNominaleKg != null && eq.chargeNominaleKg > 0 ? eq.chargeNominaleKg : null,
        signatureTechnicienImage: user?.signatureImage || '',
        signatureClientImage: site.signatureDetenteurImage || '',
      })
      createdIds.push(id)
    })
    setPicker(null)
    setIntervChoiceSite(null)
    if (createdIds.length === 0) return
    const first = createdIds[0]
    const q =
      createdIds.length > 1
        ? `id=${encodeURIComponent(first)}&batch=${encodeURIComponent(createdIds.join(','))}`
        : `id=${encodeURIComponent(first)}`
    navigate(`/app/fiche-maintenance-clim?${q}`)
  }

  const openFichesMaintenanceFromPicker = (equipementIds?: string[]) => {
    if (!picker) return
    if (picker.mode === 'rapport') {
      createFichesRapport(picker.site, equipementIds || picker.selected)
      return
    }
    const eqs = equipementsForCerfa(picker.site)
    const selected = (equipementIds || picker.selected).filter((id) => eqs.some((e) => e.id === id))
    if (selected.length === 0) {
      alert('Cochez au moins un équipement.')
      return
    }
    const client = data.clients.find((c) => c.id === picker.site.clientId)
    const site = picker.site
    const adresse =
      [site.adresse, site.codePostal, site.ville].filter(Boolean).join(', ') ||
      [client?.adresse, client?.codePostal, client?.ville].filter(Boolean).join(', ')
    const technicien = user?.signataireNom || user?.fullName || user?.email || ''
    const sharedNumero = nextNumeroIntervention(data)
    const createdIds: string[] = []
    selected.forEach((eqId) => {
      const eq = eqs.find((e) => e.id === eqId)
      if (!eq) return
      const base = blankFicheMaintenanceClim()
      const marqueModele = [eq.marque, eq.modele].filter(Boolean).join(' / ')
      const id = upsertFicheMaintenanceClim({
        ...base,
        numero: sharedNumero,
        date: today(),
        technicien,
        clientId: client?.id || site.clientId,
        chantierId: site.id,
        equipementId: eq.id,
        clientNom: client?.raisonSociale || '',
        adresse,
        marqueModele: marqueModele || eq.type || '',
        numeroSerie: eq.numeroSerie || '',
        fluide: eq.fluideType || '',
        quantiteFluideKg:
          eq.chargeNominaleKg != null && eq.chargeNominaleKg > 0 ? eq.chargeNominaleKg : null,
        signatureTechnicienImage: user?.signatureImage || '',
        signatureClientImage: site.signatureDetenteurImage || '',
      })
      createdIds.push(id)
    })
    setPicker(null)
    if (createdIds.length === 0) return
    const first = createdIds[0]
    const q =
      createdIds.length > 1
        ? `id=${encodeURIComponent(first)}&batch=${encodeURIComponent(createdIds.join(','))}`
        : `id=${encodeURIComponent(first)}`
    navigate(`/app/fiche-maintenance-clim?${q}`)
  }

  const startRapportFromSite = (site: Chantier) => {
    const eqs = allEquipements(site)
    if (eqs.length === 0) {
      alert('Ajoutez d’abord un équipement sur ce site.')
      return
    }
    if (eqs.length === 1) {
      createFichesRapport(site, [eqs[0].id])
      return
    }
    openPicker(site, 'rapport')
  }

  const onConfirmPicker = async () => {
    if (!picker || !user) return
    const eqs =
      picker.mode === 'rapport' ? allEquipements(picker.site) : equipementsForCerfa(picker.site)
    const selected = picker.selected.filter((id) => eqs.some((e) => e.id === id))
    if (selected.length === 0) {
      alert('Cochez au moins un équipement.')
      return
    }

    if (picker.mode === 'intervention') {
      if (selected.length === 1) {
        const eqId = selected[0]
        setPicker(null)
        setIntervChoiceSite(null)
        setEquipWork({
          site: picker.site,
          equipementId: eqId,
          natures: naturesForPicker(picker.nature),
        })
        return
      }
      // Plusieurs équipements → même flux que maintenance (1 CERFA / équipement)
      if (!user.signatureImage) {
        alert('Enregistrez d’abord votre signature dans « Ma signature ».')
        return
      }
      setBatchBusy(picker.site.id)
      try {
        const { drafts, site: s, client } = validateMaintenanceCerfas({
          siteId: picker.site.id,
          dateIntervention: today(),
          signataireNom: user.signataireNom || user.fullName || '',
          signataireQualite: user.signataireQualite || 'Opérateur attesté',
          signatureOperateurImage: user.signatureImage,
          userId: user.id,
          userName: user.fullName || user.email,
          equipementIds: selected,
          natures: naturesForPicker(picker.nature),
        })
        setPicker(null)
        setIntervChoiceSite(null)
        for (const draft of drafts) {
          const blob = await buildCerfaPdf({ draft, client, chantier: s })
          const fileName = `CERFA-15497-04-${draft.dateIntervention}-${draft.id.slice(0, 8)}.pdf`
          await saveCerfaPdf(draft.id, blob, fileName, user.organizationId)
          upsertIntervention({
            ...draft,
            hasCerfaPdf: true,
            cerfaPdfFileName: fileName,
            cerfaPdfSavedAt: new Date().toISOString(),
          })
        }
        alert(
          `${drafts.length} CERFA généré${drafts.length > 1 ? 's' : ''} pour les équipements choisis.`,
        )
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Génération impossible')
      } finally {
        setBatchBusy(null)
      }
      return
    }

    if (picker.mode === 'rapport') {
      createFichesRapport(picker.site, selected)
      return
    }

    if (!user.signatureImage) {
      alert('Enregistrez d’abord votre signature dans « Ma signature ».')
      return
    }

    setBatchBusy(picker.site.id)
    try {
      const { drafts, site: s, client } = validateMaintenanceCerfas({
        siteId: picker.site.id,
        dateIntervention: today(),
        signataireNom: user.signataireNom || user.fullName || '',
        signataireQualite: user.signataireQualite || 'Opérateur attesté',
        signatureOperateurImage: user.signatureImage,
        userId: user.id,
        userName: user.fullName || user.email,
        equipementIds: selected,
        natures: naturesForPicker(picker.nature),
      })
      setPicker(null)
      for (const draft of drafts) {
        const blob = await buildCerfaPdf({ draft, client, chantier: s })
        const fileName = `CERFA-15497-04-${draft.dateIntervention}-${draft.id.slice(0, 8)}.pdf`
        await saveCerfaPdf(draft.id, blob, fileName, user.organizationId)
        upsertIntervention({
          ...draft,
          hasCerfaPdf: true,
          cerfaPdfFileName: fileName,
          cerfaPdfSavedAt: new Date().toISOString(),
        })
      }
      alert(
        `${drafts.length} CERFA généré${drafts.length > 1 ? 's' : ''} pour les équipements choisis.`,
      )
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Génération impossible')
    } finally {
      setBatchBusy(null)
    }
  }

  const filteredChantiers = useMemo(() => {
    return data.chantiers.filter((c) => {
      const mode = resolveModeGestion(c)
      if (listFilter === 'contrat' && (mode !== 'contrat' || c.statut !== 'actif')) return false
      if (listFilter === 'travaux' && (mode !== 'ponctuel' || c.statut !== 'actif')) return false
      if (listFilter === 'cerfa' && !siteHasCerfaASigner(c.id, data.interventions)) return false
      const client = data.clients.find((cl) => cl.id === c.clientId)
      const typeLabel = c.typeTravaux ? TYPE_TRAVAUX_LABELS[c.typeTravaux] : ''
      const eqNames = (c.equipements || []).map((e) => e.nom).join(' ')
      return matchesQuery(
        [
          c.nom,
          c.ville,
          c.fluideType,
          c.equipementMarque,
          c.equipementModele,
          client?.raisonSociale,
          typeLabel,
          c.detailTravaux,
          c.createdByName,
          eqNames,
          modeGestionLabel(c),
          siteAvecFluideFrigorigene(c) ? 'fluide cerfa' : 'standard vmc',
        ]
          .filter(Boolean)
          .join(' '),
        q,
      )
    })
  }, [data.chantiers, data.clients, data.interventions, q, listFilter])

  /** Liste groupée : 1 case par client → sites → équipements */
  const clientSiteGroups = useMemo(() => {
    const byClient = new Map<string, Chantier[]>()
    for (const site of filteredChantiers) {
      const key = site.clientId || `_orphan_${site.id}`
      const list = byClient.get(key) || []
      list.push(site)
      byClient.set(key, list)
    }
    return [...byClient.entries()]
      .map(([clientId, sites]) => {
        const client = data.clients.find((c) => c.id === clientId)
        const sortedSites = [...sites].sort((a, b) =>
          (a.nom || '').localeCompare(b.nom || '', 'fr'),
        )
        return {
          clientId,
          client,
          label: client?.raisonSociale || sortedSites[0]?.nom || 'Client',
          sites: sortedSites,
          multi: sortedSites.length > 1,
        }
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'))
  }, [filteredChantiers, data.clients])

  useEffect(() => {
    if (!open || !currentAvecFluide) return
    const teq = calcTeqCO2FromFluide(Number(form.chargeNominaleKg) || 0, form.fluideType)
    if (teq === null) return
    if (form.teqCO2 === teq) return
    setForm((f) => ({ ...f, teqCO2: teq }))
  }, [form.fluideType, form.chargeNominaleKg, open, currentAvecFluide]) // eslint-disable-line react-hooks/exhaustive-deps

  const patchCurrentEquip = (patch: Partial<Equipement>) => {
    const list = [...equipements]
    const i = Math.min(equipIdx, list.length - 1)
    const nextEq = { ...list[i], ...patch }
    if (patch.fluideType != null || patch.chargeNominaleKg != null) {
      const teq = calcTeqCO2FromFluide(
        Number(nextEq.chargeNominaleKg) || 0,
        nextEq.fluideType,
      )
      if (teq != null) nextEq.teqCO2 = teq
    }
    if (patch.avecFluideFrigorigene === false) {
      nextEq.fluideType = ''
      nextEq.chargeNominaleKg = 0
      nextEq.teqCO2 = 0
      nextEq.detectionPermanente = false
    }
    if (patch.avecFluideFrigorigene === true && !nextEq.fluideType) {
      nextEq.fluideType = 'R-448A'
    }
    list[i] = nextEq
    const siteFluide = list.some((e) => equipAvecFluideFrigorigene(e))
    setForm({
      ...form,
      equipements: list,
      avecFluideFrigorigene: siteFluide,
      equipementType: nextEq.type,
      equipementMarque: nextEq.marque,
      equipementModele: nextEq.modele,
      equipementNumeroSerie: nextEq.numeroSerie,
      fluideType: nextEq.fluideType,
      chargeNominaleKg: nextEq.chargeNominaleKg,
      teqCO2: nextEq.teqCO2,
      detectionPermanente: nextEq.detectionPermanente,
    })
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.clientId) {
      alert('Choisissez un client dans la liste de suggestions.')
      return
    }
    const list = (form.equipements?.length ? form.equipements : syncEquipementsFromFlat(form)).map(
      (eq) => {
        const fluide = equipAvecFluideFrigorigene(eq)
        return {
          ...eq,
          nom: (eq.nom || eq.type || '').trim(),
          avecFluideFrigorigene: fluide,
          fluideType: fluide ? eq.fluideType || form.fluideType || 'R-448A' : '',
          chargeNominaleKg: fluide ? Number(eq.chargeNominaleKg) || 0 : 0,
          teqCO2: fluide
            ? eq.teqCO2 ??
              calcTeqCO2FromFluide(Number(eq.chargeNominaleKg) || 0, eq.fluideType || form.fluideType) ??
              undefined
            : undefined,
          detectionPermanente: fluide ? !!eq.detectionPermanente : false,
        }
      },
    )
    if (list.length === 0) {
      alert('Ajoutez au moins un équipement.')
      return
    }
    const withoutName = list.find((eq) => !(eq.nom || '').trim())
    if (withoutName) {
      alert('Chaque équipement doit avoir un nom / libellé.')
      return
    }
    const dup = findFirstDuplicateEquipNom(list)
    if (dup) {
      alert(
        `Deux équipements ont le même nom « ${dup.nom} ». Changez le libellé — chaque équipement du site doit avoir un nom unique.`,
      )
      return
    }
    const siteFluide = list.some((e) => equipAvecFluideFrigorigene(e))
    const primary = list.find((e) => equipAvecFluideFrigorigene(e)) || list[0]
    upsertChantier({
      ...form,
      avecFluideFrigorigene: siteFluide,
      equipements: list,
      equipementType: primary?.type || form.equipementType,
      equipementMarque: primary?.marque || form.equipementMarque,
      equipementModele: primary?.modele || form.equipementModele,
      equipementNumeroSerie: primary?.numeroSerie || form.equipementNumeroSerie,
      chargeNominaleKg: siteFluide ? Number(primary?.chargeNominaleKg || form.chargeNominaleKg) || 0 : 0,
      teqCO2: siteFluide ? primary?.teqCO2 ?? form.teqCO2 : undefined,
      fluideType: siteFluide ? primary?.fluideType || form.fluideType : '',
      detectionPermanente: siteFluide
        ? !!(primary?.detectionPermanente ?? form.detectionPermanente)
        : false,
      detailTravaux: form.detailTravaux?.trim() || '',
      modeGestion: form.modeGestion || 'contrat',
      prochaineControleEtancheite: form.prochaineControleEtancheite?.trim() || undefined,
      id: editId ?? undefined,
      createdByUserId: editId ? form.createdByUserId : user?.id,
      createdByName: editId
        ? form.createdByName
        : user?.fullName || user?.email || user?.username,
    })
    setOpen(false)
    setEditId(null)
    setEquipIdx(0)
  }

  const startEdit = (c: Chantier) => {
    setEditId(c.id)
    const eqs =
      c.equipements?.length && c.equipements.length > 0
        ? c.equipements
        : syncEquipementsFromFlat(c, c.equipements)
    const client = data.clients.find((cl) => cl.id === c.clientId)
    setClientQuery(client?.raisonSociale || '')
    setEquipFilter('')
    setForm({
      ...blank(c.clientId),
      ...c,
      typeTravaux: c.typeTravaux || 'maintenance',
      detailTravaux: c.detailTravaux || '',
      modeGestion: resolveModeGestion(c),
      prochaineControleEtancheite: c.prochaineControleEtancheite || '',
      avecFluideFrigorigene: siteAvecFluideFrigorigene(c),
      equipements: eqs,
      adresse: c.adresse || client?.adresse || '',
      codePostal: c.codePostal || client?.codePostal || '',
      ville: c.ville || client?.ville || '',
    })
    setEquipIdx(0)
    setOpen(true)
  }

  const fluideMeta = findFluide(form.fluideType)

  const applyPlaque = (fields: PlaqueFields) => {
    const fluideType = fields.fluideType || currentEquip.fluideType
    const chargeNominaleKg =
      fields.chargeNominaleKg != null && fields.chargeNominaleKg > 0
        ? fields.chargeNominaleKg
        : currentEquip.chargeNominaleKg
    const type = fields.equipementType || currentEquip.type
    patchCurrentEquip({
      type,
      marque: fields.equipementMarque || currentEquip.marque,
      modele: fields.equipementModele || currentEquip.modele,
      numeroSerie: fields.equipementNumeroSerie || currentEquip.numeroSerie,
      nom: currentEquip.nom.trim() || type || currentEquip.nom,
      ...(fields.fluideType ? { fluideType, avecFluideFrigorigene: true } : {}),
      ...(fields.chargeNominaleKg != null && fields.chargeNominaleKg > 0
        ? { chargeNominaleKg }
        : {}),
      teqCO2: calcTeqCO2FromFluide(chargeNominaleKg || 0, fluideType) ?? currentEquip.teqCO2,
    })
  }

  const startEditEquip = (site: Chantier, equipementId: string) => {
    const eqs =
      site.equipements?.length && site.equipements.length > 0
        ? site.equipements
        : syncEquipementsFromFlat(site, site.equipements)
    const idx = Math.max(
      0,
      eqs.findIndex((e) => e.id === equipementId),
    )
    const eq = eqs[idx] || eqs[0]
    const client = data.clients.find((cl) => cl.id === site.clientId)
    setEditId(site.id)
    setClientQuery(client?.raisonSociale || '')
    setEquipFilter('')
    setForm({
      ...blank(site.clientId),
      ...site,
      typeTravaux: site.typeTravaux || 'maintenance',
      detailTravaux: site.detailTravaux || '',
      modeGestion: resolveModeGestion(site),
      prochaineControleEtancheite: site.prochaineControleEtancheite || '',
      avecFluideFrigorigene: siteAvecFluideFrigorigene(site),
      equipements: eqs,
      equipementType: eq?.type || '',
      equipementMarque: eq?.marque || '',
      equipementModele: eq?.modele || '',
      equipementNumeroSerie: eq?.numeroSerie || '',
      fluideType: eq?.fluideType || site.fluideType,
      chargeNominaleKg: eq?.chargeNominaleKg ?? site.chargeNominaleKg,
      teqCO2: eq?.teqCO2 ?? site.teqCO2,
      detectionPermanente: eq?.detectionPermanente ?? site.detectionPermanente,
    })
    setEquipIdx(idx)
    setPicker(null)
    setOpen(true)
    window.setTimeout(() => {
      document
        .getElementById('equipement-photo-plaque')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 120)
  }

  const removeEquipement = (site: Chantier, equipementId: string) => {
    const eqs =
      site.equipements?.length && site.equipements.length > 0
        ? site.equipements
        : syncEquipementsFromFlat(site, site.equipements)
    const target = eqs.find((e) => e.id === equipementId)
    const label = target?.nom?.trim() || (target ? equipmentLabel(target) : 'cet équipement')
    if (
      !confirm(
        `Retirer « ${label} » du site ?\n(matériel changé, hors contrat, ou plus présent)`,
      )
    ) {
      return
    }
    const next = eqs.filter((e) => e.id !== equipementId)
    if (next.length === 0) {
      alert('Il faut au moins un équipement sur le site.')
      return
    }
    upsertChantier({
      ...site,
      equipements: next,
      avecFluideFrigorigene: next.some((e) => equipAvecFluideFrigorigene(e)),
      id: site.id,
    })
    if (picker?.site.id === site.id) {
      setPicker({
        ...picker,
        site: {
          ...site,
          equipements: next,
          avecFluideFrigorigene: next.some((e) => equipAvecFluideFrigorigene(e)),
        },
        selected: picker.selected.filter((id) => id !== equipementId),
      })
    }
  }

  const fillAdresseFromClient = (
    clientId: string,
    base: Omit<Chantier, 'id' | 'createdAt'> | typeof form,
  ) => {
    const client = data.clients.find((c) => c.id === clientId)
    if (!client) return { ...base, clientId }
    return {
      ...base,
      clientId,
      adresse: client.adresse || base.adresse || '',
      codePostal: client.codePostal || base.codePostal || '',
      ville: client.ville || base.ville || '',
    }
  }

  const openNew = () => {
    setEditId(null)
    setEquipIdx(0)
    setEquipFilter('')
    const clientId = data.clients[0]?.id || ''
    const client = data.clients.find((c) => c.id === clientId)
    setClientQuery(client?.raisonSociale || '')
    setForm(fillAdresseFromClient(clientId, blank(clientId)))
    setOpen(true)
  }

  const addEquipementToSite = (site: Chantier) => {
    const eqs =
      site.equipements?.length && site.equipements.length > 0
        ? site.equipements
        : syncEquipementsFromFlat(site, site.equipements)
    const next = blankEquip(true)
    const list = [...eqs, next]
    const client = data.clients.find((c) => c.id === site.clientId)
    setEditId(site.id)
    setClientQuery(client?.raisonSociale || '')
    setEquipFilter('')
    setForm({
      ...blank(site.clientId),
      ...site,
      typeTravaux: site.typeTravaux || 'maintenance',
      detailTravaux: site.detailTravaux || '',
      modeGestion: resolveModeGestion(site),
      prochaineControleEtancheite: site.prochaineControleEtancheite || '',
      avecFluideFrigorigene: true,
      equipements: list,
      equipementType: next.type,
      equipementMarque: next.marque,
      equipementModele: next.modele,
      equipementNumeroSerie: next.numeroSerie,
      fluideType: next.fluideType,
      chargeNominaleKg: next.chargeNominaleKg,
      teqCO2: next.teqCO2,
      detectionPermanente: next.detectionPermanente,
    })
    setEquipIdx(list.length - 1)
    setPicker(null)
    setOpen(true)
    window.setTimeout(() => {
      document
        .getElementById('equipement-photo-plaque')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 120)
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 overflow-x-hidden lg:max-w-none">
      {!open && !focusSiteId && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Sites3dIcon size={52} float delay="0.1s" className="shrink-0" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-display text-[1.75rem] font-bold leading-none tracking-tight sm:text-[2rem]">
                  Sites & Parc
                </h1>
                <span className="rounded-full bg-mist px-2.5 py-1 text-xs font-bold text-slate">
                  {filteredChantiers.length}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-muted">
                Accès rapide · chaque action = OT unique (OT2026…) + rapport
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openNew}
            className="hidden h-12 shrink-0 items-center gap-2 rounded-xl bg-[#0f766e] px-4 text-sm font-bold text-white shadow-[0_4px_12px_rgba(15,118,110,0.35)] active:translate-y-px md:inline-flex"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Nouveau site
          </button>
        </div>
      )}

      {open && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={closeForm}
            className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line bg-white px-3 text-sm font-semibold active:bg-mist"
          >
            <ArrowLeft className="h-4 w-4" /> Liste
          </button>
          <h1 className="font-display text-lg font-bold">
            {editId ? 'Modifier le site' : 'Nouveau site'}
          </h1>
        </div>
      )}

      {!open && !focusSiteId && (
        <div className="space-y-3">
          <SearchField
            value={q}
            onChange={(v) => {
              setQ(v)
              setFocusSiteId(null)
            }}
            placeholder="Chercher un site, client, équipement…"
            testId="chantiers-search"
          />
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['tous', 'Tous'],
                ['contrat', 'Sous contrat'],
                ['travaux', 'Travaux / dépannages'],
                ['cerfa', 'CERFA à signer'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setListFilter(id)}
                className={[
                  'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                  listFilter === id
                    ? 'bg-ink text-white'
                    : 'border border-line bg-white text-muted hover:bg-mist',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {open && (
        <form
          onSubmit={onSubmit}
          className="grid gap-3 overflow-x-hidden rounded-2xl border border-line bg-white p-4 sm:grid-cols-2 sm:p-5"
        >
          {editId && (
            <p className="sm:col-span-2 rounded-xl border border-accent/40 bg-accent-soft/50 px-3 py-2 text-xs text-slate">
              Site déjà enregistré — adresse et infos reprises. Ajoutez ou modifiez seulement les
              équipements.
            </p>
          )}
          <SmartSuggestField
            label="Client / détenteur *"
            value={clientQuery}
            onChange={(v) => {
              setClientQuery(v)
              const exact = data.clients.find(
                (c) => c.raisonSociale.trim().toLowerCase() === v.trim().toLowerCase(),
              )
              if (exact) setForm(fillAdresseFromClient(exact.id, form))
              else if (form.clientId) setForm({ ...form, clientId: '' })
            }}
            onPick={(s) => {
              setClientQuery(s.label)
              setForm(fillAdresseFromClient(s.id, form))
            }}
            suggestions={clientSuggestions}
            required
            showWhenEmpty
            placeholder="Tapez pour chercher un client…"
            className="sm:col-span-2"
            inputMode="search"
          />
          {/* Keep HTML5 required without native select */}
          <input type="hidden" required value={form.clientId} readOnly />
          <SmartSuggestField
            label="Nom du site *"
            value={form.nom}
            onChange={(v) => setForm({ ...form, nom: v })}
            onPick={(s) => {
              const site = data.chantiers.find((c) => c.id === s.id)
              if (!site) {
                setForm({ ...form, nom: s.label })
                return
              }
              // Création : reprendre adresse du site connu sans écraser un edit en cours
              if (editId) {
                setForm({ ...form, nom: s.label })
                return
              }
              setForm({
                ...form,
                nom: site.nom,
                adresse: site.adresse || form.adresse,
                codePostal: site.codePostal || form.codePostal,
                ville: site.ville || form.ville,
                typeTravaux: site.typeTravaux || form.typeTravaux,
                detailTravaux: form.detailTravaux || site.detailTravaux || '',
                modeGestion: resolveModeGestion(site),
                prochaineControleEtancheite:
                  site.prochaineControleEtancheite || form.prochaineControleEtancheite || '',
              })
            }}
            suggestions={siteSuggestions}
            required
            showWhenEmpty
            placeholder="Ex. Domusvi Auribeau, Hôpital de Nice…"
            className="sm:col-span-2"
            inputMode="search"
          />
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink">Mode de gestion *</span>
            <select
              required
              value={form.modeGestion || 'contrat'}
              onChange={(e) =>
                setForm({ ...form, modeGestion: e.target.value as ModeGestion })
              }
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            >
              {(Object.keys(MODE_GESTION_LABELS) as ModeGestion[]).map((key) => (
                <option key={key} value={key}>
                  {MODE_GESTION_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink">Nature typique</span>
            <select
              value={form.typeTravaux || 'maintenance'}
              onChange={(e) =>
                setForm({ ...form, typeTravaux: e.target.value as TypeTravaux })
              }
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            >
              {(Object.keys(TYPE_TRAVAUX_LABELS) as TypeTravaux[]).map((key) => (
                <option key={key} value={key}>
                  {TYPE_TRAVAUX_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Précision / contexte"
            value={form.detailTravaux || ''}
            onChange={(v) => setForm({ ...form, detailTravaux: v })}
            className="sm:col-span-2"
          />
          {(form.modeGestion || 'contrat') === 'contrat' && (
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-semibold text-ink">Prochain contrôle d’étanchéité</span>
              <input
                type="date"
                value={form.prochaineControleEtancheite || ''}
                onChange={(e) =>
                  setForm({ ...form, prochaineControleEtancheite: e.target.value })
                }
                className="h-11 w-full rounded-xl border border-line bg-white px-3"
              />
            </label>
          )}
          <p className="-mt-1 text-xs text-muted sm:col-span-2">
            Contrat = parc en veille (équipements déclarés, CERFA à la demande). Occasionnel =
            chantier / dépannage ponctuel.
          </p>
          <Field
            label="Adresse"
            value={form.adresse}
            onChange={(v) => setForm({ ...form, adresse: v })}
            className="sm:col-span-2"
          />
          <Field
            label="Code postal"
            value={form.codePostal}
            onChange={(v) => setForm({ ...form, codePostal: v })}
          />
          <Field label="Ville" value={form.ville} onChange={(v) => setForm({ ...form, ville: v })} />

          <div className="sm:col-span-2 mt-1 border-t border-line pt-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink">
                Équipements enregistrés
                {equipements.length > 0 ? (
                  <span className="ml-2 font-normal text-muted">
                    {filteredEquipIndices.length === equipements.length
                      ? `${equipements.length}`
                      : `${filteredEquipIndices.length} / ${equipements.length}`}
                  </span>
                ) : null}
              </p>
              <button
                type="button"
                onClick={() => {
                  const next = blankEquip(true)
                  const list = [...equipements, next]
                  setForm({ ...form, equipements: list, avecFluideFrigorigene: true })
                  setEquipIdx(list.length - 1)
                  setEquipFilter('')
                  window.setTimeout(() => {
                    document
                      .getElementById('equipement-photo-plaque')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }, 80)
                }}
                className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-mist"
              >
                <Plus className="h-3.5 w-3.5" /> Ajouter un équipement
              </button>
            </div>
            {equipements.length > 5 && (
              <div className="mb-3">
                <SearchField
                  value={equipFilter}
                  onChange={setEquipFilter}
                  placeholder="Filtrer les équipements (nom, marque, fluide…)"
                  testId="equipements-filter"
                />
              </div>
            )}
            {equipements.length > 1 && (
              <div className="mb-3 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                {filteredEquipIndices.map((i) => {
                  const eq = equipements[i]
                  return (
                    <button
                      key={eq.id}
                      type="button"
                      onClick={() => {
                        setEquipIdx(i)
                        setForm({
                          ...form,
                          equipementType: eq.type,
                          equipementMarque: eq.marque,
                          equipementModele: eq.modele,
                          equipementNumeroSerie: eq.numeroSerie,
                          fluideType: eq.fluideType,
                          chargeNominaleKg: eq.chargeNominaleKg,
                          teqCO2: eq.teqCO2,
                          detectionPermanente: eq.detectionPermanente,
                        })
                      }}
                      className={[
                        'rounded-full px-3 py-1 text-xs font-semibold',
                        i === equipIdx
                          ? 'bg-accent text-ink'
                          : 'border border-line text-muted hover:bg-mist',
                      ].join(' ')}
                    >
                      {eq.nom || eq.type || `Équipement ${i + 1}`}
                      {equipAvecFluideFrigorigene(eq) ? '' : ' · standard'}
                    </button>
                  )
                })}
                {filteredEquipIndices.length === 0 && (
                  <p className="text-xs text-muted">Aucun équipement pour ce filtre.</p>
                )}
              </div>
            )}
            <PlaquePhotoButton className="mb-1" onParsed={applyPlaque} />
          </div>

          <label className="flex items-center gap-3 sm:col-span-2">
            <input
              type="checkbox"
              checked={currentAvecFluide}
              onChange={(e) => patchCurrentEquip({ avecFluideFrigorigene: e.target.checked })}
              className="h-5 w-5 shrink-0 rounded border-2 border-slate-300 accent-accent"
            />
            <span className="text-sm font-medium text-ink">
              Contient du fluide frigorigène
              <span className="mt-0.5 block text-xs font-normal text-muted">
                Case cochée = CERFA / stock gaz pour cet équipement. Décochée = matériel standard
                (ex. VMC).
              </span>
            </span>
          </label>

          <SmartSuggestField
            label="Nom / libellé équipement *"
            value={currentEquip.nom || ''}
            onChange={(v) => patchCurrentEquip({ nom: v, type: currentEquip.type || v })}
            onPick={(s) => {
              // Reprendre type/marque/modèle d’un équipement déjà connu (nouvel id)
              const [siteId, eqId] = s.id.split(':')
              const site = data.chantiers.find((c) => c.id === siteId)
              const src = site ? allEquipements(site).find((e) => e.id === eqId) : undefined
              const wantedNom = (src?.nom || s.label || '').trim()
              const clash = findDuplicateEquipNom(equipements, wantedNom, currentEquip.id)
              if (clash) {
                alert(
                  `Le nom « ${wantedNom} » existe déjà sur ce site. Choisissez un autre libellé.`,
                )
                return
              }
              if (!src) {
                patchCurrentEquip({ nom: s.label, type: currentEquip.type || s.label })
                return
              }
              patchCurrentEquip({
                nom: src.nom || s.label,
                type: src.type || src.nom || s.label,
                marque: src.marque || currentEquip.marque,
                modele: src.modele || currentEquip.modele,
                avecFluideFrigorigene: src.avecFluideFrigorigene,
                fluideType: src.fluideType || currentEquip.fluideType,
                chargeNominaleKg: src.chargeNominaleKg || currentEquip.chargeNominaleKg,
                teqCO2: src.teqCO2 ?? currentEquip.teqCO2,
                detectionPermanente: src.detectionPermanente,
              })
            }}
            suggestions={equipSuggestions}
            required
            showWhenEmpty
            placeholder="Ex. Chambre froide 1 — suggestions auto"
            className="sm:col-span-2"
            inputMode="search"
            limit={12}
          />
          {(() => {
            const clash = findDuplicateEquipNom(
              equipements,
              currentEquip.nom || currentEquip.type || '',
              currentEquip.id,
            )
            if (!clash) return null
            return (
              <p className="-mt-1 text-xs font-semibold text-danger sm:col-span-2">
                Ce nom est déjà utilisé sur ce site — changez-le (chaque équipement doit avoir un
                libellé unique).
              </p>
            )
          })()}
          <p className="-mt-1 text-xs text-muted sm:col-span-2">
            Tapez pour suggérer des libellés déjà utilisés. Ex. « Chambre froide rayon frais », « Clim
            bureau 2 ». Noms uniques obligatoires sur le site.
          </p>
          <Field
            label={currentAvecFluide ? 'Type d’équipement' : 'Équipement / matériel'}
            value={form.equipementType}
            onChange={(v) => patchCurrentEquip({ type: v, nom: currentEquip.nom || v })}
          />
          <Field
            label="Marque"
            value={form.equipementMarque}
            onChange={(v) => patchCurrentEquip({ marque: v })}
          />
          <Field
            label="Modèle"
            value={form.equipementModele}
            onChange={(v) => patchCurrentEquip({ modele: v })}
          />
          <Field
            label="N° série"
            value={form.equipementNumeroSerie}
            onChange={(v) => patchCurrentEquip({ numeroSerie: v })}
          />
          {equipements.length > 1 && (
            <button
              type="button"
              onClick={() => {
                if (equipements.length <= 1) return
                if (!confirm('Retirer cet équipement du site ?')) return
                const list = equipements.filter((_, i) => i !== equipIdx)
                const nextIdx = Math.max(0, equipIdx - 1)
                const eq = list[nextIdx]
                setEquipIdx(nextIdx)
                setForm({
                  ...form,
                  equipements: list,
                  avecFluideFrigorigene: list.some((e) => equipAvecFluideFrigorigene(e)),
                  equipementType: eq.type,
                  equipementMarque: eq.marque,
                  equipementModele: eq.modele,
                  equipementNumeroSerie: eq.numeroSerie,
                  fluideType: eq.fluideType,
                  chargeNominaleKg: eq.chargeNominaleKg,
                  teqCO2: eq.teqCO2,
                  detectionPermanente: eq.detectionPermanente,
                })
              }}
              className="text-left text-xs font-semibold text-danger hover:underline sm:col-span-2"
            >
              Retirer cet équipement de la liste
            </button>
          )}

          {currentAvecFluide ? (
            <>
              <div className="sm:col-span-2 mt-1 border-t border-line pt-3">
                <p className="text-sm font-semibold text-ink">Données fluide / CERFA</p>
                <p className="text-xs text-muted">
                  Saisis une fois — réutilisés à chaque maintenance / CERFA.
                </p>
              </div>
              <FluideSelect
                label="Fluide"
                value={form.fluideType}
                onChange={(v) => patchCurrentEquip({ fluideType: v })}
                required
              />
              <DecimalField
                label="Charge nominale (kg)"
                value={form.chargeNominaleKg}
                onChange={(n) => patchCurrentEquip({ chargeNominaleKg: n })}
                placeholder="ex. 2,2"
              />
              <DecimalField
                label="teq CO₂ (auto)"
                value={form.teqCO2 ?? 0}
                onChange={(n) => patchCurrentEquip({ teqCO2: n })}
                placeholder="auto"
              />
              <p className="-mt-1 text-xs text-muted sm:col-span-2">
                kg × GWP ÷ 1000
                {fluideMeta ? ` (${form.chargeNominaleKg || 0} × ${formatGwp(fluideMeta)})` : ''}
              </p>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.detectionPermanente}
                  onChange={(e) => patchCurrentEquip({ detectionPermanente: e.target.checked })}
                />
                Système permanent de détection des fuites (cadre [6])
              </label>
            </>
          ) : (
            <div className="sm:col-span-2 rounded-xl border border-dashed border-line bg-foam px-4 py-3 text-sm text-muted">
              Équipement standard : pas de CERFA ni de suivi fluide pour celui-ci.
            </div>
          )}

          <div className="flex gap-2 sm:col-span-2">
            <button
              type="submit"
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink hover:bg-accent-hover"
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-full border border-line px-5 py-2.5 text-sm"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {!open && !focusSiteId && (
      <div className="grid gap-2">
        {clientSiteGroups.map((group) => {
          const isOpen = expandedClientId === group.clientId
          const totalEq = group.sites.reduce((n, s) => n + allEquipements(s).length, 0)
          return (
            <div
              key={group.clientId}
              className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm"
            >
              {/* Niveau 1 — nom client uniquement */}
              <button
                type="button"
                onClick={() =>
                  setExpandedClientId((cur) =>
                    cur === group.clientId ? null : group.clientId,
                  )
                }
                className="flex w-full min-h-14 items-center gap-3 px-3.5 py-3 text-left active:bg-mist sm:px-4"
                aria-expanded={isOpen}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-600">
                  <Building2 className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-ink sm:text-base">
                  {group.label}
                </span>
                <span className="shrink-0 text-[11px] font-semibold text-muted">
                  {group.sites.length} site{group.sites.length > 1 ? 's' : ''}
                  {totalEq > 0 ? ` · ${totalEq}` : ''}
                </span>
                {isOpen ? (
                  <ChevronDown className="h-5 w-5 shrink-0 text-muted" />
                ) : (
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
                )}
              </button>

              {/* Niveau 2 — sites (après clic client) */}
              {isOpen && (
                <ul className="divide-y divide-line border-t border-line">
                  {group.sites.map((c) => {
                    const eqs = allEquipements(c)
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedClientId(group.clientId)
                            setFocusSiteId(c.id)
                            setFocusEquipId(null)
                            setSiteMenuOpen(false)
                            setEquipQ('')
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                          }}
                          className="flex w-full min-h-12 items-center gap-3 px-3.5 py-3 text-left active:bg-mist sm:px-4"
                        >
                          <span className="ml-2 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-mist text-slate-600">
                            <Layers className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-ink">
                              {c.nom || c.ville || 'Site'}
                            </span>
                            <span className="block text-[11px] text-muted">
                              {eqs.length} équipement{eqs.length > 1 ? 's' : ''}
                              {c.ville ? ` · ${c.ville}` : ''}
                            </span>
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
        {clientSiteGroups.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line bg-white px-4 py-10 text-center text-sm text-muted">
            {data.chantiers.length === 0
              ? 'Aucun site. Ajoutez un client, puis un site avec son parc d’équipements.'
              : 'Aucun résultat pour cette recherche / filtre.'}
          </div>
        )}
      </div>
      )}

      {!open &&
        focusSiteId &&
        !focusEquipId &&
        (() => {
          const c = data.chantiers.find((x) => x.id === focusSiteId)
          if (!c) return null
          const client = data.clients.find((x) => x.id === c.clientId)
          const fluide = siteAvecFluideFrigorigene(c)
          const eqs = allEquipements(c)
          const eqsCerfa = equipementsForCerfa(c)
          const canBatch = eqsCerfa.length > 0
          const eqFilter = equipQ.trim()
            ? eqs.filter((eq) =>
                matchesQuery(
                  [eq.nom, eq.type, eq.marque, eq.modele, eq.fluideType, eq.numeroSerie]
                    .filter(Boolean)
                    .join(' '),
                  equipQ,
                ),
              )
            : eqs

          return (
            <div className="space-y-3 overflow-x-hidden">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFocusSiteId(null)
                    setFocusEquipId(null)
                    setSiteMenuOpen(false)
                    if (c.clientId) setExpandedClientId(c.clientId)
                  }}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-line bg-white px-2.5 text-xs font-semibold active:bg-mist"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Clients
                </button>
                <p className="min-w-0 flex-1 truncate text-xs text-muted">
                  <span className="font-semibold text-ink">{c.nom}</span>
                  {client?.raisonSociale ? ` · ${client.raisonSociale}` : ''}
                </p>
                <QuickIconBtn
                  icon={Cpu}
                  label="+ Équip."
                  tone="sites"
                  title="Ajouter un équipement"
                  onClick={() => {
                    setSiteMenuOpen(false)
                    addEquipementToSite(c)
                  }}
                />
                <QuickIconBtn
                  icon={FileSignature}
                  label="Interv."
                  tone="cerfa"
                  title="Se mettre en intervention"
                  onClick={() => {
                    setSiteMenuOpen(false)
                    setIntervChoiceSite(c)
                  }}
                />
                {(formatAddressQuery(c) || formatAddressQuery(client || {})) && (
                  <QuickIconBtn
                    icon={Navigation}
                    label="GPS"
                    tone="teal"
                    title="Ouvrir l’adresse dans le GPS (Waze, Maps…)"
                    onClick={() => {
                      setSiteMenuOpen(false)
                      const ok = openAddressInGps(
                        formatAddressQuery(c)
                          ? c
                          : {
                              adresse: client?.adresse,
                              codePostal: client?.codePostal,
                              ville: client?.ville,
                            },
                      )
                      if (!ok) alert('Adresse incomplète pour le GPS.')
                    }}
                  />
                )}
                <button
                  type="button"
                  onClick={() => setSiteMenuOpen((v) => !v)}
                  className="inline-flex h-12 items-center rounded-xl border border-line bg-white px-2.5 text-xs font-semibold active:bg-mist"
                >
                  Options
                </button>
              </div>

              {siteMenuOpen && (
                <div className="overflow-hidden rounded-xl border border-line bg-white">
                  {canBatch && (
                    <button
                      type="button"
                      disabled={batchBusy === c.id}
                      onClick={() => {
                        setSiteMenuOpen(false)
                        openPicker(c, 'maintenance')
                      }}
                      className="flex min-h-10 w-full items-center gap-2 border-b border-line px-3 text-left text-sm font-medium active:bg-mist disabled:opacity-60"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      {batchBusy === c.id ? 'Génération…' : 'Valider maintenance (lot)'}
                    </button>
                  )}
                  {fluide && (
                    <button
                      type="button"
                      onClick={() => {
                        setSiteMenuOpen(false)
                        openPicker(c, 'intervention')
                      }}
                      className="flex min-h-10 w-full items-center gap-2 border-b border-line px-3 text-left text-sm font-medium active:bg-mist"
                    >
                      <FileCheck2 className="h-3.5 w-3.5" /> CERFA sur un équipement
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSiteMenuOpen(false)
                      addEquipementToSite(c)
                    }}
                    className="flex min-h-10 w-full items-center gap-2 border-b border-line px-3 text-left text-sm font-medium active:bg-mist"
                  >
                    <Plus className="h-3.5 w-3.5" /> Ajouter équipement
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSiteMenuOpen(false)
                      startEdit(c)
                    }}
                    className="flex min-h-10 w-full items-center gap-2 border-b border-line px-3 text-left text-sm font-medium active:bg-mist"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Modifier le site
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Supprimer ce site et son parc d’équipements ?')) {
                        deleteChantier(c.id)
                        setFocusSiteId(null)
                        setFocusEquipId(null)
                      }
                    }}
                    className="flex min-h-10 w-full items-center gap-2 px-3 text-left text-sm font-medium text-danger active:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Supprimer le site
                  </button>
                </div>
              )}

              <SearchField
                value={equipQ}
                onChange={setEquipQ}
                placeholder="Chercher un équipement…"
                testId="site-equip-filter"
              />

              <div className="overflow-hidden rounded-xl border border-line bg-white">
                {eqFilter.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-muted">
                    {eqs.length === 0
                      ? 'Aucun équipement. Options → Ajouter.'
                      : 'Aucun équipement pour ce filtre.'}
                  </p>
                ) : (
                  eqFilter.map((eq, idx) => {
                    const eqFluide = equipAvecFluideFrigorigene(eq)
                    return (
                      <button
                        key={eq.id}
                        type="button"
                        onClick={() => {
                          setFocusEquipId(eq.id)
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                        className={[
                          'flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left active:bg-mist',
                          idx > 0 ? 'border-t border-line' : '',
                        ].join(' ')}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-ink">
                            {eq.nom?.trim() || eq.type || 'Sans libellé'}
                          </span>
                          <span className="block truncate text-[11px] text-muted">
                            {[
                              eq.marque,
                              eq.modele,
                              eqFluide ? eq.fluideType : 'Std',
                              eq.numeroSerie ? `SN ${eq.numeroSerie}` : '',
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                      </button>
                    )
                  })
                )}
              </div>
              <p className="text-center text-[11px] text-muted">
                {eqFilter.length} équipement{eqFilter.length > 1 ? 's' : ''} — touchez pour agir
              </p>
            </div>
          )
        })()}

      {!open &&
        focusSiteId &&
        focusEquipId &&
        (() => {
          const c = data.chantiers.find((x) => x.id === focusSiteId)
          if (!c) return null
          const eq = allEquipements(c).find((e) => e.id === focusEquipId)
          if (!eq) return null
          const eqFluide = equipAvecFluideFrigorigene(eq)
          return (
            <div className="space-y-3 overflow-x-hidden">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFocusEquipId(null)}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-line bg-white px-2.5 text-xs font-semibold active:bg-mist"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Équipements
                </button>
                <p className="min-w-0 flex-1 truncate text-xs text-muted">
                  {c.nom} ›{' '}
                  <span className="font-semibold text-ink">
                    {eq.nom?.trim() || eq.type || 'Équipement'}
                  </span>
                </p>
              </div>

              <div className="rounded-xl border border-line bg-white px-3 py-2.5">
                <p className="truncate text-sm font-semibold">
                  {eq.nom?.trim() || eq.type || 'Sans libellé'}
                </p>
                <p className="truncate text-[11px] text-muted">
                  {[
                    eq.type && eq.nom ? eq.type : null,
                    eq.marque,
                    eq.modele,
                    eqFluide ? eq.fluideType : 'Standard',
                    eq.chargeNominaleKg ? `${eq.chargeNominaleKg} kg` : null,
                    eq.numeroSerie ? `SN ${eq.numeroSerie}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>

              <div className="overflow-hidden rounded-xl border border-line bg-white">
                <button
                  type="button"
                  onClick={() => {
                    setEquipWork({
                      site: c,
                      equipementId: eq.id,
                      natures: ['entretien_reparation'],
                      step: 'choose',
                    })
                  }}
                  className="flex min-h-11 w-full items-center gap-2 border-b border-line bg-accent/15 px-3 text-left text-sm font-semibold active:bg-accent/30"
                >
                  <ClipboardList className="h-4 w-4" /> Intervenir (fiche / CERFA)
                  <ChevronRight className="ml-auto h-4 w-4 text-muted" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const url = `/app/fiche-maintenance-clim?chantier=${encodeURIComponent(c.id)}&equipement=${encodeURIComponent(eq.id)}`
                    navigate(url)
                  }}
                  className="flex min-h-11 w-full items-center gap-2 border-b border-line px-3 text-left text-sm font-medium active:bg-mist"
                >
                  <ClipboardList className="h-4 w-4 text-accent" /> Fiche checklist (optionnel)
                </button>
                {eqFluide && (
                  <button
                    type="button"
                    onClick={() =>
                      setEquipWork({
                        site: c,
                        equipementId: eq.id,
                        natures: ['entretien_reparation'],
                        step: 'cerfa',
                      })
                    }
                    className="flex min-h-11 w-full items-center gap-2 border-b border-line px-3 text-left text-sm font-medium active:bg-mist"
                  >
                    <FileCheck2 className="h-4 w-4 text-accent" /> CERFA fluides
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => startEditEquip(c, eq.id)}
                  className="flex min-h-11 w-full items-center gap-2 border-b border-line px-3 text-left text-sm font-medium active:bg-mist"
                >
                  <Pencil className="h-4 w-4" /> Modifier
                </button>
                <button
                  type="button"
                  onClick={() => {
                    removeEquipement(c, eq.id)
                    setFocusEquipId(null)
                  }}
                  className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm font-medium text-danger active:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" /> Supprimer
                </button>
              </div>
            </div>
          )
        })()}

      {picker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-white p-5 shadow-xl">
            <h2 className="font-display text-lg font-semibold">
              {picker.mode === 'maintenance'
                ? 'Quels équipements avez-vous traités ?'
                : picker.mode === 'rapport'
                  ? 'Rapport d’intervention — quel équipement ?'
                  : 'Quels équipements pour cette intervention ?'}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {picker.site.nom} — un n° OT (OT2026…) sera attribué automatiquement.
              {picker.mode === 'maintenance'
                ? ' Le CERFA suffit pour la maintenance fluide ; la fiche checklist est optionnelle.'
                : picker.mode === 'intervention'
                  ? ' Cochez un ou plusieurs équipements (1 CERFA chacun si fluide).'
                  : ''}
            </p>

            {picker.mode === 'intervention' && (
              <div className="mt-3">
                <p className="mb-2 text-xs font-semibold text-muted">Type d’intervention (prérempli sur le CERFA)</p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ['depanage', 'Entretien / réparation'],
                      ['controle', 'Contrôle étanchéité'],
                      ['maintenance', 'Maintenance + contrôle'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPicker({ ...picker, nature: id })}
                      className={[
                        'rounded-full px-3 py-1.5 text-xs font-semibold',
                        picker.nature === id
                          ? 'bg-accent text-ink'
                          : 'border border-line text-muted hover:bg-mist',
                      ].join(' ')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted">
                  Ou ouvrez l’équipement pour choisir démantèlement, charge, récupération…
                </p>
              </div>
            )}

            {picker.mode === 'maintenance' && (
              <div className="mt-3 flex flex-wrap gap-2">
                {(
                  [
                    ['maintenance', 'Maintenance'],
                    ['depanage', 'Dépannage'],
                    ['controle', 'Contrôle étanchéité'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPicker({ ...picker, nature: id })}
                    className={[
                      'rounded-full px-3 py-1.5 text-xs font-semibold',
                      picker.nature === id
                        ? 'bg-accent text-ink'
                        : 'border border-line text-muted hover:bg-mist',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {(picker.mode === 'rapport'
              ? allEquipements(picker.site)
              : equipementsForCerfa(picker.site)
            ).length > 5 && (
              <div className="mt-3">
                <SearchField
                  value={picker.filter}
                  onChange={(v) => setPicker({ ...picker, filter: v })}
                  placeholder="Filtrer les équipements…"
                  testId="picker-equip-filter"
                />
              </div>
            )}

            <ul className="mt-4 space-y-2">
              {(picker.mode === 'rapport'
                ? allEquipements(picker.site)
                : equipementsForCerfa(picker.site)
              )
                .filter((eq) =>
                  matchesQuery(
                    [eq.nom, eq.type, eq.marque, eq.modele, eq.fluideType, eq.numeroSerie]
                      .filter(Boolean)
                      .join(' '),
                    picker.filter,
                  ),
                )
                .map((eq) => {
                const checked = picker.selected.includes(eq.id)
                const libelle = eq.nom?.trim() || eq.type || 'Sans libellé'
                return (
                  <li
                    key={eq.id}
                    className={[
                      'rounded-xl border px-3 py-3 transition',
                      checked ? 'border-accent bg-accent-soft/40' : 'border-line bg-white',
                    ].join(' ')}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setPicker({
                            ...picker,
                            selected: checked
                              ? picker.selected.filter((id) => id !== eq.id)
                              : [...picker.selected, eq.id],
                          })
                        }}
                        className={[
                          'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded border-2',
                          checked
                            ? 'border-accent bg-accent text-ink'
                            : 'border-slate-300 bg-white',
                        ].join(' ')}
                        aria-pressed={checked}
                        aria-label={checked ? `Désélectionner ${libelle}` : `Sélectionner ${libelle}`}
                      >
                        {checked ? (
                          <span className="text-sm font-bold leading-none">✓</span>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => {
                          setPicker({
                            ...picker,
                            selected: checked
                              ? picker.selected.filter((id) => id !== eq.id)
                              : [...picker.selected, eq.id],
                          })
                        }}
                      >
                        <span className="block text-sm font-semibold text-ink">{libelle}</span>
                        <span className="mt-0.5 block text-xs text-muted">
                          {[eq.type && eq.nom ? eq.type : null, eq.marque, eq.modele, eq.fluideType, eq.chargeNominaleKg ? `${eq.chargeNominaleKg} kg` : '', eq.numeroSerie ? `SN ${eq.numeroSerie}` : '']
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </span>
                      </button>
                      <div className="flex shrink-0 flex-col gap-1">
                        {(picker.mode === 'maintenance' || picker.mode === 'rapport') && (
                          <button
                            type="button"
                            onClick={() => openFichesMaintenanceFromPicker([eq.id])}
                            className="inline-flex items-center justify-center gap-1 rounded-full border border-accent bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-slate hover:bg-accent"
                            title="Générer rapport / fiche"
                          >
                            <ClipboardList className="h-3.5 w-3.5" />
                            Rapport
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => startEditEquip(picker.site, eq.id)}
                          className="rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-accent hover:bg-mist"
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => removeEquipement(picker.site, eq.id)}
                          className="rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-danger hover:bg-red-50"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>

            {(picker.mode === 'maintenance' ||
              picker.mode === 'rapport' ||
              picker.mode === 'intervention') && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  className="font-semibold text-accent hover:underline"
                  onClick={() =>
                    setPicker({
                      ...picker,
                      selected: (picker.mode === 'rapport'
                        ? allEquipements(picker.site)
                        : equipementsForCerfa(picker.site)
                      ).map((e) => e.id),
                    })
                  }
                >
                  Tout cocher
                </button>
                <button
                  type="button"
                  className="font-semibold text-muted hover:underline"
                  onClick={() => setPicker({ ...picker, selected: [] })}
                >
                  Tout décocher
                </button>
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={batchBusy === picker.site.id}
                onClick={() => void onConfirmPicker()}
                className="inline-flex items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink hover:bg-accent-hover disabled:opacity-60"
              >
                {picker.mode === 'rapport' ? (
                  <ClipboardList className="h-4 w-4" />
                ) : (
                  <FileCheck2 className="h-4 w-4" />
                )}
                {picker.mode === 'maintenance'
                  ? `Générer ${picker.selected.length || 0} CERFA`
                  : picker.mode === 'rapport'
                    ? `Rapport (${picker.selected.length || 0})`
                    : 'Choisir le type d’intervention'}
              </button>
              {picker.mode === 'maintenance' && (
                <button
                  type="button"
                  onClick={() => openFichesMaintenanceFromPicker()}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-muted hover:bg-mist"
                  title="Optionnel — checklist clim / PAC si besoin"
                >
                  <ClipboardList className="h-4 w-4" />
                  {picker.selected.length > 1
                    ? `Fiches checklist (optionnel) · ${picker.selected.length}`
                    : 'Fiche checklist (optionnel)'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setPicker(null)}
                className="rounded-full border border-line px-5 py-2.5 text-sm"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {intervChoiceSite && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <div className="w-full max-w-lg overflow-hidden rounded-t-3xl border border-line bg-white p-5 shadow-xl sm:rounded-2xl">
            <h2 className="font-display text-xl font-semibold">Se mettre en intervention</h2>
            <p className="mt-1 text-sm text-muted">
              {intervChoiceSite.nom} — chaque action reçoit un OT unique (OT2026…).
            </p>
            <div className="mt-5 space-y-3">
              {siteAvecFluideFrigorigene(intervChoiceSite) ? (
                <button
                  type="button"
                  onClick={() => {
                    const site = intervChoiceSite
                    setIntervChoiceSite(null)
                    openPicker(site, 'intervention')
                  }}
                  className="flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-4 py-4 text-left font-bold text-ink active:bg-emerald-100"
                >
                  <FileCheck2 className="h-6 w-6 shrink-0 text-emerald-700" />
                  <span>
                    <span className="block text-base">Avec CERFA</span>
                    <span className="block text-sm font-medium text-muted">
                      Fluide / obligation légale — n° + signatures
                    </span>
                  </span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  const site = intervChoiceSite
                  setIntervChoiceSite(null)
                  startRapportFromSite(site)
                }}
                className="flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 border-line bg-white px-4 py-4 text-left font-bold text-ink active:bg-mist"
              >
                <ClipboardList className="h-6 w-6 shrink-0 text-emerald-700" />
                <span>
                  <span className="block text-base">Rapport sans CERFA</span>
                    <span className="block text-sm font-medium text-muted">
                      Fiche d’intervention signée — même série OT
                    </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setIntervChoiceSite(null)}
                className="min-h-12 w-full rounded-2xl border border-line px-4 py-3 text-sm font-semibold"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {equipWork && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line bg-white p-5 shadow-xl sm:rounded-2xl">
            <h2 className="font-display text-xl font-semibold">
              {(equipWork.step || 'choose') === 'choose' ? 'Que faire ?' : 'Nature CERFA'}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {equipWork.site.nom} —{' '}
              {allEquipements(equipWork.site).find((e) => e.id === equipWork.equipementId)?.nom ||
                'équipement'}
            </p>

            {(equipWork.step || 'choose') === 'choose' ? (
              <div className="mt-5 space-y-3">
                {equipAvecFluideFrigorigene(
                  allEquipements(equipWork.site).find((e) => e.id === equipWork.equipementId) ||
                    blankEquip(),
                ) ? (
                  <button
                    type="button"
                    onClick={() => setEquipWork({ ...equipWork, step: 'cerfa' })}
                    className="flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-4 py-4 text-left font-bold text-ink active:bg-emerald-100"
                  >
                    <FileCheck2 className="h-6 w-6 shrink-0 text-emerald-700" />
                    <span>
                      <span className="block text-base">CERFA fluides</span>
                      <span className="block text-sm font-medium text-muted">
                        Document utile pour la maintenance / fluide
                      </span>
                    </span>
                  </button>
                ) : (
                  <p className="rounded-xl border border-dashed border-line bg-foam/60 px-3 py-3 text-sm text-muted">
                    Équipement sans fluide — pas de CERFA. Un rapport sur l’OT suffit ; la fiche
                    checklist reste optionnelle.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const url = `/app/fiche-maintenance-clim?chantier=${encodeURIComponent(equipWork.site.id)}&equipement=${encodeURIComponent(equipWork.equipementId)}`
                    setEquipWork(null)
                    navigate(url)
                  }}
                  className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-left font-semibold text-ink active:bg-mist"
                >
                  <ClipboardList className="h-5 w-5 shrink-0 text-muted" />
                  <span>
                    <span className="block text-sm">Fiche checklist (optionnel)</span>
                    <span className="block text-xs font-medium text-muted">
                      Pas obligatoire pour une maintenance — utile si vous voulez un PDF détaillé
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setEquipWork(null)}
                  className="min-h-12 w-full rounded-2xl border border-line px-4 py-3 text-sm font-semibold"
                >
                  Annuler
                </button>
              </div>
            ) : (
              <>
                <div className="mt-4 flex flex-wrap gap-2">
                  {ALL_NATURES.map((n) => {
                    const on = equipWork.natures.includes(n)
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => {
                          setEquipWork({
                            ...equipWork,
                            natures: on
                              ? equipWork.natures.filter((x) => x !== n)
                              : [...equipWork.natures, n],
                          })
                        }}
                        className={[
                          'min-h-11 rounded-full px-4 py-2 text-sm font-semibold',
                          on ? 'bg-accent text-ink' : 'border border-line text-muted active:bg-mist',
                        ].join(' ')}
                      >
                        {NATURE_LABELS[n]}
                      </button>
                    )
                  })}
                </div>
                <div className="mt-5 grid gap-2">
                  <button
                    type="button"
                    disabled={equipWork.natures.length === 0}
                    onClick={() => {
                      const natures = equipWork.natures
                      const existingDraft = data.interventions.find(
                        (i) =>
                          i.status === 'brouillon' &&
                          i.chantierId === equipWork.site.id &&
                          i.equipementId === equipWork.equipementId,
                      )
                      if (existingDraft) {
                        setEquipWork(null)
                        navigate(`/app/interventions/${existingDraft.id}`)
                        return
                      }
                      const typeOt = natures.includes('demantelement')
                        ? 'demantelement'
                        : natures.some((n) => n.startsWith('controle_etancheite'))
                          ? 'controle_etancheite'
                          : natures.includes('entretien_reparation')
                            ? 'entretien'
                            : 'maintenance'
                      const ot = createOtForAction({
                        typeOt,
                        action: `Intervention CERFA — ${natures.map((n) => NATURE_LABELS[n]).join(', ')}`,
                        clientId: equipWork.site.clientId,
                        chantierId: equipWork.site.id,
                        equipementId: equipWork.equipementId,
                        technicien: user?.signataireNom || user?.fullName || user?.email || '',
                        signatureTechnicienImage: user?.signatureImage,
                        signatureClientImage: equipWork.site.signatureDetenteurImage,
                        statut: 'en_cours',
                      })
                      const naturesQ = encodeURIComponent(natures.join(','))
                      const url = `/app/interventions/new?chantier=${encodeURIComponent(equipWork.site.id)}&equipement=${encodeURIComponent(equipWork.equipementId)}&natures=${naturesQ}&ot=${encodeURIComponent(ot.id)}&numero=${encodeURIComponent(ot.numero)}`
                      setEquipWork(null)
                      navigate(url)
                    }}
                    className="min-h-14 rounded-2xl bg-accent px-5 py-3 text-base font-bold text-ink active:bg-accent-hover disabled:opacity-60"
                  >
                    Ouvrir le CERFA
                  </button>
                  <button
                    type="button"
                    onClick={() => setEquipWork({ ...equipWork, step: 'choose' })}
                    className="min-h-12 rounded-2xl border border-line px-5 py-3 text-sm font-semibold"
                  >
                    ← Retour
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <MobileFab
        label="Nouveau site"
        hidden={open || !!focusSiteId}
        onClick={openNew}
      />
    </div>
  )
}
