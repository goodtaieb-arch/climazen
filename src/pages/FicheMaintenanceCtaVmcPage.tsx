import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import { allEquipements } from '../lib/cerfaBatch'
import {
  blankFicheMaintenanceCtaVmc,
  mergeChecksForPeriodeCtaVmc,
  PERIODES_CTA_VMC,
  sectionsForPeriodeCtaVmc,
  TYPES_EQUIP_CTA_VMC,
  type FicheCtaVmcCheckId,
  type FicheCtaVmcMesures,
  type FicheCtaVmcResultat,
  type FicheMaintenanceCtaVmc,
  type PeriodeCtaVmc,
  type TypeEquipCtaVmc,
} from '../lib/ficheMaintenanceCtaVmc'
import { buildFicheMaintenanceCtaVmcPdf } from '../lib/ficheMaintenanceCtaVmcPdf'
import { nextNumeroIntervention } from '../lib/numeroIntervention'
import { formatOtNumero } from '../lib/ordreTravail'
import { DecimalField } from '../components/DecimalField'
import { ClientSiteSignature } from '../components/ClientSiteSignature'
import { IntervenantSignature } from '../components/IntervenantSignature'
import { VoiceDictationButton } from '../components/VoiceDictationButton'
import { PdfViewerModal } from '../components/PdfViewerModal'
import { RegistreSecuriteBanner } from '../components/RegistreSecuriteBanner'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function num(n: number | null | undefined) {
  return n == null || Number.isNaN(Number(n)) ? 0 : Number(n)
}

function setMesure(
  form: Omit<FicheMaintenanceCtaVmc, 'id' | 'createdAt' | 'updatedAt'>,
  key: keyof FicheCtaVmcMesures,
  v: number | null,
) {
  return { ...form, mesures: { ...form.mesures, [key]: v } }
}

