import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Check, Circle, FileText } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import { allEquipements, equipmentLabel } from '../lib/cerfaBatch'
import {
  blankFicheMaintenanceClim,
  FICHE_MAINT_SECTIONS,
  type FicheMaintCheckId,
  type FicheMaintResultat,
  type FicheMaintenanceClim,
} from '../lib/ficheMaintenanceClim'
import { buildFicheMaintenanceClimPdf } from '../lib/ficheMaintenanceClimPdf'
import { nextNumeroIntervention } from '../lib/numeroIntervention'
import { otBaseNumero, sameOtNumero, formatOtNumero } from '../lib/ordreTravail'
import { DecimalField } from '../components/DecimalField'
import { ClientSiteSignature } from '../components/ClientSiteSignature'
import { IntervenantSignature } from '../components/IntervenantSignature'
import { VoiceDictationButton } from '../components/VoiceDictationButton'
import { PdfViewerModal } from '../components/PdfViewerModal'
import { RegistreSecuriteBanner } from '../components/RegistreSecuriteBanner'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function buildPrefill(opts: {
  existing: FicheMaintenanceClim | null
  site?: {
    id: string
    clientId: string
    adresse?: string
    codePostal?: string
    ville?: string
    signatureDetenteurImage?: string
  }
  client?: {
    id: string
    raisonSociale?: string
    adresse?: string
    codePostal?: string
    ville?: string
  }
  equip?: {
    id: string
    nom?: string
    marque?: string
    modele?: string
    type?: string
    numeroSerie?: string
    fluideType?: string
    chargeNominaleKg?: number
  }
  technicien: string
  signatureOperateur?: string
  numero?: string
  /** Reprendre marque / SN / fluide depuis l’équipement lié (bascule multi-pages). */
  syncFromEquip?: boolean
}): Omit<FicheMaintenanceClim, 'id' | 'createdAt' | 'updatedAt'> {
  if (opts.existing) {
    const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = opts.existing
    const equip = opts.equip
    const sync = opts.syncFromEquip && equip
    const marqueFromEquip = equip
      ? [equip.marque, equip.modele].filter(Boolean).join(' / ') || equip.type || equip.nom || ''
      : ''
    return {
      ...rest,
      equipementId: equip?.id || rest.equipementId,
      chantierId: opts.site?.id || rest.chantierId,
      // Tech auto depuis profil ; client = signature de cette intervention seulement
      signatureTechnicienImage:
        rest.signatureTechnicienImage || opts.signatureOperateur || '',
      signatureClientImage: rest.signatureClientImage || '',
      marqueModele: sync && marqueFromEquip ? marqueFromEquip : rest.marqueModele,
      numeroSerie: sync && equip?.numeroSerie ? equip.numeroSerie : rest.numeroSerie,
      fluide: sync && equip?.fluideType ? equip.fluideType : rest.fluide,
      quantiteFluideKg:
        rest.quantiteFluideKg ??
        (equip?.chargeNominaleKg != null && equip.chargeNominaleKg > 0
          ? equip.chargeNominaleKg
          : rest.quantiteFluideKg ?? null),
    }
  }
  const base = blankFicheMaintenanceClim()
  const { site, client, equip } = opts
  const marqueModele = [equip?.marque, equip?.modele].filter(Boolean).join(' / ')
  return {
    ...base,
    numero: opts.numero || base.numero,
    date: today(),
    technicien: opts.technicien,
    clientId: client?.id || site?.clientId,
    chantierId: site?.id,
    equipementId: equip?.id,
    clientNom: client?.raisonSociale || '',
    adresse:
      [site?.adresse, site?.codePostal, site?.ville].filter(Boolean).join(', ') ||
      [client?.adresse, client?.codePostal, client?.ville].filter(Boolean).join(', '),
    marqueModele: marqueModele || equip?.type || equip?.nom || '',
    numeroSerie: equip?.numeroSerie || '',
    fluide: equip?.fluideType || '',
    quantiteFluideKg:
      equip?.chargeNominaleKg != null && equip.chargeNominaleKg > 0
        ? equip.chargeNominaleKg
        : null,
    signatureTechnicienImage: opts.signatureOperateur || '',
    signatureClientImage: '',
  }
}

