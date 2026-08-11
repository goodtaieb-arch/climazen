import { type FormEvent, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, FileCheck2, Pencil, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import {
  isBouteilleRetournee,
  needsRetourConsigne,
  type ContenantType,
  type StockItem,
} from '../lib/types'
import { Header } from './ClientsPage'
import { DecimalField } from '../components/DecimalField'
import { FluideSelect } from '../components/FluideSelect'
import { LabelHint } from '../components/LabelHint'
import { SearchField, matchesQuery } from '../components/SearchField'
import { findFluide, formatGwp } from '../lib/fluides'
import { TIP_ADR, TIP_BSFF, TIP_BOUTEILLE, TIP_RETOUR_CONSIGNE, TIP_UN } from '../lib/fieldTips'
import { mouvementsForBottle } from '../lib/stockMouvements'

function roundKg(n: number) {
  return Math.round(n * 1000) / 1000
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

const blank = (): Omit<StockItem, 'id' | 'updatedAt'> => ({
  fluide: 'R-32',
  contenantType: 'vierge',
  numeroContenant: '',
  quantiteKg: 0,
  quantiteInitialeKg: 0,
  bsffReference: '',
  codeUn: '',
  denominationAdr: '',
  notes: '',
})

const TYPES: { value: ContenantType; label: string }[] = [
  { value: 'vierge', label: 'Vierge (neuf)' },
  { value: 'regenere', label: 'Régénéré' },
  { value: 'recuperation', label: 'Récupération' },
  { value: 'transfert', label: 'Transfert' },
]

export function StockPage() {
  const { data, upsertStock, deleteStock, enregistrerRetourConsigneBouteille } = useStore()
  const { user } = useAuth()
  const [form, setForm] = useState(blank())
  const [editId, setEditId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [retourId, setRetourId] = useState<string | null>(null)
  const [retourForm, setRetourForm] = useState({
    bonRetourConsigne: '',
    bonRetourDate: today(),
    bonRetourFournisseur: '',
    bonRetourNotes: '',
  })
  const [q, setQ] = useState('')

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

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.numeroContenant.trim()) {
      alert(
        'N° de bouteille obligatoire : le registre de stock doit répertorier chaque bouteille sous son numéro propre (annexe 15497 / F-Gas).',
      )
      return
    }
    const qty = Number(form.quantiteKg) || 0
    upsertStock({
      ...form,
      quantiteKg: qty,
      quantiteInitialeKg: editId
        ? form.quantiteInitialeKg ?? qty
        : form.quantiteInitialeKg || qty,
      id: editId ?? undefined,
    })
    setOpen(false)
    setEditId(null)
  }

  const startEdit = (s: StockItem) => {
    setEditId(s.id)
    setForm({ ...s })
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

  const retourBottle = retourId ? data.stock.find((s) => s.id === retourId) : null

  return (
    <div className="space-y-6">
      <Header
        title="Stock fluides"
        subtitle="Bouteilles, mouvements CERFA, et bons de retour de consigne (bouteilles neuves vides)."
        onAdd={() => {
          setEditId(null)
          setForm(blank())
          setOpen(true)
        }}
      />

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
            onChange={(v) => setForm({ ...form, fluide: v })}
            required
          />
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Type de contenant</span>
            <select
              value={form.contenantType}
              onChange={(e) => setForm({ ...form, contenantType: e.target.value as ContenantType })}
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <LabelHint label="N° de bouteille / contenant *" tip={TIP_BOUTEILLE}>
            <input
              required
              value={form.numeroContenant}
              onChange={(e) => setForm({ ...form, numeroContenant: e.target.value })}
              placeholder="ex. BOT-R32-001 (gravé / distributeur)"
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            />
          </LabelHint>
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
              placeholder="ex. 3163"
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            />
          </LabelHint>
          <LabelHint label="Dénomination ADR/RID" tip={TIP_ADR} className="sm:col-span-2">
            <input
              value={form.denominationAdr || ''}
              onChange={(e) => setForm({ ...form, denominationAdr: e.target.value })}
              placeholder="ex. UN 3163 Gaz liquéfié, n.s.a. (R-410A)"
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            />
          </LabelHint>
          <p className="text-xs text-muted sm:col-span-2">
            Neuve ou récup : chaque ajout / sortie sur CERFA met à jour le reste et l'historique
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
              onClick={() => setOpen(false)}
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
          className="grid gap-3 rounded-2xl border border-accent/40 bg-white p-5 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <div className="font-display text-lg font-semibold">
              Bon de retour de consigne — {retourBottle.numeroContenant}
            </div>
            <p className="mt-1 text-sm text-muted">
              Bouteille neuve vide ({retourBottle.fluide}) : preuve pour crédit fournisseur et
              contrôle d'attestation de capacité.
            </p>
          </div>
          <LabelHint label="N° bon de retour / restitution *" tip={TIP_RETOUR_CONSIGNE}>
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
                  const hist = mouvementsForBottle(data, s.id)
                  const openHist = expandedId === s.id
                  const typeLabel =
                    TYPES.find((t) => t.value === s.contenantType)?.label || s.contenantType
                  const awaitRetour = needsRetourConsigne(s)
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
                            <span className="block truncate font-semibold text-ink">
                              {s.numeroContenant || '—'}
                            </span>
                            <span className="block truncate text-xs text-muted">
                              {typeLabel}
                              {' · '}
                              {awaitRetour
                                ? 'Vide — retour consigne'
                                : s.quantiteInitialeKg != null
                                  ? `entrée ${s.quantiteInitialeKg} kg`
                                  : 'reste actuel'}
                              {hist.length > 0
                                ? ` · ${hist.length} mvt${hist.length > 1 ? 's' : ''}`
                                : ''}
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="font-display text-base font-bold text-ink">
                              {s.quantiteKg}{' '}
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
                          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                            Historique des mouvements
                          </div>
                          {hist.length === 0 ? (
                            <p className="text-sm text-muted">Aucun mouvement pour l'instant.</p>
                          ) : (
                            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white text-sm">
                              {hist.map((m) => (
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
                                      {m.note ? ` · ${m.note}` : ''}
                                      {m.kind !== 'retour_consigne'
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
                              ))}
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
    </div>
  )
}
