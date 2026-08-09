import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileCheck2, Plus, Pencil, RefreshCw, Snowflake, Trash2, Wrench } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import type { Chantier, Equipement, TypeTravaux } from '../lib/types'
import { siteAvecFluideFrigorigene, TYPE_TRAVAUX_LABELS } from '../lib/types'
import { Field, Header } from './ClientsPage'
import { DecimalField } from '../components/DecimalField'
import { FluideSelect } from '../components/FluideSelect'
import { PlaquePhotoButton } from '../components/PlaquePhotoButton'
import { SearchField, matchesQuery } from '../components/SearchField'
import { calcTeqCO2FromFluide, findFluide, formatGwp } from '../lib/fluides'
import type { PlaqueFields } from '../lib/plaqueOcr'
import { equipementsForCerfa, equipmentLabel, syncEquipementsFromFlat } from '../lib/cerfaBatch'
import { buildCerfaPdf } from '../lib/cerfaPdf'
import { saveCerfaPdf } from '../lib/pdfStore'

const blankEquip = (): Equipement => ({
  id: crypto.randomUUID(),
  nom: '',
  type: '',
  marque: '',
  modele: '',
  numeroSerie: '',
  fluideType: 'R-448A',
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
  typeTravaux: 'installation',
  detailTravaux: '',
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
  equipements: [blankEquip()],
})

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function ChantiersPage() {
  const { data, upsertChantier, deleteChantier, validateMaintenanceCerfas, upsertIntervention } =
    useStore()
  const { user } = useAuth()
  const [form, setForm] = useState(() => blank(data.clients[0]?.id || ''))
  const [editId, setEditId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [equipIdx, setEquipIdx] = useState(0)
  const [batchBusy, setBatchBusy] = useState<string | null>(null)

  const avecFluide = form.avecFluideFrigorigene !== false
  const equipements = form.equipements?.length ? form.equipements : syncEquipementsFromFlat(form)
  const currentEquip = equipements[Math.min(equipIdx, equipements.length - 1)] || blankEquip()

  const filteredChantiers = useMemo(() => {
    return data.chantiers.filter((c) => {
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
          siteAvecFluideFrigorigene(c) ? 'fluide cerfa' : 'standard vmc',
        ]
          .filter(Boolean)
          .join(' '),
        q,
      )
    })
  }, [data.chantiers, data.clients, q])

  useEffect(() => {
    if (!open || !avecFluide) return
    const teq = calcTeqCO2FromFluide(Number(form.chargeNominaleKg) || 0, form.fluideType)
    if (teq === null) return
    if (form.teqCO2 === teq) return
    setForm((f) => ({ ...f, teqCO2: teq }))
  }, [form.fluideType, form.chargeNominaleKg, open, avecFluide]) // eslint-disable-line react-hooks/exhaustive-deps

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
    list[i] = nextEq
    setForm({
      ...form,
      equipements: list,
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
    const fluide = form.avecFluideFrigorigene !== false
    const list = fluide
      ? (form.equipements?.length ? form.equipements : syncEquipementsFromFlat(form)).map((eq) => ({
          ...eq,
          fluideType: eq.fluideType || form.fluideType,
          chargeNominaleKg: Number(eq.chargeNominaleKg) || 0,
          teqCO2:
            eq.teqCO2 ??
            calcTeqCO2FromFluide(Number(eq.chargeNominaleKg) || 0, eq.fluideType || form.fluideType) ??
            undefined,
        }))
      : []
    const primary = list[0]
    upsertChantier({
      ...form,
      avecFluideFrigorigene: fluide,
      equipements: list.length ? list : undefined,
      equipementType: primary?.type || form.equipementType,
      equipementMarque: primary?.marque || form.equipementMarque,
      equipementModele: primary?.modele || form.equipementModele,
      equipementNumeroSerie: primary?.numeroSerie || form.equipementNumeroSerie,
      chargeNominaleKg: fluide ? Number(primary?.chargeNominaleKg || form.chargeNominaleKg) || 0 : 0,
      teqCO2: fluide ? primary?.teqCO2 ?? form.teqCO2 : undefined,
      fluideType: fluide ? primary?.fluideType || form.fluideType : '',
      detectionPermanente: fluide ? !!(primary?.detectionPermanente ?? form.detectionPermanente) : false,
      detailTravaux: form.detailTravaux?.trim() || '',
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
    setForm({
      ...blank(c.clientId),
      ...c,
      typeTravaux: c.typeTravaux || 'installation',
      detailTravaux: c.detailTravaux || '',
      avecFluideFrigorigene: siteAvecFluideFrigorigene(c),
      equipements: eqs,
    })
    setEquipIdx(0)
    setOpen(true)
  }

  const fluideMeta = findFluide(form.fluideType)

  const applyPlaque = (fields: PlaqueFields) => {
    patchCurrentEquip({
      type: fields.equipementType || currentEquip.type,
      marque: fields.equipementMarque || currentEquip.marque,
      modele: fields.equipementModele || currentEquip.modele,
      numeroSerie: fields.equipementNumeroSerie || currentEquip.numeroSerie,
      nom: fields.equipementType || currentEquip.nom,
      ...(fields.fluideType ? { fluideType: fields.fluideType } : {}),
      ...(fields.chargeNominaleKg != null && fields.chargeNominaleKg > 0
        ? { chargeNominaleKg: fields.chargeNominaleKg }
        : {}),
    })
  }

  const onValidateMaintenance = async (site: Chantier) => {
    if (!user?.signatureImage) {
      alert('Enregistrez d’abord votre signature dans « Ma signature ».')
      return
    }
    const n = equipementsForCerfa(site).length
    if (
      !confirm(
        `Valider la maintenance du ${today()} et générer ${n} CERFA (1 par équipement) sans resaisir ?`,
      )
    ) {
      return
    }
    setBatchBusy(site.id)
    try {
      const { drafts, site: s, client } = validateMaintenanceCerfas({
        siteId: site.id,
        dateIntervention: today(),
        signataireNom: user.signataireNom || user.fullName || '',
        signataireQualite: user.signataireQualite || 'Opérateur attesté',
        signatureOperateurImage: user.signatureImage,
        userId: user.id,
        userName: user.fullName || user.email,
      })
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
      alert(`${drafts.length} CERFA généré${drafts.length > 1 ? 's' : ''} — visibles dans CERFA / Interventions.`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Génération impossible')
    } finally {
      setBatchBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <Header
        title="Travaux / équipements"
        subtitle="Équipements sauvegardés sur le site — en maintenance, validez une fois pour régénérer tous les CERFA."
        onAdd={() => {
          setEditId(null)
          setForm(blank(data.clients[0]?.id || ''))
          setOpen(true)
        }}
      />

      <SearchField
        value={q}
        onChange={setQ}
        placeholder="Rechercher des travaux, client, fluide…"
        testId="chantiers-search"
      />

      {open && (
        <form
          onSubmit={onSubmit}
          className="grid gap-3 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-medium text-ink">Nature de l’équipement / travaux</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, avecFluideFrigorigene: true })}
                className={[
                  'flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition',
                  avecFluide
                    ? 'border-accent bg-accent-soft/60 shadow-sm'
                    : 'border-line bg-foam hover:bg-mist',
                ].join(' ')}
              >
                <Snowflake className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <span>
                  <span className="block text-sm font-semibold text-ink">
                    Contient du fluide frigorigène
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    Accès CERFA, stock gaz, charge, détection — cadre réglementaire.
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    avecFluideFrigorigene: false,
                    typeTravaux:
                      form.typeTravaux === 'controle_etancheite' ||
                      form.typeTravaux === 'recuperation'
                        ? 'ventilation_vmc'
                        : form.typeTravaux,
                  })
                }
                className={[
                  'flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition',
                  !avecFluide
                    ? 'border-accent bg-accent-soft/60 shadow-sm'
                    : 'border-line bg-foam hover:bg-mist',
                ].join(' ')}
              >
                <Wrench className="mt-0.5 h-5 w-5 shrink-0 text-slate" />
                <span>
                  <span className="block text-sm font-semibold text-ink">Travaux standard</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    Ex. installation VMC — fiche info simple, sans CERFA ni fluide.
                  </span>
                </span>
              </button>
            </div>
          </div>

          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-muted">Client / détenteur *</span>
            <select
              required
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            >
              <option value="">— Choisir —</option>
              {data.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.raisonSociale}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Nom des travaux / site *"
            value={form.nom}
            onChange={(v) => setForm({ ...form, nom: v })}
            required
            className="sm:col-span-2"
          />
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Type de travaux *</span>
            <select
              required
              value={form.typeTravaux || 'installation'}
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
            label="Précision des travaux"
            value={form.detailTravaux || ''}
            onChange={(v) => setForm({ ...form, detailTravaux: v })}
          />
          <p className="-mt-1 text-xs text-muted sm:col-span-2">
            {avecFluide
              ? 'Ex. maintenance semestrielle, installation clim bureau directeur…'
              : 'Ex. installation VMC sanitaires, remplacement extracteur cuisine…'}
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
                Équipements enregistrés {avecFluide ? '(réutilisés à chaque maintenance)' : ''}
              </p>
              {avecFluide && (
                <button
                  type="button"
                  onClick={() => {
                    const next = blankEquip()
                    const list = [...equipements, next]
                    setForm({ ...form, equipements: list })
                    setEquipIdx(list.length - 1)
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-mist"
                >
                  <Plus className="h-3.5 w-3.5" /> Ajouter un équipement
                </button>
              )}
            </div>
            {avecFluide && equipements.length > 1 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {equipements.map((eq, i) => (
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
                  </button>
                ))}
              </div>
            )}
            <PlaquePhotoButton onParsed={applyPlaque} />
          </div>

          <Field
            label="Nom / libellé équipement"
            value={currentEquip.nom || ''}
            onChange={(v) => patchCurrentEquip({ nom: v, type: currentEquip.type || v })}
          />
          <Field
            label={avecFluide ? 'Type d’équipement' : 'Équipement / matériel'}
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
          {avecFluide && equipements.length > 1 && (
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

          {avecFluide ? (
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
              Travaux standard : pas de CERFA ni de suivi fluide. Les infos ci-dessus suffisent pour
              le dossier client.
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
              onClick={() => setOpen(false)}
              className="rounded-full border border-line px-5 py-2.5 text-sm"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-3">
        {filteredChantiers.map((c) => {
          const client = data.clients.find((x) => x.id === c.clientId)
          const fluide = siteAvecFluideFrigorigene(c)
          const eqs = equipementsForCerfa(c)
          const linked = [...data.interventions]
            .filter((i) => i.chantierId === c.id)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
          const cerfaTo = linked
            ? `/app/interventions/${linked.id}`
            : `/app/interventions/new?chantier=${encodeURIComponent(c.id)}`
          const cerfaLabel = linked
            ? linked.hasCerfaPdf
              ? 'Ouvrir CERFA'
              : 'Continuer CERFA'
            : 'Ajouter CERFA'
          const typeLabel = c.typeTravaux ? TYPE_TRAVAUX_LABELS[c.typeTravaux] : null
          const canBatch = fluide && eqs.length > 0

          return (
            <div key={c.id} className="rounded-2xl border border-line bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-display text-lg font-semibold">{c.nom}</div>
                    <span
                      className={[
                        'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                        fluide ? 'bg-accent-soft text-slate' : 'bg-mist text-muted',
                      ].join(' ')}
                    >
                      {fluide ? 'Fluide / CERFA' : 'Travaux standard'}
                    </span>
                  </div>
                  <div className="text-sm text-muted">
                    {client?.raisonSociale} · {c.ville}
                    {c.createdByName ? ` · par ${c.createdByName}` : ''}
                  </div>
                  {(typeLabel || c.detailTravaux) && (
                    <div className="mt-1 text-sm text-ink">
                      {typeLabel && (
                        <span className="rounded-full bg-mist px-2.5 py-0.5 text-xs font-semibold">
                          {typeLabel}
                        </span>
                      )}
                      {c.detailTravaux ? (
                        <span className="ml-2 text-sm text-muted">{c.detailTravaux}</span>
                      ) : null}
                    </div>
                  )}
                  {fluide && (
                    <ul className="mt-2 space-y-0.5 text-xs text-muted">
                      {eqs.map((eq) => (
                        <li key={eq.id}>
                          {equipmentLabel(eq)}
                          {eq.fluideType ? ` · ${eq.fluideType}` : ''}
                          {eq.chargeNominaleKg ? ` · ${eq.chargeNominaleKg} kg` : ''}
                          {eq.numeroSerie ? ` · SN ${eq.numeroSerie}` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                  {c.derniereMaintenanceDate && (
                    <p className="mt-1.5 text-xs text-accent">
                      Dernière maintenance validée : {c.derniereMaintenanceDate}
                      {eqs.length > 1 ? ` · ${eqs.length} CERFA` : ''}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {canBatch && (
                    <button
                      type="button"
                      disabled={batchBusy === c.id}
                      onClick={() => void onValidateMaintenance(c)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-accent bg-accent-soft px-3.5 py-2 text-xs font-semibold text-slate hover:bg-accent disabled:opacity-60"
                      title="Génère un CERFA par équipement sans resaisie"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      {batchBusy === c.id
                        ? 'Génération…'
                        : eqs.length > 1
                          ? `Valider maintenance (${eqs.length} CERFA)`
                          : 'Valider maintenance + CERFA'}
                    </button>
                  )}
                  {fluide ? (
                    <Link
                      to={cerfaTo}
                      className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-2 text-xs font-semibold text-ink hover:bg-accent-hover"
                    >
                      <FileCheck2 className="h-3.5 w-3.5" />
                      {cerfaLabel}
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-foam px-3.5 py-2 text-xs font-medium text-muted">
                      <Wrench className="h-3.5 w-3.5" />
                      Info travaux
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => startEdit(c)}
                    className="rounded-lg p-2 text-accent hover:bg-accent-soft"
                    title="Modifier les travaux"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Supprimer ces travaux ?')) deleteChantier(c.id)
                    }}
                    className="rounded-lg p-2 text-danger hover:bg-red-50"
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
        {filteredChantiers.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-muted">
            {data.chantiers.length === 0
              ? 'Aucun travaux enregistré. Créez d’abord un client, puis des travaux.'
              : 'Aucun résultat pour cette recherche.'}
          </div>
        )}
      </div>
    </div>
  )
}
