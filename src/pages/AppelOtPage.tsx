import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ClipboardList,
  Cpu,
  FileCheck2,
  MapPin,
  Phone,
  Plus,
  User,
} from 'lucide-react'
import { DocsPackPanel } from '../components/DocsPackPanel'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import { SearchField, matchesQuery } from '../components/SearchField'
import { ClientSiteSignature } from '../components/ClientSiteSignature'
import { IntervenantSignature } from '../components/IntervenantSignature'
import { FluideSelect } from '../components/FluideSelect'
import { DecimalField } from '../components/DecimalField'
import { PlaquePhotoButton } from '../components/PlaquePhotoButton'
import { VoiceDictationButton } from '../components/VoiceDictationButton'
import type { PlaqueFields } from '../lib/plaqueOcr'
import { allEquipements, findDuplicateEquipNom } from '../lib/cerfaBatch'
import { calcTeqCO2FromFluide } from '../lib/fluides'
import { FicheGroupementModal } from '../components/FicheGroupementChoice'
import type { EquipementsParFiche } from '../lib/ficheGroupement'
import { blankFicheMaintenanceClim } from '../lib/ficheMaintenanceClim'
import { blankFicheMaintenanceChaufferie } from '../lib/ficheMaintenanceChaufferie'
import { blankFicheMaintenanceCtaVmc } from '../lib/ficheMaintenanceCtaVmc'
import type { Client, Equipement, Site } from '../lib/types'
import { clientDisplayName, equipAvecFluideFrigorigene, syncClientRaisonSociale } from '../lib/types'
import {
  TYPE_OT_LABELS,
  PARCOURS_APPEL_STEPS,
  blankOrdreTravail,
  nextNumeroOt,
  naturesCerfaPourTypeOt,
  inferParcoursStep,
  isOtCloture,
  formatOtNumero,
  otBaseNumero,
  type TypeOt,
  type StatutOt,
  type ParcoursAppelStepId,
  type OrdreTravail,
  type LienCommandeType,
} from '../lib/ordreTravail'
import {
  contratsActifsForClient,
  contratsActifsForSite,
} from '../lib/contratMaintenance'
import { OtCommandeLinkFields } from '../components/OtCommandeLinkFields'
import { TechnicienAssignField } from '../components/TechnicienAssignField'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function blankClient(): Omit<Client, 'id' | 'createdAt'> {
  return {
    typeClient: 'entreprise',
    raisonSociale: '',
    nomContact: '',
    nom: '',
    prenom: '',
    adresse: '',
    codePostal: '',
    ville: '',
    telephone: '',
    email: '',
    siret: '',
    notes: '',
  }
}

function blankSite(clientId: string, from?: Partial<Client>): Omit<Site, 'id' | 'createdAt'> {
  const label = from ? clientDisplayName(from as Client) : ''
  return {
    clientId,
    nom: label && label !== '—' ? `Site ${label}` : '',
    adresse: from?.adresse || '',
    codePostal: from?.codePostal || '',
    ville: from?.ville || '',
    typeTravaux: 'depanage',
    detailTravaux: '',
    modeGestion: 'ponctuel',
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
    equipements: [],
  }
}

function blankEquip(avecFluide = true): Equipement {
  return {
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
  }
}

const STEP_INDEX: Record<ParcoursAppelStepId, number> = {
  ot: 0,
  client: 1,
  site: 2,
  equipement: 3,
  docs: 4,
}

