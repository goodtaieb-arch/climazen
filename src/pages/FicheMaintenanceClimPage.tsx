import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import { allEquipements } from '../lib/cerfaBatch'
import {
  blankFicheMaintenanceClim,
  FICHE_MAINT_SECTIONS,
  type FicheMaintCheckId,
  type FicheMaintResultat,
  type FicheMaintenanceClim,
} from '../lib/ficheMaintenanceClim'
import { buildFicheMaintenanceClimPdf } from '../lib/ficheMaintenanceClimPdf'
import { DecimalField } from '../components/DecimalField'
import { SignaturePad } from '../components/SignaturePad'
import { PdfViewerModal } from '../components/PdfViewerModal'

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
    marque?: string
    modele?: string
    type?: string
    numeroSerie?: string
    fluideType?: string
  }
  technicien: string
  signatureOperateur?: string
}): Omit<FicheMaintenanceClim, 'id' | 'createdAt' | 'updatedAt'> {
  if (opts.existing) {
    const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = opts.existing
    return rest
  }
  const base = blankFicheMaintenanceClim()
  const { site, client, equip } = opts
  const marqueModele = [equip?.marque, equip?.modele].filter(Boolean).join(' / ')
  return {
    ...base,
    date: today(),
    technicien: opts.technicien,
    clientId: client?.id || site?.clientId,
    chantierId: site?.id,
    equipementId: equip?.id,
    clientNom: client?.raisonSociale || '',
    adresse:
      [site?.adresse, site?.codePostal, site?.ville].filter(Boolean).join(', ') ||
      [client?.adresse, client?.codePostal, client?.ville].filter(Boolean).join(', '),
    marqueModele: marqueModele || equip?.type || '',
    numeroSerie: equip?.numeroSerie || '',
    fluide: equip?.fluideType || '',
    signatureTechnicienImage: opts.signatureOperateur || '',
    signatureClientImage: site?.signatureDetenteurImage || '',
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

  const existing = useMemo(
    () => (data.fichesMaintenanceClim || []).find((f) => f.id === editId) || null,
    [data.fichesMaintenanceClim, editId],
  )
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
      }),
  )
  const hydratedKey = useRef('')

  useEffect(() => {
    const key = `${editId}|${chantierId}|${equipementId}|${existing?.updatedAt || ''}|${site?.id || ''}|${equip?.id || ''}|${technicienDefault}`
    if (hydratedKey.current === key) return
    if (
      hydratedKey.current.startsWith(`${editId}|${chantierId}|${equipementId}|`) &&
      !existing &&
      hydratedKey.current
    ) {
      return
    }
    hydratedKey.current = key
    setForm(
      buildPrefill({
        existing,
        site,
        client,
        equip,
        technicien: technicienDefault,
        signatureOperateur: user?.signatureImage,
      }),
    )
  }, [
    editId,
    chantierId,
    equipementId,
    existing,
    site,
    client,
    equip,
    technicienDefault,
    user?.signatureImage,
  ])

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
      id: existing?.id,
    })
    return id
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const id = persist()
    alert('Fiche enregistrée.')
    if (!editId) navigate(`/app/fiche-maintenance-clim?id=${encodeURIComponent(id)}`, { replace: true })
  }

  const onPdf = async () => {
    setBusy(true)
    try {
      const id = persist()
      const fiche =
        (data.fichesMaintenanceClim || []).find((f) => f.id === id) ||
        ({
          ...form,
          id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as FicheMaintenanceClim)
      const blob = await buildFicheMaintenanceClimPdf({
        ...fiche,
        ...form,
        id,
      })
      const url = URL.createObjectURL(blob)
      setPdfUrl(url)
      upsertFicheMaintenanceClim({
        ...form,
        id,
        hasPdf: true,
        pdfFileName: `fiche-maint-clim-${form.date || today()}.pdf`,
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'PDF impossible')
    } finally {
      setBusy(false)
    }
  }

  const num = (n: number | null | undefined) => (n == null || Number.isNaN(Number(n)) ? 0 : Number(n))

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to={site ? '/app/chantiers' : '/app'}
            className="text-sm font-semibold text-accent hover:underline"
          >
            ← Retour
          </Link>
          <h1 className="font-display mt-1 text-2xl font-bold">
            Fiche de Maintenance Climatisation / PAC
          </h1>
          <p className="text-sm text-muted">
            Checklist terrain (hors CERFA). Les contrôles d’étanchéité légaux restent sur le CERFA
            15497-04.
          </p>
        </div>
      </div>

      {relatedFiches.length > 0 && (
        <div className="rounded-2xl border border-line bg-white p-4">
          <h2 className="text-sm font-semibold text-ink">Fiches précédentes</h2>
          <ul className="mt-2 space-y-1.5">
            {relatedFiches.map((f) => (
              <li key={f.id}>
                <Link
                  to={`/app/fiche-maintenance-clim?id=${encodeURIComponent(f.id)}`}
                  className="flex flex-wrap items-center gap-2 text-sm text-accent hover:underline"
                >
                  <span className="font-medium">{f.date || '—'}</span>
                  <span className="text-muted">
                    {f.numero ? `N° ${f.numero}` : f.resultat || 'brouillon'}
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
            <span className="mb-1 block text-muted">Intervention N°</span>
            <input
              value={form.numero}
              onChange={(e) => setForm({ ...form, numero: e.target.value })}
              className="h-11 w-full rounded-xl border border-line px-3"
              placeholder="ex. M-2026-014"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Date</span>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="h-11 w-full rounded-xl border border-line px-3"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Technicien</span>
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
              <span className="mb-1 block text-muted">Client / Raison sociale</span>
              <input
                required
                value={form.clientNom}
                onChange={(e) => setForm({ ...form, clientNom: e.target.value })}
                className="h-11 w-full rounded-xl border border-line px-3"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-muted">Adresse du chantier</span>
              <input
                value={form.adresse}
                onChange={(e) => setForm({ ...form, adresse: e.target.value })}
                className="h-11 w-full rounded-xl border border-line px-3"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Marque / Modèle</span>
              <input
                value={form.marqueModele}
                onChange={(e) => setForm({ ...form, marqueModele: e.target.value })}
                className="h-11 w-full rounded-xl border border-line px-3"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">N° de série</span>
              <input
                value={form.numeroSerie}
                onChange={(e) => setForm({ ...form, numeroSerie: e.target.value })}
                className="h-11 w-full rounded-xl border border-line px-3"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-muted">Fluide</span>
              <input
                value={form.fluide}
                onChange={(e) => setForm({ ...form, fluide: e.target.value })}
                className="h-11 w-full rounded-xl border border-line px-3"
              />
            </label>
          </div>
        </div>

        {FICHE_MAINT_SECTIONS.map((sec) => (
          <div key={sec.id} className="border-t border-line pt-3">
            <h2 className="font-display mb-2 text-base font-semibold">{sec.title}</h2>
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
            <span className="mb-1 block text-muted">Observations / pièces à prévoir</span>
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
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <SignaturePad
              label="Signature technicien"
              value={form.signatureTechnicienImage}
              onChange={(v) => setForm({ ...form, signatureTechnicienImage: v })}
              height={140}
            />
            <SignaturePad
              label="Signature client"
              value={form.signatureClientImage}
              onChange={(v) => setForm({ ...form, signatureClientImage: v })}
              height={140}
            />
          </div>
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
