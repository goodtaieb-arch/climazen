import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronRight, FileCheck2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import {
  CONTENANT_TYPE_LABELS,
  isBouteilleRetournee,
  isContenantDestination,
  needsRetourConsigne,
  type ContenantType,
  type StockItem,
  type StockMouvement,
} from '../lib/types'
import { DecimalField } from '../components/DecimalField'
import { FluideSelect } from '../components/FluideSelect'
import { LabelHint } from '../components/LabelHint'
import { SearchField, matchesQuery } from '../components/SearchField'
import { BarcodeScanButton } from '../components/BarcodeScanButton'
import { adrInfoForFluide, findFluide, formatGwp, isFluideInflammableA2LOrA3 } from '../lib/fluides'
import { TIP_ADR, TIP_BSFF, TIP_BOUTEILLE, TIP_RETOUR_CONSIGNE, TIP_UN } from '../lib/fieldTips'
import { labelEmplacement, mouvementsForBottle } from '../lib/stockMouvements'
import { resumeRegleContenant } from '../lib/stockRegles'
import { A2lConformiteCheckbox, A2lRecupAlert } from '../components/A2lRecupAlert'
import { MobileFab } from '../components/MobileFab'
import { StockBottleIcon } from '../components/StockBottleIcon'

function roundKg(n: number) {
  return Math.round(n * 1000) / 1000
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

const blank = (opts?: {
  fluide?: string
  contenantType?: ContenantType
}): Omit<StockItem, 'id' | 'updatedAt'> => {
  const fluide = opts?.fluide?.trim() || 'R-32'
  const adr = adrInfoForFluide(fluide)
  const contenantType = opts?.contenantType || 'vierge'
  return {
    fluide,
    contenantType,
    numeroContenant: '',
    quantiteKg: contenantType === 'recuperation' ? 0 : 0,
    quantiteInitialeKg: 0,
    capaciteMaxKg: contenantType === 'recuperation' ? 10 : undefined,
    emplacement: contenantType === 'transfert' ? 'atelier' : undefined,
    bsffReference: '',
    codeUn: adr?.codeUn || '',
    denominationAdr: adr?.denominationAdr || '',
    notes: '',
    conformeA2LA3: false,
    pressionEpreuveBar: undefined,
    dateReepreuvage: '',
  }
}

const TYPES: { value: ContenantType; label: string }[] = (
  Object.keys(CONTENANT_TYPE_LABELS) as ContenantType[]
).map((value) => ({ value, label: CONTENANT_TYPE_LABELS[value] }))

const TYPE_BADGE: Record<ContenantType, { label: string; cls: string }> = {
  vierge: { label: 'Vierge (neuf)', cls: 'bg-emerald-100 text-emerald-800' },
  recuperation: { label: 'Récup. déchet', cls: 'bg-orange-100 text-orange-800' },
  regenere: { label: 'Recyclé / régén.', cls: 'bg-sky-100 text-sky-800' },
  transfert: { label: 'Transfert', cls: 'bg-slate-100 text-slate-700' },
}

function applyFluideAdr(
  form: Omit<StockItem, 'id' | 'updatedAt'>,
  fluide: string,
  force = false,
): Omit<StockItem, 'id' | 'updatedAt'> {
  const adr = adrInfoForFluide(fluide)
  if (!adr) return { ...form, fluide }
  const prevAdr = adrInfoForFluide(form.fluide)
  const unWasAuto = !form.codeUn || (prevAdr && form.codeUn === prevAdr.codeUn)
  const denomWasAuto =
    !form.denominationAdr || (prevAdr && form.denominationAdr === prevAdr.denominationAdr)
  return {
    ...form,
    fluide,
    codeUn: force || unWasAuto ? adr.codeUn : form.codeUn,
    denominationAdr: force || denomWasAuto ? adr.denominationAdr : form.denominationAdr,
  }
}

function BottleLevelBar({ current, initial }: { current: number; initial: number }) {
  const cap = initial > 0 ? initial : current > 0 ? current : 0
  const pct = cap > 0 ? Math.max(0, Math.min(100, Math.round((current / cap) * 100))) : 0
  const tone =
    pct <= 15 ? 'bg-danger' : pct <= 40 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="mt-1.5 w-full min-w-[7rem] max-w-[11rem]">
      <div className="h-2 overflow-hidden rounded-full bg-mist">
        <div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-0.5 text-[10px] font-medium text-muted">
        {roundKg(current)} kg / {roundKg(cap)} kg
      </div>
    </div>
  )
}

