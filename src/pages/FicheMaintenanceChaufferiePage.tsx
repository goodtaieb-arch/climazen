import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import { allEquipements } from '../lib/cerfaBatch'
import {
  blankFicheMaintenanceChaufferie,
  mergeChecksForPeriode,
  PERIODES_CHAUFFERIE,
  sectionsForPeriode,
  type FicheChauffCheckId,
  type FicheChauffMesures,
  type FicheChauffResultat,
  type FicheMaintenanceChaufferie,
  type PeriodeChaufferie,
} from '../lib/ficheMaintenanceChaufferie'
import { buildFicheMaintenanceChaufferiePdf } from '../lib/ficheMaintenanceChaufferiePdf'
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
  form: Omit<FicheMaintenanceChaufferie, 'id' | 'createdAt' | 'updatedAt'>,
  key: keyof FicheChauffMesures,
  v: number | boolean | null,
) {
  return { ...form, mesures: { ...form.mesures, [key]: v } }
}

export function FicheMaintenanceChaufferiePage() {
  const { data, upsertFicheMaintenanceChaufferie } = useStore()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const chantierId = params.get('chantier') || ''
  const equipementId = params.get('equipement') || ''
  const editId = params.get('id') || ''
  const otFromQuery = params.get('ot') || ''
  const periodeQuery = (params.get('periode') || '') as PeriodeChaufferie | ''

  const existing = useMemo(
    () => (data.fichesMaintenanceChaufferie || []).find((f) => f.id === editId) || null,
    [data.fichesMaintenanceChaufferie, editId],
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
      const byFiche = list.find((o) => o.ficheChaufferieId === ficheId)
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

  const [form, setForm] = useState(() => {
    if (existing) {
      const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = existing
      return rest
    }
    const base = blankFicheMaintenanceChaufferie(
      periodeQuery && PERIODES_CHAUFFERIE.some((p) => p.id === periodeQuery)
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

  const sections = useMemo(() => sectionsForPeriode(form.periode), [form.periode])

  const setPeriode = (periode: PeriodeChaufferie) => {
    setForm((f) => ({
      ...f,
      periode,
      checks: mergeChecksForPeriode(f.checks, periode),
    }))
  }

  const setCheck = (id: FicheChauffCheckId, v: boolean) => {
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
    const id = upsertFicheMaintenanceChaufferie({
      ...form,
      id: editId || existing?.id,
      numero,
    })
    if (!opts?.keepMsg) setSavedMsg('Fiche enregistrée.')
    if (!editId) {
      navigate(
        `/app/fiche-maintenance-chaufferie?id=${encodeURIComponent(id)}${
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
      navigate('/app', { replace: true })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Enregistrement impossible')
    }
  }

  const generatePdf = async () => {
    setBusy(true)
    try {
      const id = persist({ keepMsg: true })
      const fiche: FicheMaintenanceChaufferie = {
        ...form,
        id,
        numero: form.numero || existing?.numero || linkedOt?.numero || '',
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        signatureTechnicienImage: form.signatureTechnicienImage || techSig,
      }
      const blob = await buildFicheMaintenanceChaufferiePdf(fiche, {
        raisonSociale: op?.raisonSociale,
        adresse: op?.adresse,
        telephone: op?.telephone,
        email: op?.email,
        siret: op?.siret,
        logoImage: op?.logoImage,
      })
      const fileName = `fiche-maint-chaufferie-${fiche.date || today()}-${id.slice(0, 8)}.pdf`
      upsertFicheMaintenanceChaufferie({
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

  const PairTemp = ({
    label,
    aKey,
    bKey,
    aLabel,
    bLabel,
  }: {
    label: string
    aKey: keyof FicheChauffMesures
    bKey: keyof FicheChauffMesures
    aLabel: string
    bLabel: string
  }) => (
    <div className="rounded-xl border border-line bg-mist/40 p-3">
      <p className="mb-2 text-xs font-bold text-ink">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <DecimalField
          label={aLabel}
          value={num(form.mesures[aKey] as number | null)}
          onChange={(n) => setForm((f) => setMesure(f, aKey, n))}
        />
        <DecimalField
          label={bLabel}
          value={num(form.mesures[bKey] as number | null)}
          onChange={(n) => setForm((f) => setMesure(f, bKey, n))}
        />
      </div>
    </div>
  )

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
            Fiche maintenance chaufferie P2/P3
          </h1>
          <p className="text-sm text-muted">
            Registre par période. Cochez ce qui est fait ; décochez le reste. Les périodes
            supérieures incluent les contrôles des périodes inférieures.
          </p>
        </div>
      </div>

      {/* Onglets période */}
      <div className="sticky top-0 z-20 -mx-1 overflow-x-auto bg-white/95 px-1 py-2 backdrop-blur">
        <div className="flex gap-1.5 rounded-2xl border border-line bg-white p-1 shadow-sm">
          {PERIODES_CHAUFFERIE.map((p) => {
            const active = form.periode === p.id
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriode(p.id)}
                className={[
                  'min-h-11 flex-1 rounded-xl px-2 py-2 text-center transition',
                  active
                    ? 'bg-accent text-ink shadow-sm'
                    : 'bg-transparent text-slate hover:bg-mist',
                ].join(' ')}
              >
                <span className="block text-xs font-extrabold uppercase tracking-wide">
                  {p.label}
                </span>
                <span
                  className={['block text-[10px] font-medium', active ? 'text-ink/80' : 'text-muted'].join(
                    ' ',
                  )}
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
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-semibold">Énergie / combustible</span>
            <input
              className="w-full rounded-xl border border-line px-3 py-2.5"
              placeholder="Gaz · Fioul · …"
              value={form.energie}
              onChange={(e) => setForm({ ...form, energie: e.target.value })}
            />
          </label>
        </div>

        {/* Relevés mensuels */}
        <div className="space-y-3 rounded-2xl border border-line bg-white p-4">
          <h2 className="font-display text-base font-semibold">Relevés températures (°C)</h2>
          <PairTemp
            label="Départ / Retour chaudière (primaire)"
            aKey="tempDepChaudiereC"
            bKey="tempRetChaudiereC"
            aLabel="Départ"
            bLabel="Retour"
          />
          <PairTemp
            label="Échangeur à plaques — primaire"
            aKey="tempEchPrimEntreeC"
            bKey="tempEchPrimSortieC"
            aLabel="Entrée"
            bLabel="Sortie"
          />
          <PairTemp
            label="Échangeur à plaques — secondaire"
            aKey="tempEchSecEntreeC"
            bKey="tempEchSecSortieC"
            aLabel="Entrée"
            bLabel="Sortie"
          />
          <PairTemp
            label="Circuit chauffage radiateurs / PCBT"
            aKey="tempDepChauffageC"
            bKey="tempRetChauffageC"
            aLabel="Départ"
            bLabel="Retour"
          />
          <PairTemp
            label="ECS / bouclage"
            aKey="tempDepEcsC"
            bKey="tempBouclageEcsC"
            aLabel="Départ ECS"
            bLabel="Bouclage"
          />
        </div>

        <div className="space-y-3 rounded-2xl border border-line bg-white p-4">
          <h2 className="font-display text-base font-semibold">Pressions, sel & chimie</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <DecimalField
              label="Pression réseau à froid (bar)"
              value={num(form.mesures.pressionReseauFroidBar)}
              onChange={(n) => setForm((f) => setMesure(f, 'pressionReseauFroidBar', n))}
            />
            <DecimalField
              label="Pression réseau à chaud (bar)"
              value={num(form.mesures.pressionReseauChaudBar)}
              onChange={(n) => setForm((f) => setMesure(f, 'pressionReseauChaudBar', n))}
            />
            <DecimalField
              label="ΔP échangeur (bar)"
              value={num(form.mesures.deltaPEchangeurBar)}
              onChange={(n) => setForm((f) => setMesure(f, 'deltaPEchangeurBar', n))}
            />
            <DecimalField
              label="Pression eau brute (bar)"
              value={num(form.mesures.pressionEauBruteBar)}
              onChange={(n) => setForm((f) => setMesure(f, 'pressionEauBruteBar', n))}
            />
            <DecimalField
              label="Pression eau traitée (bar)"
              value={num(form.mesures.pressionEauTraiteeBar)}
              onChange={(n) => setForm((f) => setMesure(f, 'pressionEauTraiteeBar', n))}
            />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <span className="w-full text-xs font-semibold text-ink">Niveau sel adoucisseur</span>
            <button
              type="button"
              onClick={() => setForm((f) => setMesure(f, 'niveauSelConforme', true))}
              className={[
                'rounded-full px-3 py-1.5 text-xs font-bold',
                form.mesures.niveauSelConforme === true
                  ? 'bg-accent text-ink'
                  : 'border border-line bg-white',
              ].join(' ')}
            >
              Conforme
            </button>
            <button
              type="button"
              onClick={() => setForm((f) => setMesure(f, 'niveauSelConforme', false))}
              className={[
                'rounded-full px-3 py-1.5 text-xs font-bold',
                form.mesures.niveauSelConforme === false
                  ? 'bg-amber-200 text-ink'
                  : 'border border-line bg-white',
              ].join(' ')}
            >
              Appoint nécessaire
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <DecimalField
              label="TH eau brute (°f)"
              value={num(form.mesures.thEauBrute)}
              onChange={(n) => setForm((f) => setMesure(f, 'thEauBrute', n))}
            />
            <DecimalField
              label="TH eau adoucie (°f)"
              value={num(form.mesures.thEauAdoucie)}
              onChange={(n) => setForm((f) => setMesure(f, 'thEauAdoucie', n))}
            />
            <DecimalField
              label="TH eau réseau (°f)"
              value={num(form.mesures.thEauReseau)}
              onChange={(n) => setForm((f) => setMesure(f, 'thEauReseau', n))}
            />
            <DecimalField
              label="pH circuit chauffage"
              value={num(form.mesures.phCircuit)}
              onChange={(n) => setForm((f) => setMesure(f, 'phCircuit', n))}
            />
          </div>
        </div>

        {(form.periode === 'semestriel' || form.periode === 'annuel') && (
          <div className="rounded-2xl border border-line bg-white p-4">
            <h2 className="font-display mb-2 text-base font-semibold">Semestriel — vase</h2>
            <DecimalField
              label="Pression prégonflage vase (bar)"
              value={num(form.mesures.vasePregonflageBar)}
              onChange={(n) => setForm((f) => setMesure(f, 'vasePregonflageBar', n))}
            />
          </div>
        )}

        {form.periode === 'annuel' && (
          <div className="space-y-2 rounded-2xl border border-line bg-white p-4">
            <h2 className="font-display text-base font-semibold">
              Annuel — analyse de combustion
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              <DecimalField
                label="CO₂ (%)"
                value={num(form.mesures.combustionCo2Pct)}
                onChange={(n) => setForm((f) => setMesure(f, 'combustionCo2Pct', n))}
              />
              <DecimalField
                label="O₂ (%)"
                value={num(form.mesures.combustionO2Pct)}
                onChange={(n) => setForm((f) => setMesure(f, 'combustionO2Pct', n))}
              />
              <DecimalField
                label="CO ambiant (ppm)"
                value={num(form.mesures.combustionCoAmbiantPpm)}
                onChange={(n) => setForm((f) => setMesure(f, 'combustionCoAmbiantPpm', n))}
              />
              <DecimalField
                label="CO fumées (ppm)"
                value={num(form.mesures.combustionCoFumeesPpm)}
                onChange={(n) => setForm((f) => setMesure(f, 'combustionCoFumeesPpm', n))}
              />
              <DecimalField
                label="Rendement (%)"
                value={num(form.mesures.combustionRendementPct)}
                onChange={(n) => setForm((f) => setMesure(f, 'combustionRendementPct', n))}
              />
            </div>
          </div>
        )}

        {/* Checklists par sections de la période */}
        {sections.map((sec) => {
          const allOn = sec.items.every((it) => form.checks[it.id])
          return (
            <div key={sec.id} className="rounded-2xl border border-line bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-accent">
                    {PERIODES_CHAUFFERIE.find((p) => p.id === sec.periode)?.label}
                  </p>
                  <h2 className="font-display text-base font-semibold">{sec.title}</h2>
                </div>
                <button
                  type="button"
                  className="text-xs font-semibold text-accent hover:underline"
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
                        className="mt-0.5 h-5 w-5 shrink-0 rounded border-2 border-slate-300 accent-accent"
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
                onClick={() => setForm({ ...form, resultat: id as FicheChauffResultat })}
                className={[
                  'rounded-full px-3.5 py-2 text-xs font-bold',
                  form.resultat === id ? 'bg-accent text-ink' : 'border border-line bg-white',
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

        {savedMsg ? <p className="text-sm font-semibold text-accent">{savedMsg}</p> : null}

        <div className="flex flex-wrap gap-2 pb-8">
          <button
            type="submit"
            className="min-h-12 rounded-full bg-accent px-6 text-sm font-bold text-ink"
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
          title="Fiche chaufferie"
          onClose={() => {
            if (pdfUrl) URL.revokeObjectURL(pdfUrl)
            setPdfUrl(null)
          }}
        />
      ) : null}
    </div>
  )
}