export function AppelOtPage() {
  const { data, upsertOrdreTravail, upsertClient, upsertChantier, upsertFicheMaintenanceClim, upsertFicheMaintenanceChaufferie, upsertFicheMaintenanceCtaVmc, upsertIntervention } =
    useStore()
  const { user, isOwner } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const otIdParam = params.get('ot') || params.get('id') || ''
  const clientFromQuery = params.get('client') || ''
  const chantierFromQuery = params.get('chantier') || ''
  const equipFromQuery = params.get('equipement') || ''
  const contratFromQuery = params.get('contrat') || ''
  const fromScan = params.get('from') === 'scan'

  const existing = useMemo(
    () => (data.ordresTravail || []).find((o) => o.id === otIdParam) || null,
    [data.ordresTravail, otIdParam],
  )

  const [otId, setOtId] = useState(existing?.id || '')
  const [step, setStep] = useState<ParcoursAppelStepId>(() => {
    if (existing) return inferParcoursStep(existing)
    if (clientFromQuery && chantierFromQuery && equipFromQuery) return 'docs'
    if (clientFromQuery && chantierFromQuery) return 'equipement'
    if (clientFromQuery) return 'site'
    return 'ot'
  })

  const [otForm, setOtForm] = useState(() => {
    if (existing) {
      const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = existing
      return rest
    }
    const site = chantierFromQuery
      ? data.chantiers.find((c) => c.id === chantierFromQuery)
      : undefined
    const eqs = site ? allEquipements(site) : []
    const eq =
      (equipFromQuery && eqs.find((e) => e.id === equipFromQuery)) || undefined
    const label = eq
      ? (eq.nom || eq.type || 'Équipement').trim()
      : site?.nom || 'Intervention'
    const contratPrefill = contratFromQuery
      ? (data.contratsMaintenance || []).find((c) => c.id === contratFromQuery)
      : undefined
    return {
      ...blankOrdreTravail(),
      numero: nextNumeroOt(data),
      date: today(),
      technicien: user?.signataireNom || user?.fullName || user?.email || '',
      technicienUserId: user?.id,
      signatureTechnicienImage: user?.signatureImage || '',
      typeOt: 'depanage' as TypeOt,
      action: fromScan || equipFromQuery ? `Intervention — ${label}` : '',
      statut: (fromScan || equipFromQuery ? 'en_cours' : 'brouillon') as StatutOt,
      parcoursStep: (clientFromQuery && chantierFromQuery && equipFromQuery
        ? 'docs'
        : 'ot') as ParcoursAppelStepId,
      clientId: clientFromQuery || site?.clientId || contratPrefill?.clientId || undefined,
      chantierId: chantierFromQuery || undefined,
      equipementId: equipFromQuery || undefined,
      equipementIds: equipFromQuery ? [equipFromQuery] : undefined,
      lienCommandeType: (contratPrefill ? 'contrat' : 'aucun') as LienCommandeType,
      lienCommandeRef: contratPrefill?.numero || '',
      contratId: contratPrefill?.id,
    }
  })

  const [clientMode, setClientMode] = useState<'pick' | 'new'>('pick')
  const [clientQ, setClientQ] = useState('')
  const [clientForm, setClientForm] = useState(blankClient)

  const [siteMode, setSiteMode] = useState<'pick' | 'new'>('pick')
  const [siteForm, setSiteForm] = useState(() => blankSite(''))

  const [equipMode, setEquipMode] = useState<'pick' | 'new'>('pick')
  const [equipForm, setEquipForm] = useState(() => blankEquip(true))
  const [clientSignNom, setClientSignNom] = useState('')
  const [clientSignQualite, setClientSignQualite] = useState('Représentant client')
  const [awaitingRemoteSignature, setAwaitingRemoteSignature] = useState(false)

  const [msg, setMsg] = useState('')
  const [groupementModal, setGroupementModal] = useState<null | 'clim' | 'cta'>(null)
  const scanBootRef = useRef(false)

  useEffect(() => {
    if (!existing) return
    const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = existing
    setOtForm(rest)
    setOtId(existing.id)
    setStep(inferParcoursStep(existing))
  }, [existing?.id, existing?.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scan QR terrain : créer / persister l’OT tout de suite (client + site + équipement)
  useEffect(() => {
    if (scanBootRef.current) return
    if (existing || otId || !fromScan) return
    if (!otForm.clientId || !otForm.chantierId || !otForm.equipementId) return
    scanBootRef.current = true
    persistOt({
      ...otForm,
      statut: 'en_cours',
      parcoursStep: 'docs',
      action: otForm.action || 'Intervention terrain (scan QR)',
    })
    setMsg(`${formatOtNumero(otForm.numero)} ouvert depuis le scan — à compléter.`)
    setStep('docs')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromScan, otForm.clientId, otForm.chantierId, otForm.equipementId])

  // OT déjà clôturé : classer les CERFA encore en « brouillon »
  useEffect(() => {
    if (!existing || !isOtCloture(existing.statut)) return
    const linked = data.interventions.filter(
      (i) =>
        i.status === 'brouillon' &&
        (i.ordreTravailId === existing.id ||
          (existing.numero &&
            (i.numeroIntervention === existing.numero ||
              (i.numeroIntervention || '').startsWith(`${existing.numero}-`)))),
    )
    for (const draft of linked) {
      if (!draft.hasCerfaPdf && !draft.signatureOperateurImage) continue
      upsertIntervention({ ...draft, status: 'signe' })
    }
  }, [existing?.id, existing?.statut]) // eslint-disable-line react-hooks/exhaustive-deps

  const client = data.clients.find((c) => c.id === otForm.clientId)
  const site = data.chantiers.find((c) => c.id === otForm.chantierId)
  const contratsPourOt = useMemo(() => {
    if (site) return contratsActifsForSite(data.contratsMaintenance, site)
    if (otForm.clientId) return contratsActifsForClient(data.contratsMaintenance, otForm.clientId)
    return (data.contratsMaintenance || []).filter((c) => c.statut === 'signe')
  }, [data.contratsMaintenance, site, otForm.clientId])
  const eqs = site ? allEquipements(site) : []
  const selectedEquipIds = useMemo(() => {
    if (otForm.equipementIds && otForm.equipementIds.length > 0) return otForm.equipementIds
    if (otForm.equipementId) return [otForm.equipementId]
    return [] as string[]
  }, [otForm.equipementId, otForm.equipementIds])
  const selectedEqs = eqs.filter((e) => selectedEquipIds.includes(e.id))
  const selectedEq = selectedEqs[0]

  const toggleEquip = (id: string) => {
    const cur = selectedEquipIds
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    setOtForm({
      ...otForm,
      equipementIds: next,
      equipementId: next[0] || '',
    })
  }

  useEffect(() => {
    if (!site) return
    setClientSignNom((n) => {
      // Ne pas réécraser si l’utilisateur saisit / efface (évite « Signataire site » qui revient)
      if (n.trim() && n.trim() !== 'Signataire site') return n
      if (n === '') return n
      const fromSite = site.signatureDetenteurNom?.trim() || ''
      if (fromSite && fromSite !== 'Signataire site') return fromSite
      const contact = client?.nomContact?.trim() || ''
      return contact
    })
    setClientSignQualite((q) =>
      q && q !== 'Représentant client' ? q : site.signatureDetenteurQualite || 'Représentant client',
    )
    // Ne pas préremplir signatureClientImage — signature à chaque OT
  }, [site?.id, client?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const clientsFiltered = useMemo(
    () =>
      data.clients.filter((c) =>
        matchesQuery(
          [clientDisplayName(c), c.ville, c.telephone, c.nomContact, c.nom, c.prenom]
            .filter(Boolean)
            .join(' '),
          clientQ,
        ),
      ),
    [data.clients, clientQ],
  )

  const sitesForClient = useMemo(
    () =>
      otForm.clientId
        ? data.chantiers.filter((s) => s.clientId === otForm.clientId)
        : [],
    [data.chantiers, otForm.clientId],
  )

  const persistOt = (
    patch: Partial<OrdreTravail> & { parcoursStep?: ParcoursAppelStepId },
    idOverride?: string,
  ) => {
    const id = upsertOrdreTravail({
      ...otForm,
      ...patch,
      id: idOverride || otId || existing?.id,
      signatureTechnicienImage:
        patch.signatureTechnicienImage ??
        otForm.signatureTechnicienImage ??
        user?.signatureImage ??
        '',
      createdByUserId: user?.id,
      createdByName: user?.fullName || user?.email,
    })
    setOtId(id)
    setOtForm((f) => ({ ...f, ...patch }))
    if (!otIdParam || otIdParam !== id) {
      navigate(`/app/appel?ot=${encodeURIComponent(id)}`, { replace: true })
    }
    return id
  }

  const goStep = (next: ParcoursAppelStepId) => {
    setStep(next)
    if (otId || existing?.id) {
      persistOt({ parcoursStep: next })
    }
  }

  const saveOtStep = () => {
    if (!otForm.action.trim()) {
      alert('Décrivez la panne, l’installation ou la demande du client.')
      return
    }
    const id = persistOt({
      ...otForm,
      statut: 'en_cours',
      parcoursStep: 'client',
    })
    setMsg(`${formatOtNumero(otForm.numero)} créé — complètez le client.`)
    setOtId(id)
    setStep('client')
  }

  const saveClientStep = () => {
    let clientId = otForm.clientId || ''
    if (clientMode === 'new' || !clientId) {
      const typeClient = clientForm.typeClient || 'entreprise'
      if (typeClient === 'particulier') {
        if (!(clientForm.nom || '').trim() || !(clientForm.prenom || '').trim()) {
          alert('Indiquez le nom et le prénom du particulier.')
          return
        }
      } else if (!clientForm.raisonSociale.trim()) {
        alert('Indiquez la raison sociale / nom du client.')
        return
      }
      const payload = syncClientRaisonSociale({
        ...clientForm,
        typeClient,
        nomContact: typeClient === 'entreprise' ? clientForm.nomContact : '',
        nom: typeClient === 'particulier' ? (clientForm.nom || '').trim() : '',
        prenom: typeClient === 'particulier' ? (clientForm.prenom || '').trim() : '',
        siret: typeClient === 'entreprise' ? clientForm.siret : '',
      })
      clientId = upsertClient({
        ...payload,
        createdByUserId: user?.id,
        createdByName: user?.fullName || user?.email,
      })
    }
    const c = data.clients.find((x) => x.id === clientId) || {
      ...clientForm,
      id: clientId,
      createdAt: '',
    }
    setSiteForm(blankSite(clientId, c))
    persistOt({ clientId, parcoursStep: 'site' }, otId)
    setStep('site')
    setMsg('Client enregistré.')
  }

  const saveSiteStep = () => {
    if (!otForm.clientId) {
      alert('Choisissez d’abord un client.')
      return
    }
    let chantierId = otForm.chantierId || ''
    if (siteMode === 'new' || !chantierId) {
      if (!siteForm.nom.trim()) {
        alert('Indiquez le nom du site.')
        return
      }
      chantierId = upsertChantier({
        ...siteForm,
        clientId: otForm.clientId,
        createdByUserId: user?.id,
        createdByName: user?.fullName || user?.email,
      })
    }
    persistOt({ chantierId, parcoursStep: 'equipement' }, otId)
    setStep('equipement')
    const siteJustSaved = data.chantiers.find((s) => s.id === chantierId)
    const eqCount = siteJustSaved ? allEquipements(siteJustSaved).length : 0
    setEquipMode(eqCount > 0 ? 'pick' : 'new')
    setMsg('Site enregistré — sur place, ajoutez l’équipement.')
  }

  const saveEquipStep = () => {
    if (!otForm.chantierId || !site) {
      alert('Site manquant.')
      return
    }
    let equipementIds = [...selectedEquipIds]
    if (equipMode === 'new') {
      if (!equipForm.nom.trim() && !equipForm.type.trim()) {
        alert('Indiquez au moins un nom ou type d’équipement.')
        return
      }
      const nom = equipForm.nom.trim() || equipForm.type.trim()
      const existing = allEquipements(site)
      const clash = findDuplicateEquipNom(existing, nom)
      if (clash) {
        alert(
          `Un équipement « ${nom} » existe déjà sur ce site. Changez le nom — chaque équipement doit avoir un libellé unique.`,
        )
        return
      }
      const teq =
        equipForm.avecFluideFrigorigene !== false && equipForm.fluideType
          ? calcTeqCO2FromFluide(equipForm.chargeNominaleKg || 0, equipForm.fluideType) || 0
          : 0
      const eq: Equipement = {
        ...equipForm,
        id: equipForm.id || crypto.randomUUID(),
        nom,
        teqCO2: teq,
      }
      const list = [...existing, eq]
      upsertChantier({
        ...site,
        equipements: list,
        avecFluideFrigorigene: list.some((e) => e.avecFluideFrigorigene !== false),
      })
      equipementIds = [...equipementIds.filter((id) => id !== eq.id), eq.id]
    } else if (equipementIds.length === 0) {
      alert('Cochez au moins un équipement (ou créez-en un).')
      return
    }
    persistOt(
      {
        equipementIds,
        equipementId: equipementIds[0] || '',
        parcoursStep: 'docs',
      },
      otId,
    )
    setStep('docs')
    setMsg(
      equipementIds.length > 1
        ? `${equipementIds.length} équipements liés — CERFA si fluide, sinon rapport OT.`
        : 'Équipement lié — CERFA si fluide, sinon rapport OT. Fiche checklist optionnelle.',
    )
  }

  const skipEquipForNow = () => {
    persistOt({ parcoursStep: 'docs' }, otId)
    setStep('docs')
    setMsg('Équipement à compléter plus tard.')
  }

  const openCerfa = () => {
    if (!otForm.chantierId) {
      alert('Site requis pour le CERFA.')
      return
    }
    const ids =
      selectedEquipIds.length > 0
        ? selectedEquipIds
        : otForm.equipementId
          ? [otForm.equipementId]
          : []
    const withFluide = ids.filter((id) => {
      const eq = eqs.find((e) => e.id === id)
      // CERFA dispo dès que l’équipement est « avec fluide » — le type de gaz
      // peut être complété dans la fiche CERFA (pas besoin qu’il soit déjà rempli).
      return Boolean(eq && equipAvecFluideFrigorigene(eq))
    })
    if (ids.length === 0) {
      alert('Sélectionnez au moins un équipement avant le CERFA.')
      return
    }
    if (withFluide.length === 0) {
      alert(
        'Aucun équipement « fluide » sélectionné.\n\nSur la fiche équipement, cochez « Contient du fluide frigorigène », puis réessayez.',
      )
      return
    }

    const natures = naturesCerfaPourTypeOt(otForm.typeOt)
    const id = persistOt(
      {
        parcoursStep: 'docs',
        statut: 'en_cours',
        equipementIds: ids,
        equipementId: withFluide[0] || ids[0],
      },
      otId,
    )

    const draftIds: string[] = []
    for (let i = 0; i < withFluide.length; i++) {
      const eqId = withFluide[i]
      const eq = eqs.find((e) => e.id === eqId)
      const candidates = data.interventions.filter(
        (interv) =>
          interv.chantierId === otForm.chantierId &&
          interv.equipementId === eqId &&
          (interv.ordreTravailId === id ||
            interv.ordreTravailId === otId ||
            interv.numeroIntervention === otForm.numero ||
            (otForm.numero &&
              (interv.numeroIntervention || '').startsWith(`${otForm.numero}-`))),
      )
      // Même OT + équipement : reprendre la fiche existante (même signée) — évite double déduction stock
      let existingDraft =
        candidates.find((c) =>
          (data.stockMouvements || []).some((m) => m.interventionId === c.id),
        ) ||
        candidates.find((c) => c.hasCerfaPdf) ||
        candidates.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))[0] ||
        data.interventions.find(
          (interv) =>
            interv.status === 'brouillon' &&
            interv.chantierId === otForm.chantierId &&
            interv.equipementId === eqId &&
            !interv.ordreTravailId,
        )
      if (existingDraft) {
        // Harmoniser le n° sur celui de l’OT (unique, sans -1/-2)
        if (
          otForm.numero &&
          existingDraft.numeroIntervention !== otForm.numero
        ) {
          upsertIntervention({
            ...existingDraft,
            numeroIntervention: otForm.numero,
            ordreTravailId: existingDraft.ordreTravailId || id,
          })
        } else if (!existingDraft.ordreTravailId) {
          upsertIntervention({
            ...existingDraft,
            ordreTravailId: id,
          })
        }
        draftIds.push(existingDraft.id)
        continue
      }
      const charge = Number(eq?.chargeNominaleKg) || 0
      const draftId = upsertIntervention({
        clientId: otForm.clientId || site?.clientId || '',
        chantierId: otForm.chantierId,
        equipementId: eqId,
        dateIntervention: otForm.date,
        numeroIntervention: otForm.numero,
        ordreTravailId: id,
        operateur: data.operateur,
        natures: natures as import('../lib/types').NatureIntervention[],
        detectionPermanente: !!eq?.detectionPermanente,
        fluideType: eq?.fluideType || '',
        quantiteTotaleKg: charge,
        teqCO2: eq?.teqCO2,
        fuiteConstatee: false,
        manipulations: [],
        status: 'brouillon',
        createdByUserId: user?.id,
        createdByName: user?.fullName || user?.email,
      })
      draftIds.push(draftId)
    }

    if (draftIds.length > 1) {
      setMsg(
        `${draftIds.length} CERFA brouillons créés (un par équipement). Remplissez-les un par un.`,
      )
    }
    navigate(`/app/interventions/${draftIds[0]}?ot=${encodeURIComponent(id)}`)
  }

  const openFicheMaint = (perPage: EquipementsParFiche = 1) => {
    if (!otForm.chantierId) {
      alert('Site requis pour la fiche.')
      return
    }
    const c = client
    const s = site
    const eqIds =
      selectedEquipIds.length > 0
        ? selectedEquipIds
        : otForm.equipementId
          ? [otForm.equipementId]
          : ([] as string[])
    if (eqIds.length === 0) {
      alert('Sélectionnez au moins un équipement pour la fiche checklist.')
      return
    }

    const adresse =
      [s?.adresse, s?.codePostal, s?.ville].filter(Boolean).join(', ') ||
      [c?.adresse, c?.codePostal, c?.ville].filter(Boolean).join(', ')

    const id = persistOt(
      {
        parcoursStep: 'docs',
        equipementIds: eqIds,
        equipementId: eqIds[0],
      },
      otId,
    )

    const ficheIds: string[] = []
    for (const eqId of eqIds) {
      const eq = eqs.find((e) => e.id === eqId)
      const existingFiche =
        (data.fichesMaintenanceClim || []).find(
          (f) =>
            f.chantierId === otForm.chantierId &&
            f.equipementId === eqId &&
            (f.numero === otForm.numero ||
              (otForm.numero && (f.numero || '').startsWith(`${otForm.numero}-`))),
        ) ||
        (data.fichesMaintenanceClim || []).find(
          (f) =>
            f.chantierId === otForm.chantierId &&
            f.equipementId === eqId &&
            !f.hasPdf &&
            (!f.numero || f.numero === otForm.numero),
        )
      if (existingFiche) {
        upsertFicheMaintenanceClim({
          ...existingFiche,
          numero: otForm.numero || existingFiche.numero,
          equipementsParFiche: perPage,
        })
        ficheIds.push(existingFiche.id)
        continue
      }
      const base = blankFicheMaintenanceClim()
      const ficheId = upsertFicheMaintenanceClim({
        ...base,
        numero: otForm.numero,
        date: otForm.date || today(),
        technicien: otForm.technicien,
        clientId: otForm.clientId,
        chantierId: otForm.chantierId,
        equipementId: eqId,
        clientNom: c?.raisonSociale || '',
        adresse,
        marqueModele: eq
          ? [eq.marque, eq.modele].filter(Boolean).join(' / ') || eq.nom || eq.type || ''
          : '',
        numeroSerie: eq?.numeroSerie || '',
        fluide: eq?.fluideType || '',
        quantiteFluideKg:
          eq?.chargeNominaleKg != null && eq.chargeNominaleKg > 0 ? eq.chargeNominaleKg : null,
        signatureTechnicienImage: otForm.signatureTechnicienImage || user?.signatureImage || '',
        signatureClientImage: otForm.signatureClientImage || '',
        observations: otForm.observations || '',
        equipementsParFiche: perPage,
      })
      ficheIds.push(ficheId)
    }

    if (ficheIds.length === 0) return
    persistOt({ ficheMaintenanceId: ficheIds[0], parcoursStep: 'docs' }, id)
    if (ficheIds.length > 1) {
      setMsg(
        perPage > 1
          ? `${ficheIds.length} équipements prêts — PDF groupé (${perPage} par page) au choix du client. Remplissez-les un par un.`
          : `${ficheIds.length} fiches checklist créées (une par équipement). Remplissez-les une par une.`,
      )
    }
    const q =
      ficheIds.length > 1
        ? `id=${encodeURIComponent(ficheIds[0])}&batch=${encodeURIComponent(ficheIds.join(','))}&ot=${encodeURIComponent(id)}`
        : `id=${encodeURIComponent(ficheIds[0])}&ot=${encodeURIComponent(id)}`
    navigate(`/app/fiche-maintenance-clim?${q}`)
  }

  const openFicheChaufferie = () => {
    if (!otForm.chantierId) {
      alert('Site requis pour la fiche chaufferie.')
      return
    }
    const c = client
    const s = site
    const eqId =
      selectedEquipIds[0] || otForm.equipementId || (eqs[0]?.id ?? '')
    const eq = eqs.find((e) => e.id === eqId)
    const adresse =
      [s?.adresse, s?.codePostal, s?.ville].filter(Boolean).join(', ') ||
      [c?.adresse, c?.codePostal, c?.ville].filter(Boolean).join(', ')

    const id = persistOt(
      {
        parcoursStep: 'docs',
        equipementId: eqId || otForm.equipementId,
      },
      otId,
    )

    const existingFiche =
      (data.fichesMaintenanceChaufferie || []).find(
        (f) =>
          f.chantierId === otForm.chantierId &&
          (!eqId || f.equipementId === eqId) &&
          (f.numero === otForm.numero || !f.hasPdf),
      ) || null

    let ficheId = existingFiche?.id
    if (existingFiche) {
      if (otForm.numero && existingFiche.numero !== otForm.numero) {
        upsertFicheMaintenanceChaufferie({
          ...existingFiche,
          numero: otForm.numero,
        })
      }
    } else {
      const base = blankFicheMaintenanceChaufferie('mensuel')
      ficheId = upsertFicheMaintenanceChaufferie({
        ...base,
        numero: otForm.numero,
        date: otForm.date || today(),
        technicien: otForm.technicien,
        clientId: otForm.clientId,
        chantierId: otForm.chantierId,
        equipementId: eqId || undefined,
        clientNom: c?.raisonSociale || '',
        adresse,
        marqueModele: eq
          ? [eq.marque, eq.modele].filter(Boolean).join(' / ') || eq.nom || eq.type || ''
          : '',
        numeroSerie: eq?.numeroSerie || '',
        signatureTechnicienImage: otForm.signatureTechnicienImage || user?.signatureImage || '',
        signatureClientImage: otForm.signatureClientImage || '',
        observations: otForm.observations || '',
      })
    }
    if (!ficheId) return
    persistOt({ ficheChaufferieId: ficheId, parcoursStep: 'docs' }, id)
    navigate(
      `/app/fiche-maintenance-chaufferie?id=${encodeURIComponent(ficheId)}&ot=${encodeURIComponent(id)}`,
    )
  }

  const openFicheCtaVmc = (perPage: EquipementsParFiche = 1) => {
    if (!otForm.chantierId) {
      alert('Site requis pour la fiche CTA / VMC.')
      return
    }
    const c = client
    const s = site
    const eqIds =
      selectedEquipIds.length > 0
        ? selectedEquipIds
        : otForm.equipementId
          ? [otForm.equipementId]
          : eqs[0]?.id
            ? [eqs[0].id]
            : ([] as string[])
    if (eqIds.length === 0) {
      alert('Sélectionnez au moins un équipement pour la fiche CTA / VMC.')
      return
    }
    const adresse =
      [s?.adresse, s?.codePostal, s?.ville].filter(Boolean).join(', ') ||
      [c?.adresse, c?.codePostal, c?.ville].filter(Boolean).join(', ')

    const id = persistOt(
      {
        parcoursStep: 'docs',
        equipementIds: eqIds,
        equipementId: eqIds[0],
      },
      otId,
    )

    const ficheIds: string[] = []
    for (const eqId of eqIds) {
      const eq = eqs.find((e) => e.id === eqId)
      const existingFiche =
        (data.fichesMaintenanceCtaVmc || []).find(
          (f) =>
            f.chantierId === otForm.chantierId &&
            f.equipementId === eqId &&
            (f.numero === otForm.numero || !f.hasPdf),
        ) || null
      if (existingFiche) {
        upsertFicheMaintenanceCtaVmc({
          ...existingFiche,
          numero: otForm.numero || existingFiche.numero,
          equipementsParFiche: perPage,
        })
        ficheIds.push(existingFiche.id)
        continue
      }
      const raw = `${eq?.type || ''} ${eq?.nom || ''}`.toLowerCase()
      const hasCta = /cta|centrale/.test(raw)
      const hasVmc = /vmc|ventilation/.test(raw)
      const typeEquipement =
        hasCta && hasVmc ? 'cta_vmc' : hasCta ? 'cta' : hasVmc ? 'vmc' : 'cta_vmc'
      const base = blankFicheMaintenanceCtaVmc('mensuel')
      const ficheId = upsertFicheMaintenanceCtaVmc({
        ...base,
        numero: otForm.numero,
        date: otForm.date || today(),
        technicien: otForm.technicien,
        clientId: otForm.clientId,
        chantierId: otForm.chantierId,
        equipementId: eqId,
        clientNom: c?.raisonSociale || '',
        adresse,
        marqueModele: eq
          ? [eq.marque, eq.modele].filter(Boolean).join(' / ') || eq.nom || eq.type || ''
          : '',
        numeroSerie: eq?.numeroSerie || '',
        typeEquipement,
        signatureTechnicienImage: otForm.signatureTechnicienImage || user?.signatureImage || '',
        signatureClientImage: otForm.signatureClientImage || '',
        observations: otForm.observations || '',
        equipementsParFiche: perPage,
      })
      ficheIds.push(ficheId)
    }
    if (ficheIds.length === 0) return
    persistOt({ ficheCtaVmcId: ficheIds[0], parcoursStep: 'docs' }, id)
    if (ficheIds.length > 1) {
      setMsg(
        perPage > 1
          ? `${ficheIds.length} CTA/VMC prêts — PDF groupé (${perPage} par page) au choix du client.`
          : `${ficheIds.length} fiches CTA/VMC créées (une par équipement).`,
      )
    }
    const q =
      ficheIds.length > 1
        ? `id=${encodeURIComponent(ficheIds[0])}&batch=${encodeURIComponent(ficheIds.join(','))}&ot=${encodeURIComponent(id)}`
        : `id=${encodeURIComponent(ficheIds[0])}&ot=${encodeURIComponent(id)}`
    navigate(`/app/fiche-maintenance-cta-vmc?${q}`)
  }

  const finishWithSignatures = () => {
    if (!otForm.signatureTechnicienImage) {
      alert('Signature technicien requise.')
      return
    }
    if (!otForm.signatureClientImage) {
      if (awaitingRemoteSignature) {
        alert(
          'Client absent : la signature n’est pas encore arrivée.\n\n' +
            '1) Envoyez le lien (SMS ou e-mail)\n' +
            '2) Le client signe sur son téléphone\n' +
            '3) La signature apparaît ici automatiquement\n' +
            '4) Ensuite seulement « Clôturer signé »\n\n' +
            'Gardez cette page ouverte (rafraîchissement auto).',
        )
        return
      }
      alert(
        'Signature client requise sur l’OT.\n\n' +
          'Si le client est absent : cochez « Client absent », envoyez le lien SMS/e-mail, ' +
          'attendez qu’il signe, puis recliquez sur Clôturer.',
      )
      return
    }
    const id = persistOt({
      statut: 'signe',
      parcoursStep: 'docs',
      rapportAction: otForm.rapportAction || otForm.action,
    })
    // Clôturer aussi les CERFA liés (plus de « brouillon à reprendre »)
    const linked = data.interventions.filter(
      (i) =>
        i.ordreTravailId === id ||
        i.ordreTravailId === otId ||
        (otForm.numero &&
          (i.numeroIntervention === otForm.numero ||
            (i.numeroIntervention || '').startsWith(`${otForm.numero}-`))),
    )
    for (const draft of linked) {
      upsertIntervention({
        ...draft,
        // Même n° OT pour tous les CERFA de l’intervention (plus de -1/-2)
        numeroIntervention: otForm.numero || draft.numeroIntervention,
        status: 'signe',
        signatureOperateurImage:
          draft.signatureOperateurImage || otForm.signatureTechnicienImage || undefined,
        signatureOperateur:
          draft.signatureOperateur || otForm.technicien || undefined,
        signatureDetenteurImage:
          draft.signatureDetenteurImage || otForm.signatureClientImage || undefined,
        signatureDetenteur:
          draft.signatureDetenteur || clientSignNom || undefined,
        signatureDetenteurQualite:
          draft.signatureDetenteurQualite || clientSignQualite || undefined,
      })
    }
    setMsg(
      linked.length > 0
        ? `${formatOtNumero(otForm.numero)} clôturé — ${linked.length} CERFA classé${linked.length > 1 ? 's' : ''} signé${linked.length > 1 ? 's' : ''}.`
        : `${formatOtNumero(otForm.numero)} clôturé.`,
    )
    navigate(`/app/ot?id=${encodeURIComponent(id)}`)
  }

  const stepIdx = STEP_INDEX[step]
  /** Afficher CERFA si au moins un équipement est marqué fluide (même sans type R-xx encore). */
  const hasFluide =
    selectedEqs.length > 0
      ? selectedEqs.some((eq) => equipAvecFluideFrigorigene(eq))
      : site
        ? allEquipements(site).some((eq) => equipAvecFluideFrigorigene(eq))
        : true
  const fluideCount = (
    selectedEqs.length > 0 ? selectedEqs : site ? allEquipements(site) : []
  ).filter((eq) => equipAvecFluideFrigorigene(eq)).length
  const fluideSansType = (
    selectedEqs.length > 0 ? selectedEqs : site ? allEquipements(site) : []
  ).filter((eq) => equipAvecFluideFrigorigene(eq) && !(eq.fluideType || '').trim()).length
  const isMaint =
    otForm.typeOt === 'maintenance' ||
    otForm.typeOt === 'entretien' ||
    otForm.typeOt === 'controle_etancheite'
  const otCloture = isOtCloture(otForm.statut)

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(otId ? `/app/ot?id=${encodeURIComponent(otId)}` : '/app/ot')}
          className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line bg-white px-3 text-sm font-semibold"
        >
          <ArrowLeft className="h-4 w-4" /> OT
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
            {isOwner ? 'Client appelle' : 'Urgence / astreinte'}
          </h1>
          <p className="truncate text-xs text-muted">
            {otForm.numero ? formatOtNumero(otForm.numero) : 'Nouvel OT'} · date {otForm.date || '—'}
            {!isOwner
              ? ' · OT & CERFA synchronisés sur le compte société'
              : ''}
          </p>
        </div>
      </div>

      {!isOwner ? (
        <p className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-950">
          Week-end / hors horaires bureau : créez l’OT ici. Le gérant et toute l’équipe le voient
          automatiquement (sync PC ↔ téléphone).
        </p>
      ) : (
        <p className="rounded-xl border border-line bg-white px-3 py-2 text-xs text-muted">
          Les techniciens peuvent aussi créer un OT en astreinte — tout arrive dans le coffre
          société.
        </p>
      )}

      {/* Stepper */}
      <ol className="flex gap-1 overflow-x-auto pb-1">
        {PARCOURS_APPEL_STEPS.map((s, i) => {
          const done = i < stepIdx
          const active = s.id === step
          return (
            <li key={s.id} className="min-w-0 flex-1">
              <button
                type="button"
                disabled={!otId && i > 0}
                onClick={() => {
                  if (otId || i === 0) goStep(s.id)
                }}
                className={[
                  'flex w-full flex-col items-start rounded-xl border px-2 py-2 text-left',
                  active
                    ? 'border-emerald-400 bg-emerald-50'
                    : done
                      ? 'border-line bg-white'
                      : 'border-dashed border-line bg-mist/40 opacity-70',
                ].join(' ')}
              >
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted">
                  {done ? <Check className="h-3 w-3 text-emerald-600" /> : null}
                  {i + 1}
                </span>
                <span className="truncate text-xs font-semibold text-ink">{s.label}</span>
              </button>
            </li>
          )
        })}
      </ol>

      {otCloture && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          <p className="font-semibold">OT clôturé</p>
          <p className="mt-0.5 text-muted">
            Classé avec les OT terminés. Vous pouvez encore corriger une erreur, puis re-clôturer
            si besoin.
          </p>
        </div>
      )}

      {msg ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {msg}
        </p>
      ) : null}

      {/* ——— Étape OT ——— */}
      {step === 'ot' && (
        <section className="space-y-3 rounded-2xl border border-line bg-white p-4">
          <p className="text-sm text-muted">
            Au téléphone ou en astreinte : créez l’OT tout de suite, même avant d’être sur site.
            Tout est enregistré sur le compte société.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-ink">N° OT</span>
              <div className="flex h-11 overflow-hidden rounded-xl border border-line bg-white">
                <span className="grid shrink-0 place-items-center bg-emerald-50 px-2.5 text-sm font-extrabold text-emerald-800">
                  OT
                </span>
                <input
                  value={otBaseNumero(otForm.numero) || otForm.numero}
                  onChange={(e) =>
                    setOtForm({
                      ...otForm,
                      numero: e.target.value.replace(/^OT\s*/i, '').trim(),
                    })
                  }
                  className="h-full min-w-0 flex-1 border-0 px-3 font-bold tracking-wide outline-none"
                  placeholder="26081702"
                />
              </div>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-ink">Date (auto, modifiable)</span>
              <input
                type="date"
                value={otForm.date}
                onChange={(e) => setOtForm({ ...otForm, date: e.target.value })}
                className="h-11 w-full rounded-xl border border-line px-3"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-ink">Type</span>
              <select
                value={otForm.typeOt}
                onChange={(e) => setOtForm({ ...otForm, typeOt: e.target.value as TypeOt })}
                className="h-11 w-full rounded-xl border border-line bg-white px-3"
              >
                {(Object.keys(TYPE_OT_LABELS) as TypeOt[]).map((t) => (
                  <option key={t} value={t}>
                    {TYPE_OT_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-1 flex items-center justify-between gap-2 font-semibold text-ink">
              <span>Description — panne / installation / demande *</span>
              <VoiceDictationButton
                value={otForm.action}
                onChange={(v) => setOtForm({ ...otForm, action: v })}
              />
            </span>
            <textarea
              rows={3}
              value={otForm.action}
              onChange={(e) => setOtForm({ ...otForm, action: e.target.value })}
              className="w-full rounded-xl border border-line px-3 py-2"
              placeholder="Ex. Plus de froid chambre 2, fuite suspectée…"
              autoFocus
            />
          </label>

          <OtCommandeLinkFields
            compact
            value={otForm}
            contrats={contratsPourOt}
            devisList={(data.devis || []).filter(
              (d) => !otForm.clientId || d.clientId === otForm.clientId,
            )}
            commandes={(data.commandesFournisseur || []).filter(
              (c) => !otForm.clientId || !c.clientId || c.clientId === otForm.clientId,
            )}
            clients={data.clients}
            devisLienClient={client?.devisLien}
            onChange={(patch) => setOtForm({ ...otForm, ...patch })}
          />

          <label className="block text-sm">
            <span className="mb-1 flex items-center justify-between gap-2 font-semibold text-ink">
              <span>Observations (appel)</span>
              <VoiceDictationButton
                value={otForm.observations}
                onChange={(v) => setOtForm({ ...otForm, observations: v })}
              />
            </span>
            <textarea
              rows={2}
              value={otForm.observations}
              onChange={(e) => setOtForm({ ...otForm, observations: e.target.value })}
              className="w-full rounded-xl border border-line px-3 py-2"
              placeholder="Urgence, accès, contact sur place…"
            />
          </label>
          <TechnicienAssignField
            technicien={otForm.technicien}
            technicienUserId={otForm.technicienUserId}
            onChange={(next) => setOtForm({ ...otForm, ...next })}
          />
          <button
            type="button"
            onClick={saveOtStep}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0f766e] px-5 text-sm font-bold text-white sm:w-auto"
          >
            Enregistrer l’OT <ArrowRight className="h-4 w-4" />
          </button>
        </section>
      )}

      {/* ——— Étape Client ——— */}
      {step === 'client' && (
        <section className="space-y-3 rounded-2xl border border-line bg-white p-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setClientMode('pick')}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${clientMode === 'pick' ? 'bg-accent text-ink' : 'border border-line'}`}
            >
              Client existant
            </button>
            <button
              type="button"
              onClick={() => {
                setClientMode('new')
                setOtForm({ ...otForm, clientId: '' })
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${clientMode === 'new' ? 'bg-accent text-ink' : 'border border-line'}`}
            >
              <Plus className="mr-1 inline h-3.5 w-3.5" /> Nouveau client
            </button>
          </div>

          {clientMode === 'pick' ? (
            <>
              <SearchField
                value={clientQ}
                onChange={setClientQ}
                placeholder="Chercher un client…"
                testId="appel-client-search"
              />
              <ul className="max-h-64 space-y-1 overflow-y-auto">
                {clientsFiltered.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setOtForm({ ...otForm, clientId: c.id })
                        setClientForm({
                          typeClient: c.typeClient || 'entreprise',
                          raisonSociale: c.raisonSociale,
                          nomContact: c.nomContact || '',
                          nom: c.nom || '',
                          prenom: c.prenom || '',
                          adresse: c.adresse || '',
                          codePostal: c.codePostal || '',
                          ville: c.ville || '',
                          telephone: c.telephone || '',
                          email: c.email || '',
                          siret: c.siret || '',
                          notes: c.notes || '',
                        })
                      }}
                      className={[
                        'flex min-h-12 w-full items-center gap-2 rounded-xl border px-3 text-left text-sm',
                        otForm.clientId === c.id
                          ? 'border-emerald-400 bg-emerald-50'
                          : 'border-line bg-white active:bg-mist',
                      ].join(' ')}
                    >
                      <User className="h-4 w-4 shrink-0 text-muted" />
                      <span className="min-w-0 flex-1 truncate font-semibold">
                        {clientDisplayName(c)}
                      </span>
                      <span className="truncate text-xs text-muted">{c.ville}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <fieldset className="sm:col-span-2">
                <legend className="mb-2 block text-sm font-semibold text-ink">Type de client</legend>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ['entreprise', 'Entreprise'],
                      ['particulier', 'Particulier'],
                    ] as const
                  ).map(([id, label]) => {
                    const on = (clientForm.typeClient || 'entreprise') === id
                    return (
                      <label
                        key={id}
                        className={[
                          'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-4 text-sm font-semibold',
                          on
                            ? 'border-emerald-400 bg-emerald-50 text-emerald-950'
                            : 'border-line bg-white',
                        ].join(' ')}
                      >
                        <input
                          type="radio"
                          name="appelTypeClient"
                          checked={on}
                          onChange={() =>
                            setClientForm({
                              ...clientForm,
                              typeClient: id,
                              ...(id === 'particulier'
                                ? { raisonSociale: '', nomContact: '', siret: '' }
                                : { nom: '', prenom: '' }),
                            })
                          }
                          className="accent-emerald-700"
                        />
                        {label}
                      </label>
                    )
                  })}
                </div>
              </fieldset>
              {(clientForm.typeClient || 'entreprise') === 'entreprise' ? (
                <>
                  <label className="block text-sm sm:col-span-2">
                    <span className="mb-1 block font-semibold text-ink">Raison sociale *</span>
                    <input
                      value={clientForm.raisonSociale}
                      onChange={(e) =>
                        setClientForm({ ...clientForm, raisonSociale: e.target.value })
                      }
                      className="h-11 w-full rounded-xl border border-line px-3"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-semibold text-ink">Contact</span>
                    <input
                      value={clientForm.nomContact}
                      onChange={(e) =>
                        setClientForm({ ...clientForm, nomContact: e.target.value })
                      }
                      className="h-11 w-full rounded-xl border border-line px-3"
                    />
                  </label>
                </>
              ) : (
                <>
                  <label className="block text-sm">
                    <span className="mb-1 block font-semibold text-ink">Nom *</span>
                    <input
                      value={clientForm.nom || ''}
                      onChange={(e) => setClientForm({ ...clientForm, nom: e.target.value })}
                      className="h-11 w-full rounded-xl border border-line px-3"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-semibold text-ink">Prénom *</span>
                    <input
                      value={clientForm.prenom || ''}
                      onChange={(e) => setClientForm({ ...clientForm, prenom: e.target.value })}
                      className="h-11 w-full rounded-xl border border-line px-3"
                    />
                  </label>
                </>
              )}
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-ink">Téléphone</span>
                <input
                  value={clientForm.telephone}
                  onChange={(e) => setClientForm({ ...clientForm, telephone: e.target.value })}
                  className="h-11 w-full rounded-xl border border-line px-3"
                  inputMode="tel"
                />
              </label>
              {(clientForm.typeClient || 'entreprise') === 'entreprise' ? null : (
                <div className="hidden sm:block" />
              )}
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-semibold text-ink">Adresse</span>
                <input
                  value={clientForm.adresse}
                  onChange={(e) => setClientForm({ ...clientForm, adresse: e.target.value })}
                  className="h-11 w-full rounded-xl border border-line px-3"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-ink">Code postal</span>
                <input
                  value={clientForm.codePostal}
                  onChange={(e) => setClientForm({ ...clientForm, codePostal: e.target.value })}
                  className="h-11 w-full rounded-xl border border-line px-3"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-ink">Ville</span>
                <input
                  value={clientForm.ville}
                  onChange={(e) => setClientForm({ ...clientForm, ville: e.target.value })}
                  className="h-11 w-full rounded-xl border border-line px-3"
                />
              </label>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => goStep('ot')}
              className="btn-secondary min-h-11 rounded-xl border border-line px-4 text-sm font-semibold"
            >
              Retour
            </button>
            <button
              type="button"
              onClick={saveClientStep}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#0f766e] px-5 text-sm font-bold text-white sm:flex-none"
            >
              Continuer site <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {/* ——— Étape Site ——— */}
      {step === 'site' && (
        <section className="space-y-3 rounded-2xl border border-line bg-white p-4">
          <p className="text-sm text-muted">
            Client : <strong>{client ? clientDisplayName(client) : '—'}</strong>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSiteMode('pick')}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${siteMode === 'pick' ? 'bg-accent text-ink' : 'border border-line'}`}
            >
              Site existant
            </button>
            <button
              type="button"
              onClick={() => {
                setSiteMode('new')
                setOtForm({ ...otForm, chantierId: '' })
                setSiteForm(blankSite(otForm.clientId || '', client))
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${siteMode === 'new' ? 'bg-accent text-ink' : 'border border-line'}`}
            >
              <Plus className="mr-1 inline h-3.5 w-3.5" /> Nouveau site
            </button>
          </div>

          {siteMode === 'pick' ? (
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {sitesForClient.length === 0 ? (
                <li className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-sm text-muted">
                  Aucun site pour ce client — créez-en un.
                </li>
              ) : (
                sitesForClient.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setOtForm({ ...otForm, chantierId: s.id })}
                      className={[
                        'flex min-h-12 w-full items-center gap-2 rounded-xl border px-3 text-left text-sm',
                        otForm.chantierId === s.id
                          ? 'border-emerald-400 bg-emerald-50'
                          : 'border-line bg-white active:bg-mist',
                      ].join(' ')}
                    >
                      <MapPin className="h-4 w-4 shrink-0 text-muted" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{s.nom}</span>
                        <span className="block text-xs text-muted">
                          {[s.codePostal, s.ville].filter(Boolean).join(' ')}
                        </span>
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-semibold text-ink">Nom du site *</span>
                <input
                  value={siteForm.nom}
                  onChange={(e) => setSiteForm({ ...siteForm, nom: e.target.value })}
                  className="h-11 w-full rounded-xl border border-line px-3"
                  placeholder="Ex. Cuisine, Entrepôt nord…"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-semibold text-ink">Adresse</span>
                <input
                  value={siteForm.adresse}
                  onChange={(e) => setSiteForm({ ...siteForm, adresse: e.target.value })}
                  className="h-11 w-full rounded-xl border border-line px-3"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-ink">Code postal</span>
                <input
                  value={siteForm.codePostal}
                  onChange={(e) => setSiteForm({ ...siteForm, codePostal: e.target.value })}
                  className="h-11 w-full rounded-xl border border-line px-3"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-ink">Ville</span>
                <input
                  value={siteForm.ville}
                  onChange={(e) => setSiteForm({ ...siteForm, ville: e.target.value })}
                  className="h-11 w-full rounded-xl border border-line px-3"
                />
              </label>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => goStep('client')}
              className="min-h-11 rounded-xl border border-line px-4 text-sm font-semibold"
            >
              Retour
            </button>
            <button
              type="button"
              onClick={saveSiteStep}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#0f766e] px-5 text-sm font-bold text-white sm:flex-none"
            >
              Continuer équipement <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {/* ——— Étape Équipement ——— */}
      {step === 'equipement' && (
        <section className="space-y-3 rounded-2xl border border-line bg-white p-4">
          <p className="text-sm text-muted">
            Sur site : cochez un ou plusieurs équipements concernés ({site?.nom || '—'}).
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setEquipMode('pick')}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${equipMode === 'pick' ? 'bg-accent text-ink' : 'border border-line'}`}
            >
              Déjà au parc
            </button>
            <button
              type="button"
              onClick={() => {
                setEquipMode('new')
                setEquipForm(blankEquip(true))
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${equipMode === 'new' ? 'bg-accent text-ink' : 'border border-line'}`}
            >
              <Plus className="mr-1 inline h-3.5 w-3.5" /> Nouvel équipement
            </button>
          </div>

          {equipMode === 'pick' ? (
            <div className="space-y-2">
              {eqs.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setOtForm({
                        ...otForm,
                        equipementIds: eqs.map((e) => e.id),
                        equipementId: eqs[0]?.id || '',
                      })
                    }
                    className="rounded-full border border-line px-3 py-1 text-xs font-semibold hover:bg-mist"
                  >
                    Tout cocher
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setOtForm({ ...otForm, equipementIds: [], equipementId: '' })
                    }
                    className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted hover:bg-mist"
                  >
                    Tout décocher
                  </button>
                  {selectedEquipIds.length > 0 && (
                    <span className="self-center text-xs font-semibold text-emerald-800">
                      {selectedEquipIds.length} sélectionné
                      {selectedEquipIds.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              )}
              <ul className="max-h-64 space-y-1 overflow-y-auto">
                {eqs.length === 0 ? (
                  <li className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-sm text-muted">
                    Aucun équipement — créez-en un sur place.
                  </li>
                ) : (
                  eqs.map((eq) => {
                    const checked = selectedEquipIds.includes(eq.id)
                    return (
                      <li key={eq.id}>
                        <button
                          type="button"
                          onClick={() => toggleEquip(eq.id)}
                          className={[
                            'flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 text-left text-sm',
                            checked
                              ? 'border-emerald-400 bg-emerald-50'
                              : 'border-line bg-white active:bg-mist',
                          ].join(' ')}
                          aria-pressed={checked}
                        >
                          <span
                            className={[
                              'grid h-6 w-6 shrink-0 place-items-center rounded border-2',
                              checked
                                ? 'border-emerald-600 bg-emerald-600 text-white'
                                : 'border-slate-300 bg-white',
                            ].join(' ')}
                          >
                            {checked ? <Check className="h-3.5 w-3.5" /> : null}
                          </span>
                          <Cpu className="h-4 w-4 shrink-0 text-muted" />
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold">
                              {eq.nom || eq.type || 'Équipement'}
                            </span>
                            <span className="block text-xs text-muted">
                              {[eq.marque, eq.modele, eq.fluideType].filter(Boolean).join(' · ')}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })
                )}
              </ul>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <PlaquePhotoButton
                  onParsed={(fields: PlaqueFields) => {
                    setEquipForm((prev) => {
                      const fluideType = fields.fluideType || prev.fluideType
                      const chargeNominaleKg =
                        fields.chargeNominaleKg != null && fields.chargeNominaleKg > 0
                          ? fields.chargeNominaleKg
                          : prev.chargeNominaleKg
                      const type = fields.equipementType || prev.type
                      return {
                        ...prev,
                        type,
                        nom: prev.nom.trim() || type || prev.nom,
                        marque: fields.equipementMarque || prev.marque,
                        modele: fields.equipementModele || prev.modele,
                        numeroSerie: fields.equipementNumeroSerie || prev.numeroSerie,
                        ...(fields.fluideType
                          ? { fluideType, avecFluideFrigorigene: true as const }
                          : {}),
                        ...(fields.chargeNominaleKg != null && fields.chargeNominaleKg > 0
                          ? { chargeNominaleKg }
                          : {}),
                        teqCO2:
                          calcTeqCO2FromFluide(chargeNominaleKg || 0, fluideType) || prev.teqCO2,
                      }
                    })
                  }}
                />
              </div>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-semibold text-ink">Nom / repère *</span>
                <input
                  value={equipForm.nom}
                  onChange={(e) => setEquipForm({ ...equipForm, nom: e.target.value })}
                  className="h-11 w-full rounded-xl border border-line px-3"
                  placeholder="Chambre froide 1, PAC bureau…"
                  required
                />
                {site &&
                findDuplicateEquipNom(
                  allEquipements(site),
                  equipForm.nom.trim() || equipForm.type.trim(),
                ) ? (
                  <span className="mt-1 block text-xs font-semibold text-danger">
                    Ce nom existe déjà sur le site — changez-le.
                  </span>
                ) : (
                  <span className="mt-1 block text-xs text-muted">
                    Nom unique obligatoire sur le site.
                  </span>
                )}
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-ink">Type</span>
                <input
                  value={equipForm.type}
                  onChange={(e) => setEquipForm({ ...equipForm, type: e.target.value })}
                  className="h-11 w-full rounded-xl border border-line px-3"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-ink">N° série</span>
                <input
                  value={equipForm.numeroSerie}
                  onChange={(e) => setEquipForm({ ...equipForm, numeroSerie: e.target.value })}
                  className="h-11 w-full rounded-xl border border-line px-3"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-ink">Marque</span>
                <input
                  value={equipForm.marque}
                  onChange={(e) => setEquipForm({ ...equipForm, marque: e.target.value })}
                  className="h-11 w-full rounded-xl border border-line px-3"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-ink">Modèle</span>
                <input
                  value={equipForm.modele}
                  onChange={(e) => setEquipForm({ ...equipForm, modele: e.target.value })}
                  className="h-11 w-full rounded-xl border border-line px-3"
                />
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={equipForm.avecFluideFrigorigene !== false}
                  onChange={(e) =>
                    setEquipForm({
                      ...equipForm,
                      avecFluideFrigorigene: e.target.checked,
                      fluideType: e.target.checked ? equipForm.fluideType || 'R-448A' : '',
                    })
                  }
                />
                Contient du fluide frigorigène (CERFA possible)
              </label>
              {equipForm.avecFluideFrigorigene !== false ? (
                <>
                  <div className="sm:col-span-2">
                    <FluideSelect
                      value={equipForm.fluideType}
                      onChange={(v) => setEquipForm({ ...equipForm, fluideType: v })}
                    />
                  </div>
                  <DecimalField
                    label="Charge (kg)"
                    value={equipForm.chargeNominaleKg}
                    onChange={(v) => setEquipForm({ ...equipForm, chargeNominaleKg: v })}
                  />
                </>
              ) : null}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => goStep('site')}
              className="min-h-11 rounded-xl border border-line px-4 text-sm font-semibold"
            >
              Retour
            </button>
            <button
              type="button"
              onClick={skipEquipForNow}
              className="min-h-11 rounded-xl border border-line px-4 text-sm font-semibold text-muted"
            >
              Plus tard
            </button>
            <button
              type="button"
              onClick={saveEquipStep}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#0f766e] px-5 text-sm font-bold text-white sm:flex-none"
            >
              Continuer <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {/* ——— Étape docs / signatures ——— */}
      {step === 'docs' && (
        <section className="space-y-4 rounded-2xl border border-line bg-white p-4">
          <div className="rounded-xl bg-mist/60 px-3 py-2 text-sm">
            <p className="font-semibold text-ink">
              {TYPE_OT_LABELS[otForm.typeOt]} · {formatOtNumero(otForm.numero)}
            </p>
            <p className="text-muted">{otForm.action}</p>
            <p className="mt-1 text-xs text-muted">
              {[
                client ? clientDisplayName(client) : '',
                site?.nom,
                selectedEqs.length > 1
                  ? `${selectedEqs.length} équipements`
                  : selectedEq?.nom || selectedEq?.type,
              ]
                .filter(Boolean)
                .join(' · ') || 'Compléter client / site / équipement si besoin'}
            </p>
            {selectedEqs.length > 1 && (
              <ul className="mt-2 space-y-0.5 text-xs text-muted">
                {selectedEqs.map((eq) => (
                  <li key={eq.id}>
                    · {eq.nom || eq.type || 'Équipement'}
                    {eq.fluideType ? ` (${eq.fluideType})` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink">Date d’intervention (modifiable)</span>
            <input
              type="date"
              value={otForm.date}
              onChange={(e) => {
                const date = e.target.value
                setOtForm({ ...otForm, date })
                persistOt({ date })
              }}
              className="h-11 w-full max-w-xs rounded-xl border border-line px-3"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 flex items-center justify-between gap-2 font-semibold text-ink">
              <span>Rapport d’action (sur place)</span>
              <VoiceDictationButton
                value={otForm.rapportAction}
                onChange={(v) => {
                  setOtForm({ ...otForm, rapportAction: v })
                }}
              />
            </span>
            <textarea
              rows={3}
              value={otForm.rapportAction}
              onChange={(e) => setOtForm({ ...otForm, rapportAction: e.target.value })}
              className="w-full rounded-xl border border-line px-3 py-2"
              placeholder="Ce qui a été fait…"
            />
          </label>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Documents</p>
            {hasFluide ? (
              <button
                type="button"
                onClick={openCerfa}
                className="flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-4 text-left font-bold active:bg-emerald-100"
              >
                <FileCheck2 className="h-6 w-6 shrink-0 text-emerald-700" />
                <span>
                  <span className="block">CERFA (fluide / gaz) — remplir</span>
                  <span className="block text-sm font-medium text-muted">
                    {fluideCount > 1
                      ? `${fluideCount} équipements → 1 CERFA chacun`
                      : fluideSansType > 0
                        ? 'Ouvrir la fiche — complétez fluide / charge dedans'
                        : `Document utile — ${formatOtNumero(otForm.numero)}, date reprise`}
                  </span>
                </span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                if (selectedEquipIds.length > 1) setGroupementModal('clim')
                else openFicheMaint(1)
              }}
              className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-dashed border-line bg-white px-4 py-3 text-left font-semibold active:bg-mist"
            >
              <ClipboardList className="h-5 w-5 shrink-0 text-muted" />
              <span>
                <span className="block text-sm">Fiche checklist clim (optionnel)</span>
                <span className="block text-xs font-medium text-muted">
                  {selectedEquipIds.length > 1
                    ? `${selectedEquipIds.length} équipements — vous pourrez regrouper 2 ou 3 par page à l’impression`
                    : isMaint
                      ? 'Pas obligatoire en maintenance — le CERFA ou le rapport OT suffisent'
                      : 'Si vous voulez un PDF détaillé hors CERFA'}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={openFicheChaufferie}
              className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-dashed border-amber-200 bg-amber-50/60 px-4 py-3 text-left font-semibold active:bg-amber-50"
            >
              <ClipboardList className="h-5 w-5 shrink-0 text-amber-800" />
              <span>
                <span className="block text-sm">Fiche chaufferie P2/P3</span>
                <span className="block text-xs font-medium text-muted">
                  Mensuel · trimestriel · semestriel · annuel (registre complet)
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedEquipIds.length > 1) setGroupementModal('cta')
                else openFicheCtaVmc(1)
              }}
              className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-dashed border-sky-200 bg-sky-50/60 px-4 py-3 text-left font-semibold active:bg-sky-50"
            >
              <ClipboardList className="h-5 w-5 shrink-0 text-sky-700" />
              <span>
                <span className="block text-sm">Fiche CTA / VMC</span>
                <span className="block text-xs font-medium text-muted">
                  {selectedEquipIds.length > 1
                    ? `${selectedEquipIds.length} équipements — regroupement 2 ou 3 par page possible`
                    : '1M · 3M · 6M · 1Y — bouches, filtres, turbine, réglementaire'}
                </span>
              </span>
            </button>
            {!hasFluide ? (
              <p className="text-xs text-muted">
                Pas de fluide : notez l’intervention dans le rapport d’action ci-dessus, puis
                clôturez l’OT. La fiche checklist n’est pas exigée.
              </p>
            ) : null}
          </div>

          {otId ? (
            <DocsPackPanel
              ot={{
                ...otForm,
                id: otId,
                createdAt: existing?.createdAt || new Date().toISOString(),
                updatedAt: existing?.updatedAt || new Date().toISOString(),
              }}
            />
          ) : null}

          <div className="space-y-4">
            <IntervenantSignature
              label="Signature technicien (auto)"
              nom={otForm.technicien}
              qualite="Opérateur attesté"
              image={otForm.signatureTechnicienImage || ''}
              onNomChange={(v) => setOtForm({ ...otForm, technicien: v })}
              onQualiteChange={() => {}}
              onImageChange={(v) => setOtForm({ ...otForm, signatureTechnicienImage: v })}
              height={140}
            />
            <ClientSiteSignature
              siteId={otForm.chantierId || undefined}
              otId={otId || undefined}
              nom={clientSignNom}
              qualite={clientSignQualite}
              image={otForm.signatureClientImage || ''}
              onNomChange={setClientSignNom}
              onQualiteChange={setClientSignQualite}
              onImageChange={(v) => setOtForm({ ...otForm, signatureClientImage: v })}
              onAwaitingRemoteChange={setAwaitingRemoteSignature}
              height={140}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => goStep('equipement')}
              className="min-h-11 rounded-xl border border-line px-4 text-sm font-semibold"
            >
              Retour
            </button>
            <button
              type="button"
              onClick={() =>
                persistOt({
                  rapportAction: otForm.rapportAction,
                  observations: otForm.observations,
                  signatureTechnicienImage: otForm.signatureTechnicienImage,
                  signatureClientImage: otForm.signatureClientImage,
                  statut: 'en_cours',
                })
              }
              className="min-h-11 rounded-xl border border-line px-4 text-sm font-semibold"
            >
              Enregistrer l’OT
            </button>
            <button
              type="button"
              onClick={finishWithSignatures}
              disabled={awaitingRemoteSignature && !otForm.signatureClientImage}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#0f766e] px-5 text-sm font-bold text-white disabled:opacity-50 sm:flex-none"
            >
              <Check className="h-4 w-4" />{' '}
              {awaitingRemoteSignature && !otForm.signatureClientImage
                ? 'En attente signature client…'
                : otCloture
                  ? 'Re-clôturer'
                  : 'Clôturer signé'}
            </button>
          </div>

          <p className="text-xs text-muted">
            {awaitingRemoteSignature && !otForm.signatureClientImage
              ? 'Client absent : attendez que le client signe via le lien SMS/e-mail. La signature arrive seule — ensuite le bouton Clôturer se réactive.'
              : otCloture
                ? 'OT déjà clôturé — modification exceptionnelle en cas d’erreur.'
                : 'Signatures technicien + client sur l’OT (reprises sur le CERFA si besoin). La fiche checklist n’est pas exigée pour clôturer.'}
          </p>
        </section>
      )}

      <div className="flex flex-wrap gap-3 pb-8 text-sm">
        <Link to="/app/ot" className="font-semibold text-accent hover:underline">
          Liste des OT
        </Link>
        {client?.telephone ? (
          <a
            href={`tel:${client.telephone.replace(/\s/g, '')}`}
            className="inline-flex items-center gap-1 font-semibold text-ink"
          >
            <Phone className="h-3.5 w-3.5" /> {client.telephone}
          </a>
        ) : null}
        {client ? (
          <span className="inline-flex items-center gap-1 text-muted">
            <Building2 className="h-3.5 w-3.5" /> {clientDisplayName(client)}
          </span>
        ) : null}
      </div>
      <FicheGroupementModal
        open={!!groupementModal}
        title={
          groupementModal === 'cta'
            ? 'Impression des fiches CTA / VMC'
            : 'Impression des fiches clim'
        }
        equipementCount={Math.max(selectedEquipIds.length, 2)}
        onConfirm={(v) => {
          const kind = groupementModal
          setGroupementModal(null)
          if (kind === 'cta') openFicheCtaVmc(v)
          else openFicheMaint(v)
        }}
        onCancel={() => setGroupementModal(null)}
      />
    </div>
  )
}
