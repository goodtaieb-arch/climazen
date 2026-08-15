import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check, Circle, Eye, FileCheck2, Plus, Save, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import {
  CONTENANT_TYPE_LABELS,
  NATURE_LABELS,
  bouteilleVisibleCerfaMemeVide,
  isBouteilleRetournee,
  isContenantDestination,
  isDetecteurControleExpire,
  needsBottleNumber,
  sensMouvementPourContenant,
  type CerfaDraft,
  type ContenantType,
  type NatureIntervention,
  type StockMouvementSens,
} from '../lib/types'
import { buildCerfaPdf } from '../lib/cerfaPdf'
import { loadCerfaPdf, saveCerfaPdf } from '../lib/pdfStore'
import { Field } from './ClientsPage'
import { PdfViewerModal } from '../components/PdfViewerModal'
import { ClientSiteSignature } from '../components/ClientSiteSignature'
import { IntervenantSignature } from '../components/IntervenantSignature'
import { FluideSelect } from '../components/FluideSelect'
import { DecimalField } from '../components/DecimalField'
import { LabelHint } from '../components/LabelHint'
import {
  adrInfoForFluide,
  calcTeqCO2FromFluide,
  controlesPeriodiquesInfo,
  findFluide,
  isFluideInflammableA2LOrA3,
  sameFluideCode,
} from '../lib/fluides'
import {
  DESTINATION_AUTRE_VALUE,
  isDestinationLibre,
  mergeDestinationsInstallation,
  rememberDestination,
} from '../lib/destinationsInstallation'
import {
  assertMouvementCerfaLegal,
  bouteilleEligibleChargeCerfa,
  capaciteRestanteKg,
  jaugeRemplissageRecup,
  naturesPermettentRemplissageRecup,
  resumeRegleContenant,
  sensAutorisesCerfa,
} from '../lib/stockRegles'
import { A2lRecupAlert } from '../components/A2lRecupAlert'
import { RecupJaugeBanner } from '../components/RecupJaugeBanner'
import {
  TYPE_HUILE_LABELS,
  isBouteilleReepreuveExpiree,
  quantiteDepuisPesee,
  type TypeHuile,
} from '../lib/stockBouteilleExtras'
import { bottleLetter, roundKg } from '../lib/decimal'
import { TIP_ADR, TIP_BOUTEILLE, TIP_DESTINATION, TIP_UN } from '../lib/fieldTips'
import { detecteurForUser, assertDetecteurValidePourCerfa } from '../lib/detecteurs'
import { equipementsForCerfa, equipmentLabel } from '../lib/cerfaBatch'
import { findEquipement } from '../lib/migrate'
import { nextNumeroIntervention } from '../lib/numeroIntervention'
import { otBaseNumero, sameOtNumero } from '../lib/ordreTravail'
import { nomSignataireClient } from '../lib/signataireClient'

const ALL_NATURES = Object.keys(NATURE_LABELS) as NatureIntervention[]

function today() {
  return new Date().toISOString().slice(0, 10)
}

type ManipDraft = {
  key: string
  stockItemId: string
  quantiteKg: number
  sens: StockMouvementSens
  typeHuile?: import('../lib/types').StockItem['typeHuile']
  /** Poids brut lu sur balance (tare déduite → quantiteKg) */
  poidsBrutKg?: number
}

function newManipLine(sens: StockMouvementSens = 'sortie'): ManipDraft {
  return {
    key: crypto.randomUUID(),
    stockItemId: '',
    quantiteKg: 0,
    sens,
    typeHuile: undefined,
    poidsBrutKg: undefined,
  }
}

