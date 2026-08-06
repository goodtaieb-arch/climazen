import { type FormEvent, useEffect, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import type { Chantier } from '../lib/types'
import { Field, Header } from './ClientsPage'
import { DecimalField } from '../components/DecimalField'
import { FluideSelect } from '../components/FluideSelect'
import { calcTeqCO2FromFluide, findFluide, formatGwp } from '../lib/fluides'

const blank = (clientId = ''): Omit<Chantier, 'id' | 'createdAt'> => ({
  clientId,
  nom: '',
  adresse: '',
  codePostal: '',
  ville: '',
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

  useEffect(() => {
    if (!open) return
    const teq = calcTeqCO2FromFluide(Number(form.chargeNominaleKg) || 0, form.fluideType)
    if (teq === null) return
    if (form.teqCO2 === teq) return
    setForm((f) => ({ ...f, teqCO2: teq }))
  }, [form.fluideType, form.chargeNominaleKg, open]) // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const charge = Number(form.chargeNominaleKg) || 0
    const teq = calcTeqCO2FromFluide(charge, form.fluideType) ?? form.teqCO2
    upsertChantier({
      ...form,
      chargeNominaleKg: charge,
      teqCO2: teq,
      id: editId ?? undefined,
    })
    setOpen(false)
    setEditId(null)
  }

  const startEdit = (c: Chantier) => {
    setEditId(c.id)
    setForm({ ...c })
    setOpen(true)
  }

  const fluideMeta = findFluide(form.fluideType)

  return (
    <div className="space-y-6">
      <Header
        title="Chantiers / équipements"
        subtitle="Cadre [3] — type, fluide, charge et détection permanente."
        onAdd={() => {
          setEditId(null)
          setForm(blank(data.clients[0]?.id || ''))
          setOpen(true)
        }}
      />

      {open && (
        <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2">
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
          <Field label="Nom du chantier *" value={form.nom} onChange={(v) => setForm({ ...form, nom: v })} required className="sm:col-span-2" />
          <Field label="Adresse" value={form.adresse} onChange={(v) => setForm({ ...form, adresse: v })} className="sm:col-span-2" />
          <Field label="Code postal" value={form.codePostal} onChange={(v) => setForm({ ...form, codePostal: v })} />
          <Field label="Ville" value={form.ville} onChange={(v) => setForm({ ...form, ville: v })} />
          <Field label="Type d’équipement" value={form.equipementType} onChange={(v) => setForm({ ...form, equipementType: v })} />
          <Field label="Marque" value={form.equipementMarque} onChange={(v) => setForm({ ...form, equipementMarque: v })} />
          <Field label="Modèle" value={form.equipementModele} onChange={(v) => setForm({ ...form, equipementModele: v })} />
          <Field label="N° série" value={form.equipementNumeroSerie} onChange={(v) => setForm({ ...form, equipementNumeroSerie: v })} />
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
            {fluideMeta
              ? ` (${form.chargeNominaleKg || 0} × ${formatGwp(fluideMeta)})`
              : ''}
          </p>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={form.detectionPermanente}
              onChange={(e) => setForm({ ...form, detectionPermanente: e.target.checked })}
            />
            Système permanent de détection des fuites (cadre [6])
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink hover:bg-accent-hover">
              Enregistrer
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-line px-5 py-2.5 text-sm">
              Annuler
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-3">
        {data.chantiers.map((c) => {
          const client = data.clients.find((x) => x.id === c.clientId)
          return (
            <div key={c.id} className="rounded-2xl border border-line bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-display text-lg font-semibold">{c.nom}</div>
                  <div className="text-sm text-muted">
                    {client?.raisonSociale} · {c.ville} · {c.fluideType} · {c.chargeNominaleKg} kg
                    {c.teqCO2 != null && c.teqCO2 > 0 ? ` · ${c.teqCO2} t eq. CO₂` : ''}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {c.equipementMarque} {c.equipementModele} · SN {c.equipementNumeroSerie || '—'}
                    {c.detectionPermanente ? ' · Détection permanente' : ''}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => startEdit(c)} className="rounded-lg p-2 text-accent hover:bg-accent-soft">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Supprimer ce chantier ?')) deleteChantier(c.id)
                    }}
                    className="rounded-lg p-2 text-danger hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
        {data.chantiers.length === 0 && (
          <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-muted">
            Aucun chantier. Créez d’abord un client, puis un équipement.
          </p>
        )}
      </div>
    </div>
  )
}