export function FicheMaintenanceCtaVmcPage() {
  const { data, upsertFicheMaintenanceCtaVmc } = useStore()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const chantierId = params.get('chantier') || ''
  const equipementId = params.get('equipement') || ''
  const editId = params.get('id') || ''
  const otFromQuery = params.get('ot') || ''
  const periodeQuery = (params.get('periode') || '') as PeriodeCtaVmc | ''

  const existing = useMemo(
    () => (data.fichesMaintenanceCtaVmc || []).find((f) => f.id === editId) || null,
    [data.fichesMaintenanceCtaVmc, editId],
  )

  const site = useMemo(
    () =>
      data.chantiers.find((c) => c.id === (chantierId || existing?.chantierId)) || undefined,
    [data.chantiers, chantierId, existing?.chantierId],
  )
  const client = useMemo(
    () =>
      data.clients.find((c) => c.id === (site?.clientId || existing?.clientId)) || undefined,
    [data.clients, site?.clientId, existing?.clientId],
  )
  const equip = useMemo(() => {
    if (!site) return undefined
    const eqs = allEquipements(site)
    return eqs.find((e) => e.id === (equipementId || existing?.equipementId))
  }, [site, equipementId, existing?.equipementId])

  const linkedOt = useMemo(() => {
    const list = data.ordresTravail || []
    if (otFromQuery) {
      const byId = list.find((o) => o.id === otFromQuery || o.numero === otFromQuery)
      if (byId) return byId
    }
    const ficheId = editId || existing?.id
    if (ficheId) {
      const byFiche = list.find((o) => o.ficheCtaVmcId === ficheId)
      if (byFiche) return byFiche
    }
    if (existing?.numero) {
      return list.find((o) => o.numero === existing.numero) || null
    }
    return null
  }, [data.ordresTravail, otFromQuery, editId, existing])

  const otReturnHref = linkedOt
    ? `/app/appel?ot=${encodeURIComponent(linkedOt.id)}`
    : ''

  const techName = user?.fullName || user?.email || ''
  const op = data.operateur
  const techSig = user?.signatureImage || ''

  const guessType = (): TypeEquipCtaVmc => {
    const raw = `${equip?.type || ''} ${equip?.nom || ''}`.toLowerCase()
    const hasCta = /cta|centrale/.test(raw)
    const hasVmc = /vmc|ventilation/.test(raw)
    if (hasCta && hasVmc) return 'cta_vmc'
    if (hasCta) return 'cta'
    if (hasVmc) return 'vmc'
    return 'cta_vmc'
  }

  const [form, setForm] = useState(() => {
    if (existing) {
      const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = existing
      return rest
    }
    const base = blankFicheMaintenanceCtaVmc(
      periodeQuery && PERIODES_CTA_VMC.some((p) => p.id === periodeQuery)
        ? periodeQuery
        : 'mensuel',
    )
    const marqueModele = [equip?.marque, equip?.modele].filter(Boolean).join(' / ')
    return {
      ...base,
      date: today(),
      technicien: techName,
      clientId: client?.id || site?.clientId,
      chantierId: site?.id,
      equipementId: equip?.id,
      clientNom: client?.raisonSociale || '',
      adresse:
        [site?.adresse, site?.codePostal, site?.ville].filter(Boolean).join(', ') ||
        [client?.adresse, client?.codePostal, client?.ville].filter(Boolean).join(', '),
      marqueModele: marqueModele || equip?.type || equip?.nom || '',
      numeroSerie: equip?.numeroSerie || '',
      typeEquipement: guessType(),
      signatureTechnicienImage: techSig,
      signatureClientImage: '',
    }
  })

  useEffect(() => {
    if (!existing) return
    const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = existing
    setForm({
      ...rest,
      signatureTechnicienImage: rest.signatureTechnicienImage || techSig,
      signatureClientImage: rest.signatureClientImage || '',
    })
  }, [existing?.id, existing?.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  const [savedMsg, setSavedMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)

  const sections = useMemo(() => sectionsForPeriodeCtaVmc(form.periode), [form.periode])

  const setPeriode = (periode: PeriodeCtaVmc) => {
    setForm((f) => ({
      ...f,
      periode,
      checks: mergeChecksForPeriodeCtaVmc(f.checks, periode),
    }))
  }

  const setCheck = (id: FicheCtaVmcCheckId, v: boolean) => {
    setForm((f) => ({ ...f, checks: { ...f.checks, [id]: v } }))
  }

  const toggleSection = (sectionId: string, checked: boolean) => {
    const sec = sections.find((s) => s.id === sectionId)
    if (!sec) return
    setForm((f) => {
      const checks = { ...f.checks }
      for (const it of sec.items) checks[it.id] = checked
      return { ...f, checks }
    })
  }

  const persist = (opts?: { keepMsg?: boolean }) => {
    const numero =
      (form.numero || '').trim() ||
      existing?.numero ||
      linkedOt?.numero ||
      nextNumeroIntervention(data)
    const id = upsertFicheMaintenanceCtaVmc({
      ...form,
      id: editId || existing?.id,
      numero,
    })
    if (!opts?.keepMsg) setSavedMsg('Fiche enregistrée.')
    if (!editId) {
      navigate(
        `/app/fiche-maintenance-cta-vmc?id=${encodeURIComponent(id)}${
          linkedOt ? `&ot=${encodeURIComponent(linkedOt.id)}` : ''
        }`,
        { replace: true },
      )
    }
    return id
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    try {
      persist()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Enregistrement impossible')
    }
  }

  const generatePdf = async () => {
    setBusy(true)
    try {
      const id = persist({ keepMsg: true })
      const fiche: FicheMaintenanceCtaVmc = {
        ...form,
        id,
        numero: form.numero || existing?.numero || linkedOt?.numero || '',
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        signatureTechnicienImage: form.signatureTechnicienImage || techSig,
      }
      const blob = await buildFicheMaintenanceCtaVmcPdf(fiche, {
        raisonSociale: op?.raisonSociale,
        adresse: op?.adresse,
        telephone: op?.telephone,
        email: op?.email,
        siret: op?.siret,
        logoImage: op?.logoImage,
      })
      const fileName = `fiche-maint-cta-vmc-${fiche.date || today()}-${id.slice(0, 8)}.pdf`
      upsertFicheMaintenanceCtaVmc({
        ...fiche,
        id,
        hasPdf: true,
        pdfFileName: fileName,
      })
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
      setPdfUrl(URL.createObjectURL(blob))
      setSavedMsg('PDF généré.')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'PDF impossible')
    } finally {
      setBusy(false)
    }
  }

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
              ← Retour à l’{formatOtNumero(linkedOt?.numero) || 'OT'}
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
            Fiche maintenance CTA / VMC
          </h1>
          <p className="text-sm text-muted">
            Registre par période. Cochez ce qui est fait ; décochez le reste. Les périodes
            supérieures incluent les contrôles des périodes inférieures.
          </p>
        </div>
      </div>

      <div className="sticky top-0 z-20 -mx-1 overflow-x-auto bg-white/95 px-1 py-2 backdrop-blur">
        <div className="flex gap-1.5 rounded-2xl border border-line bg-white p-1 shadow-sm">
          {PERIODES_CTA_VMC.map((p) => {
            const active = form.periode === p.id
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriode(p.id)}
                className={[
                  'min-h-11 flex-1 rounded-xl px-2 py-2 text-center transition',
                  active
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'bg-transparent text-slate hover:bg-mist',
                ].join(' ')}
              >
                <span className="block text-xs font-extrabold uppercase tracking-wide">
                  {p.short} · {p.label}
                </span>
                <span
                  className={[
                    'block text-[10px] font-medium',
                    active ? 'text-white/85' : 'text-muted',
                  ].join(' ')}
                >
                  {p.hint}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Date</span>
            <input
              type="date"
              className="w-full rounded-xl border border-line px-3 py-2.5"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Technicien</span>
            <input
              className="w-full rounded-xl border border-line px-3 py-2.5"
              value={form.technicien}
              onChange={(e) => setForm({ ...form, technicien: e.target.value })}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-semibold">Client</span>
            <input
              className="w-full rounded-xl border border-line px-3 py-2.5"
              value={form.clientNom}
              onChange={(e) => setForm({ ...form, clientNom: e.target.value })}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-semibold">Adresse</span>
            <input
              className="w-full rounded-xl border border-line px-3 py-2.5"
              value={form.adresse}
              onChange={(e) => setForm({ ...form, adresse: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Marque / modèle</span>
            <input
              className="w-full rounded-xl border border-line px-3 py-2.5"
              value={form.marqueModele}
              onChange={(e) => setForm({ ...form, marqueModele: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">N° série</span>
            <input
              className="w-full rounded-xl border border-line px-3 py-2.5"
              value={form.numeroSerie}
              onChange={(e) => setForm({ ...form, numeroSerie: e.target.value })}
            />
          </label>
          <div className="sm:col-span-2">
            <span className="mb-1 block text-sm font-semibold">Type d’équipement</span>
            <div className="flex flex-wrap gap-2">
              {TYPES_EQUIP_CTA_VMC.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setForm({ ...form, typeEquipement: t.id })}
                  className={[
                    'rounded-full px-3.5 py-2 text-xs font-bold',
                    form.typeEquipement === t.id
                      ? 'bg-sky-500 text-white'
                      : 'border border-line bg-white',
                  ].join(' ')}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {form.periode !== 'mensuel' ? (
          <div className="rounded-2xl border border-line bg-white p-4">
            <h2 className="font-display mb-2 text-base font-semibold">Relevés</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              <DecimalField
                label="ΔP filtres (Pa)"
                value={num(form.mesures.deltaPFiltresPa)}
                onChange={(n) => setForm((f) => setMesure(f, 'deltaPFiltresPa', n))}
              />
              {form.periode === 'annuel' ? (
                <>
                  <DecimalField
                    label="Intensité absorbée (A)"
                    value={num(form.mesures.intensiteAbsorbeeA)}
                    onChange={(n) => setForm((f) => setMesure(f, 'intensiteAbsorbeeA', n))}
                  />
                  <DecimalField
                    label="Intensité plaque (A)"
                    value={num(form.mesures.intensitePlaqueA)}
                    onChange={(n) => setForm((f) => setMesure(f, 'intensitePlaqueA', n))}
                  />
                  <DecimalField
                    label="Débit principal (m³/h)"
                    value={num(form.mesures.debitPrincipalM3h)}
                    onChange={(n) => setForm((f) => setMesure(f, 'debitPrincipalM3h', n))}
                  />
                  <DecimalField
                    label="Vitesse d’air (m/s)"
                    value={num(form.mesures.vitesseAirMs)}
                    onChange={(n) => setForm((f) => setMesure(f, 'vitesseAirMs', n))}
                  />
                </>
              ) : null}
            </div>
          </div>
        ) : null}

        {sections.map((sec) => {
          const allOn = sec.items.every((it) => form.checks[it.id])
          return (
            <div key={sec.id} className="rounded-2xl border border-line bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-sky-600">
                    {PERIODES_CTA_VMC.find((p) => p.id === sec.periode)?.label} (
                    {PERIODES_CTA_VMC.find((p) => p.id === sec.periode)?.short})
                  </p>
                  <h2 className="font-display text-base font-semibold">{sec.title}</h2>
                </div>
                <button
                  type="button"
                  className="text-xs font-semibold text-sky-700 hover:underline"
                  onClick={() => toggleSection(sec.id, !allOn)}
                >
                  {allOn ? 'Tout décocher' : 'Tout cocher'}
                </button>
              </div>
              <ul className="space-y-2.5">
                {sec.items.map((it) => (
                  <li key={it.id}>
                    <label className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-5 w-5 shrink-0 rounded border-2 border-slate-300 accent-sky-500"
                        checked={!!form.checks[it.id]}
                        onChange={(e) => setCheck(it.id, e.target.checked)}
                      />
                      <span className="text-sm font-medium text-ink">{it.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}

        <div className="rounded-2xl border border-line bg-white p-4">
          <h2 className="font-display mb-2 text-base font-semibold">Validation & signatures</h2>
          <label className="block text-sm">
            <span className="mb-1 flex items-center justify-between gap-2 font-semibold text-ink">
              <span>Observations</span>
              <VoiceDictationButton
                value={form.observations}
                onChange={(v) => setForm({ ...form, observations: v })}
              />
            </span>
            <textarea
              className="min-h-[88px] w-full rounded-xl border border-line px-3 py-2.5"
              value={form.observations}
              onChange={(e) => setForm({ ...form, observations: e.target.value })}
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                ['conforme', 'Conforme'],
                ['reserves', 'Avec réserves'],
                ['non_conforme', 'Non conforme'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setForm({ ...form, resultat: id as FicheCtaVmcResultat })}
                className={[
                  'rounded-full px-3.5 py-2 text-xs font-bold',
                  form.resultat === id ? 'bg-sky-500 text-white' : 'border border-line bg-white',
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
              qualite="Opérateur"
              image={form.signatureTechnicienImage || ''}
              onNomChange={(v) => setForm({ ...form, technicien: v })}
              onQualiteChange={() => {}}
              onImageChange={(v) => setForm({ ...form, signatureTechnicienImage: v })}
              height={120}
            />
            <ClientSiteSignature
              siteId={form.chantierId || site?.id}
              otId={linkedOt?.id}
              nom={form.clientNom}
              qualite="Client / détenteur"
              image={form.signatureClientImage || ''}
              onNomChange={(v) => setForm({ ...form, clientNom: v })}
              onQualiteChange={() => {}}
              onImageChange={(v) => setForm({ ...form, signatureClientImage: v })}
              height={120}
            />
          </div>
        </div>

        {savedMsg ? <p className="text-sm font-semibold text-sky-700">{savedMsg}</p> : null}

        <div className="flex flex-wrap gap-2 pb-8">
          <button
            type="submit"
            className="min-h-12 rounded-full bg-sky-500 px-6 text-sm font-bold text-white"
          >
            Enregistrer
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void generatePdf()}
            className="min-h-12 rounded-full border border-line bg-white px-6 text-sm font-semibold"
          >
            {busy ? 'PDF…' : 'Générer PDF'}
          </button>
        </div>
      </form>

      {pdfUrl ? (
        <PdfViewerModal
          url={pdfUrl}
          title="Fiche CTA / VMC"
          onClose={() => {
            if (pdfUrl) URL.revokeObjectURL(pdfUrl)
            setPdfUrl(null)
          }}
        />
      ) : null}
    </div>
  )
}