export function FicheMaintenanceClimPage() {
  const { data, upsertFicheMaintenanceClim } = useStore()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const chantierId = params.get('chantier') || ''
  const equipementId = params.get('equipement') || ''
  const editId = params.get('id') || ''
  const numeroFromQuery = params.get('numero') || ''
  const otFromQuery = params.get('ot') || ''
  const batchIds = useMemo(
    () =>
      (params.get('batch') || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    [params],
  )
  const batchQuery = batchIds.length
    ? `&batch=${encodeURIComponent(batchIds.join(','))}`
    : ''

  const existing = useMemo(
    () => (data.fichesMaintenanceClim || []).find((f) => f.id === editId) || null,
    [data.fichesMaintenanceClim, editId],
  )

  /** OT lié (query ?ot=, ficheMaintenanceId, ou même n°) — pour revenir signer. */
  const linkedOt = useMemo(() => {
    const list = data.ordresTravail || []
    if (otFromQuery) {
      const byId = list.find((o) => o.id === otFromQuery || o.numero === otFromQuery)
      if (byId) return byId
    }
    const ficheId = editId || existing?.id
    if (ficheId) {
      const byFiche = list.find((o) => o.ficheMaintenanceId === ficheId)
      if (byFiche) return byFiche
    }
    if (batchIds.length > 0) {
      const byBatch = list.find((o) => o.ficheMaintenanceId && batchIds.includes(o.ficheMaintenanceId))
      if (byBatch) return byBatch
    }
    const nums = [numeroFromQuery, existing?.numero].filter(Boolean) as string[]
    for (const n of nums) {
      const base = otBaseNumero(n) || n
      const found = list.find(
        (o) => o.numero === n || o.numero === base || sameOtNumero(o.numero, n),
      )
      if (found) return found
    }
    return null
  }, [
    data.ordresTravail,
    otFromQuery,
    editId,
    existing?.id,
    existing?.numero,
    batchIds,
    numeroFromQuery,
  ])

  const otReturnHref = linkedOt
    ? `/app/appel?ot=${encodeURIComponent(linkedOt.id)}`
    : null
  const otQuery = linkedOt
    ? `&ot=${encodeURIComponent(linkedOt.id)}`
    : otFromQuery
      ? `&ot=${encodeURIComponent(otFromQuery)}`
      : ''
  const site = data.chantiers.find((c) => c.id === chantierId || c.id === existing?.chantierId)
  const client = data.clients.find(
    (c) => c.id === (site?.clientId || existing?.clientId || ''),
  )
  const equip = site
    ? allEquipements(site).find((e) => e.id === (equipementId || existing?.equipementId))
    : undefined

  const technicienDefault = user?.signataireNom || user?.fullName || user?.email || ''

  const [form, setForm] = useState<Omit<FicheMaintenanceClim, 'id' | 'createdAt' | 'updatedAt'>>(
    () =>
      buildPrefill({
        existing,
        site,
        client,
        equip,
        technicien: technicienDefault,
        signatureOperateur: user?.signatureImage,
        numero: existing?.numero || numeroFromQuery || (!editId
          ? nextNumeroIntervention({
              interventions: data.interventions,
              fichesMaintenanceClim: data.fichesMaintenanceClim,
              ordresTravail: data.ordresTravail,
            })
          : undefined),
        syncFromEquip: true,
      }),
  )
  const [clientSignNom, setClientSignNom] = useState(
    () => site?.signatureDetenteurNom || client?.nomContact || '',
  )
  const [clientSignQualite, setClientSignQualite] = useState(
    () => site?.signatureDetenteurQualite || 'Représentant client',
  )
  const loadedEditId = useRef<string | null>(null)

  // Recharge TOUT le formulaire à chaque changement de fiche (Page 1/2 ↔ 2/2)
  useEffect(() => {
    if (!editId) {
      loadedEditId.current = null
      return
    }
    if (loadedEditId.current === editId) return
    const fiche =
      (data.fichesMaintenanceClim || []).find((f) => f.id === editId) || existing
    if (!fiche) return
    const siteRow =
      data.chantiers.find((c) => c.id === fiche.chantierId) || site
    const clientRow = data.clients.find(
      (c) => c.id === (fiche.clientId || siteRow?.clientId || ''),
    )
    const equipRow = siteRow
      ? allEquipements(siteRow).find((e) => e.id === fiche.equipementId)
      : undefined
    loadedEditId.current = editId
    setForm(
      buildPrefill({
        existing: fiche,
        site: siteRow,
        client: clientRow,
        equip: equipRow,
        technicien: fiche.technicien || technicienDefault,
        signatureOperateur: user?.signatureImage,
        numero: fiche.numero || numeroFromQuery,
        syncFromEquip: true,
      }),
    )
    if (siteRow?.signatureDetenteurNom || clientRow?.nomContact) {
      const n = (siteRow?.signatureDetenteurNom || clientRow?.nomContact || '').trim()
      if (n && n !== 'Signataire site') setClientSignNom(n)
    }
    if (siteRow?.signatureDetenteurQualite) {
      setClientSignQualite(siteRow.signatureDetenteurQualite)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bascule uniquement sur editId
  }, [editId, data.fichesMaintenanceClim])

  // Signature tech auto depuis le profil ; client = pad vide (par intervention)
  useEffect(() => {
    const tech = user?.signatureImage
    if (!tech) return
    setForm((f) => {
      if (f.signatureTechnicienImage) return f
      return { ...f, signatureTechnicienImage: tech }
    })
  }, [user?.signatureImage, editId])

  const relatedFiches = useMemo(() => {
    const list = data.fichesMaintenanceClim || []
    const eqId = equipementId || existing?.equipementId || form.equipementId
    const chId = chantierId || existing?.chantierId || form.chantierId
    return list
      .filter((f) => {
        if (editId && f.id === editId) return false
        if (eqId && f.equipementId === eqId) return true
        if (!eqId && chId && f.chantierId === chId) return true
        return false
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 8)
  }, [
    data.fichesMaintenanceClim,
    equipementId,
    existing?.equipementId,
    existing?.chantierId,
    form.equipementId,
    form.chantierId,
    chantierId,
    editId,
  ])

  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  const batchItems = useMemo(() => {
    if (batchIds.length < 2) return [] as {
      id: string
      label: string
      hasPdf: boolean
      isCurrent: boolean
      equipementId?: string
    }[]
    const list = data.fichesMaintenanceClim || []
    return batchIds.map((fid) => {
      const f = list.find((x) => x.id === fid)
      const eq =
        site && f?.equipementId
          ? allEquipements(site).find((e) => e.id === f.equipementId)
          : undefined
      const label = eq
        ? `${equipmentLabel(eq)}${eq.numeroSerie ? ` · SN ${eq.numeroSerie}` : ''}`
        : [f?.marqueModele, f?.numeroSerie].filter(Boolean).join(' · ') || 'Équipement'
      return {
        id: fid,
        label,
        hasPdf: Boolean(f?.hasPdf),
        isCurrent: fid === editId,
        equipementId: f?.equipementId,
      }
    })
  }, [batchIds, data.fichesMaintenanceClim, site, editId])

  const batchStorageKey = batchIds.length > 1 ? `climazen_fiche_ok_${batchIds.join('_')}` : ''
  const [markedOk, setMarkedOk] = useState<string[]>(() => {
    if (!batchStorageKey) return []
    try {
      const raw = sessionStorage.getItem(batchStorageKey)
      if (!raw) return []
      const parsed = JSON.parse(raw) as string[]
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    if (!batchStorageKey) return
    try {
      sessionStorage.setItem(batchStorageKey, JSON.stringify(markedOk))
    } catch {
      /* ignore */
    }
  }, [markedOk, batchStorageKey])

  const toggleMarkedOk = (ficheId: string) => {
    setMarkedOk((prev) =>
      prev.includes(ficheId) ? prev.filter((x) => x !== ficheId) : [...prev, ficheId],
    )
  }

  const goToBatchPage = (ficheId: string) => {
    if (ficheId === editId) return
    const currentId = existing?.id || editId
    if (currentId) {
      try {
        // Sauve la page courante SANS écraser le lien équipement
        upsertFicheMaintenanceClim({
          ...form,
          id: currentId,
          equipementId: existing?.equipementId || form.equipementId,
          chantierId: existing?.chantierId || form.chantierId,
        })
      } catch {
        /* ignore */
      }
    }
    loadedEditId.current = null
    navigate(
      `/app/fiche-maintenance-clim?id=${encodeURIComponent(ficheId)}${batchQuery}${otQuery}`,
    )
  }

  const setCheck = (id: FicheMaintCheckId, v: boolean) => {
    setForm((f) => ({ ...f, checks: { ...f.checks, [id]: v } }))
  }

  const recomputedDelta = () => {
    const a = Number(form.tempReprisC)
    const b = Number(form.tempSouffleC)
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const d = Math.round((a - b) * 10) / 10
      setForm((f) => ({ ...f, deltaTC: d, checks: { ...f.checks, fr_delta: true } }))
    }
  }

  const persist = () => {
    const id = upsertFicheMaintenanceClim({
      ...form,
      id: existing?.id || editId || undefined,
      equipementId: existing?.equipementId || form.equipementId,
      chantierId: existing?.chantierId || form.chantierId,
    })
    return id
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    persist()
    navigate('/app', { replace: true })
  }

  const onPdf = async () => {
    const techSig = form.signatureTechnicienImage || user?.signatureImage || ''
    if (!techSig) {
      alert(
        'Signature manuscrite opérateur obligatoire. Enregistrez-la dans « Mon profil », comme pour le CERFA.',
      )
      return
    }
    setBusy(true)
    try {
      const withSig = {
        ...form,
        signatureTechnicienImage: techSig,
        signatureClientImage:
          form.signatureClientImage || '',
      }
      setForm(withSig)
      const id = upsertFicheMaintenanceClim({
        ...withSig,
        id: existing?.id,
      })
      const fiche =
        (data.fichesMaintenanceClim || []).find((f) => f.id === id) ||
        ({
          ...withSig,
          id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as FicheMaintenanceClim)
      const op = data.operateur
      const blob = await buildFicheMaintenanceClimPdf(
        {
          ...fiche,
          ...withSig,
          id,
        },
        {
          raisonSociale: op.raisonSociale,
          adresse: op.adresse,
          telephone: op.telephone,
          email: op.email,
          siret: op.siret,
          logoImage: op.logoImage,
        },
      )
      const url = URL.createObjectURL(blob)
      setPdfUrl(url)
      upsertFicheMaintenanceClim({
        ...withSig,
        id,
        hasPdf: true,
        pdfFileName: `fiche-maint-clim-${form.date || today()}.pdf`,
      })
      if (id) {
        setMarkedOk((prev) => (prev.includes(id) ? prev : [...prev, id]))
      }
      setSavedMsg('PDF généré pour cette fiche.')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'PDF impossible')
    } finally {
      setBusy(false)
    }
  }

  /** Régénère les PDF pour toutes les fiches cochées ✓ (ensemble). */
  const regenerateAllFiches = async () => {
    if (batchItems.length < 2) return
    const techSig = form.signatureTechnicienImage || user?.signatureImage || ''
    if (!techSig) {
      alert(
        'Signature manuscrite opérateur obligatoire. Enregistrez-la dans « Mon profil », comme pour le CERFA.',
      )
      return
    }
    setBusy(true)
    setSavedMsg('')
    try {
      try {
        const currentId = persist()
        if (currentId) {
          setMarkedOk((prev) => (prev.includes(currentId) ? prev : [...prev, currentId]))
        }
      } catch (err) {
        console.warn(err)
      }

      const okIds = new Set(
        markedOk.length > 0
          ? markedOk
          : batchItems.filter((b) => b.hasPdf).map((b) => b.id),
      )
      if (editId) okIds.add(editId)

      const targets = batchItems.filter((b) => okIds.has(b.id))
      if (targets.length === 0) {
        alert(
          'Cochez l’icône ✓ sur chaque fiche équipement quand elle est OK, puis régénérez l’ensemble.',
        )
        return
      }

      const op = data.operateur
      let done = 0
      for (const item of targets) {
        const fiche = (data.fichesMaintenanceClim || []).find((f) => f.id === item.id)
        if (!fiche) {
          throw new Error(`Fiche manquante pour « ${item.label} » — ouvrez-la, complétez, cochez ✓.`)
        }
        const withSig: FicheMaintenanceClim = {
          ...fiche,
          signatureTechnicienImage:
            fiche.signatureTechnicienImage || techSig || user?.signatureImage || '',
          signatureClientImage:
            fiche.signatureClientImage || '',
        }
        if (!withSig.signatureTechnicienImage) {
          throw new Error(`Signature manquante sur « ${item.label} ».`)
        }
        const blob = await buildFicheMaintenanceClimPdf(withSig, {
          raisonSociale: op.raisonSociale,
          adresse: op.adresse,
          telephone: op.telephone,
          email: op.email,
          siret: op.siret,
          logoImage: op.logoImage,
        })
        // blob used to validate generation; PDF is client-side only for fiche
        void blob
        upsertFicheMaintenanceClim({
          ...withSig,
          id: withSig.id,
          hasPdf: true,
          pdfFileName: `fiche-maint-clim-${withSig.date || today()}-${withSig.id.slice(0, 8)}.pdf`,
        })
        done += 1
      }

      setSavedMsg(`${done} fiche${done > 1 ? 's' : ''} PDF régénérée${done > 1 ? 's' : ''}.`)
      // Recharger l’aperçu de la page courante
      if (editId) {
        const cur = (data.fichesMaintenanceClim || []).find((f) => f.id === editId)
        if (cur) {
          const blob = await buildFicheMaintenanceClimPdf(
            {
              ...cur,
              ...form,
              signatureTechnicienImage:
                form.signatureTechnicienImage || techSig || cur.signatureTechnicienImage,
            },
            {
              raisonSociale: op.raisonSociale,
              adresse: op.adresse,
              telephone: op.telephone,
              email: op.email,
              siret: op.siret,
              logoImage: op.logoImage,
            },
          )
          if (pdfUrl) URL.revokeObjectURL(pdfUrl)
          setPdfUrl(URL.createObjectURL(blob))
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Régénération impossible')
    } finally {
      setBusy(false)
    }
  }

  const num = (n: number | null | undefined) => (n == null || Number.isNaN(Number(n)) ? 0 : Number(n))

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <RegistreSecuriteBanner />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {otReturnHref ? (
            <button
              type="button"
              onClick={() => {
                try {
                  persist()
                } catch {
                  /* ignore */
                }
                navigate(otReturnHref)
              }}
              className="text-sm font-semibold text-accent hover:underline"
            >
              ← Retour à l’{formatOtNumero(linkedOt?.numero) || 'INT'}
            </button>
          ) : (
            <Link
              to={site ? '/app/chantiers' : '/app'}
              className="text-sm font-semibold text-accent hover:underline"
            >
              ← Retour
            </Link>
          )}
          <h1 className="font-display mt-1 text-2xl font-bold">
            Fiche de Maintenance Climatisation / PAC
          </h1>
          <p className="text-sm text-muted">
            Checklist terrain (hors CERFA). Toutes les tâches sont cochées : décochez seulement ce
            qui n’a pas été fait. Signatures reprises automatiquement (comme le CERFA).
          </p>
          {savedMsg ? (
            <p className="mt-1 text-xs font-semibold text-emerald-800">{savedMsg}</p>
          ) : null}
        </div>
      </div>

      {otReturnHref && (
        <div className="sticky top-[6.5rem] z-10 flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-[#0f766e] bg-[#0f766e] px-4 py-3 text-white shadow-lg md:top-[5.5rem]">
          <div className="min-w-0">
            <p className="text-sm font-extrabold">Retour signatures OT</p>
            <p className="text-xs text-white/85">
              {formatOtNumero(linkedOt?.numero) || 'INT'} — signez et clôturez après la fiche checklist
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              try {
                persist()
              } catch {
                /* ignore */
              }
              navigate(otReturnHref)
            }}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-white px-4 text-sm font-extrabold text-[#0f766e]"
          >
            <Check className="h-4 w-4" />
            Retour à l’OT — signer
          </button>
        </div>
      )}

      {batchItems.length > 1 && (
        <div className="space-y-2 rounded-2xl border border-accent/40 bg-accent-soft/30 p-4">
          <p className="text-sm font-semibold text-ink">Équipements de l’intervention</p>
          <p className="text-xs text-muted">
            Ouvrez chaque page, cochez ✓ quand tout est bon, puis régénérez l’ensemble des fiches.
          </p>
          <ul className="space-y-1.5">
            {batchItems.map((item, idx) => {
              const ok = markedOk.includes(item.id) || item.hasPdf
              return (
                <li key={item.id}>
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
                      onClick={() => toggleMarkedOk(item.id)}
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
                      onClick={() => goToBatchPage(item.id)}
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

      {relatedFiches.length > 0 && batchItems.length < 2 && (
        <div className="rounded-2xl border border-line bg-white p-4">
          <h2 className="text-sm font-semibold text-ink">Fiches précédentes</h2>
          <ul className="mt-2 space-y-1.5">
            {relatedFiches.map((f) => (
              <li key={f.id}>
                <Link
                  to={`/app/fiche-maintenance-clim?id=${encodeURIComponent(f.id)}${otQuery}`}
                  className="flex flex-wrap items-center gap-2 text-sm text-accent hover:underline"
                >
                  <span className="font-medium">{f.date || '—'}</span>
                  <span className="text-muted">
                    {f.numero ? formatOtNumero(f.numero) : f.resultat || 'brouillon'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-line bg-white p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink">N° OT</span>
            <div className="flex h-11 overflow-hidden rounded-xl border border-line bg-white">
              <span className="grid shrink-0 place-items-center bg-emerald-50 px-2.5 text-sm font-extrabold text-emerald-800">
                OT
              </span>
              <input
                value={otBaseNumero(form.numero) || form.numero}
                onChange={(e) =>
                  setForm({ ...form, numero: e.target.value.replace(/^OT\s*/i, '').trim() })
                }
                className="h-full min-w-0 flex-1 border-0 px-3 outline-none"
                placeholder="26081702"
              />
            </div>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink">Date</span>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="h-11 w-full rounded-xl border border-line px-3"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink">Technicien</span>
            <input
              required
              value={form.technicien}
              onChange={(e) => setForm({ ...form, technicien: e.target.value })}
              className="h-11 w-full rounded-xl border border-line px-3"
            />
          </label>
        </div>

        <div className="border-t border-line pt-3">
          <h2 className="font-display mb-2 text-base font-semibold">Client & matériel</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-semibold text-ink">Client / Raison sociale</span>
              <input
                required
                value={form.clientNom}
                onChange={(e) => setForm({ ...form, clientNom: e.target.value })}
                className="h-11 w-full rounded-xl border border-line px-3"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-semibold text-ink">Adresse du chantier</span>
              <input
                value={form.adresse}
                onChange={(e) => setForm({ ...form, adresse: e.target.value })}
                className="h-11 w-full rounded-xl border border-line px-3"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-ink">Marque / Modèle</span>
              <input
                value={form.marqueModele}
                onChange={(e) => setForm({ ...form, marqueModele: e.target.value })}
                className="h-11 w-full rounded-xl border border-line px-3"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-ink">N° de série</span>
              <input
                value={form.numeroSerie}
                onChange={(e) => setForm({ ...form, numeroSerie: e.target.value })}
                className="h-11 w-full rounded-xl border border-line px-3"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-ink">Fluide</span>
              <input
                value={form.fluide}
                onChange={(e) => setForm({ ...form, fluide: e.target.value })}
                className="h-11 w-full rounded-xl border border-line px-3"
              />
            </label>
            <div className="block text-sm">
              <DecimalField
                label="Quantité de fluide (kg)"
                value={num(form.quantiteFluideKg)}
                onChange={(n) => setForm({ ...form, quantiteFluideKg: n || null })}
                placeholder="ex. 1,2"
              />
            </div>
          </div>
        </div>

        {FICHE_MAINT_SECTIONS.map((sec) => (
          <div key={sec.id} className="border-t border-line pt-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold">{sec.title}</h2>
              <button
                type="button"
                className="text-xs font-semibold text-accent hover:underline"
                onClick={() => {
                  const next = { ...form.checks }
                  const allOn = sec.items.every((it) => next[it.id])
                  for (const it of sec.items) next[it.id] = !allOn
                  setForm({ ...form, checks: next })
                }}
              >
                Tout cocher / décocher
              </button>
            </div>
            <p className="mb-2 text-xs text-muted">
              Pré-validé — décochez uniquement ce qui n’a pas été réalisé.
            </p>
            <ul className="space-y-2">
              {sec.items.map((it) => (
                <li key={it.id} className="rounded-xl border border-line bg-foam/40 px-3 py-2.5">
                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-5 w-5 shrink-0 rounded border-2 border-slate-300 accent-accent"
                      checked={!!form.checks[it.id]}
                      onChange={(e) => setCheck(it.id, e.target.checked)}
                    />
                    <span className="font-medium text-ink">{it.label}</span>
                  </label>
                  {it.id === 'fr_souffle' && (
                    <div className="mt-2 pl-8">
                      <DecimalField
                        label="Temp. soufflé (°C)"
                        value={num(form.tempSouffleC)}
                        onChange={(n) => {
                          setForm((f) => ({
                            ...f,
                            tempSouffleC: n,
                            checks: { ...f.checks, fr_souffle: true },
                          }))
                        }}
                        placeholder="ex. 12"
                      />
                    </div>
                  )}
                  {it.id === 'fr_repris' && (
                    <div className="mt-2 pl-8">
                      <DecimalField
                        label="Temp. repris (°C)"
                        value={num(form.tempReprisC)}
                        onChange={(n) => {
                          setForm((f) => ({
                            ...f,
                            tempReprisC: n,
                            checks: { ...f.checks, fr_repris: true },
                          }))
                        }}
                        placeholder="ex. 24"
                      />
                      <button
                        type="button"
                        className="mt-1 text-xs font-semibold text-accent hover:underline"
                        onClick={recomputedDelta}
                      >
                        Calculer Delta T° automatiquement
                      </button>
                    </div>
                  )}
                  {it.id === 'fr_delta' && (
                    <div className="mt-2 pl-8">
                      <DecimalField
                        label="Delta T° (°C)"
                        value={num(form.deltaTC)}
                        onChange={(n) =>
                          setForm((f) => ({
                            ...f,
                            deltaTC: n,
                            checks: { ...f.checks, fr_delta: true },
                          }))
                        }
                        placeholder="8 à 12"
                      />
                    </div>
                  )}
                  {it.id === 'fr_pression' && (
                    <div className="mt-2 pl-8">
                      <DecimalField
                        label="BP / surchauffe (bar)"
                        value={num(form.pressionBpBar)}
                        onChange={(n) =>
                          setForm((f) => ({
                            ...f,
                            pressionBpBar: n,
                            checks: { ...f.checks, fr_pression: true },
                          }))
                        }
                      />
                    </div>
                  )}
                  {it.id === 'el_tension' && (
                    <div className="mt-2 pl-8">
                      <DecimalField
                        label="Tension (V)"
                        value={num(form.tensionV)}
                        onChange={(n) =>
                          setForm((f) => ({
                            ...f,
                            tensionV: n,
                            checks: { ...f.checks, el_tension: true },
                          }))
                        }
                        placeholder="230"
                      />
                    </div>
                  )}
                  {it.id === 'el_intensite' && (
                    <div className="mt-2 pl-8">
                      <DecimalField
                        label="Intensité (A)"
                        value={num(form.intensiteA)}
                        onChange={(n) =>
                          setForm((f) => ({
                            ...f,
                            intensiteA: n,
                            checks: { ...f.checks, el_intensite: true },
                          }))
                        }
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="border-t border-line pt-3">
          <h2 className="font-display mb-2 text-base font-semibold">Validation & signatures</h2>
          <label className="block text-sm">
            <span className="mb-1 flex items-center justify-between gap-2 font-semibold text-ink">
              <span>Observations / pièces à prévoir</span>
              <VoiceDictationButton
                value={form.observations}
                onChange={(v) => setForm({ ...form, observations: v })}
              />
            </span>
            <textarea
              value={form.observations}
              onChange={(e) => setForm({ ...form, observations: e.target.value })}
              rows={3}
              className="w-full rounded-xl border border-line px-3 py-2"
            />
          </label>
          <p className="mb-2 mt-3 text-sm font-medium text-ink">Résultat global</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['conforme', 'Conforme'],
                ['reserves', 'Réserve(s)'],
                ['non_conforme', 'Non conforme'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setForm({ ...form, resultat: id as FicheMaintResultat })}
                className={[
                  'rounded-full px-3 py-1.5 text-xs font-semibold',
                  form.resultat === id
                    ? 'bg-accent text-ink'
                    : 'border border-line text-muted hover:bg-mist',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-4">
            <IntervenantSignature
              label="Signature technicien"
              nom={form.technicien}
              qualite="Opérateur attesté"
              image={form.signatureTechnicienImage || ''}
              onNomChange={(v) => setForm({ ...form, technicien: v })}
              onQualiteChange={() => {}}
              onImageChange={(v) => setForm({ ...form, signatureTechnicienImage: v })}
              height={140}
            />
            <ClientSiteSignature
              siteId={site?.id || form.chantierId}
              otId={linkedOt?.id}
              nom={clientSignNom}
              qualite={clientSignQualite}
              image={form.signatureClientImage || ''}
              onNomChange={setClientSignNom}
              onQualiteChange={setClientSignQualite}
              onImageChange={(v) => setForm({ ...form, signatureClientImage: v })}
              height={140}
            />
          </div>
          {!user?.signatureImage && (
            <p className="mt-2 text-xs text-danger">
              Aucune signature opérateur en profil — enregistrez-la dans « Mon profil » avant le
              PDF.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          <button
            type="submit"
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink hover:bg-accent-hover"
          >
            Enregistrer
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onPdf()}
            className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm font-semibold hover:bg-mist disabled:opacity-60"
          >
            <FileText className="h-4 w-4" />
            {busy ? 'PDF…' : 'Générer le PDF'}
          </button>
          {batchItems.length > 1 ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void regenerateAllFiches()}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#0f766e] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60 sm:flex-none"
            >
              <FileText className="h-4 w-4" />
              {busy
                ? 'Régénération…'
                : `Régénérer l’ensemble (${Math.max(markedOk.length, batchItems.filter((b) => b.hasPdf).length) || batchItems.length} fiches)`}
            </button>
          ) : null}
          {otReturnHref ? (
            <button
              type="button"
              onClick={() => {
                try {
                  persist()
                } catch {
                  /* ignore */
                }
                navigate(otReturnHref)
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-[#0f766e] px-5 py-2.5 text-sm font-extrabold text-[#0f766e] hover:bg-emerald-50"
            >
              <Check className="h-4 w-4" />
              Retour à l’OT — signer
            </button>
          ) : null}
        </div>
      </form>

      {pdfUrl && (
        <PdfViewerModal
          url={pdfUrl}
          title="Fiche maintenance clim / PAC"
          onClose={() => {
            URL.revokeObjectURL(pdfUrl)
            setPdfUrl(null)
          }}
        />
      )}
    </div>
  )
}
