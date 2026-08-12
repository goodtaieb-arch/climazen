import { useEffect, useMemo, useState } from 'react'
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
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import { SearchField, matchesQuery } from '../components/SearchField'
import { ClientSiteSignature } from '../components/ClientSiteSignature'
import { IntervenantSignature } from '../components/IntervenantSignature'
import { FluideSelect } from '../components/FluideSelect'
import { DecimalField } from '../components/DecimalField'
import { PlaquePhotoButton } from '../components/PlaquePhotoButton'
import type { PlaqueFields } from '../lib/plaqueOcr'
import { allEquipements, equipementsForCerfa } from '../lib/cerfaBatch'
import { calcTeqCO2FromFluide } from '../lib/fluides'
import { blankFicheMaintenanceClim } from '../lib/ficheMaintenanceClim'
import type { Client, Equipement, Site } from '../lib/types'
import {
  TYPE_OT_LABELS,
  PARCOURS_APPEL_STEPS,
  blankOrdreTravail,
  nextNumeroOt,
  naturesCerfaPourTypeOt,
  inferParcoursStep,
  type TypeOt,
  type ParcoursAppelStepId,
  type OrdreTravail,
} from '../lib/ordreTravail'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function blankClient(): Omit<Client, 'id' | 'createdAt'> {
  return {
    raisonSociale: '',
    nomContact: '',
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
  return {
    clientId,
    nom: from?.raisonSociale ? `Site ${from.raisonSociale}` : '',
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
  const { data, upsertOrdreTravail, upsertClient, upsertChantier, upsertFicheMaintenanceClim } =
    useStore()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const otIdParam = params.get('ot') || params.get('id') || ''

  const existing = useMemo(
    () => (data.ordresTravail || []).find((o) => o.id === otIdParam) || null,
    [data.ordresTravail, otIdParam],
  )

  const [otId, setOtId] = useState(existing?.id || '')
  const [step, setStep] = useState<ParcoursAppelStepId>(() =>
    existing ? inferParcoursStep(existing) : 'ot',
  )

  const [otForm, setOtForm] = useState(() => {
    if (existing) {
      const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = existing
      return rest
    }
    return {
      ...blankOrdreTravail(),
      numero: nextNumeroOt(data),
      date: today(),
      technicien: user?.signataireNom || user?.fullName || user?.email || '',
      signatureTechnicienImage: user?.signatureImage || '',
      typeOt: 'depanage' as TypeOt,
      parcoursStep: 'ot' as ParcoursAppelStepId,
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

  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!existing) return
    const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = existing
    setOtForm(rest)
    setOtId(existing.id)
    setStep(inferParcoursStep(existing))
  }, [existing?.id, existing?.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  const client = data.clients.find((c) => c.id === otForm.clientId)
  const site = data.chantiers.find((c) => c.id === otForm.chantierId)
  const eqs = site ? allEquipements(site) : []
  const selectedEq = eqs.find((e) => e.id === otForm.equipementId)

  useEffect(() => {
    if (!site) return
    setClientSignNom((n) => n || site.signatureDetenteurNom || '')
    setClientSignQualite((q) =>
      q && q !== 'Représentant client' ? q : site.signatureDetenteurQualite || 'Représentant client',
    )
    if (!otForm.signatureClientImage && site.signatureDetenteurImage) {
      setOtForm((f) => ({ ...f, signatureClientImage: site.signatureDetenteurImage }))
    }
  }, [site?.id, site?.signatureDetenteurAt]) // eslint-disable-line react-hooks/exhaustive-deps

  const clientsFiltered = useMemo(
    () =>
      data.clients.filter((c) =>
        matchesQuery([c.raisonSociale, c.ville, c.telephone, c.nomContact].join(' '), clientQ),
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
    setMsg(`OT ${otForm.numero} créé — complètez le client.`)
    setOtId(id)
    setStep('client')
  }

  const saveClientStep = () => {
    let clientId = otForm.clientId || ''
    if (clientMode === 'new' || !clientId) {
      if (!clientForm.raisonSociale.trim()) {
        alert('Indiquez la raison sociale / nom du client.')
        return
      }
      clientId = upsertClient({
        ...clientForm,
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
    let equipementId = otForm.equipementId || ''
    if (equipMode === 'new') {
      if (!equipForm.nom.trim() && !equipForm.type.trim()) {
        alert('Indiquez au moins un nom ou type d’équipement.')
        return
      }
      const teq =
        equipForm.avecFluideFrigorigene !== false && equipForm.fluideType
          ? calcTeqCO2FromFluide(equipForm.chargeNominaleKg || 0, equipForm.fluideType) || 0
          : 0
      const eq: Equipement = {
        ...equipForm,
        id: equipForm.id || crypto.randomUUID(),
        nom: equipForm.nom.trim() || equipForm.type || 'Équipement',
        teqCO2: teq,
      }
      const list = [...allEquipements(site), eq]
      upsertChantier({
        ...site,
        equipements: list,
        avecFluideFrigorigene: list.some((e) => e.avecFluideFrigorigene !== false),
      })
      equipementId = eq.id
    } else if (!equipementId) {
      alert('Sélectionnez un équipement ou créez-en un.')
      return
    }
    persistOt({ equipementId, parcoursStep: 'docs' }, otId)
    setStep('docs')
    setMsg('Équipement lié — choisissez le document d’intervention.')
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
    const natures = naturesCerfaPourTypeOt(otForm.typeOt).join(',')
    const id = persistOt(
      {
        parcoursStep: 'docs',
        statut: 'en_cours',
      },
      otId,
    )
    const q = new URLSearchParams({
      chantier: otForm.chantierId,
      ot: id,
      numero: otForm.numero,
      natures,
      date: otForm.date,
    })
    if (otForm.equipementId) q.set('equipement', otForm.equipementId)
    navigate(`/app/interventions/new?${q.toString()}`)
  }

  const openFicheMaint = () => {
    if (!otForm.chantierId) {
      alert('Site requis pour la fiche.')
      return
    }
    const c = client
    const s = site
    const eq = selectedEq
    const adresse =
      [s?.adresse, s?.codePostal, s?.ville].filter(Boolean).join(', ') ||
      [c?.adresse, c?.codePostal, c?.ville].filter(Boolean).join(', ')
    const base = blankFicheMaintenanceClim()
    const ficheId = upsertFicheMaintenanceClim({
      ...base,
      numero: otForm.numero,
      date: otForm.date || today(),
      technicien: otForm.technicien,
      clientId: otForm.clientId,
      chantierId: otForm.chantierId,
      equipementId: otForm.equipementId,
      clientNom: c?.raisonSociale || '',
      adresse,
      marqueModele: eq ? [eq.marque, eq.modele].filter(Boolean).join(' / ') || eq.nom : '',
      numeroSerie: eq?.numeroSerie || '',
      fluide: eq?.fluideType || '',
      quantiteFluideKg:
        eq?.chargeNominaleKg != null && eq.chargeNominaleKg > 0 ? eq.chargeNominaleKg : null,
      signatureTechnicienImage: otForm.signatureTechnicienImage || user?.signatureImage || '',
      signatureClientImage: otForm.signatureClientImage || s?.signatureDetenteurImage || '',
      observations: otForm.observations || '',
    })
    persistOt(
      {
        ficheMaintenanceId: ficheId,
        parcoursStep: 'docs',
      },
      otId,
    )
    navigate(`/app/fiche-maintenance-clim?id=${encodeURIComponent(ficheId)}`)
  }

  const finishWithSignatures = () => {
    if (!otForm.signatureTechnicienImage) {
      alert('Signature technicien requise.')
      return
    }
    if (!otForm.signatureClientImage) {
      alert('Signature client requise sur l’OT.')
      return
    }
    persistOt({
      statut: 'signe',
      parcoursStep: 'docs',
      rapportAction: otForm.rapportAction || otForm.action,
    })
    setMsg(`OT ${otForm.numero} signé.`)
    navigate(`/app/ot?id=${encodeURIComponent(otId || existing?.id || '')}`)
  }

  const stepIdx = STEP_INDEX[step]
  const hasFluide = selectedEq
    ? selectedEq.avecFluideFrigorigene !== false && !!selectedEq.fluideType
    : site
      ? equipementsForCerfa(site).length > 0
      : true
  const isMaint =
    otForm.typeOt === 'maintenance' ||
    otForm.typeOt === 'entretien' ||
    otForm.typeOt === 'controle_etancheite'

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
            Client appelle
          </h1>
          <p className="truncate text-xs text-muted">
            {otForm.numero || 'Nouvel OT'} · date {otForm.date || '—'}
          </p>
        </div>
      </div>

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

      {msg ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {msg}
        </p>
      ) : null}

      {/* ——— Étape OT ——— */}
      {step === 'ot' && (
        <section className="space-y-3 rounded-2xl border border-line bg-white p-4">
          <p className="text-sm text-muted">
            Au téléphone : créez l’OT tout de suite, même avant d’être sur site.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="mb-1 block text-muted">N° OT</span>
              <input
                value={otForm.numero}
                onChange={(e) => setOtForm({ ...otForm, numero: e.target.value })}
                className="h-11 w-full rounded-xl border border-line px-3 font-bold tracking-wide"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Date (auto, modifiable)</span>
              <input
                type="date"
                value={otForm.date}
                onChange={(e) => setOtForm({ ...otForm, date: e.target.value })}
                className="h-11 w-full rounded-xl border border-line px-3"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Type</span>
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
            <span className="mb-1 block text-muted">Description — panne / installation / demande *</span>
            <textarea
              rows={3}
              value={otForm.action}
              onChange={(e) => setOtForm({ ...otForm, action: e.target.value })}
              className="w-full rounded-xl border border-line px-3 py-2"
              placeholder="Ex. Plus de froid chambre 2, fuite suspectée…"
              autoFocus
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Observations (appel)</span>
            <textarea
              rows={2}
              value={otForm.observations}
              onChange={(e) => setOtForm({ ...otForm, observations: e.target.value })}
              className="w-full rounded-xl border border-line px-3 py-2"
              placeholder="Urgence, accès, contact sur place…"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Technicien</span>
            <input
              value={otForm.technicien}
              onChange={(e) => setOtForm({ ...otForm, technicien: e.target.value })}
              className="h-11 w-full rounded-xl border border-line px-3"
            />
          </label>
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
                          raisonSociale: c.raisonSociale,
                          nomContact: c.nomContact || '',
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
                      <span className="min-w-0 flex-1 truncate font-semibold">{c.raisonSociale}</span>
                      <span className="truncate text-xs text-muted">{c.ville}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-muted">Raison sociale *</span>
                <input
                  value={clientForm.raisonSociale}
                  onChange={(e) => setClientForm({ ...clientForm, raisonSociale: e.target.value })}
                  className="h-11 w-full rounded-xl border border-line px-3"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted">Téléphone</span>
                <input
                  value={clientForm.telephone}
                  onChange={(e) => setClientForm({ ...clientForm, telephone: e.target.value })}
                  className="h-11 w-full rounded-xl border border-line px-3"
                  inputMode="tel"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted">Contact</span>
                <input
                  value={clientForm.nomContact}
                  onChange={(e) => setClientForm({ ...clientForm, nomContact: e.target.value })}
                  className="h-11 w-full rounded-xl border border-line px-3"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-muted">Adresse</span>
                <input
                  value={clientForm.adresse}
                  onChange={(e) => setClientForm({ ...clientForm, adresse: e.target.value })}
                  className="h-11 w-full rounded-xl border border-line px-3"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted">Code postal</span>
                <input
                  value={clientForm.codePostal}
                  onChange={(e) => setClientForm({ ...clientForm, codePostal: e.target.value })}
                  className="h-11 w-full rounded-xl border border-line px-3"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted">Ville</span>
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
            Client : <strong>{client?.raisonSociale || '—'}</strong>
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
                <span className="mb-1 block text-muted">Nom du site *</span>
                <input
                  value={siteForm.nom}
                  onChange={(e) => setSiteForm({ ...siteForm, nom: e.target.value })}
                  className="h-11 w-full rounded-xl border border-line px-3"
                  placeholder="Ex. Cuisine, Entrepôt nord…"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-muted">Adresse</span>
                <input
                  value={siteForm.adresse}
                  onChange={(e) => setSiteForm({ ...siteForm, adresse: e.target.value })}
                  className="h-11 w-full rounded-xl border border-line px-3"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted">Code postal</span>
                <input
                  value={siteForm.codePostal}
                  onChange={(e) => setSiteForm({ ...siteForm, codePostal: e.target.value })}
                  className="h-11 w-full rounded-xl border border-line px-3"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted">Ville</span>
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
            Sur site : inscrivez l’équipement concerné ({site?.nom || '—'}).
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
                setOtForm({ ...otForm, equipementId: '' })
                setEquipForm(blankEquip(true))
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${equipMode === 'new' ? 'bg-accent text-ink' : 'border border-line'}`}
            >
              <Plus className="mr-1 inline h-3.5 w-3.5" /> Nouvel équipement
            </button>
          </div>

          {equipMode === 'pick' ? (
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {eqs.length === 0 ? (
                <li className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-sm text-muted">
                  Aucun équipement — créez-en un sur place.
                </li>
              ) : (
                eqs.map((eq) => (
                  <li key={eq.id}>
                    <button
                      type="button"
                      onClick={() => setOtForm({ ...otForm, equipementId: eq.id })}
                      className={[
                        'flex min-h-12 w-full items-center gap-2 rounded-xl border px-3 text-left text-sm',
                        otForm.equipementId === eq.id
                          ? 'border-emerald-400 bg-emerald-50'
                          : 'border-line bg-white active:bg-mist',
                      ].join(' ')}
                    >
                      <Cpu className="h-4 w-4 shrink-0 text-muted" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{eq.nom || eq.type || 'Équipement'}</span>
                        <span className="block text-xs text-muted">
                          {[eq.marque, eq.modele, eq.fluideType].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
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
                <span className="mb-1 block text-muted">Nom / repère</span>
                <input
                  value={equipForm.nom}
                  onChange={(e) => setEquipForm({ ...equipForm, nom: e.target.value })}
                  className="h-11 w-full rounded-xl border border-line px-3"
                  placeholder="Chambre froide 1, PAC bureau…"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted">Type</span>
                <input
                  value={equipForm.type}
                  onChange={(e) => setEquipForm({ ...equipForm, type: e.target.value })}
                  className="h-11 w-full rounded-xl border border-line px-3"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted">N° série</span>
                <input
                  value={equipForm.numeroSerie}
                  onChange={(e) => setEquipForm({ ...equipForm, numeroSerie: e.target.value })}
                  className="h-11 w-full rounded-xl border border-line px-3"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted">Marque</span>
                <input
                  value={equipForm.marque}
                  onChange={(e) => setEquipForm({ ...equipForm, marque: e.target.value })}
                  className="h-11 w-full rounded-xl border border-line px-3"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted">Modèle</span>
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
              {TYPE_OT_LABELS[otForm.typeOt]} · {otForm.numero}
            </p>
            <p className="text-muted">{otForm.action}</p>
            <p className="mt-1 text-xs text-muted">
              {[client?.raisonSociale, site?.nom, selectedEq?.nom].filter(Boolean).join(' · ') ||
                'Compléter client / site / équipement si besoin'}
            </p>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block text-muted">Date d’intervention (modifiable)</span>
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
            <span className="mb-1 block text-muted">Rapport d’action (sur place)</span>
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
                  <span className="block">CERFA (fluide / gaz)</span>
                  <span className="block text-sm font-medium text-muted">
                    Obligation légale — n° {otForm.numero}, date reprise
                  </span>
                </span>
              </button>
            ) : null}
            {isMaint || !hasFluide ? (
              <button
                type="button"
                onClick={openFicheMaint}
                className="flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 border-line bg-white px-4 text-left font-bold active:bg-mist"
              >
                <ClipboardList className="h-6 w-6 shrink-0 text-teal-700" />
                <span>
                  <span className="block">Fiche maintenance / rapport</span>
                  <span className="block text-sm font-medium text-muted">
                    Sans CERFA — même n° OT et date
                  </span>
                </span>
              </button>
            ) : null}
          </div>

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
              nom={clientSignNom}
              qualite={clientSignQualite}
              image={otForm.signatureClientImage || ''}
              onNomChange={setClientSignNom}
              onQualiteChange={setClientSignQualite}
              onImageChange={(v) => setOtForm({ ...otForm, signatureClientImage: v })}
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
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#0f766e] px-5 text-sm font-bold text-white sm:flex-none"
            >
              <Check className="h-4 w-4" /> Clôturer signé
            </button>
          </div>

          <p className="text-xs text-muted">
            Les signatures technicien + client doivent figurer sur l’OT, le CERFA et la fiche. La
            date est reprise automatiquement (modifiable si l’OT est rédigé hors site).
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
            <Building2 className="h-3.5 w-3.5" /> {client.raisonSociale}
          </span>
        ) : null}
      </div>
    </div>
  )
}
