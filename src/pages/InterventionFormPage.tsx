import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Eye, FileCheck2, Plus, Save, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import {
  NATURE_LABELS,
  isBouteilleRetournee,
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
import { SignaturePad } from '../components/SignaturePad'
import { FluideSelect } from '../components/FluideSelect'
import { DecimalField } from '../components/DecimalField'
import { LabelHint } from '../components/LabelHint'
import { calcTeqCO2FromFluide, controlesPeriodiquesInfo, findFluide, sameFluideCode } from '../lib/fluides'
import { bottleLetter, roundKg } from '../lib/decimal'
import { TIP_ADR, TIP_BOUTEILLE, TIP_UN } from '../lib/fieldTips'

const ALL_NATURES = Object.keys(NATURE_LABELS) as NatureIntervention[]

const CERFA_STEPS = [
  { id: 'chantier', label: 'Chantier' },
  { id: 'nature', label: 'Nature' },
  { id: 'controles', label: 'Contrôles' },
  { id: 'fluide', label: 'Fluide' },
  { id: 'signatures', label: 'Signatures' },
] as const

function today() {
  return new Date().toISOString().slice(0, 10)
}

type ManipDraft = {
  key: string
  stockItemId: string
  quantiteKg: number
  sens: StockMouvementSens
}

function newManipLine(sens: StockMouvementSens = 'sortie'): ManipDraft {
  return {
    key: crypto.randomUUID(),
    stockItemId: '',
    quantiteKg: 0,
    sens,
  }
}

export function InterventionFormPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const { data, saveInterventionWithStock, upsertChantier } = useStore()
  const { user } = useAuth()

  const existing = useMemo(
    () => (isNew ? null : data.interventions.find((x) => x.id === id) || null),
    [data.interventions, id, isNew],
  )

  const chantierFromQuery = searchParams.get('chantier') || ''
  const chantierQueryOk = data.chantiers.some((c) => c.id === chantierFromQuery)

  const defaultSignNom =
    user?.signataireNom || user?.fullName || data.operateur.signataireNom || data.operateur.raisonSociale || ''
  const defaultSignQualite =
    user?.signataireQualite || data.operateur.signataireQualite || 'Opérateur attesté'
  const defaultSignImage = user?.signatureImage || data.operateur.signatureImage || ''

  const [chantierId, setChantierId] = useState(
    existing?.chantierId ||
      (chantierQueryOk ? chantierFromQuery : '') ||
      data.chantiers[0]?.id ||
      '',
  )
  const [natures, setNatures] = useState<NatureIntervention[]>(
    existing?.natures || ['entretien_reparation'],
  )
  const [dateIntervention, setDateIntervention] = useState(existing?.dateIntervention || today())
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
    existing?.detecteurIdentification || data.operateur.detecteurIdentification || '',
  )
  const [detecteurControleDate, setDetecteurControleDate] = useState(
    existing?.detecteurControleDate || data.operateur.detecteurControleDate || '',
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
    existing?.signatureDetenteurQualite || 'Détenteur',
  )
  const [signatureOperateurImage, setSignatureOperateurImage] = useState(
    existing?.signatureOperateurImage || defaultSignImage,
  )
  const [signatureDetenteurImage, setSignatureDetenteurImage] = useState(
    existing?.signatureDetenteurImage || '',
  )
  const [status, setStatus] = useState<CerfaDraft['status']>(existing?.status || 'brouillon')
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState(0)
  const [savedMsg, setSavedMsg] = useState('')
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [hasPdf, setHasPdf] = useState(!!existing?.hasCerfaPdf)
  const [fullscreen, setFullscreen] = useState(false)

  const chantier = data.chantiers.find((c) => c.id === chantierId)
  const client = data.clients.find((c) => c.id === chantier?.clientId)
  const detecteurExpire = isDetecteurControleExpire(detecteurControleDate)
  /** Dénomination fluide de la fiche CERFA (pas l’ancien gaz du chantier) */
  const denominationFluide = (fluideType || '').trim()
  const manipQtyTotal = manips.reduce((s, m) => s + (Number(m.quantiteKg) || 0), 0)
  const firstStockId = manips.find((m) => m.stockItemId)?.stockItemId || ''
  const stockMatchingFluide = useMemo(() => {
    if (!denominationFluide) return []
    return data.stock.filter(
      (s) =>
        sameFluideCode(s.fluide, denominationFluide) &&
        !isBouteilleRetournee(s) &&
        ((Number(s.quantiteKg) || 0) > 0 || s.contenantType === 'recuperation'),
    )
  }, [data.stock, denominationFluide])

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

  useEffect(() => {
    if (!chantier || existing) return
    setDetectionPermanente(chantier.detectionPermanente)
    setFluideType(chantier.fluideType)
    setQuantiteTotaleKg(chantier.chargeNominaleKg)
    if (chantier.teqCO2) setTeqCO2(chantier.teqCO2)
  }, [chantierId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Préremplir UN / ADR depuis la 1ʳᵉ bouteille choisie
  useEffect(() => {
    if (existing) return
    const first = manips.find((m) => m.stockItemId)
    if (!first) return
    const item = data.stock.find((s) => s.id === first.stockItemId)
    if (!item) return
    if (item.codeUn) setCodeUn(item.codeUn)
    if (item.denominationAdr) setDenominationAdr(item.denominationAdr)
  }, [firstStockId]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Préremplir nom détenteur depuis le client du chantier
  useEffect(() => {
    if (!client || existing?.signatureDetenteur) return
    setSignatureDetenteur(client.nomContact || client.raisonSociale)
  }, [client?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const needsDetecteur =
    natures.includes('controle_etancheite_periodique') ||
    natures.includes('controle_etancheite_non_periodique')

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
            next.sens = sensMouvementPourContenant(item.contenantType)
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

  const buildDraft = (): Omit<CerfaDraft, 'id' | 'createdAt' | 'updatedAt'> & { id?: string } => {
    const manipulations = manips
      .map((m) => {
        const item = data.stock.find((s) => s.id === m.stockItemId)
        if (!item || !(m.quantiteKg > 0)) return null
        return {
          type: item.contenantType as ContenantType,
          stockItemId: item.id,
          quantiteKg: roundKg(m.quantiteKg),
          numeroContenant: item.numeroContenant,
          bsffReference: item.bsffReference,
          sens: m.sens,
        }
      })
      .filter((x): x is NonNullable<typeof x> => !!x)

    return {
      id: existing?.id,
      clientId: client?.id || '',
      chantierId,
      dateIntervention,
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

  const persistInApp = async () => {
    if (!client || !chantier) throw new Error('Choisissez un chantier lié à un client.')
    if (!fluideType.trim()) {
      throw new Error('Indiquez la dénomination du fluide (cadre [7]).')
    }

    // Toujours aligner le chantier sur le fluide de la fiche avant contrôle bouteilles
    if (!sameFluideCode(chantier.fluideType, fluideType)) {
      const teq =
        calcTeqCO2FromFluide(quantiteTotaleKg || chantier.chargeNominaleKg, fluideType) ??
        chantier.teqCO2
      upsertChantier({ ...chantier, fluideType, teqCO2: teq })
    }

    if (needsDetecteur && !detecteurIdentification) {
      throw new Error('Cadre [5] : identification (réf.) du détecteur manquante.')
    }
    if (needsDetecteur && !detecteurControleDate) {
      throw new Error('Cadre [5] : date de contrôle du détecteur manquante.')
    }
    if (needsDetecteur && detecteurExpire) {
      const ok = confirm('Contrôle détecteur > 1 an. Continuer ?')
      if (!ok) throw new Error('Enregistrement annulé.')
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
    }

    const draft = buildDraft()
    const fileName = `CERFA-15497-04-${dateIntervention}.pdf`
    const previewId = draft.id || crypto.randomUUID()
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
      if (isNew) navigate(`/app/interventions/${savedId}`, { replace: true })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur enregistrement')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/app/interventions" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Interventions
        </Link>
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
          {isNew ? 'Nouvelle intervention' : 'Fiche CERFA 15497-04'}
        </h1>
        <p className="mt-1 text-muted">
          L’enregistrement reste <strong>dans ClimaZEN</strong> (avec le PDF officiel). Rien n’est
          envoyé dans le dossier Téléchargements.
        </p>
      </div>

      {savedMsg && (
        <div className="flex items-start gap-2 rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-slate">
          <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0" />
          {savedMsg}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="rounded-2xl border border-line bg-white p-3 sm:p-4">
          <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted">
            <span>
              Étape {step + 1} / {CERFA_STEPS.length}
            </span>
            <span className="font-medium text-slate">{CERFA_STEPS[step]?.label}</span>
          </div>
          <div className="flex gap-1">
            {CERFA_STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(i)}
                className={[
                  'h-1.5 flex-1 rounded-full transition-colors',
                  i <= step ? 'bg-accent' : 'bg-mist',
                ].join(' ')}
                aria-label={s.label}
              />
            ))}
          </div>
          <div className="mt-3 hidden flex-wrap gap-1 sm:flex">
            {CERFA_STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(i)}
                className={[
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  i === step
                    ? 'bg-accent text-ink'
                    : i < step
                      ? 'bg-accent-soft text-slate'
                      : 'bg-mist text-muted',
                ].join(' ')}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className={step === 0 ? 'space-y-5' : 'hidden'}>
        <Section title="[3] Chantier & équipement (auto)">
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Chantier *</span>
            <select
              required
              value={chantierId}
              onChange={(e) => setChantierId(e.target.value)}
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
          {chantier && client && (
            <div className="mt-3 rounded-xl bg-accent-soft/60 p-3 text-sm text-slate">
              <div>
                <strong>Détenteur [2] :</strong> {client.raisonSociale} — {client.adresse},{' '}
                {client.codePostal} {client.ville}
              </div>
              <div className="mt-1">
                <strong>Équipement :</strong> {chantier.equipementType} · {chantier.equipementMarque}{' '}
                {chantier.equipementModele} · SN {chantier.equipementNumeroSerie || '—'}
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
            {data.operateur.raisonSociale || '—'} · Attestation {data.operateur.attestationNumero || '—'}{' '}
            ·{' '}
            <Link to="/app/operateur" className="font-medium text-accent">
              Modifier
            </Link>
          </p>
        </Section>
        </div>

        <div className={step === 1 ? 'space-y-5' : 'hidden'}>
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

        {(needsDetecteur || detecteurIdentification) && (
          <Section title="[5] Détecteur manuel de fuite">
            <p className="mb-3 text-sm text-muted">
              Identification (réf.) + date de contrôle — contrôle <strong>chaque année</strong>.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Identification / réf. *"
                value={detecteurIdentification}
                onChange={setDetecteurIdentification}
                required={needsDetecteur}
              />
              <Field
                label="Contrôlé le (date) *"
                type="date"
                value={detecteurControleDate}
                onChange={setDetecteurControleDate}
                required={needsDetecteur}
              />
            </div>
            {detecteurControleDate && (
              <p
                className={[
                  'mt-3 rounded-xl px-3 py-2 text-sm',
                  detecteurExpire ? 'bg-red-50 text-danger' : 'bg-accent-soft text-slate',
                ].join(' ')}
              >
                {detecteurExpire
                  ? '⚠ Contrôle détecteur expiré (> 1 an).'
                  : '✓ Contrôle détecteur valable (< 1 an).'}
              </p>
            )}
          </Section>
        )}
        </div>

        <div className={step === 2 ? 'space-y-5' : 'hidden'}>
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
        </div>

        <div className={step === 3 ? 'space-y-5' : 'hidden'}>
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
                      {optionsDispo.map((s) => (
                        <option key={s.id} value={s.id} disabled={!s.numeroContenant?.trim()}>
                          {s.fluide} · {s.contenantType} · {s.numeroContenant || 'SANS N°'} — reste{' '}
                          {s.quantiteKg} kg
                          {s.quantiteInitialeKg != null ? ` / ${s.quantiteInitialeKg} kg` : ''}
                        </option>
                      ))}
                    </select>
                  </LabelHint>
                  {item && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm">
                        <span className="mb-1 block text-muted">Type de mouvement *</span>
                        <select
                          value={m.sens}
                          onChange={(e) =>
                            updateManip(m.key, { sens: e.target.value as StockMouvementSens })
                          }
                          className="h-11 w-full rounded-xl border border-line bg-white px-3"
                        >
                          {item.contenantType === 'recuperation' ? (
                            <>
                              <option value="entree">Ajouter (récupération → + kg)</option>
                              <option value="sortie">Retirer (vidage / transfert → − kg)</option>
                            </>
                          ) : (
                            <>
                              <option value="sortie">Utiliser / charge (sortie → − kg)</option>
                              <option value="entree">Réintégrer (entrée → + kg)</option>
                            </>
                          )}
                        </select>
                      </label>
                      <DecimalField
                        label={
                          m.sens === 'sortie'
                            ? `Quantité sortie (kg) * — max ${item.quantiteKg}`
                            : 'Quantité ajoutée (kg) *'
                        }
                        value={m.quantiteKg}
                        onChange={(n) => updateManip(m.key, { quantiteKg: n })}
                        placeholder="ex. 2,2"
                        emptyZero
                      />
                    </div>
                  )}
                  {item && !item.numeroContenant?.trim() && (
                    <p className="text-xs text-danger">
                      Cette ligne de stock n’a pas de n° de bouteille — corrigez-la dans Stock
                      fluides.
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
              Cliquez « Ajouter une bouteille » — le reste et le CERFA seront liés
              automatiquement.
            </p>
          )}
        </Section>

        <Section title="[12] / [13] Déchets & destination">
          <div className="grid gap-3 sm:grid-cols-2">
            <LabelHint label="Code UN" tip={TIP_UN}>
              <input
                value={codeUn}
                onChange={(e) => setCodeUn(e.target.value)}
                placeholder="ex. 3163"
                className="h-11 w-full rounded-xl border border-line bg-white px-3"
              />
            </LabelHint>
            <LabelHint label="Dénomination ADR/RID" tip={TIP_ADR}>
              <input
                value={denominationAdr}
                onChange={(e) => setDenominationAdr(e.target.value)}
                placeholder="ex. UN 3163 Gaz liquéfié, n.s.a. (R-410A)"
                className="h-11 w-full rounded-xl border border-line bg-white px-3"
              />
            </LabelHint>
            <Field
              label="Installation de destination [13]"
              value={installationDestination}
              onChange={setInstallationDestination}
              className="sm:col-span-2"
            />
          </div>
        </Section>
        </div>

        <div className={step === 4 ? 'space-y-5' : 'hidden'}>
        <Section title="[14] Observations & signatures">
          <Field label="Observations" value={observations} onChange={setObservations} />

          <div className="mt-5 space-y-5">
            <div className="rounded-xl border border-line bg-mist/40 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-sm font-semibold">Signature opérateur</h3>
                <Link to="/app/operateur" className="text-xs font-medium text-accent hover:underline">
                  Enregistrer ma signature dans Mon entreprise
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nom" value={signatureOperateur} onChange={setSignatureOperateur} />
                <Field
                  label="Qualité"
                  value={signatureOperateurQualite}
                  onChange={setSignatureOperateurQualite}
                />
              </div>
              <div className="mt-3">
                <SignaturePad
                  label="Signature (auto depuis Mon entreprise — modifiable)"
                  value={signatureOperateurImage}
                  onChange={setSignatureOperateurImage}
                  height={150}
                />
              </div>
            </div>

            <div className="rounded-xl border border-accent/30 bg-accent-soft/40 p-4">
              <h3 className="font-display mb-1 text-sm font-semibold">Signature détenteur</h3>
              <p className="mb-3 text-xs text-muted">
                Le client signe au doigt sur le téléphone / tablette.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nom" value={signatureDetenteur} onChange={setSignatureDetenteur} />
                <Field
                  label="Qualité"
                  value={signatureDetenteurQualite}
                  onChange={setSignatureDetenteurQualite}
                />
              </div>
              <div className="mt-3">
                <SignaturePad
                  label="Signature détenteur (tactile)"
                  value={signatureDetenteurImage}
                  onChange={setSignatureDetenteurImage}
                  height={180}
                  hint="Faites signer le détenteur ici."
                />
              </div>
            </div>
          </div>

          <label className="mt-4 block text-sm">
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
        </Section>

        {step === 4 && (
          <>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-bold text-ink hover:bg-accent-hover disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {busy
                ? 'Génération…'
                : hasPdf
                  ? 'Régénérer le CERFA'
                  : 'Enregistrer & générer le CERFA'}
            </button>
            <p className="text-xs text-muted">
              En fin de travaux : vérifiez les signatures, puis appuyez ici pour (re)générer le PDF
              officiel dans ClimaZEN.
            </p>
          </>
        )}
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" /> Précédent
          </button>
          {step < CERFA_STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(CERFA_STEPS.length - 1, s + 1))}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-ink hover:bg-accent-hover"
            >
              Suivant <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <span className="text-xs text-muted">Dernière étape — générez le CERFA</span>
          )}
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
