import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Eye, FileCheck2, Save } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import {
  NATURE_LABELS,
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
import { calcTeqCO2FromFluide, controlesPeriodiquesInfo, findFluide } from '../lib/fluides'
import { TIP_ADR, TIP_BOUTEILLE, TIP_UN } from '../lib/fieldTips'

const ALL_NATURES = Object.keys(NATURE_LABELS) as NatureIntervention[]

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function InterventionFormPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const { data, saveInterventionWithStock } = useStore()
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
  const [fuiteReparee, setFuiteReparee] = useState(existing?.fuiteReparee || false)
  const [fuiteLocalisation2, setFuiteLocalisation2] = useState(existing?.fuiteLocalisation2 || '')
  const [fuiteLocalisation3, setFuiteLocalisation3] = useState(existing?.fuiteLocalisation3 || '')
  const [detecteurIdentification, setDetecteurIdentification] = useState(
    existing?.detecteurIdentification || data.operateur.detecteurIdentification || '',
  )
  const [detecteurControleDate, setDetecteurControleDate] = useState(
    existing?.detecteurControleDate || data.operateur.detecteurControleDate || '',
  )
  const [stockItemId, setStockItemId] = useState(existing?.manipulations[0]?.stockItemId || '')
  const [manipQty, setManipQty] = useState(existing?.manipulations[0]?.quantiteKg ?? 0)
  const [manipSens, setManipSens] = useState<StockMouvementSens>(
    existing?.manipulations[0]?.sens ||
      (existing?.manipulations[0]?.type === 'recuperation' ? 'entree' : 'sortie'),
  )
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
  const [savedMsg, setSavedMsg] = useState('')
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [hasPdf, setHasPdf] = useState(!!existing?.hasCerfaPdf)
  const [fullscreen, setFullscreen] = useState(false)

  const chantier = data.chantiers.find((c) => c.id === chantierId)
  const client = data.clients.find((c) => c.id === chantier?.clientId)
  const stockItem = data.stock.find((s) => s.id === stockItemId)
  const detecteurExpire = isDetecteurControleExpire(detecteurControleDate)

  // Charger le CERFA déjà enregistré dans l’app
  useEffect(() => {
    let revoked: string | null = null
    const interventionId = existing?.id
    if (!interventionId) return
    void loadCerfaPdf(interventionId).then((pdf) => {
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
  }, [existing?.id, existing?.cerfaPdfSavedAt])

  useEffect(() => {
    if (!chantier || existing) return
    setDetectionPermanente(chantier.detectionPermanente)
    setFluideType(chantier.fluideType)
    setQuantiteTotaleKg(chantier.chargeNominaleKg)
    if (chantier.teqCO2) setTeqCO2(chantier.teqCO2)
  }, [chantierId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!stockItem) return
    const def = sensMouvementPourContenant(stockItem.contenantType)
    if (!existing?.manipulations[0]?.sens) setManipSens(def)
    if (def === 'sortie' && !existing) {
      setManipQty((q) => Math.min(stockItem.quantiteKg, q || 0.5))
    }
    if (stockItem.codeUn && !existing) setCodeUn(stockItem.codeUn)
    if (stockItem.denominationAdr && !existing) {
      setDenominationAdr(stockItem.denominationAdr)
    }
  }, [stockItemId]) // eslint-disable-line react-hooks/exhaustive-deps

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
    manipQty,
    stockItemId: stockItemId || undefined,
  })

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
    const manipulations =
      stockItem && manipQty > 0
        ? [
            {
              type: stockItem.contenantType as ContenantType,
              stockItemId: stockItem.id,
              quantiteKg: manipQty,
              numeroContenant: stockItem.numeroContenant,
              bsffReference: stockItem.bsffReference,
              sens: manipSens,
            },
          ]
        : existing?.manipulations || []

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
      fuiteReparee,
      fuiteLocalisation2: fuiteLocalisation2 || undefined,
      fuiteLocalisation3: fuiteLocalisation3 || undefined,
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
      manipQty,
      stockItemId: stockItemId || undefined,
    })
    if (requireBottle) {
      if (!stockItem) {
        throw new Error(
          'Mouvement de fluide : choisissez une bouteille du stock (n° de contenant obligatoire — F-Gas / Cerfa).',
        )
      }
      if (!stockItem.numeroContenant?.trim()) {
        throw new Error(
          `La bouteille sélectionnée n’a pas de n° d’identification. Complétez-le dans Stock fluides.`,
        )
      }
      if (!(manipQty > 0)) {
        throw new Error('Indiquez la quantité de fluide manipulée (kg) pour cette bouteille.')
      }
      if (manipSens === 'sortie' && manipQty > stockItem.quantiteKg + 1e-9) {
        throw new Error(
          `Stock insuffisant sur ${stockItem.numeroContenant} : reste ${stockItem.quantiteKg} kg.`,
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

    // Stock + historique CERFA d’abord (peut échouer si quantité insuffisante)
    const savedId = saveInterventionWithStock(
      { ...fullDraft, id: previewId },
      { createdByName: user?.fullName || user?.email || user?.username },
    )

    const blob = await buildCerfaPdf({
      draft: { ...fullDraft, id: savedId },
      client,
      chantier,
    })
    await saveCerfaPdf(savedId, blob, fileName)

    if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    const url = URL.createObjectURL(blob)
    setPdfUrl(url)
    setHasPdf(true)
    const reste =
      stockItem && manipQty > 0
        ? manipSens === 'sortie'
          ? Math.round((stockItem.quantiteKg - manipQty) * 1000) / 1000
          : Math.round((stockItem.quantiteKg + manipQty) * 1000) / 1000
        : null
    setSavedMsg(
      reste != null && stockItem
        ? `Enregistré — ${manipSens === 'sortie' ? 'sortie' : 'entrée'} ${manipQty} kg sur ${stockItem.numeroContenant} (reste ${reste} kg) · CERFA ${fileName.replace(/\.pdf$/i, '')}`
        : 'Enregistré dans ClimaZEN — le CERFA est ci-dessous.',
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
              onChange={setFluideType}
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
            <div className="mt-3 space-y-3">
              <Field label="Localisation 1" value={fuiteDescription} onChange={setFuiteDescription} />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={fuiteReparee}
                  onChange={(e) => setFuiteReparee(e.target.checked)}
                />
                Réparation 1 réalisée
              </label>
              <Field label="Localisation 2" value={fuiteLocalisation2} onChange={setFuiteLocalisation2} />
              <Field label="Localisation 3" value={fuiteLocalisation3} onChange={setFuiteLocalisation3} />
            </div>
          )}
        </Section>

        <Section title="[11] Manipulation fluide (depuis stock)">
          <LabelHint
            label={bottleRequired ? 'Contenant / bouteille *' : 'Contenant / bouteille'}
            tip={TIP_BOUTEILLE}
          >
            <select
              required={bottleRequired}
              value={stockItemId}
              onChange={(e) => setStockItemId(e.target.value)}
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            >
              <option value="">
                {bottleRequired
                  ? '— Choisir une bouteille (obligatoire) —'
                  : '— Aucun (pas de mouvement de fluide) —'}
              </option>
              {data.stock.map((s) => (
                <option key={s.id} value={s.id} disabled={!s.numeroContenant?.trim()}>
                  {s.fluide} · {s.contenantType} · {s.numeroContenant || 'SANS N°'} — reste{' '}
                  {s.quantiteKg} kg
                  {s.quantiteInitialeKg != null ? ` / ${s.quantiteInitialeKg} kg` : ''}
                </option>
              ))}
            </select>
          </LabelHint>

          {stockItem && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-muted">Type de mouvement *</span>
                <select
                  value={manipSens}
                  onChange={(e) => setManipSens(e.target.value as StockMouvementSens)}
                  className="h-11 w-full rounded-xl border border-line bg-white px-3"
                >
                  {stockItem.contenantType === 'recuperation' ? (
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
                  manipSens === 'sortie'
                    ? `Quantité sortie (kg) * — max ${stockItem.quantiteKg}`
                    : 'Quantité ajoutée (kg) *'
                }
                value={manipQty}
                onChange={setManipQty}
                placeholder="ex. 2,2"
                emptyZero
              />
            </div>
          )}

          {stockItem && (
            <p className="mt-2 rounded-xl bg-mist px-3 py-2 text-xs text-muted">
              Bouteille <strong className="text-ink">{stockItem.numeroContenant}</strong> · reste{' '}
              <strong className="text-ink">{stockItem.quantiteKg} kg</strong>
              {stockItem.quantiteInitialeKg != null
                ? ` (entrée stock ${stockItem.quantiteInitialeKg} kg)`
                : ''}
              . Chaque mouvement est historisé avec le n° CERFA.
            </p>
          )}

          {!stockItem && bottleRequired && (
            <p className="mt-2 rounded-xl bg-accent-soft/70 px-3 py-2 text-xs text-slate">
              Récupération, charge ou transfert : choisissez la bouteille — le reste et le CERFA
              seront liés automatiquement.
            </p>
          )}
          {!bottleRequired && !stockItem && (
            <p className="mt-2 text-xs text-muted">
              Entretien / contrôle sans mouvement de fluide : laissez vide.
            </p>
          )}
          {stockItem && !stockItem.numeroContenant?.trim() && (
            <p className="mt-2 text-xs text-danger">
              Cette ligne de stock n’a pas de n° de bouteille — corrigez-la dans Stock fluides.
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