export function StockPage() {
  const {
    data,
    upsertStock,
    deleteStock,
    enregistrerRetourConsigneBouteille,
    enregistrerDestructionBouteille,
    enregistrerTransfertInterneBouteille,
  } = useStore()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [form, setForm] = useState(blank)
  const [editId, setEditId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [regsOpen, setRegsOpen] = useState(false)
  const [retourId, setRetourId] = useState<string | null>(null)
  const [retourForm, setRetourForm] = useState({
    bonRetourConsigne: '',
    bonRetourDate: today(),
    bonRetourFournisseur: '',
    bonRetourNotes: '',
  })
  const [destrId, setDestrId] = useState<string | null>(null)
  const [destrForm, setDestrForm] = useState({
    quantiteKg: 0,
    date: today(),
    centreDestruction: '',
    documentReference: '',
    notes: '',
  })
  const [trfId, setTrfId] = useState<string | null>(null)
  const [trfForm, setTrfForm] = useState({
    versEmplacement: 'vehicule' as 'atelier' | 'vehicule',
    versLabel: '',
    date: today(),
    documentAdr: '',
    notes: '',
  })
  const [q, setQ] = useState('')

  // Prefill depuis CERFA / lien « bouteille de récupération »
  useEffect(() => {
    const type = searchParams.get('type') as ContenantType | null
    const fluide = searchParams.get('fluide') || ''
    const wantRecup = type === 'recuperation'
    if (!wantRecup && !fluide) return
    setEditId(null)
    setForm(
      blank({
        fluide: fluide || undefined,
        contenantType: wantRecup ? 'recuperation' : undefined,
      }),
    )
    setOpen(true)
    setRegsOpen(wantRecup)
    const next = new URLSearchParams(searchParams)
    next.delete('type')
    next.delete('fluide')
    setSearchParams(next, { replace: true })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const actifStock = useMemo(
    () =>
      data.stock.filter(
        (s) =>
          !isBouteilleRetournee(s) &&
          matchesQuery(
            [s.fluide, s.numeroContenant, s.contenantType, s.bsffReference, s.codeUn, s.notes]
              .filter(Boolean)
              .join(' '),
            q,
          ),
      ),
    [data.stock, q],
  )
  const retournees = useMemo(
    () =>
      data.stock.filter(
        (s) =>
          isBouteilleRetournee(s) &&
          matchesQuery(
            [s.fluide, s.numeroContenant, s.contenantType, s.bsffReference].filter(Boolean).join(' '),
            q,
          ),
      ),
    [data.stock, q],
  )

  const groups = useMemo(() => {
    const map = new Map<string, StockItem[]>()
    for (const s of actifStock) {
      const key = s.fluide || '—'
      const list = map.get(key) || []
      list.push(s)
      map.set(key, list)
    }
    return [...map.entries()]
      .map(([fluide, bottles]) => ({
        fluide,
        bottles: [...bottles].sort((a, b) =>
          (a.numeroContenant || '').localeCompare(b.numeroContenant || '', 'fr'),
        ),
        totalKg: roundKg(bottles.reduce((sum, b) => sum + (Number(b.quantiteKg) || 0), 0)),
      }))
      .sort((a, b) => a.fluide.localeCompare(b.fluide, 'fr'))
  }, [actifStock])

  const mouvementContext = (m: StockMouvement) => {
    if (!m.interventionId) return null
    const intervention = data.interventions.find((i) => i.id === m.interventionId)
    if (!intervention) return { cerfa: m.cerfaLabel, client: '', site: '' }
    const client = data.clients.find((c) => c.id === intervention.clientId)
    const site = data.chantiers.find((c) => c.id === intervention.chantierId)
    return {
      cerfa: m.cerfaLabel || intervention.cerfaPdfFileName || `CERFA`,
      client: client?.raisonSociale || '',
      site: site?.nom || '',
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.numeroContenant.trim()) {
      alert(
        'N° de bouteille obligatoire : le registre de stock doit répertorier chaque bouteille sous son numéro propre (annexe 15497 / F-Gas).',
      )
      return
    }
    let qty = Number(form.quantiteKg) || 0
    let contenantType = form.contenantType
    let capaciteMaxKg = Number(form.capaciteMaxKg) || undefined

    if (!editId && qty <= 0 && !isContenantDestination(contenantType)) {
      const ok = window.confirm(
        'Quantité à 0 kg : une bouteille Vierge doit arriver pleine (achat). Pour une destination de vidange, choisissez Récupération / Recyclé / Transfert.\n\nPasser en Récupération vide ?',
      )
      if (ok) {
        contenantType = 'recuperation'
        capaciteMaxKg = capaciteMaxKg || 10
      } else {
        return
      }
    }

    if (contenantType === 'vierge' && qty <= 0) {
      alert('Bouteille vierge (neuf) : indiquez la quantité à l’entrée (kg) > 0.')
      return
    }

    if (contenantType === 'recuperation') {
      if (!capaciteMaxKg || capaciteMaxKg <= 0) {
        alert('Bouteille de récupération : capacité max (kg) obligatoire pour éviter la surcharge.')
        return
      }
      if (qty > capaciteMaxKg + 1e-9) {
        alert(`Quantité (${qty} kg) supérieure à la capacité max (${capaciteMaxKg} kg).`)
        return
      }
      if (isFluideInflammableA2LOrA3(form.fluide) && !form.conformeA2LA3) {
        alert(
          'Fluide inflammable (A2L/A3) : cochez la confirmation « bouteille certifiée A2L/A3 » (collerette rouge + pas à gauche).',
        )
        return
      }
    }

    upsertStock({
      ...form,
      contenantType,
      capaciteMaxKg:
        contenantType === 'recuperation' || contenantType === 'regenere' || contenantType === 'transfert'
          ? capaciteMaxKg
          : form.capaciteMaxKg,
      emplacement: contenantType === 'transfert' ? form.emplacement || 'atelier' : form.emplacement,
      emplacementLabel:
        (contenantType === 'transfert' ? form.emplacement || 'atelier' : form.emplacement) ===
        'vehicule'
          ? form.emplacementLabel?.trim() || undefined
          : undefined,
      quantiteKg: qty,
      quantiteInitialeKg: editId
        ? form.quantiteInitialeKg ?? qty
        : form.quantiteInitialeKg || qty,
      id: editId ?? undefined,
    })
    setOpen(false)
    setEditId(null)
    setRegsOpen(false)
  }

  const startEdit = (s: StockItem) => {
    setEditId(s.id)
    setForm({ ...s })
    setRegsOpen(Boolean(s.bsffReference || s.codeUn || s.denominationAdr))
    setOpen(true)
  }

  const openRetour = (s: StockItem) => {
    setRetourId(s.id)
    setRetourForm({
      bonRetourConsigne: '',
      bonRetourDate: today(),
      bonRetourFournisseur: '',
      bonRetourNotes: '',
    })
  }

  const submitRetour = (e: FormEvent) => {
    e.preventDefault()
    if (!retourId) return
    try {
      enregistrerRetourConsigneBouteille({
        stockItemId: retourId,
        ...retourForm,
        createdByName: user?.fullName || user?.email || user?.username,
      })
      setRetourId(null)
      setExpandedId(retourId)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur retour consigne')
    }
  }

  const openDestruction = (s: StockItem) => {
    setDestrId(s.id)
    setDestrForm({
      quantiteKg: Number(s.quantiteKg) || 0,
      date: today(),
      centreDestruction: '',
      documentReference: s.bsffReference || '',
      notes: '',
    })
  }

  const submitDestruction = (e: FormEvent) => {
    e.preventDefault()
    if (!destrId) return
    try {
      enregistrerDestructionBouteille({
        stockItemId: destrId,
        ...destrForm,
        createdByName: user?.fullName || user?.email || user?.username,
      })
      setDestrId(null)
      setExpandedId(destrId)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur destruction / BSFF')
    }
  }

  const openTransfert = (s: StockItem) => {
    const from = s.emplacement || 'atelier'
    setTrfId(s.id)
    setTrfForm({
      versEmplacement: from === 'vehicule' ? 'atelier' : 'vehicule',
      versLabel: from === 'vehicule' ? '' : s.emplacementLabel || '',
      date: today(),
      documentAdr: '',
      notes: '',
    })
  }

  const submitTransfert = (e: FormEvent) => {
    e.preventDefault()
    if (!trfId) return
    try {
      enregistrerTransfertInterneBouteille({
        stockItemId: trfId,
        versEmplacement: trfForm.versEmplacement,
        versLabel: trfForm.versLabel,
        date: trfForm.date,
        documentAdr: trfForm.documentAdr,
        notes: trfForm.notes,
        createdByName: user?.fullName || user?.email || user?.username,
      })
      setTrfId(null)
      setExpandedId(trfId)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur transfert interne')
    }
  }

  const retourBottle = retourId ? data.stock.find((s) => s.id === retourId) : null
  const destrBottle = destrId ? data.stock.find((s) => s.id === destrId) : null
  const trfBottle = trfId ? data.stock.find((s) => s.id === trfId) : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <StockBottleIcon size={56} float delay="0.15s" className="shrink-0" />
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-bold tracking-tight">Stock fluides</h1>
            <p className="mt-1 text-muted">
              Bouteilles, CERFA, transferts atelier ↔ véhicule (sans CERFA), BSFF et retours
              consigne.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setEditId(null)
              setForm(blank({ contenantType: 'recuperation' }))
              setRegsOpen(true)
              setOpen(true)
            }}
            className="hidden min-h-12 items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 text-sm font-semibold text-orange-900 hover:bg-orange-100 md:inline-flex"
          >
            <Plus className="h-4 w-4" /> Récup. vide
          </button>
          <button
            type="button"
            onClick={() => {
              setEditId(null)
              setForm(blank())
              setRegsOpen(false)
              setOpen(true)
            }}
            className="hidden min-h-12 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-ink hover:bg-accent-hover md:inline-flex"
          >
            <Plus className="h-4 w-4" /> Ajouter
          </button>
        </div>
      </div>

      <SearchField
        value={q}
        onChange={setQ}
        placeholder="Rechercher fluide, n° bouteille, BSFF…"
        testId="stock-search"
      />

      {open && (
        <form
          onSubmit={onSubmit}
          className="grid gap-3 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2"
        >
          <FluideSelect
            label="Fluide"
            value={form.fluide}
            onChange={(v) =>
              setForm((f) => ({
                ...applyFluideAdr(f, v),
                conformeA2LA3: isFluideInflammableA2LOrA3(v) ? f.conformeA2LA3 : false,
              }))
            }
            required
          />
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Type de contenant</span>
            <select
              value={form.contenantType}
              onChange={(e) => {
                const contenantType = e.target.value as ContenantType
                setForm((f) => ({
                  ...f,
                  contenantType,
                  quantiteKg: contenantType === 'recuperation' && !editId ? 0 : f.quantiteKg,
                  capaciteMaxKg:
                    contenantType === 'recuperation' && !f.capaciteMaxKg ? 10 : f.capaciteMaxKg,
                  emplacement:
                    contenantType === 'transfert' ? f.emplacement || 'atelier' : undefined,
                }))
              }}
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted">{resumeRegleContenant(form.contenantType)}</p>
            {isContenantDestination(form.contenantType) ? (
              <p className="mt-1 text-xs text-orange-800">
                Destination de vidange : 0 kg OK sur le CERFA — même fluide que l’équipement.
              </p>
            ) : Number(form.quantiteKg) <= 0 ? (
              <p className="mt-1 text-xs text-amber-800">
                Vierge : quantité d’entrée &gt; 0 obligatoire (achat distributeur).
              </p>
            ) : null}
          </label>

          {(form.contenantType === 'recuperation' ||
            form.contenantType === 'regenere' ||
            form.contenantType === 'transfert') && (
            <DecimalField
              label={
                form.contenantType === 'recuperation'
                  ? 'Capacité max (kg) *'
                  : 'Capacité max (kg)'
              }
              value={form.capaciteMaxKg ?? 0}
              onChange={(n) => setForm({ ...form, capaciteMaxKg: n })}
              placeholder="ex. 10"
              emptyZero
            />
          )}

          {form.contenantType === 'recuperation' && isFluideInflammableA2LOrA3(form.fluide) && (
            <div className="space-y-2 sm:col-span-2">
              <A2lRecupAlert fluide={form.fluide} />
              <A2lConformiteCheckbox
                fluide={form.fluide}
                checked={!!form.conformeA2LA3}
                onChange={(v) => setForm({ ...form, conformeA2LA3: v })}
                id="stock-conforme-a2l"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <DecimalField
                  label="Pression d’épreuve PH (bar)"
                  value={form.pressionEpreuveBar ?? 0}
                  onChange={(n) => setForm({ ...form, pressionEpreuveBar: n || undefined })}
                  placeholder="ex. 48"
                  emptyZero
                />
                <label className="block text-sm">
                  <span className="mb-1 block text-muted">Date de rééprouvage</span>
                  <input
                    type="date"
                    value={form.dateReepreuvage || ''}
                    onChange={(e) => setForm({ ...form, dateReepreuvage: e.target.value })}
                    className="h-11 w-full rounded-xl border border-line bg-white px-3"
                  />
                </label>
              </div>
            </div>
          )}

          {form.contenantType === 'transfert' && (
            <>
              <label className="block text-sm">
                <span className="mb-1 block text-muted">Emplacement</span>
                <select
                  value={form.emplacement || 'atelier'}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      emplacement: e.target.value as 'atelier' | 'vehicule',
                    })
                  }
                  className="h-11 w-full rounded-xl border border-line bg-white px-3"
                >
                  <option value="atelier">Atelier / dépôt</option>
                  <option value="vehicule">Véhicule technicien</option>
                </select>
              </label>
              {form.emplacement === 'vehicule' && (
                <label className="block text-sm">
                  <span className="mb-1 block text-muted">Nom du véhicule</span>
                  <input
                    value={form.emplacementLabel || ''}
                    onChange={(e) => setForm({ ...form, emplacementLabel: e.target.value })}
                    placeholder="ex. Véhicule A"
                    className="h-11 w-full rounded-xl border border-line bg-white px-3"
                  />
                </label>
              )}
            </>
          )}

          <div className="sm:col-span-2">
            <LabelHint label="N° de bouteille / contenant *" tip={TIP_BOUTEILLE}>
              <div className="flex gap-2">
                <input
                  required
                  value={form.numeroContenant}
                  onChange={(e) => setForm({ ...form, numeroContenant: e.target.value })}
                  placeholder="ex. BOT-R32-001 (gravé / distributeur)"
                  className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-white px-3"
                />
                <BarcodeScanButton
                  onDetected={(value) => setForm({ ...form, numeroContenant: value })}
                />
              </div>
            </LabelHint>
            <p className="mt-1 text-xs text-muted">
              Sur mobile : scannez le code-barres / QR fournisseur au lieu de taper le n°.
            </p>
          </div>

          <DecimalField
            label={editId ? 'Quantité restante (kg)' : "Quantité à l'entrée (kg)"}
            value={form.quantiteKg}
            onChange={(n) => {
              setForm({
                ...form,
                quantiteKg: n,
                quantiteInitialeKg: editId ? form.quantiteInitialeKg : n,
              })
            }}
            placeholder="ex. 10,5"
          />
          {editId ? (
            <DecimalField
              label="Quantité d’entrée (kg)"
              value={form.quantiteInitialeKg ?? form.quantiteKg}
              onChange={(n) => setForm({ ...form, quantiteInitialeKg: n })}
              placeholder="capacité / entrée"
            />
          ) : (
            <div className="hidden sm:block" aria-hidden />
          )}

          <div className="sm:col-span-2 overflow-hidden rounded-xl border border-line">
            <button
              type="button"
              onClick={() => setRegsOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 bg-mist/40 px-4 py-3 text-left text-sm font-semibold"
            >
              <span>Informations réglementaires (ADR / BSFF)</span>
              {regsOpen ? (
                <ChevronDown className="h-4 w-4 text-muted" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted" />
              )}
            </button>
            {regsOpen && (
              <div className="grid gap-3 border-t border-line p-4 sm:grid-cols-2">
                <p className="text-xs text-muted sm:col-span-2">
                  Code UN et ADR sont préremplis selon le fluide — modifiables si besoin.
                </p>
                <LabelHint label="Réf. BSFF" tip={TIP_BSFF}>
                  <input
                    value={form.bsffReference || ''}
                    onChange={(e) => setForm({ ...form, bsffReference: e.target.value })}
                    placeholder={
                      form.contenantType === 'recuperation'
                        ? 'ex. BSFF-2026-XXXXXXXX'
                        : 'N/A si pas de récupération'
                    }
                    className="h-11 w-full rounded-xl border border-line bg-white px-3"
                  />
                </LabelHint>
                <LabelHint label="Code UN" tip={TIP_UN}>
                  <input
                    value={form.codeUn || ''}
                    onChange={(e) => setForm({ ...form, codeUn: e.target.value })}
                    placeholder="ex. 3252"
                    className="h-11 w-full rounded-xl border border-line bg-white px-3"
                  />
                </LabelHint>
                <LabelHint label="Dénomination ADR/RID" tip={TIP_ADR} className="sm:col-span-2">
                  <input
                    value={form.denominationAdr || ''}
                    onChange={(e) => setForm({ ...form, denominationAdr: e.target.value })}
                    placeholder="ex. UN 3252 DIFLUOROMETHANE (REFRIGERANT GAS R 32)"
                    className="h-11 w-full rounded-xl border border-line bg-white px-3"
                  />
                </LabelHint>
              </div>
            )}
          </div>

          <p className="text-xs text-muted sm:col-span-2">
            Neuve ou récup : chaque ajout / sortie sur CERFA met à jour le reste et l&apos;historique
            (ex. 10 kg → sortie 2 kg → reste 8 kg, lié au n° CERFA).
          </p>
          <div className="flex gap-2 sm:col-span-2">
            <button
              type="submit"
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink hover:bg-accent-hover"
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setRegsOpen(false)
              }}
              className="rounded-full border border-line px-5 py-2.5 text-sm"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {retourBottle && (
        <form
          onSubmit={submitRetour}
          className="grid gap-3 rounded-2xl border border-accent/40 bg-accent-soft/30 p-5 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <h2 className="font-display text-lg font-semibold">Bon de retour de consigne</h2>
            <p className="mt-1 text-sm text-muted">
              {retourBottle.numeroContenant} · {retourBottle.fluide} (bouteille neuve vide)
            </p>
          </div>
          <LabelHint label="N° bon de retour *" tip={TIP_RETOUR_CONSIGNE}>
            <input
              required
              value={retourForm.bonRetourConsigne}
              onChange={(e) =>
                setRetourForm({ ...retourForm, bonRetourConsigne: e.target.value })
              }
              placeholder="ex. BR-2026-0042"
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            />
          </LabelHint>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Date de retour *</span>
            <input
              required
              type="date"
              value={retourForm.bonRetourDate}
              onChange={(e) => setRetourForm({ ...retourForm, bonRetourDate: e.target.value })}
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-muted">Fournisseur</span>
            <input
              value={retourForm.bonRetourFournisseur}
              onChange={(e) =>
                setRetourForm({ ...retourForm, bonRetourFournisseur: e.target.value })
              }
              placeholder="ex. Distributeur fluides"
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-muted">Notes</span>
            <input
              value={retourForm.bonRetourNotes}
              onChange={(e) => setRetourForm({ ...retourForm, bonRetourNotes: e.target.value })}
              placeholder="Optionnel"
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button
              type="submit"
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink hover:bg-accent-hover"
            >
              Enregistrer le retour
            </button>
            <button
              type="button"
              onClick={() => setRetourId(null)}
              className="rounded-full border border-line px-5 py-2.5 text-sm"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {destrId && destrBottle && (
        <form
          onSubmit={submitDestruction}
          className="grid gap-3 rounded-2xl border border-orange-200 bg-orange-50/60 p-5 sm:grid-cols-2"
        >
          <p className="text-sm text-orange-950 sm:col-span-2">
            Évacuation BSFF — bouteille <strong>{destrBottle.numeroContenant}</strong> (
            {destrBottle.fluide}). Fluide usagé remis à un centre agréé (pas de réinjection CERFA).
          </p>
          <DecimalField
            label="Quantité à évacuer (kg) *"
            value={destrForm.quantiteKg}
            onChange={(n) => setDestrForm({ ...destrForm, quantiteKg: n })}
            emptyZero
          />
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Date *</span>
            <input
              required
              type="date"
              value={destrForm.date}
              onChange={(e) => setDestrForm({ ...destrForm, date: e.target.value })}
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            />
          </label>
          <LabelHint label="Réf. BSFF *" tip={TIP_BSFF}>
            <input
              required
              value={destrForm.documentReference}
              onChange={(e) => setDestrForm({ ...destrForm, documentReference: e.target.value })}
              placeholder="ex. BSFF-2026-XXXXXXXX"
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            />
          </LabelHint>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Centre / installation agréée</span>
            <input
              value={destrForm.centreDestruction}
              onChange={(e) => setDestrForm({ ...destrForm, centreDestruction: e.target.value })}
              placeholder="ex. Centre de traitement"
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-muted">Notes</span>
            <input
              value={destrForm.notes}
              onChange={(e) => setDestrForm({ ...destrForm, notes: e.target.value })}
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button
              type="submit"
              className="rounded-full bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
            >
              Enregistrer l’évacuation
            </button>
            <button
              type="button"
              onClick={() => setDestrId(null)}
              className="rounded-full border border-line bg-white px-5 py-2.5 text-sm"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {trfId && trfBottle && (
        <form
          onSubmit={submitTransfert}
          className="grid gap-3 rounded-2xl border border-sky-200 bg-sky-50/70 p-5 sm:grid-cols-2"
        >
          <div className="sm:col-span-2 space-y-1 text-sm text-sky-950">
            <p className="font-semibold">
              Transfert interne (sans CERFA) — {trfBottle.numeroContenant} · {trfBottle.fluide} ·{' '}
              {roundKg(Number(trfBottle.quantiteKg) || 0)} kg
            </p>
            <p className="text-xs">
              Emplacement actuel :{' '}
              <strong>
                {labelEmplacement(trfBottle.emplacement || 'atelier', trfBottle.emplacementLabel)}
              </strong>
              . Le fluide reste propriété de l’entreprise — registre F-Gas mis à jour, aucun CERFA
              client.
            </p>
            {(trfBottle.codeUn || trfBottle.denominationAdr) && (
              <p className="rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs">
                ADR transport : {trfBottle.codeUn || '—'}
                {trfBottle.denominationAdr ? ` · ${trfBottle.denominationAdr}` : ''} — document ADR
                / seuil 1000 points à prévoir dans le véhicule.
              </p>
            )}
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Destination *</span>
            <select
              value={trfForm.versEmplacement}
              onChange={(e) =>
                setTrfForm({
                  ...trfForm,
                  versEmplacement: e.target.value as 'atelier' | 'vehicule',
                })
              }
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            >
              <option value="atelier">Atelier / dépôt</option>
              <option value="vehicule">Véhicule</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Date *</span>
            <input
              required
              type="date"
              value={trfForm.date}
              onChange={(e) => setTrfForm({ ...trfForm, date: e.target.value })}
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            />
          </label>
          {trfForm.versEmplacement === 'vehicule' && (
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-muted">Nom du véhicule *</span>
              <input
                required
                value={trfForm.versLabel}
                onChange={(e) => setTrfForm({ ...trfForm, versLabel: e.target.value })}
                placeholder="ex. Véhicule A"
                className="h-11 w-full rounded-xl border border-line bg-white px-3"
              />
            </label>
          )}
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-muted">Réf. document ADR (optionnel)</span>
            <input
              value={trfForm.documentAdr}
              onChange={(e) => setTrfForm({ ...trfForm, documentAdr: e.target.value })}
              placeholder="ex. Déclaration transport / n° doc."
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-muted">Notes</span>
            <input
              value={trfForm.notes}
              onChange={(e) => setTrfForm({ ...trfForm, notes: e.target.value })}
              placeholder="ex. Préparation tournée"
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button
              type="submit"
              className="rounded-full bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-800"
            >
              Enregistrer le transfert
            </button>
            <button
              type="button"
              onClick={() => setTrfId(null)}
              className="rounded-full border border-line bg-white px-5 py-2.5 text-sm"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {groups.map((group) => {
          const f = findFluide(group.fluide)
          return (
            <section
              key={group.fluide}
              className="overflow-hidden rounded-2xl border border-accent/25 bg-white"
            >
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-accent/20 bg-accent-soft/40 px-4 py-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Type de gaz
                  </div>
                  <div className="font-display text-xl font-bold text-ink">{group.fluide}</div>
                  <div className="mt-0.5 text-xs text-muted">
                    {group.bottles.length} bouteille
                    {group.bottles.length > 1 ? 's' : ''}
                    {f ? ` · GWP ${formatGwp(f)}` : ''}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Quantité totale
                  </div>
                  <div className="font-display text-2xl font-bold text-ink">
                    {group.totalKg}{' '}
                    <span className="text-base font-semibold text-muted">kg</span>
                  </div>
                </div>
              </div>

              <ul className="divide-y divide-line">
                {group.bottles.map((s) => {
                  const hist = [...mouvementsForBottle(data, s.id)].sort((a, b) =>
                    (b.date || '').localeCompare(a.date || ''),
                  )
                  const openHist = expandedId === s.id
                  const badge = TYPE_BADGE[s.contenantType] || TYPE_BADGE.transfert
                  const awaitRetour = needsRetourConsigne(s)
                  const initial =
                    Number(s.capaciteMaxKg) ||
                    Number(s.quantiteInitialeKg) ||
                    Number(s.quantiteKg) ||
                    0
                  const current = Number(s.quantiteKg) || 0
                  const lastCerfa = hist.find((m) => m.interventionId || m.kind === 'cerfa')
                  const lastCtx = lastCerfa ? mouvementContext(lastCerfa) : null
                  const canDestroy =
                    s.contenantType === 'recuperation' && current > 0 && !isBouteilleRetournee(s)
                  const canTransfer = !isBouteilleRetournee(s)
                  return (
                    <li key={s.id}>
                      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:px-4">
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          onClick={() => setExpandedId(openHist ? null : s.id)}
                        >
                          {openHist ? (
                            <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="truncate font-semibold text-ink">
                                {s.numeroContenant || '—'}
                              </span>
                              <span
                                className={[
                                  'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                                  badge.cls,
                                ].join(' ')}
                              >
                                {badge.label}
                              </span>
                              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-sky-900">
                                {labelEmplacement(s.emplacement || 'atelier', s.emplacementLabel)}
                              </span>
                              {s.contenantType === 'recuperation' && current > 0 && (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950">
                                  BSFF seul
                                </span>
                              )}
                              {s.contenantType === 'regenere' && s.origineClientId && (
                                <span className="rounded-full bg-sky-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-950">
                                  Même client
                                </span>
                              )}
                              {s.contenantType === 'recuperation' &&
                                isFluideInflammableA2LOrA3(s.fluide) && (
                                  <span
                                    className={[
                                      'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                                      s.conformeA2LA3
                                        ? 'bg-red-600 text-white'
                                        : 'bg-red-100 text-red-800 ring-1 ring-red-400',
                                    ].join(' ')}
                                  >
                                    {findFluide(s.fluide)?.classeSecurite || 'A2L'}
                                    {s.conformeA2LA3 ? '' : ' ?'}
                                  </span>
                                )}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-muted">
                              {awaitRetour
                                ? 'Vide — retour consigne'
                                : initial > 0
                                  ? `Entrée : ${roundKg(initial)} kg`
                                  : 'Reste actuel'}
                              {hist.length > 0
                                ? ` · ${hist.length} mvt${hist.length > 1 ? 's' : ''}`
                                : ''}
                            </span>
                            <BottleLevelBar current={current} initial={initial} />
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="font-display text-base font-bold text-ink">
                              {roundKg(current)}{' '}
                              <span className="text-xs font-semibold text-muted">kg</span>
                            </span>
                          </span>
                        </button>
                        <div className="flex shrink-0 flex-wrap items-center gap-0.5">
                          {awaitRetour && (
                            <button
                              type="button"
                              onClick={() => openRetour(s)}
                              className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-accent-hover"
                              title="Bon de retour de consigne"
                            >
                              <FileCheck2 className="h-3.5 w-3.5" />
                              Retour
                            </button>
                          )}
                          {canDestroy && (
                            <button
                              type="button"
                              onClick={() => openDestruction(s)}
                              className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-xs font-semibold text-orange-950 hover:bg-orange-100"
                              title="Évacuation BSFF / destruction"
                            >
                              BSFF
                            </button>
                          )}
                          {canTransfer && (
                            <button
                              type="button"
                              onClick={() => openTransfert(s)}
                              className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-950 hover:bg-sky-100"
                              title="Transfert interne atelier ↔ véhicule (sans CERFA)"
                            >
                              Transfert
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => startEdit(s)}
                            className="rounded-lg p-2 text-accent hover:bg-accent-soft"
                            title="Modifier"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('Supprimer cette bouteille et son historique ?'))
                                deleteStock(s.id)
                            }}
                            className="rounded-lg p-2 text-danger hover:bg-red-50"
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {openHist && (
                        <div className="border-t border-line bg-mist/40 px-4 py-3">
                          {lastCerfa && (
                            <div className="mb-3 rounded-xl border border-accent/30 bg-white px-3 py-2.5 text-sm">
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                                Dernier mouvement CERFA
                              </div>
                              <div className="mt-1 font-semibold text-ink">
                                {lastCerfa.sens === 'sortie' ? '−' : '+'}
                                {lastCerfa.quantiteKg} kg
                                {lastCtx?.cerfa ? ` · ${lastCtx.cerfa}` : ''}
                              </div>
                              <div className="mt-0.5 text-xs text-muted">
                                {[lastCtx?.client, lastCtx?.site, lastCerfa.date]
                                  .filter(Boolean)
                                  .join(' · ') || lastCerfa.date}
                              </div>
                              {lastCerfa.interventionId && (
                                <Link
                                  to={`/app/interventions/${lastCerfa.interventionId}`}
                                  className="mt-1 inline-block text-xs font-semibold text-accent hover:underline"
                                >
                                  Ouvrir la fiche →
                                </Link>
                              )}
                            </div>
                          )}
                          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                            Historique des mouvements
                          </div>
                          {hist.length === 0 ? (
                            <p className="text-sm text-muted">Aucun mouvement pour l&apos;instant.</p>
                          ) : (
                            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white text-sm">
                              {hist.map((m) => {
                                const ctx = mouvementContext(m)
                                return (
                                  <li
                                    key={m.id}
                                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                                  >
                                    <div>
                                      {m.kind === 'retour_consigne' ? (
                                        <span className="font-semibold text-accent">
                                          Retour consigne
                                          {m.bonRetourReference
                                            ? ` · ${m.bonRetourReference}`
                                            : ''}
                                        </span>
                                      ) : m.kind === 'transfert_interne' ? (
                                        <span className="font-semibold text-sky-800">
                                          Transfert interne
                                        </span>
                                      ) : m.kind === 'destruction' ? (
                                        <span className="font-semibold text-orange-800">
                                          Évacuation BSFF −{m.quantiteKg} kg
                                        </span>
                                      ) : (
                                        <span
                                          className={
                                            m.sens === 'sortie'
                                              ? 'font-semibold text-danger'
                                              : 'font-semibold text-accent'
                                          }
                                        >
                                          {m.sens === 'sortie' ? '−' : '+'}
                                          {m.quantiteKg} kg
                                        </span>
                                      )}
                                      <span className="text-muted">
                                        {' '}
                                        · {m.date}
                                        {ctx?.client ? ` · ${ctx.client}` : ''}
                                        {ctx?.site ? ` · ${ctx.site}` : ''}
                                        {m.note ? ` · ${m.note}` : ''}
                                        {m.kind !== 'retour_consigne' &&
                                        m.kind !== 'transfert_interne'
                                          ? ` · ${m.quantiteAvantKg} → ${m.quantiteApresKg} kg`
                                          : ''}
                                      </span>
                                    </div>
                                    {m.interventionId ? (
                                      <Link
                                        to={`/app/interventions/${m.interventionId}`}
                                        className="font-medium text-accent hover:underline"
                                      >
                                        {m.cerfaLabel}
                                      </Link>
                                    ) : (
                                      <span className="font-medium text-muted">{m.cerfaLabel}</span>
                                    )}
                                  </li>
                                )
                              })}
                            </ul>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}

        {retournees.length > 0 && (
          <section className="space-y-2">
            <div className="rounded-2xl border border-line bg-mist/50 px-4 py-3">
              <div className="font-display text-lg font-semibold text-ink">
                Retours de consigne (archives)
              </div>
              <p className="mt-0.5 text-xs text-muted">
                Bouteilles neuves vides retournées — conservées pour contrôle / crédit fournisseur.
              </p>
            </div>
            {retournees.map((s) => {
              const hist = mouvementsForBottle(data, s.id)
              const openHist = expandedId === s.id
              return (
                <div
                  key={s.id}
                  className="overflow-hidden rounded-2xl border border-line bg-white"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setExpandedId(openHist ? null : s.id)}
                    >
                      <div className="font-display font-semibold">
                        {s.numeroContenant} · {s.fluide}
                      </div>
                      <div className="mt-1 text-sm text-muted">
                        Bon {s.bonRetourConsigne}
                        {s.bonRetourDate ? ` · ${s.bonRetourDate}` : ''}
                        {s.bonRetourFournisseur ? ` · ${s.bonRetourFournisseur}` : ''}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Supprimer cette archive et son historique ?'))
                          deleteStock(s.id)
                      }}
                      className="rounded-lg p-2 text-danger hover:bg-red-50"
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {openHist && hist.length > 0 && (
                    <div className="border-t border-line bg-mist/40 px-4 py-3 text-sm">
                      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
                        {hist.map((m) => (
                          <li key={m.id} className="px-3 py-2.5 text-muted">
                            {m.kind === 'retour_consigne'
                              ? `Retour consigne ${m.bonRetourReference || ''} · ${m.date}`
                              : `${m.sens === 'sortie' ? '−' : '+'}${m.quantiteKg} kg · ${m.cerfaLabel} · ${m.date}`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )
            })}
          </section>
        )}

        {data.stock.length === 0 && (
          <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-muted">
            Stock vide — ajoutez vos bouteilles (neuves ou récup).
          </p>
        )}
      </div>

      <MobileFab
        label="Ajouter"
        hidden={open || !!retourId || !!destrId || !!trfId}
        onClick={() => {
          setEditId(null)
          setForm(blank())
          setRegsOpen(false)
          setOpen(true)
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
      />
    </div>
  )
}