export function InterventionFormPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const {
    data,
    saveInterventionWithStock,
    upsertIntervention,
    upsertChantier,
    applySiteClientSignature,
    setOperateur,
  } = useStore()
  const { user } = useAuth()

  const existing = useMemo(
    () => (isNew ? null : data.interventions.find((x) => x.id === id) || null),
    [data.interventions, id, isNew],
  )

  const chantierFromQuery = searchParams.get('chantier') || ''
  const equipementFromQuery = searchParams.get('equipement') || ''
  const otFromQuery = searchParams.get('ot') || ''
  const numeroFromQuery = searchParams.get('numero') || ''
  const dateFromQuery = searchParams.get('date') || ''
  const naturesFromQuery = (searchParams.get('natures') || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is NatureIntervention => s in NATURE_LABELS)
  const chantierQueryOk = data.chantiers.some((c) => c.id === chantierFromQuery)

  const defaultSignNom =
    user?.signataireNom || user?.fullName || ''
  const defaultSignQualite =
    user?.signataireQualite || (user?.role === 'owner' ? 'Responsable / gérant' : 'Opérateur attesté')
  /** Signature perso uniquement (jamais celle « société ») */
  const defaultSignImage = user?.signatureImage || ''
  const monDetecteur = detecteurForUser(data, user?.id)

  const linkedOt = useMemo(() => {
    if (!otFromQuery && !numeroFromQuery) return null
    const list = data.ordresTravail || []
    return (
      list.find((o) => o.id === otFromQuery) ||
      list.find((o) => o.numero === otFromQuery || o.numero === numeroFromQuery) ||
      null
    )
  }, [data.ordresTravail, otFromQuery, numeroFromQuery])

  const [chantierId, setChantierId] = useState(
    existing?.chantierId ||
      (chantierQueryOk ? chantierFromQuery : '') ||
      data.chantiers[0]?.id ||
      '',
  )
  const [equipementId, setEquipementId] = useState(
    existing?.equipementId || equipementFromQuery || '',
  )
  const [natures, setNatures] = useState<NatureIntervention[]>(
    existing?.natures ||
      (naturesFromQuery.length > 0 ? naturesFromQuery : ['entretien_reparation']),
  )
  const [dateIntervention, setDateIntervention] = useState(
    existing?.dateIntervention || dateFromQuery || today(),
  )
  const [detectionPermanente, setDetectionPermanente] = useState(
    existing?.detectionPermanente ?? false,
  )
  const [fluideType, setFluideType] = useState(existing?.fluideType || '')
  const [quantiteTotaleKg, setQuantiteTotaleKg] = useState(existing?.quantiteTotaleKg ?? 0)
  const [quantiteHfoKg, setQuantiteHfoKg] = useState(existing?.quantiteHfoKg ?? 0)
  const [teqCO2, setTeqCO2] = useState(existing?.teqCO2 ?? 0)
  const [periodiciteControle, setPeriodiciteControle] = useState(
    existing?.periodiciteControle || '',
  )
  const [fuiteConstatee, setFuiteConstatee] = useState(existing?.fuiteConstatee || false)
  const [fuiteDescription, setFuiteDescription] = useState(existing?.fuiteDescription || '')
  const [fuiteReparee, setFuiteReparee] = useState<boolean | null>(
    existing?.fuiteReparee === undefined ? null : !!existing.fuiteReparee,
  )
  const [fuiteLocalisation2, setFuiteLocalisation2] = useState(existing?.fuiteLocalisation2 || '')
  const [fuite2Reparee, setFuite2Reparee] = useState<boolean | null>(
    existing?.fuite2Reparee === undefined ? null : !!existing.fuite2Reparee,
  )
  const [fuiteLocalisation3, setFuiteLocalisation3] = useState(existing?.fuiteLocalisation3 || '')
  const [fuite3Reparee, setFuite3Reparee] = useState<boolean | null>(
    existing?.fuite3Reparee === undefined ? null : !!existing.fuite3Reparee,
  )
  const [detecteurIdentification, setDetecteurIdentification] = useState(
    existing?.detecteurIdentification || monDetecteur?.identification || '',
  )
  const [detecteurControleDate, setDetecteurControleDate] = useState(
    existing?.detecteurControleDate || monDetecteur?.controleDate || '',
  )
  const [manips, setManips] = useState<ManipDraft[]>(() => {
    const fromExisting = (existing?.manipulations || []).filter((m) => m.stockItemId)
    if (fromExisting.length > 0) {
      return fromExisting.map((m) => ({
        key: crypto.randomUUID(),
        stockItemId: m.stockItemId || '',
        quantiteKg: m.quantiteKg || 0,
        sens:
          m.sens ||
          (m.type === 'recuperation' ? 'entree' : ('sortie' as StockMouvementSens)),
      }))
    }
    return []
  })
  const [codeUn, setCodeUn] = useState(existing?.codeUn || '')
  const [denominationAdr, setDenominationAdr] = useState(existing?.denominationAdr || '')
  const [installationDestination, setInstallationDestination] = useState(
    existing?.installationDestination || '',
  )
  const [observations, setObservations] = useState(existing?.observations || '')
  const [signatureOperateur, setSignatureOperateur] = useState(
    existing?.signatureOperateur || defaultSignNom,
  )
  const [signatureOperateurQualite, setSignatureOperateurQualite] = useState(
    existing?.signatureOperateurQualite || defaultSignQualite,
  )
  const [signatureDetenteur, setSignatureDetenteur] = useState(existing?.signatureDetenteur || '')
  const [signatureDetenteurQualite, setSignatureDetenteurQualite] = useState(
    existing?.signatureDetenteurQualite || '',
  )
  const [signatureOperateurImage, setSignatureOperateurImage] = useState(
    existing?.signatureOperateurImage || linkedOt?.signatureTechnicienImage || defaultSignImage,
  )
  const [signatureDetenteurImage, setSignatureDetenteurImage] = useState(
    existing?.signatureDetenteurImage || linkedOt?.signatureClientImage || '',
  )
  const [status, setStatus] = useState<CerfaDraft['status']>(existing?.status || 'brouillon')
  const [numeroIntervention, setNumeroIntervention] = useState(
    () =>
      otBaseNumero(linkedOt?.numero) ||
      otBaseNumero(numeroFromQuery) ||
      otBaseNumero(existing?.numeroIntervention) ||
      (isNew
        ? nextNumeroIntervention({
            interventions: data.interventions,
            fichesMaintenanceClim: data.fichesMaintenanceClim,
            ordresTravail: data.ordresTravail,
          })
        : ''),
  )
  const [ordreTravailId] = useState(
    () => existing?.ordreTravailId || linkedOt?.id || undefined,
  )
  const [busy, setBusy] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [draftId, setDraftId] = useState<string | null>(existing?.id || null)
  const [draftHint, setDraftHint] = useState('')
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [hasPdf, setHasPdf] = useState(!!existing?.hasCerfaPdf)
  const [fullscreen, setFullscreen] = useState(false)
  const skipAutosaveRef = useRef(true)
  const lastDraftJsonRef = useRef('')
  const saveDraftRef = useRef<() => string | null>(() => null)

  const chantier = data.chantiers.find((c) => c.id === chantierId)
  const client = data.clients.find((c) => c.id === chantier?.clientId)
  const equipement = findEquipement(chantier, equipementId || equipementFromQuery)
  const detecteurExpire = isDetecteurControleExpire(detecteurControleDate)
  /** Dénomination fluide de la fiche CERFA (pas l’ancien gaz du chantier) */
  const denominationFluide = (fluideType || '').trim()
  const adrAuto = useMemo(() => adrInfoForFluide(denominationFluide), [denominationFluide])
  const destinationsOptions = useMemo(() => {
    const fromInterventions = data.interventions
      .map((i) => i.installationDestination || '')
      .filter(Boolean)
    return mergeDestinationsInstallation(data.operateur.destinationsInstallation, fromInterventions)
  }, [data.interventions, data.operateur.destinationsInstallation])
  const destinationSelectValue = useMemo(() => {
    const v = installationDestination.trim()
    if (!v) return ''
    if (isDestinationLibre(v, destinationsOptions)) return DESTINATION_AUTRE_VALUE
    const match = destinationsOptions.find((o) => o.trim().toLowerCase() === v.toLowerCase())
    return match || DESTINATION_AUTRE_VALUE
  }, [installationDestination, destinationsOptions])
  const manipQtyTotal = manips.reduce((s, m) => s + (Number(m.quantiteKg) || 0), 0)
  const firstStockId = manips.find((m) => m.stockItemId)?.stockItemId || ''
  const stockMatchingFluide = useMemo(() => {
    if (!denominationFluide) return []
    const permetRecup = naturesPermettentRemplissageRecup(natures)
    return data.stock.filter((s) => {
      if (!sameFluideCode(s.fluide, denominationFluide)) return false
      if (isBouteilleRetournee(s)) return false
      const qty = Number(s.quantiteKg) || 0

      // Déchet usagé : jamais proposée en charge — uniquement pour remplir (récup / démantèlement)
      if (s.contenantType === 'recuperation') {
        return permetRecup
      }

      if (qty > 0) {
        // Charge / appoint : vierge, recyclé (même client) ou régénéré usine — pas le déchet
        return bouteilleEligibleChargeCerfa(s, client?.id)
      }

      // Vide : recyclé (boucle même détenteur) ou récup seulement si natures OK
      if (!bouteilleVisibleCerfaMemeVide(s.contenantType)) return false
      return permetRecup
    })
  }, [data.stock, denominationFluide, client?.id, natures])

  const destinationWrongFluide = useMemo(() => {
    if (!denominationFluide) return []
    return data.stock.filter(
      (s) =>
        isContenantDestination(s.contenantType) &&
        !isBouteilleRetournee(s) &&
        !sameFluideCode(s.fluide, denominationFluide),
    )
  }, [data.stock, denominationFluide])

  const emptyViergeSameFluide = useMemo(() => {
    if (!denominationFluide) return []
    return data.stock.filter(
      (s) =>
        sameFluideCode(s.fluide, denominationFluide) &&
        !isBouteilleRetournee(s) &&
        (Number(s.quantiteKg) || 0) <= 0 &&
        s.contenantType === 'vierge',
    )
  }, [data.stock, denominationFluide])

  const stockCreateRecupHref = useMemo(() => {
    const q = new URLSearchParams({ type: 'recuperation' })
    if (denominationFluide) q.set('fluide', denominationFluide)
    return `/app/stock?${q.toString()}`
  }, [denominationFluide])

  // Charger le CERFA déjà enregistré dans l’app
  useEffect(() => {
    let revoked: string | null = null
    const interventionId = existing?.id
    if (!interventionId) return
    void loadCerfaPdf(interventionId, user?.organizationId).then((pdf) => {
      if (!pdf) {
        setHasPdf(false)
        return
      }
      const url = URL.createObjectURL(pdf.blob)
      revoked = url
      setPdfUrl(url)
      setHasPdf(true)
    })
    return () => {
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [existing?.id, existing?.cerfaPdfSavedAt, user?.organizationId])

  // Reprendre un brouillon déjà lié au même OT / n° (évite une fiche vide)
  useEffect(() => {
    if (!isNew) return
    if (!otFromQuery && !numeroFromQuery) return
    const list = data.interventions
    const found =
      (equipementFromQuery &&
        list.find(
          (i) =>
            i.equipementId === equipementFromQuery &&
            ((otFromQuery && (i.ordreTravailId === otFromQuery || i.id === otFromQuery)) ||
              (numeroFromQuery.trim() !== '' &&
                (i.numeroIntervention === numeroFromQuery.trim() ||
                  (i.numeroIntervention || '').startsWith(`${numeroFromQuery.trim()}-`)))),
        )) ||
      list.find(
        (i) =>
          (otFromQuery && (i.ordreTravailId === otFromQuery || i.id === otFromQuery)) ||
          (numeroFromQuery.trim() !== '' && i.numeroIntervention === numeroFromQuery.trim()),
      )
    if (found) {
      navigate(`/app/interventions/${found.id}`, { replace: true })
    }
  }, [isNew, otFromQuery, numeroFromQuery, equipementFromQuery, data.interventions, navigate])

  const otBatchId = ordreTravailId || linkedOt?.id || existing?.ordreTravailId || otFromQuery || ''

  /** Équipements du même OT (intervention multi). */
  const batchEquipIds = useMemo(() => {
    const ot =
      (data.ordresTravail || []).find((o) => o.id === otBatchId) ||
      linkedOt ||
      null
    if (ot?.equipementIds && ot.equipementIds.length > 1) return ot.equipementIds
    if (!otBatchId && !numeroIntervention) return [] as string[]
    const siblings = data.interventions.filter(
      (i) =>
        (otBatchId && i.ordreTravailId === otBatchId) ||
        sameOtNumero(i.numeroIntervention, numeroIntervention),
    )
    const ids = [
      ...new Set(
        siblings.map((i) => i.equipementId).filter((x): x is string => Boolean(x)),
      ),
    ]
    return ids.length > 1 ? ids : []
  }, [
    data.ordresTravail,
    data.interventions,
    otBatchId,
    linkedOt,
    numeroIntervention,
  ])

  const batchItems = useMemo(() => {
    if (!chantier || batchEquipIds.length < 2) return []
    const currentId = existing?.id || draftId || ''
    return batchEquipIds.map((eqId) => {
      const eq = findEquipement(chantier, eqId)
      const draft = data.interventions.find(
        (i) =>
          i.equipementId === eqId &&
          ((otBatchId && i.ordreTravailId === otBatchId) ||
            sameOtNumero(i.numeroIntervention, numeroIntervention) ||
            i.id === currentId),
      )
      return {
        equipementId: eqId,
        label: eq
          ? `${equipmentLabel(eq)}${eq.numeroSerie ? ` · SN ${eq.numeroSerie}` : ''}`
          : 'Équipement',
        draftId: draft?.id as string | undefined,
        hasPdf: Boolean(draft?.hasCerfaPdf),
        isCurrent:
          Boolean(currentId && draft?.id === currentId) ||
          (!currentId && eqId === (equipementId || existing?.equipementId || '')),
      }
    })
  }, [
    chantier,
    batchEquipIds,
    data.interventions,
    otBatchId,
    numeroIntervention,
    existing?.id,
    existing?.equipementId,
    equipementId,
    draftId,
  ])

  const isMultiBatch = batchItems.length > 1

  const [markedOk, setMarkedOk] = useState<string[]>(() => {
    if (!otBatchId) return []
    try {
      const raw = sessionStorage.getItem(`climazen_cerfa_ok_${otBatchId}`)
      if (!raw) return []
      const parsed = JSON.parse(raw) as string[]
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    if (!otBatchId) return
    try {
      sessionStorage.setItem(`climazen_cerfa_ok_${otBatchId}`, JSON.stringify(markedOk))
    } catch {
      /* ignore */
    }
  }, [markedOk, otBatchId])

  const toggleMarkedOk = (eqId: string) => {
    setMarkedOk((prev) =>
      prev.includes(eqId) ? prev.filter((x) => x !== eqId) : [...prev, eqId],
    )
  }

  // Laisser le préremplissage initial se faire avant l’autosave
  useEffect(() => {
    const t = window.setTimeout(() => {
      skipAutosaveRef.current = false
    }, 900)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!chantier || existing) return
    const eq = findEquipement(chantier, equipementId || equipementFromQuery)
    if (eq?.id && !equipementId) setEquipementId(eq.id)
    setDetectionPermanente(eq?.detectionPermanente ?? chantier.detectionPermanente)
    setFluideType(eq?.fluideType || chantier.fluideType)
    setQuantiteTotaleKg(eq?.chargeNominaleKg ?? chantier.chargeNominaleKg)
    if (eq?.teqCO2 || chantier.teqCO2) setTeqCO2(eq?.teqCO2 ?? chantier.teqCO2 ?? 0)
  }, [chantierId, equipementId]) // eslint-disable-line react-hooks/exhaustive-deps

  // [12] Code UN + ADR : 100 % auto selon le fluide [7]
  useEffect(() => {
    const adr = adrInfoForFluide(denominationFluide)
    if (adr) {
      setCodeUn(adr.codeUn)
      setDenominationAdr(adr.denominationAdr)
    } else {
      setCodeUn('')
      setDenominationAdr('')
    }
  }, [denominationFluide])

  // Si la dénomination fluide change, retirer toute bouteille d’un autre gaz (tous types)
  useEffect(() => {
    if (!denominationFluide) {
      setManips((prev) => (prev.some((m) => m.stockItemId) ? prev.map((m) => ({ ...m, stockItemId: '', quantiteKg: 0 })) : prev))
      return
    }
    setManips((prev) => {
      const next = prev.filter((m) => {
        if (!m.stockItemId) return true
        const item = data.stock.find((s) => s.id === m.stockItemId)
        return item ? sameFluideCode(item.fluide, denominationFluide) : false
      })
      return next.length === prev.length ? prev : next
    })
  }, [denominationFluide]) // eslint-disable-line react-hooks/exhaustive-deps

  // Préremplir nom / signature client depuis le site (personne qui signe, pas la société)
  useEffect(() => {
    if (!chantier) return
    if (!signatureDetenteurImage && chantier.signatureDetenteurImage) {
      setSignatureDetenteurImage(chantier.signatureDetenteurImage)
    }
    const person = nomSignataireClient({
      signatureNom: signatureDetenteur || chantier.signatureDetenteurNom,
      nomContact: client?.nomContact,
      raisonSociale: client?.raisonSociale,
    })
    if (
      !signatureDetenteur.trim() ||
      (client?.raisonSociale &&
        signatureDetenteur.trim().toLowerCase() === client.raisonSociale.trim().toLowerCase())
    ) {
      if (person) setSignatureDetenteur(person)
    }
    if (!signatureDetenteurQualite.trim()) {
      setSignatureDetenteurQualite(
        chantier.signatureDetenteurQualite || 'Représentant client',
      )
    }
  }, [chantier?.id, chantier?.signatureDetenteurAt, client?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // teq CO₂ = Charge (kg) × GWP / 1000 — dès que fluide + charge connus
  useEffect(() => {
    const teq = calcTeqCO2FromFluide(quantiteTotaleKg, fluideType)
    if (teq === null) return
    setTeqCO2(teq)
    const f = findFluide(fluideType)
    if (f?.famille === 'HFO' && quantiteTotaleKg > 0 && !quantiteHfoKg) {
      setQuantiteHfoKg(quantiteTotaleKg)
    }
  }, [fluideType, quantiteTotaleKg]) // eslint-disable-line react-hooks/exhaustive-deps

  // Signature perso du compte connecté (opérateur ou owner)
  useEffect(() => {
    if (existing?.signatureOperateurImage) return
    if (defaultSignImage && !signatureOperateurImage) {
      setSignatureOperateurImage(defaultSignImage)
    }
    if (defaultSignNom && !signatureOperateur) {
      setSignatureOperateur(defaultSignNom)
    }
    if (defaultSignQualite && !signatureOperateurQualite) {
      setSignatureOperateurQualite(defaultSignQualite)
    }
  }, [defaultSignImage, defaultSignNom, defaultSignQualite]) // eslint-disable-line react-hooks/exhaustive-deps

  // Toujours aligner sur le détecteur enregistré (technicien / société)
  useEffect(() => {
    if (!monDetecteur?.identification) return
    if (!detecteurIdentification.trim()) {
      setDetecteurIdentification(monDetecteur.identification)
    }
    if (!detecteurControleDate.trim() && monDetecteur.controleDate) {
      setDetecteurControleDate(monDetecteur.controleDate)
    }
  }, [monDetecteur?.id, monDetecteur?.identification, monDetecteur?.controleDate]) // eslint-disable-line react-hooks/exhaustive-deps

  const bottleRequired = needsBottleNumber({
    natures,
    manipQty: manipQtyTotal,
    stockItemId: firstStockId || undefined,
    manipCount: manips.filter((m) => m.stockItemId).length,
  })

  const updateManip = (key: string, patch: Partial<ManipDraft>) => {
    setManips((prev) =>
      prev.map((m) => {
        if (m.key !== key) return m
        const next = { ...m, ...patch }
        if (patch.stockItemId) {
          const item = data.stock.find((s) => s.id === patch.stockItemId)
          if (item) {
            next.sens = sensMouvementPourContenant(item.contenantType, item.quantiteKg)
            const allowed = sensAutorisesCerfa(item.contenantType)
            if (!allowed.includes(next.sens)) next.sens = allowed[0]
            if (item.contenantType === 'recuperation' && !next.typeHuile) {
              next.typeHuile = item.typeHuile || 'inconnu'
            }
            if (item.tareKg && next.poidsBrutKg != null) {
              next.quantiteKg = quantiteDepuisPesee(next.poidsBrutKg, item.tareKg)
            }
          }
        }
        if (patch.poidsBrutKg != null) {
          const item = data.stock.find((s) => s.id === next.stockItemId)
          if (item?.tareKg) {
            next.quantiteKg = quantiteDepuisPesee(patch.poidsBrutKg, item.tareKg)
          }
        }
        return next
      }),
    )
  }

  const ctrlPeriodique = useMemo(
    () =>
      controlesPeriodiquesInfo({
        fluideCode: fluideType,
        chargeKg: quantiteTotaleKg,
        teqCO2,
        detectionPermanente,
      }),
    [fluideType, quantiteTotaleKg, teqCO2, detectionPermanente],
  )

  // Ajuste la périodicité suggérée quand le seuil / [6] change
  useEffect(() => {
    if (!ctrlPeriodique.obligatoire) {
      if (periodiciteControle) setPeriodiciteControle('')
      return
    }
    if (ctrlPeriodique.periodeSuggeree && periodiciteControle !== ctrlPeriodique.periodeSuggeree) {
      // Ne force que si vide ou ancienne valeur hors options actuelles
      const opts = detectionPermanente
        ? ['24 mois', '12 mois', '6 mois']
        : ['12 mois', '6 mois', '3 mois']
      if (!periodiciteControle || !opts.includes(periodiciteControle)) {
        setPeriodiciteControle(ctrlPeriodique.periodeSuggeree)
      }
    }
  }, [ctrlPeriodique.obligatoire, ctrlPeriodique.periodeSuggeree, detectionPermanente]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleNature = (n: NatureIntervention) => {
    setNatures((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]))
  }

  const buildDraft = (
    opts?: { keepEmptyManips?: boolean },
  ): Omit<CerfaDraft, 'id' | 'createdAt' | 'updatedAt'> & { id?: string } => {
    const keepEmptyManips = opts?.keepEmptyManips === true
    const manipulations = manips
      .map((m) => {
        const item = data.stock.find((s) => s.id === m.stockItemId)
        if (!item) return null
        if (!keepEmptyManips && !(m.quantiteKg > 0)) return null
        return {
          type: item.contenantType as ContenantType,
          stockItemId: item.id,
          quantiteKg: roundKg(m.quantiteKg || 0),
          numeroContenant: item.numeroContenant,
          bsffReference: item.bsffReference,
          sens: m.sens,
          typeHuile: m.typeHuile || item.typeHuile,
        }
      })
      .filter((x): x is NonNullable<typeof x> => !!x)

    return {
      id: draftId || existing?.id,
      clientId: client?.id || '',
      chantierId,
      equipementId: equipementId || equipement?.id || undefined,
      dateIntervention,
      numeroIntervention: otBaseNumero(numeroIntervention) || undefined,
      ordreTravailId: ordreTravailId || existing?.ordreTravailId,
      operateur: data.operateur,
      natures,
      detecteurIdentification,
      detecteurControleDate,
      detectionPermanente,
      fluideType,
      quantiteTotaleKg,
      quantiteHfoKg: quantiteHfoKg || undefined,
      teqCO2: teqCO2 || undefined,
      periodiciteControle: ctrlPeriodique.obligatoire
        ? periodiciteControle || ctrlPeriodique.periodeSuggeree || undefined
        : undefined,
      fuiteConstatee,
      fuiteDescription,
      fuiteReparee: fuiteReparee === null ? undefined : fuiteReparee,
      fuiteLocalisation2: fuiteLocalisation2 || undefined,
      fuite2Reparee:
        fuiteLocalisation2 && fuite2Reparee !== null ? fuite2Reparee : undefined,
      fuiteLocalisation3: fuiteLocalisation3 || undefined,
      fuite3Reparee:
        fuiteLocalisation3 && fuite3Reparee !== null ? fuite3Reparee : undefined,
      manipulations,
      codeUn,
      denominationAdr,
      installationDestination,
      observations,
      signatureOperateur,
      signatureOperateurQualite,
      signatureDetenteur,
      signatureDetenteurQualite,
      signatureOperateurImage: signatureOperateurImage || undefined,
      signatureDetenteurImage: signatureDetenteurImage || undefined,
      createdByUserId: existing?.createdByUserId || user?.id,
      createdByName: existing?.createdByName || user?.fullName || user?.email || user?.username,
      hasCerfaPdf: existing?.hasCerfaPdf,
      cerfaPdfFileName: existing?.cerfaPdfFileName,
      cerfaPdfSavedAt: existing?.cerfaPdfSavedAt,
      status,
    }
  }

  /** Enregistre sans contrôles stricts ni mouvement stock — pour ne rien perdre en quittant. */
  const saveDraftQuiet = useCallback(
    (opts?: { navigateToDraft?: boolean }) => {
      if (!chantierId) return null
      const site = data.chantiers.find((c) => c.id === chantierId)
      const clientId = client?.id || site?.clientId || ''
      if (!clientId) return null

      const draft = buildDraft({ keepEmptyManips: true })
      let statusToSave = draft.status || 'brouillon'
      if (
        statusToSave !== 'brouillon' &&
        (!draft.signatureOperateurImage || !draft.signatureDetenteurImage)
      ) {
        statusToSave = 'brouillon'
      }

      const snapshot = JSON.stringify({
        ...draft,
        id: draftId || existing?.id || '',
        clientId,
        status: statusToSave,
      })
      if (snapshot === lastDraftJsonRef.current) return draftId || existing?.id || null

      const savedId = upsertIntervention({
        ...draft,
        id: draftId || existing?.id,
        clientId,
        status: statusToSave,
        hasCerfaPdf: existing?.hasCerfaPdf,
        cerfaPdfFileName: existing?.cerfaPdfFileName,
        cerfaPdfSavedAt: existing?.cerfaPdfSavedAt,
      })
      lastDraftJsonRef.current = JSON.stringify({
        ...draft,
        id: savedId,
        clientId,
        status: statusToSave,
      })
      setDraftId(savedId)
      setDraftHint(
        `Brouillon enregistré · ${new Date().toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        })}`,
      )
      if (opts?.navigateToDraft !== false && (isNew || !existing?.id)) {
        navigate(`/app/interventions/${savedId}`, { replace: true })
      }
      return savedId
    },
    // buildDraft lit l’état courant du rendu — deps volontairement larges via effet autosave
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      chantierId,
      client?.id,
      data.chantiers,
      draftId,
      existing?.id,
      existing?.hasCerfaPdf,
      existing?.cerfaPdfFileName,
      existing?.cerfaPdfSavedAt,
      isNew,
      navigate,
      upsertIntervention,
      // form fields that affect draft:
      equipementId,
      dateIntervention,
      numeroIntervention,
      ordreTravailId,
      natures,
      detecteurIdentification,
      detecteurControleDate,
      detectionPermanente,
      fluideType,
      quantiteTotaleKg,
      quantiteHfoKg,
      teqCO2,
      periodiciteControle,
      fuiteConstatee,
      fuiteDescription,
      fuiteReparee,
      fuiteLocalisation2,
      fuite2Reparee,
      fuiteLocalisation3,
      fuite3Reparee,
      manips,
      codeUn,
      denominationAdr,
      installationDestination,
      observations,
      signatureOperateur,
      signatureOperateurQualite,
      signatureDetenteur,
      signatureDetenteurQualite,
      signatureOperateurImage,
      signatureDetenteurImage,
      status,
      data.operateur,
      data.stock,
      equipement?.id,
      user?.id,
      user?.fullName,
      user?.email,
      user?.username,
    ],
  )

  saveDraftRef.current = () => saveDraftQuiet({ navigateToDraft: false })

  // Autosave pendant la saisie
  useEffect(() => {
    if (skipAutosaveRef.current) return
    if (!chantierId) return
    const t = window.setTimeout(() => {
      try {
        saveDraftQuiet({ navigateToDraft: true })
      } catch {
        /* ignore autosave errors */
      }
    }, 1000)
    return () => window.clearTimeout(t)
  }, [saveDraftQuiet, chantierId])

  // Flush à la sortie de page / onglet
  useEffect(() => {
    const flush = () => {
      try {
        saveDraftRef.current()
      } catch {
        /* ignore */
      }
    }
    const onVis = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      flush()
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  const persistInApp = async () => {
    if (!client || !chantier) throw new Error('Choisissez un chantier lié à un client.')
    if (!fluideType.trim()) {
      throw new Error('Indiquez la dénomination du fluide (cadre [7]).')
    }

    // Cadre [5] : détecteur de fuite obligatoire + contrôle < 1 an
    const detOk = assertDetecteurValidePourCerfa(data, user?.id, {
      identification: detecteurIdentification,
      controleDate: detecteurControleDate,
    })
    setDetecteurIdentification(detOk.identification)
    setDetecteurControleDate(detOk.controleDate)

    // Toujours aligner le chantier sur le fluide de la fiche avant contrôle bouteilles
    if (!sameFluideCode(chantier.fluideType, fluideType)) {
      const teq =
        calcTeqCO2FromFluide(quantiteTotaleKg || chantier.chargeNominaleKg, fluideType) ??
        chantier.teqCO2
      upsertChantier({ ...chantier, fluideType, teqCO2: teq })
    }

    if (!signatureOperateur.trim()) {
      throw new Error('Signature opérateur : indiquez votre nom.')
    }
    if (!signatureOperateurImage) {
      throw new Error(
        'Signature manuscrite opérateur obligatoire. Enregistrez-la dans « Ma signature », puis validez le CERFA.',
      )
    }
    if (status === 'signe' || status === 'envoye') {
      if (!signatureDetenteur.trim()) {
        throw new Error('Pour valider (signé / envoyé) : nom du détenteur requis.')
      }
      if (!signatureDetenteurImage) {
        throw new Error('Pour valider (signé / envoyé) : signature détenteur obligatoire.')
      }
    }

    if (ctrlPeriodique.obligatoire) {
      const per = periodiciteControle || ctrlPeriodique.periodeSuggeree
      if (!per) {
        throw new Error(
          'Contrôle périodique obligatoire pour cette charge / ce fluide — choisissez la périodicité [8]/[9].',
        )
      }
      if (!periodiciteControle && ctrlPeriodique.periodeSuggeree) {
        setPeriodiciteControle(ctrlPeriodique.periodeSuggeree)
      }
    }

    const requireBottle = needsBottleNumber({
      natures,
      manipQty: manipQtyTotal,
      stockItemId: firstStockId || undefined,
      manipCount: manips.filter((m) => m.stockItemId).length,
    })
    if (requireBottle) {
      const filled = manips.filter((m) => m.stockItemId && m.quantiteKg > 0)
      if (filled.length === 0) {
        throw new Error(
          'Charge / récupération / démantèlement : ajoutez au moins une bouteille avec quantité.',
        )
      }
    }

    for (const m of manips) {
      if (!m.stockItemId && !(m.quantiteKg > 0)) continue
      if (!denominationFluide) {
        throw new Error(
          'Indiquez d’abord la dénomination du fluide (équipement) avant d’associer une bouteille.',
        )
      }
      const item = data.stock.find((s) => s.id === m.stockItemId)
      if (!item) {
        throw new Error('Choisissez une bouteille du stock pour chaque ligne remplie.')
      }
      if (!sameFluideCode(item.fluide, denominationFluide)) {
        throw new Error(
          `Interdit : bouteille ${item.numeroContenant} (${item.fluide}) ≠ dénomination fluide ${denominationFluide}. Même gaz obligatoire pour tous les types.`,
        )
      }
      if (!item.numeroContenant?.trim()) {
        throw new Error(
          `La bouteille ${item.numeroContenant || 'sélectionnée'} n’a pas de n° d’identification. Complétez-le dans Stock fluides.`,
        )
      }
      if (!(m.quantiteKg > 0)) {
        throw new Error(`Indiquez la quantité (kg) pour la bouteille ${item.numeroContenant}.`)
      }
      const sameBottleLines = manips.filter((x) => x.stockItemId === m.stockItemId)
      if (sameBottleLines.length > 1) {
        throw new Error(
          `La bouteille ${item.numeroContenant} est déjà utilisée sur une autre ligne — choisissez une bouteille encore disponible.`,
        )
      }
      if (m.sens === 'sortie' && m.quantiteKg > item.quantiteKg + 1e-9) {
        throw new Error(
          `Stock insuffisant sur ${item.numeroContenant} : reste ${item.quantiteKg} kg.`,
        )
      }
      assertMouvementCerfaLegal({
        item,
        sens: m.sens,
        quantiteKg: m.quantiteKg,
        clientId: client?.id || chantier?.clientId,
      })
      if (
        item.contenantType === 'recuperation' &&
        isFluideInflammableA2LOrA3(item.fluide) &&
        !item.conformeA2LA3
      ) {
        throw new Error(
          `Bouteille ${item.numeroContenant} (${item.fluide}) : confirmez en Stock qu’elle est certifiée A2L/A3 (collerette rouge + pas à gauche) avant la récupération.`,
        )
      }
      if (isBouteilleReepreuveExpiree(item)) {
        throw new Error(
          `Bouteille ${item.numeroContenant} : date de rééprouvage dépassée (${item.dateReepreuvage}). Contrôle périodique obligatoire avant usage.`,
        )
      }
    }

    const draft = {
      ...buildDraft(),
      detecteurIdentification: detOk.identification,
      detecteurControleDate: detOk.controleDate,
    }
    const fileName = `CERFA-15497-04-${dateIntervention}.pdf`
    const previewId = draft.id || draftId || crypto.randomUUID()
    const fullDraft: CerfaDraft = {
      ...draft,
      id: previewId,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      hasCerfaPdf: true,
      cerfaPdfFileName: fileName,
      cerfaPdfSavedAt: new Date().toISOString(),
    }

    const savedId = saveInterventionWithStock(
      { ...fullDraft, id: previewId },
      { createdByName: user?.fullName || user?.email || user?.username },
    )
    setDraftId(savedId)
    lastDraftJsonRef.current = ''

    const dest = installationDestination.trim()
    if (dest) {
      const nextDest = rememberDestination(data.operateur.destinationsInstallation, dest)
      const prev = data.operateur.destinationsInstallation || []
      if (JSON.stringify(nextDest) !== JSON.stringify(prev)) {
        void setOperateur({ ...data.operateur, destinationsInstallation: nextDest })
      }
    }

    if (signatureDetenteurImage && chantierId) {
      applySiteClientSignature({
        siteId: chantierId,
        signatureDetenteur: signatureDetenteur.trim() || 'Signataire site',
        signatureDetenteurQualite: signatureDetenteurQualite.trim() || 'Représentant client',
        signatureDetenteurImage,
      })
    }

    const blob = await buildCerfaPdf({
      draft: { ...fullDraft, id: savedId },
      client,
      chantier,
    })
    await saveCerfaPdf(savedId, blob, fileName, user?.organizationId)

    if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    const url = URL.createObjectURL(blob)
    setPdfUrl(url)
    setHasPdf(true)
    const nBottles = (draft.manipulations || []).length
    setSavedMsg(
      nBottles > 0
        ? `Enregistré — ${nBottles} bouteille${nBottles > 1 ? 's' : ''} · ${manipQtyTotal} kg · CERFA ${fileName.replace(/\.pdf$/i, '')}`
        : 'Enregistré dans ClimaZEN — le CERFA est ci-dessous (pas de mouvement de bouteille).',
    )
    return savedId
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setSavedMsg('')
    try {
      const savedId = await persistInApp()
      if (equipementId) {
        setMarkedOk((prev) => (prev.includes(equipementId) ? prev : [...prev, equipementId]))
      }
      if (isNew) navigate(`/app/interventions/${savedId}`, { replace: true })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur enregistrement')
    } finally {
      setBusy(false)
    }
  }

  const goToEquipPage = (eqId: string) => {
    if (!chantier) return
    const currentId = draftId || existing?.id || ''
    const currentEq = equipementId || existing?.equipementId || ''
    if (eqId === currentEq && batchItems.some((b) => b.equipementId === eqId && b.isCurrent)) {
      return
    }
    try {
      saveDraftQuiet({ navigateToDraft: false })
    } catch {
      /* ignore */
    }
    const sibling = data.interventions.find(
      (i) =>
        i.equipementId === eqId &&
        i.id !== currentId &&
        ((otBatchId && i.ordreTravailId === otBatchId) ||
          sameOtNumero(i.numeroIntervention, numeroIntervention)),
    )
    if (sibling) {
      navigate(`/app/interventions/${sibling.id}`)
      return
    }
    // Déjà un brouillon pour cet équipement (même id courant) → rester
    const samePage = data.interventions.find(
      (i) =>
        i.id === currentId &&
        i.equipementId === eqId &&
        ((otBatchId && i.ordreTravailId === otBatchId) ||
          sameOtNumero(i.numeroIntervention, numeroIntervention)),
    )
    if (samePage) return

    const eq = findEquipement(chantier, eqId)
    const charge = Number(eq?.chargeNominaleKg) || 0
    const baseNum = otBaseNumero(numeroIntervention) || numeroIntervention
    const newId = upsertIntervention({
      clientId: client?.id || chantier.clientId || '',
      chantierId: chantier.id,
      equipementId: eqId,
      dateIntervention,
      numeroIntervention: baseNum || undefined,
      ordreTravailId: otBatchId || undefined,
      operateur: data.operateur,
      natures,
      detectionPermanente: !!eq?.detectionPermanente,
      fluideType: eq?.fluideType || fluideType || '',
      quantiteTotaleKg: charge,
      teqCO2: eq?.teqCO2,
      fuiteConstatee: false,
      manipulations: [],
      signatureOperateur: signatureOperateur || defaultSignNom,
      signatureOperateurQualite: signatureOperateurQualite || defaultSignQualite,
      signatureOperateurImage: signatureOperateurImage || defaultSignImage || undefined,
      signatureDetenteur: signatureDetenteur || undefined,
      signatureDetenteurQualite: signatureDetenteurQualite || undefined,
      signatureDetenteurImage: signatureDetenteurImage || undefined,
      detecteurIdentification: detecteurIdentification || undefined,
      detecteurControleDate: detecteurControleDate || undefined,
      status: 'brouillon',
      createdByUserId: user?.id,
      createdByName: user?.fullName || user?.email,
    })
    navigate(`/app/interventions/${newId}`)
  }

  /** Régénère les PDF CERFA pour toutes les pages cochées ✓ (ensemble). */
  const regenerateAllCerfas = async () => {
    if (!client || !chantier) {
      alert('Chantier / client manquant.')
      return
    }
    setBusy(true)
    setSavedMsg('')
    try {
      // Sauve d’abord la page courante
      try {
        await persistInApp()
        if (equipementId) {
          setMarkedOk((prev) => (prev.includes(equipementId) ? prev : [...prev, equipementId]))
        }
      } catch (err) {
        // Si la page courante n’est pas prête, on continue sur les autres cochées
        console.warn(err)
      }

      const okIds = new Set(
        markedOk.length > 0
          ? markedOk
          : batchItems.filter((b) => b.hasPdf).map((b) => b.equipementId),
      )
      if (equipementId) okIds.add(equipementId)

      const targets = batchItems.filter((b) => okIds.has(b.equipementId))
      if (targets.length === 0) {
        alert(
          'Cochez l’icône ✓ sur chaque page équipement quand elle est OK, puis régénérez l’ensemble.',
        )
        return
      }

      let done = 0
      for (const item of targets) {
        let draft = data.interventions.find((i) => i.id === item.draftId)
        if (!draft && item.equipementId === equipementId && draftId) {
          draft = data.interventions.find((i) => i.id === draftId)
        }
        if (!draft) {
          throw new Error(
            `Page manquante pour « ${item.label} » — ouvrez-la, complétez, cochez ✓.`,
          )
        }
        if (!draft.fluideType?.trim()) {
          throw new Error(`Fluide manquant sur « ${item.label} ».`)
        }
        assertDetecteurValidePourCerfa(data, user?.id, {
          identification: draft.detecteurIdentification || detecteurIdentification,
          controleDate: draft.detecteurControleDate || detecteurControleDate,
        })
        const fileName = `CERFA-15497-04-${draft.dateIntervention}-${draft.id.slice(0, 8)}.pdf`
        const fullDraft: CerfaDraft = {
          ...draft,
          hasCerfaPdf: true,
          cerfaPdfFileName: fileName,
          cerfaPdfSavedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        upsertIntervention(fullDraft)
        const blob = await buildCerfaPdf({ draft: fullDraft, client, chantier })
        await saveCerfaPdf(draft.id, blob, fileName, user?.organizationId)
        done += 1
      }

      // Recharger le PDF de la page courante
      const currentId = draftId || existing?.id
      if (currentId) {
        const pdf = await loadCerfaPdf(currentId, user?.organizationId)
        if (pdf) {
          if (pdfUrl) URL.revokeObjectURL(pdfUrl)
          setPdfUrl(URL.createObjectURL(pdf.blob))
          setHasPdf(true)
        }
      }

      setSavedMsg(
        `${done} CERFA régénéré${done > 1 ? 's' : ''} pour les équipements cochés ✓.`,
      )
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Régénération impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            try {
              saveDraftQuiet({ navigateToDraft: false })
            } catch {
              /* ignore */
            }
            navigate('/app/interventions')
          }}
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> Interventions
        </button>
        {hasPdf && pdfUrl && (
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-4 py-2 text-sm font-semibold text-slate"
          >
            <Eye className="h-4 w-4" /> Voir CERFA
          </button>
        )}
      </div>

      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {isNew && !draftId ? 'Nouvelle intervention' : 'Fiche CERFA 15497-04'}
        </h1>
        <p className="mt-1 text-muted">
          Brouillon enregistré automatiquement — vous pouvez quitter et reprendre plus tard. Le PDF
          officiel se génère avec le bouton en bas.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {numeroIntervention ? (
            <p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-800">
              OT {numeroIntervention}
            </p>
          ) : null}
          {(status === 'brouillon' || draftHint) && (
            <p className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
              {draftHint || 'Brouillon'}
            </p>
          )}
        </div>
      </div>

      {savedMsg && (
        <div className="flex items-start gap-2 rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-slate">
          <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0" />
          {savedMsg}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-5">
        <Section title="[3] Chantier & équipement (auto)">
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Chantier / site *</span>
            <select
              required
              value={chantierId}
              onChange={(e) => {
                setChantierId(e.target.value)
                setEquipementId('')
              }}
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            >
              <option value="">— Choisir —</option>
              {data.chantiers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </label>
          {chantier && isMultiBatch && (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-semibold text-ink">Équipements de l’intervention</p>
              <p className="text-xs text-muted">
                Ouvrez chaque page, cochez ✓ quand tout est bon, puis régénérez l’ensemble des CERFA.
              </p>
              <ul className="space-y-1.5">
                {batchItems.map((item, idx) => {
                  const ok = markedOk.includes(item.equipementId) || item.hasPdf
                  return (
                    <li key={item.equipementId}>
                      <div
                        className={[
                          'flex items-center gap-2 rounded-xl border px-2 py-2',
                          item.isCurrent
                            ? 'border-emerald-400 bg-emerald-50'
                            : 'border-line bg-white',
                        ].join(' ')}
                      >
                        <button
                          type="button"
                          onClick={() => toggleMarkedOk(item.equipementId)}
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
                          title={ok ? 'Page OK (cochée)' : 'Marquer cette page comme OK'}
                          aria-pressed={ok}
                        >
                          {ok ? (
                            <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-600 text-white">
                              <Check className="h-4 w-4" strokeWidth={3} />
                            </span>
                          ) : (
                            <Circle className="h-8 w-8 text-slate-300" strokeWidth={1.5} />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => goToEquipPage(item.equipementId)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="block text-xs font-bold text-muted">
                            Page {idx + 1}/{batchItems.length}
                            {item.isCurrent ? ' · en cours' : ''}
                            {item.hasPdf ? ' · PDF' : ''}
                          </span>
                          <span className="block truncate text-sm font-semibold text-ink">
                            {item.label}
                          </span>
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
          {chantier && !isMultiBatch && equipementsForCerfa(chantier).length > 0 && (
            <label className="mt-3 block text-sm">
              <span className="mb-1 block text-muted">Équipement précis *</span>
              <select
                required
                value={equipementId || equipement?.id || ''}
                onChange={(e) => setEquipementId(e.target.value)}
                className="h-11 w-full rounded-xl border border-line bg-white px-3"
              >
                <option value="">— Choisir l’équipement —</option>
                {equipementsForCerfa(chantier).map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {equipmentLabel(eq)}
                    {eq.fluideType ? ` · ${eq.fluideType}` : ''}
                    {eq.numeroSerie ? ` · SN ${eq.numeroSerie}` : ''}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-muted">
                Liste des équipements déjà enregistrés sur ce site (dépannage / maintenance ciblée).
              </span>
            </label>
          )}
          {chantier && client && (
            <div className="mt-3 rounded-xl bg-accent-soft/60 p-3 text-sm text-slate">
              <div>
                <strong>Détenteur [2] :</strong> {client.raisonSociale} — {client.adresse},{' '}
                {client.codePostal} {client.ville}
              </div>
              <div className="mt-1">
                <strong>Équipement :</strong>{' '}
                {equipement
                  ? `${equipmentLabel(equipement)}${equipement.numeroSerie ? ` · SN ${equipement.numeroSerie}` : ''}`
                  : `${chantier.equipementType} · ${chantier.equipementMarque} ${chantier.equipementModele} · SN ${chantier.equipementNumeroSerie || '—'}`}
              </div>
            </div>
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Date intervention *" type="date" value={dateIntervention} onChange={setDateIntervention} required />
            <FluideSelect
              label="Fluide [7]"
              value={fluideType}
              onChange={(v) => {
                setFluideType(v)
                // Aligner le chantier sur la dénomination choisie (évite R-410A chantier vs R-32 fiche)
                if (chantier && v) {
                  const teq =
                    calcTeqCO2FromFluide(quantiteTotaleKg || chantier.chargeNominaleKg, v) ??
                    chantier.teqCO2
                  upsertChantier({ ...chantier, fluideType: v, teqCO2: teq })
                }
              }}
              required
            />
            <DecimalField
              label="Charge / quantité kg [7]"
              value={quantiteTotaleKg}
              onChange={setQuantiteTotaleKg}
              placeholder="ex. 2,2"
            />
            <DecimalField
              label="teq CO₂ [3] (auto)"
              value={teqCO2}
              onChange={setTeqCO2}
              placeholder="auto"
            />
            <p className="-mt-1 text-xs text-muted sm:col-span-2">
              Formule : charge (kg) × GWP ÷ 1000
              {findFluide(fluideType)
                ? ` → ${quantiteTotaleKg || 0} × ${findFluide(fluideType)!.gwp} / 1000`
                : ''}
            </p>
            <DecimalField
              label="Dont HFO kg [7]"
              value={quantiteHfoKg}
              onChange={setQuantiteHfoKg}
              placeholder="ex. 0,5"
            />
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={detectionPermanente}
              onChange={(e) => setDetectionPermanente(e.target.checked)}
            />
            Système permanent de détection des fuites [6]
          </label>
        </Section>

        <Section title="[1] Opérateur (auto)">
          <p className="text-sm text-muted">
            {data.operateur.raisonSociale || '—'} · Attestation {data.operateur.attestationNumero || '—'}
            {user?.role === 'owner' ? (
              <>
                {' '}
                ·{' '}
                <Link to="/app/operateur" className="font-medium text-accent">
                  Modifier (admin)
                </Link>
              </>
            ) : (
              <span className="text-xs"> — géré par l’administrateur</span>
            )}
          </p>
        </Section>

        <Section title="[4] Nature de l’intervention">
          <div className="grid gap-2 sm:grid-cols-2">
            {ALL_NATURES.map((n) => (
              <label key={n} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={natures.includes(n)}
                  onChange={() => toggleNature(n)}
                />
                {NATURE_LABELS[n]}
              </label>
            ))}
          </div>
        </Section>

        <Section title="[5] Détecteur manuel de fuite *">
          <p className="mb-3 text-sm text-muted">
            Obligatoire pour tout CERFA — identification + contrôle annuel (&lt; 1 an).
            {monDetecteur?.assigneeName || monDetecteur?.assigneeUserId === user?.id
              ? ' Prérempli depuis votre détecteur attribué.'
              : monDetecteur
                ? ' Prérempli depuis le détecteur enregistré.'
                : ' Aucun détecteur enregistré — ajoutez-en un dans « Mon entreprise ».'}
          </p>
          {!monDetecteur && (
            <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Enregistrez un détecteur avec une date de contrôle valide avant de générer le CERFA.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Identification / réf. *"
              value={detecteurIdentification}
              onChange={setDetecteurIdentification}
              required
            />
            <Field
              label="Contrôlé le (date) *"
              type="date"
              value={detecteurControleDate}
              onChange={setDetecteurControleDate}
              required
            />
          </div>
          {detecteurControleDate ? (
            <p
              className={[
                'mt-3 rounded-xl px-3 py-2 text-sm',
                detecteurExpire ? 'bg-red-50 text-danger' : 'bg-accent-soft text-slate',
              ].join(' ')}
            >
              {detecteurExpire
                ? '⚠ Contrôle détecteur expiré (> 1 an) — CERFA interdit tant que le détecteur n’est pas contrôlé.'
                : '✓ Contrôle détecteur valable (< 1 an).'}
            </p>
          ) : (
            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">
              Date de contrôle manquante — obligatoire pour générer le CERFA.
            </p>
          )}
        </Section>

        <Section title={detectionPermanente ? '[9] Avec détection permanente' : '[8] Sans détection permanente'}>
          <p
            className={[
              'mb-3 rounded-xl px-3 py-2 text-sm',
              ctrlPeriodique.obligatoire ? 'bg-amber-50 text-amber-950' : 'bg-mist text-muted',
            ].join(' ')}
          >
            {ctrlPeriodique.message}
          </p>

          {ctrlPeriodique.obligatoire ? (
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Périodicité de contrôle *</span>
              <select
                required
                value={periodiciteControle || ctrlPeriodique.periodeSuggeree || ''}
                onChange={(e) => setPeriodiciteControle(e.target.value)}
                className="h-11 w-full rounded-xl border border-line bg-white px-3"
              >
                {detectionPermanente ? (
                  <>
                    <option value="24 mois">24 mois</option>
                    <option value="12 mois">12 mois</option>
                    <option value="6 mois">6 mois</option>
                  </>
                ) : (
                  <>
                    <option value="12 mois">12 mois</option>
                    <option value="6 mois">6 mois</option>
                    <option value="3 mois">3 mois</option>
                  </>
                )}
              </select>
              <span className="mt-1 block text-xs text-muted">
                Suggestion réglementaire (colonne {ctrlPeriodique.colonne}) :{' '}
                {ctrlPeriodique.periodeSuggeree}
              </span>
            </label>
          ) : (
            <p className="text-sm text-muted">
              Aucune case de périodicité à cocher sur le CERFA pour cette charge / ce fluide.
            </p>
          )}
        </Section>

        <Section title="[10] Fuites">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={fuiteConstatee}
              onChange={(e) => setFuiteConstatee(e.target.checked)}
            />
            Fuite(s) constatée(s)
          </label>
          {fuiteConstatee && (
            <div className="mt-3 space-y-4">
              {(
                [
                  {
                    n: 1,
                    loc: fuiteDescription,
                    setLoc: setFuiteDescription,
                    rep: fuiteReparee,
                    setRep: setFuiteReparee,
                  },
                  {
                    n: 2,
                    loc: fuiteLocalisation2,
                    setLoc: setFuiteLocalisation2,
                    rep: fuite2Reparee,
                    setRep: setFuite2Reparee,
                  },
                  {
                    n: 3,
                    loc: fuiteLocalisation3,
                    setLoc: setFuiteLocalisation3,
                    rep: fuite3Reparee,
                    setRep: setFuite3Reparee,
                  },
                ] as const
              ).map((row) => (
                <div key={row.n} className="rounded-xl border border-line bg-mist/30 p-3 space-y-2">
                  <Field
                    label={`Localisation ${row.n}`}
                    value={row.loc}
                    onChange={row.setLoc}
                  />
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span className="text-muted">Réparation {row.n} :</span>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name={`fuite-rep-${row.n}`}
                        checked={row.rep === true}
                        onChange={() => row.setRep(true)}
                      />
                      Réalisée
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name={`fuite-rep-${row.n}`}
                        checked={row.rep === false}
                        onChange={() => row.setRep(false)}
                      />
                      À faire
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="[11] Manipulation fluide (depuis stock)">
          <div className="space-y-3">
            {manips.map((m, idx) => {
              const item = data.stock.find((s) => s.id === m.stockItemId)
              // Ne proposer que les bouteilles du bon gaz, pas déjà prises sur une autre ligne
              const dejaPrises = new Set(
                manips
                  .filter((x) => x.key !== m.key && x.stockItemId)
                  .map((x) => x.stockItemId),
              )
              const optionsDispo = stockMatchingFluide.filter(
                (s) => s.id === m.stockItemId || !dejaPrises.has(s.id),
              )
              const qtyRestante = item ? Number(item.quantiteKg) || 0 : 0
              const autorises = item ? sensAutorisesCerfa(item.contenantType) : []
              const fillMode =
                !!item &&
                (item.contenantType === 'recuperation' ||
                  (isContenantDestination(item.contenantType) && qtyRestante <= 0) ||
                  m.sens === 'entree')
              const resteCap = item ? capaciteRestanteKg(item) : null
              const jauge = item ? jaugeRemplissageRecup(item) : null
              return (
                <div
                  key={m.key}
                  className="rounded-xl border border-line bg-white p-3 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-muted">
                      Bouteille {bottleLetter(idx)}
                    </span>
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-danger hover:bg-red-50"
                      title="Retirer cette bouteille"
                      onClick={() => setManips((prev) => prev.filter((x) => x.key !== m.key))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <LabelHint label="Contenant / bouteille" tip={TIP_BOUTEILLE}>
                    <select
                      value={m.stockItemId}
                      onChange={(e) => updateManip(m.key, { stockItemId: e.target.value })}
                      className="h-11 w-full rounded-xl border border-line bg-white px-3"
                    >
                      <option value="">— Choisir —</option>
                      {optionsDispo.map((s) => {
                        const q = Number(s.quantiteKg) || 0
                        const videDest = q <= 0 && bouteilleVisibleCerfaMemeVide(s.contenantType)
                        return (
                          <option key={s.id} value={s.id} disabled={!s.numeroContenant?.trim()}>
                            {s.fluide} · {CONTENANT_TYPE_LABELS[s.contenantType] || s.contenantType}{' '}
                            · {s.numeroContenant || 'SANS N°'} —{' '}
                            {videDest ? 'vide (à remplir)' : `reste ${s.quantiteKg} kg`}
                            {s.quantiteInitialeKg != null && q > 0
                              ? ` / ${s.quantiteInitialeKg} kg`
                              : ''}
                          </option>
                        )
                      })}
                    </select>
                  </LabelHint>
                  {item && (
                    <p className="text-[11px] leading-snug text-muted">
                      {resumeRegleContenant(item.contenantType)}
                    </p>
                  )}
                  {jauge && <RecupJaugeBanner item={item!} />}
                  {item && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm">
                        <span className="mb-1 block text-muted">Type de mouvement *</span>
                        <select
                          value={autorises.includes(m.sens) ? m.sens : autorises[0]}
                          onChange={(e) =>
                            updateManip(m.key, { sens: e.target.value as StockMouvementSens })
                          }
                          className="h-11 w-full rounded-xl border border-line bg-white px-3"
                        >
                          {autorises.includes('entree') && (
                            <option value="entree">
                              Remplir depuis l’installation (→ + kg)
                            </option>
                          )}
                          {autorises.includes('sortie') && (
                            <option value="sortie">
                              {item.contenantType === 'vierge'
                                ? 'Utiliser / charge (sortie → − kg)'
                                : 'Réinjecter / retirer (sortie → − kg)'}
                            </option>
                          )}
                        </select>
                      </label>
                      <DecimalField
                        label={
                          m.sens === 'sortie'
                            ? `Quantité sortie (kg) * — max ${item.quantiteKg}`
                            : resteCap != null
                              ? `Quantité récupérée (kg) * — max ${resteCap} (cumul multi-sites)`
                              : 'Quantité récupérée / ajoutée (kg) *'
                        }
                        value={m.quantiteKg}
                        onChange={(n) => updateManip(m.key, { quantiteKg: n, poidsBrutKg: undefined })}
                        placeholder="ex. 2,2"
                        emptyZero
                      />
                    </div>
                  )}
                  {item && m.sens === 'entree' && Number(item.tareKg) > 0 && (
                    <div className="rounded-xl border border-line bg-mist/50 p-3">
                      <p className="mb-2 text-xs font-semibold text-ink">
                        Calculateur balance (brut − tare {item.tareKg} kg)
                      </p>
                      <DecimalField
                        label="Poids lu sur la balance (brut, kg)"
                        value={m.poidsBrutKg ?? 0}
                        onChange={(n) => updateManip(m.key, { poidsBrutKg: n })}
                        placeholder="ex. 12,4"
                        emptyZero
                      />
                      <p className="mt-1 text-xs text-muted">
                        Quantité fluide calculée :{' '}
                        <strong>
                          {quantiteDepuisPesee(m.poidsBrutKg ?? 0, item.tareKg || 0)} kg
                        </strong>
                      </p>
                    </div>
                  )}
                  {item?.contenantType === 'recuperation' && m.sens === 'entree' && (
                    <label className="block text-sm">
                      <span className="mb-1 block text-muted">Type d’huile de l’équipement</span>
                      <select
                        value={m.typeHuile || item.typeHuile || 'inconnu'}
                        onChange={(e) =>
                          updateManip(m.key, { typeHuile: e.target.value as TypeHuile })
                        }
                        className="h-11 w-full rounded-xl border border-line bg-white px-3"
                      >
                        {(Object.keys(TYPE_HUILE_LABELS) as TypeHuile[]).map((k) => (
                          <option key={k} value={k}>
                            {TYPE_HUILE_LABELS[k]}
                          </option>
                        ))}
                      </select>
                      {item.typeHuile &&
                        item.typeHuile !== 'inconnu' &&
                        m.typeHuile &&
                        m.typeHuile !== 'inconnu' &&
                        item.typeHuile !== m.typeHuile && (
                          <p className="mt-1 text-xs font-semibold text-danger">
                            Attention : bouteille déjà en {item.typeHuile} — mélange avec{' '}
                            {m.typeHuile} interdit (recyclage).
                          </p>
                        )}
                    </label>
                  )}
                  {item && isBouteilleReepreuveExpiree(item) && (
                    <p className="text-xs font-semibold text-danger">
                      Rééprouvage dépassé ({item.dateReepreuvage}) — usage interdit jusqu’au contrôle.
                    </p>
                  )}
                  {item && !item.numeroContenant?.trim() && (
                    <p className="text-xs text-danger">
                      Cette ligne de stock n’a pas de n° de bouteille — corrigez-la dans Stock
                      fluides.
                    </p>
                  )}
                  {item?.contenantType === 'recuperation' && (
                    <p className="text-xs text-amber-900">
                      Accumulation autorisée sur plusieurs sites (même fluide {item.fluide} uniquement).
                      Chaque site = un CERFA avec le n° {item.numeroContenant}. Pas de réinjection —
                      à pleine capacité : BSFF / retour distributeur.
                    </p>
                  )}
                  {item?.contenantType === 'recuperation' &&
                    isFluideInflammableA2LOrA3(item.fluide) && (
                      <div className="space-y-2">
                        <A2lRecupAlert fluide={item.fluide} />
                        {!item.conformeA2LA3 && (
                          <p className="text-xs font-semibold text-danger">
                            Conformité A2L/A3 non cochée en Stock — ouvrez la bouteille et validez
                            avant d’enregistrer le CERFA.
                          </p>
                        )}
                      </div>
                    )}
                  {item && fillMode && m.sens === 'entree' && item.contenantType !== 'recuperation' && (
                    <p className="text-xs text-muted">
                      Vidange : le fluide quitte l’installation et remplit cette bouteille (
                      {CONTENANT_TYPE_LABELS[item.contenantType]}).
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => setManips((prev) => [...prev, newManipLine()])}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm font-semibold text-slate hover:bg-mist"
          >
            <Plus className="h-4 w-4" />
            Ajouter une bouteille
          </button>

          {manips.length === 0 && bottleRequired && (
            <p className="mt-2 rounded-xl bg-accent-soft/70 px-3 py-2 text-xs text-slate">
              {naturesPermettentRemplissageRecup(natures) ? (
                <>
                  Récupération / démantèlement : ajoutez une bouteille{' '}
                  <strong>Récupération (déchet)</strong> ou <strong>Recyclé</strong> (même
                  détenteur). Le fluide usagé ne peut pas servir à charger un autre client.
                </>
              ) : (
                <>
                  Charge / appoint : utilisez une bouteille <strong>Vierge</strong> ou{' '}
                  <strong>régénérée usine</strong>. Les bouteilles de récupération (déchet) sont
                  bloquées ici.
                </>
              )}
            </p>
          )}

          {!denominationFluide && (
            <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              Renseignez d’abord le <strong>fluide [7]</strong> : sans dénomination, aucune
              bouteille ne peut être proposée.
            </p>
          )}

          {denominationFluide && stockMatchingFluide.length === 0 && (
            <div className="mt-2 space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              <p>
                Aucune bouteille utilisable pour <strong>{denominationFluide}</strong>.
                {naturesPermettentRemplissageRecup(natures) ? (
                  <>
                    {' '}
                    Pour vider l’installation : bouteille <strong>Récupération (déchet)</strong> ou{' '}
                    <strong>Recyclé</strong> (même détenteur), fluide {denominationFluide}.
                  </>
                ) : (
                  <>
                    {' '}
                    Pour une charge : bouteille <strong>Vierge</strong> ou régénérée (pas une
                    récupération déchet).
                  </>
                )}
              </p>
              {emptyViergeSameFluide.length > 0 && (
                <p>
                  {emptyViergeSameFluide.length} bouteille(s) « Vierge » à 0 kg existent — elles
                  ne servent pas à la vidange. Passez-les en Récupération / Recyclé / Transfert
                  dans Stock, ou créez une nouvelle destination.
                </p>
              )}
              {destinationWrongFluide.length > 0 && (
                <p>
                  Bouteille(s) destination trouvées mais autre fluide :{' '}
                  {destinationWrongFluide
                    .slice(0, 3)
                    .map((s) => `${s.numeroContenant || '?'} (${s.fluide} · ${CONTENANT_TYPE_LABELS[s.contenantType]})`)
                    .join(', ')}
                  . Alignez le fluide CERFA ou créez une bouteille {denominationFluide}.
                </p>
              )}
              <Link
                to={stockCreateRecupHref}
                className="inline-flex font-semibold text-accent underline-offset-2 hover:underline"
              >
                Créer une bouteille de récupération {denominationFluide} →
              </Link>
            </div>
          )}

          {denominationFluide && stockMatchingFluide.length > 0 && manips.some((m) => !m.stockItemId) && (
            <p className="mt-2 text-xs text-muted">
              {naturesPermettentRemplissageRecup(natures)
                ? 'Vidange : bouteille « Récupération » → Remplir (jamais de réinjection). Recyclé = même client uniquement.'
                : 'Charge : bouteille Vierge ou régénérée usine. Récupération déchet absente de cette liste (F-Gas).'}
            </p>
          )}
        </Section>

        <Section title="[12] / [13] Déchets & destination">
          <div className="grid gap-3 sm:grid-cols-2">
            <LabelHint label="Code UN (auto)" tip={TIP_UN}>
              <input
                value={codeUn}
                readOnly
                placeholder={denominationFluide ? 'Non trouvé pour ce fluide' : 'Choisir le fluide [7]'}
                className="h-11 w-full rounded-xl border border-line bg-mist/60 px-3 text-ink"
                aria-readonly="true"
              />
            </LabelHint>
            <LabelHint label="Dénomination ADR/RID (auto)" tip={TIP_ADR}>
              <input
                value={denominationAdr}
                readOnly
                placeholder={denominationFluide ? 'Non trouvé pour ce fluide' : 'Choisir le fluide [7]'}
                className="h-11 w-full rounded-xl border border-line bg-mist/60 px-3 text-ink"
                aria-readonly="true"
              />
            </LabelHint>
            {denominationFluide && !adrAuto && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 sm:col-span-2">
                Pas de code UN / ADR connu pour <strong>{denominationFluide}</strong>. Vérifiez le
                fluide [7] ou contactez le support ClimaZEN pour l’ajouter.
              </p>
            )}
            {adrAuto && (
              <p className="text-xs text-muted sm:col-span-2">
                Rempli automatiquement depuis le fluide <strong>{denominationFluide}</strong> —
                changez [7] pour mettre à jour.
              </p>
            )}
            <LabelHint
              label="Installation de destination [13]"
              tip={TIP_DESTINATION}
              className="sm:col-span-2"
            >
              <select
                value={destinationSelectValue}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === DESTINATION_AUTRE_VALUE) {
                    if (!isDestinationLibre(installationDestination, destinationsOptions)) {
                      setInstallationDestination('')
                    }
                    return
                  }
                  setInstallationDestination(v)
                }}
                className="h-11 w-full rounded-xl border border-line bg-white px-3"
              >
                <option value="">— Choisir un distributeur / dépôt —</option>
                {destinationsOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
                <option value={DESTINATION_AUTRE_VALUE}>Autre (texte libre)…</option>
              </select>
              {destinationSelectValue === DESTINATION_AUTRE_VALUE && (
                <input
                  value={installationDestination}
                  onChange={(e) => setInstallationDestination(e.target.value)}
                  placeholder="ex. Nom du centre, adresse, filière…"
                  className="mt-2 h-11 w-full rounded-xl border border-line bg-white px-3"
                  autoFocus
                />
              )}
            </LabelHint>
          </div>
        </Section>

        <Section title="[14] Observations & signatures">
          <Field label="Observations" value={observations} onChange={setObservations} />

          <div className="mt-5 space-y-5">
            <IntervenantSignature
              label="Signature intervenant *"
              nom={signatureOperateur}
              qualite={signatureOperateurQualite}
              image={signatureOperateurImage}
              onNomChange={setSignatureOperateur}
              onQualiteChange={setSignatureOperateurQualite}
              onImageChange={setSignatureOperateurImage}
              height={150}
            />

            <ClientSiteSignature
              siteId={chantierId || undefined}
              nom={signatureDetenteur}
              qualite={signatureDetenteurQualite}
              image={signatureDetenteurImage}
              onNomChange={setSignatureDetenteur}
              onQualiteChange={setSignatureDetenteurQualite}
              onImageChange={setSignatureDetenteurImage}
              height={180}
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-muted">N° OT (ordre de travail)</span>
              <input
                value={numeroIntervention}
                onChange={(e) => setNumeroIntervention(e.target.value)}
                className="h-11 w-full rounded-xl border border-line bg-white px-3 font-semibold tracking-wide"
                placeholder="OT20260001"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Statut</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CerfaDraft['status'])}
                className="h-11 w-full rounded-xl border border-line bg-white px-3"
              >
                <option value="brouillon">Brouillon</option>
                <option value="signe">Signé</option>
                <option value="envoye">Envoyé</option>
              </select>
            </label>
          </div>
        </Section>

        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              disabled={busy || !chantierId}
              onClick={() => {
                try {
                  const id = saveDraftQuiet({ navigateToDraft: true })
                  if (id) {
                    setSavedMsg('Brouillon enregistré — vous pouvez quitter et reprendre cette fiche.')
                  } else {
                    alert('Choisissez d’abord un site / chantier pour enregistrer le brouillon.')
                  }
                } catch (err) {
                  alert(err instanceof Error ? err.message : 'Erreur brouillon')
                }
              }}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-line bg-white px-6 py-3 text-sm font-bold text-ink hover:bg-mist disabled:opacity-60 sm:w-auto"
            >
              <Save className="h-4 w-4" />
              Enregistrer brouillon
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-bold text-ink hover:bg-accent-hover disabled:opacity-60 sm:w-auto"
            >
              <Save className="h-4 w-4" />
              {busy
                ? 'Génération…'
                : hasPdf
                  ? 'Régénérer ce CERFA'
                  : 'Enregistrer & générer ce CERFA'}
            </button>
            {isMultiBatch && (
              <button
                type="button"
                disabled={busy || !chantierId}
                onClick={() => void regenerateAllCerfas()}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-emerald-600 bg-emerald-50 px-6 py-3 text-sm font-bold text-emerald-950 hover:bg-emerald-100 disabled:opacity-60 sm:w-auto"
              >
                <FileCheck2 className="h-4 w-4" />
                {busy
                  ? 'Régénération…'
                  : `Régénérer l’ensemble (${Math.max(markedOk.length, batchItems.filter((b) => b.hasPdf).length) || batchItems.length} CERFA)`}
              </button>
            )}
          </div>
          <p className="text-xs text-muted">
            {isMultiBatch
              ? 'Cochez ✓ sur chaque page équipement quand elle est bonne, puis « Régénérer l’ensemble ». Le brouillon se sauve aussi tout seul.'
              : 'Le brouillon se sauve aussi tout seul pendant la saisie. Pour le PDF officiel et le stock bouteilles, utilisez « Enregistrer & générer le CERFA ».'}
          </p>
        </div>
      </form>

      {pdfUrl && (
        <section className="space-y-3 rounded-2xl border border-line bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">CERFA enregistré dans l’app</h2>
            <button
              type="button"
              onClick={() => setFullscreen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm font-medium"
            >
              <Eye className="h-4 w-4" /> Agrandir
            </button>
          </div>
          <iframe title="CERFA 15497-04" src={pdfUrl} className="h-[70vh] w-full rounded-xl border border-line bg-mist" />
        </section>
      )}

      {fullscreen && pdfUrl && (
        <PdfViewerModal url={pdfUrl} title="CERFA 15497-04" onClose={() => setFullscreen(false)} />
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h2 className="font-display mb-3 text-base font-semibold text-slate">{title}</h2>
      {children}
    </section>
  )
}
