import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileCheck2, Pencil, Snowflake, Trash2, Wrench } from 'lucide-react'
import { useStore } from '../lib/store'
import type { Chantier, TypeTravaux } from '../lib/types'
import { siteAvecFluideFrigorigene, TYPE_TRAVAUX_LABELS } from '../lib/types'
import { Field, Header } from './ClientsPage'
import { DecimalField } from '../components/DecimalField'
import { FluideSelect } from '../components/FluideSelect'
import { PlaquePhotoButton } from '../components/PlaquePhotoButton'
import { SearchField, matchesQuery } from '../components/SearchField'
import { calcTeqCO2FromFluide, findFluide, formatGwp } from '../lib/fluides'
import type { PlaqueFields } from '../lib/plaqueOcr'

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
  fluideType: 'R-32',
  chargeNominaleKg: 0,
  teqCO2: 0,
  detectionPermanente: false,
  statut: 'actif',
  notes: '',
})

export function ChantiersPage() {
  const { data, upsertChantier, deleteChantier } = useStore()
  const [form, setForm] = useState(() => blank(data.clients[0]?.id || ''))
  const [editId, setEditId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')

  const avecFluide = form.avecFluideFrigorigene !== false

  const filteredChantiers = useMemo(() => {
    return data.chantiers.filter((c) => {
      const client = data.clients.find((cl) => cl.id === c.clientId)
      const typeLabel = c.typeTravaux ? TYPE_TRAVAUX_LABELS[c.typeTravaux] : ''
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

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const fluide = form.avecFluideFrigorigene !== false
    const charge = fluide ? Number(form.chargeNominaleKg) || 0 : 0
    const teq = fluide
      ? (calcTeqCO2FromFluide(charge, form.fluideType) ?? form.teqCO2)
      : undefined
    upsertChantier({
      ...form,
      avecFluideFrigorigene: fluide,
      chargeNominaleKg: charge,
      teqCO2: teq,
      fluideType: fluide ? form.fluideType : '',
      detectionPermanente: fluide ? form.detectionPermanente : false,
      detailTravaux: form.detailTravaux?.trim() || '',
      id: editId ?? undefined,
    })
    setOpen(false)
    setEditId(null)
  }

  const startEdit = (c: Chantier) => {
    setEditId(c.id)
    setForm({
      ...blank(c.clientId),
      ...c,
      typeTravaux: c.typeTravaux || 'installation',
      detailTravaux: c.detailTravaux || '',
      avecFluideFrigorigene: siteAvecFluideFrigorigene(c),
    })
    setOpen(true)
  }

  const fluideMeta = findFluide(form.fluideType)

  const applyPlaque = (fields: PlaqueFields) => {
    setForm((f) => {
      const next = { ...f }
      if (fields.equipementType) next.equipementType = fields.equipementType
      if (fields.equipementMarque) next.equipementMarque = fields.equipementMarque
      if (fields.equipementModele) next.equipementModele = fields.equipementModele
      if (fields.equipementNumeroSerie) next.equipementNumeroSerie = fields.equipementNumeroSerie
      if (f.avecFluideFrigorigene !== false) {
        if (fields.fluideType) next.fluideType = fields.fluideType
        if (fields.chargeNominaleKg != null && fields.chargeNominaleKg > 0) {
          next.chargeNominaleKg = fields.chargeNominaleKg
          const teq = calcTeqCO2FromFluide(
            fields.chargeNominaleKg,
            fields.fluideType || next.fluideType,
          )
          if (teq != null) next.teqCO2 = teq
        }
      }
      return next
    })
  }

  return (
    <div className="space-y-6">
      <Header
        title="Travaux / équipements"
        subtitle="Travaux standard (VMC…) ou équipement avec fluide frigorigène (CERFA)."
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
            <p className="mb-2 text-sm font-semibold text-ink">Équipement</p>
            <PlaquePhotoButton onParsed={applyPlaque} />
          </div>

          <Field
            label={avecFluide ? 'Type d’équipement' : 'Équipement / matériel'}
            value={form.equipementType}
            onChange={(v) => setForm({ ...form, equipementType: v })}
          />
          <Field
            label="Marque"
            value={form.equipementMarque}
            onChange={(v) => setForm({ ...form, equipementMarque: v })}
          />
          <Field
            label="Modèle"
            value={form.equipementModele}
            onChange={(v) => setForm({ ...form, equipementModele: v })}
          />
          <Field
            label="N° série"
            value={form.equipementNumeroSerie}
            onChange={(v) => setForm({ ...form, equipementNumeroSerie: v })}
          />

          {avecFluide ? (
            <>
              <div className="sm:col-span-2 mt-1 border-t border-line pt-3">
                <p className="text-sm font-semibold text-ink">Données fluide / CERFA</p>
                <p className="text-xs text-muted">
                  Obligatoire pour les équipements contenant un fluide frigorigène.
                </p>
              </div>
              <FluideSelect
                label="Fluide"
                value={form.fluideType}
                onChange={(v) => setForm({ ...form, fluideType: v })}
                required
              />
              <DecimalField
                label="Charge nominale (kg)"
                value={form.chargeNominaleKg}
                onChange={(n) => setForm({ ...form, chargeNominaleKg: n })}
                placeholder="ex. 2,2"
              />
              <DecimalField
                label="teq CO₂ (auto)"
                value={form.teqCO2 ?? 0}
                onChange={(n) => setForm({ ...form, teqCO2: n })}
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
                  onChange={(e) => setForm({ ...form, detectionPermanente: e.target.checked })}
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
          const linked = [...data.interventions]
            .filter((i) => i.chantierId === c.id)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
          const cerfaTo = linked
            ? `/app/interventions/${linked.id}`
            : `/app/interventions/new?chantier=${encodeURIComponent(c.id)}`
          const cerfaLabel = linked
            ? linked.hasCerfaPdf
              ? 'Régénérer CERFA'
              : 'Continuer CERFA'
            : 'Ajouter CERFA'
          const typeLabel = c.typeTravaux ? TYPE_TRAVAUX_LABELS[c.typeTravaux] : null

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
                    {fluide
                      ? ` · ${c.fluideType || '—'} · ${c.chargeNominaleKg || 0} kg${
                          c.teqCO2 != null && c.teqCO2 > 0 ? ` · ${c.teqCO2} t eq. CO₂` : ''
                        }`
                      : ''}
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
                  <div className="mt-1 text-xs text-muted">
                    {[c.equipementType, c.equipementMarque, c.equipementModele]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                    {c.equipementNumeroSerie ? ` · SN ${c.equipementNumeroSerie}` : ''}
                    {fluide && c.detectionPermanente ? ' · Détection permanente' : ''}
                  </div>
                  {fluide && linked && (
                    <p className="mt-1.5 text-xs text-muted">
                      Intervention du {linked.dateIntervention}
                      {linked.hasCerfaPdf ? ' · CERFA déjà enregistré' : ' · fiche en cours'}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {fluide ? (
                    <Link
                      to={cerfaTo}
                      title={
                        linked
                          ? 'Ouvrir la même fiche et régénérer le CERFA'
                          : 'Créer une fiche CERFA (fluide frigorigène)'
                      }
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
