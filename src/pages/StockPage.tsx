import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import type { ContenantType, StockItem } from '../lib/types'
import { Header } from './ClientsPage'
import { DecimalField } from '../components/DecimalField'
import { FluideSelect } from '../components/FluideSelect'
import { LabelHint } from '../components/LabelHint'
import { findFluide, formatGwp } from '../lib/fluides'
import { TIP_ADR, TIP_BSFF, TIP_BOUTEILLE, TIP_UN } from '../lib/fieldTips'
import { mouvementsForBottle } from '../lib/stockMouvements'

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
  const { data, upsertStock, deleteStock } = useStore()
  const [form, setForm] = useState(blank())
  const [editId, setEditId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

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

  return (
    <div className="space-y-6">
      <Header
        title="Stock fluides"
        subtitle="Bouteilles + historique des mouvements liés aux CERFA (ajouts / sorties)."
        onAdd={() => {
          setEditId(null)
          setForm(blank())
          setOpen(true)
        }}
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
            label={editId ? 'Quantité restante (kg)' : 'Quantité à l’entrée (kg)'}
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
            Neuve ou récup : chaque ajout / sortie sur CERFA met à jour le reste et l’historique
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

      <div className="space-y-3">
        {data.stock.map((s) => {
          const f = findFluide(s.fluide)
          const hist = mouvementsForBottle(data, s.id)
          const openHist = expandedId === s.id
          return (
            <div key={s.id} className="overflow-hidden rounded-2xl border border-line bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-start gap-2 text-left"
                  onClick={() => setExpandedId(openHist ? null : s.id)}
                >
                  {openHist ? (
                    <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted" />
                  ) : (
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted" />
                  )}
                  <div className="min-w-0">
                    <div className="font-display font-semibold">
                      {s.numeroContenant}{' '}
                      <span className="text-sm font-normal text-muted">· {s.fluide}</span>
                    </div>
                    <div className="text-sm text-muted">
                      {TYPES.find((t) => t.value === s.contenantType)?.label || s.contenantType}
                      {' · '}
                      <strong className="text-ink">reste {s.quantiteKg} kg</strong>
                      {s.quantiteInitialeKg != null ? ` / entrée ${s.quantiteInitialeKg} kg` : ''}
                      {f ? ` · GWP ${formatGwp(f)}` : ''}
                      {hist.length > 0 ? ` · ${hist.length} mouvement${hist.length > 1 ? 's' : ''}` : ''}
                    </div>
                  </div>
                </button>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(s)}
                    className="rounded-lg p-2 text-accent hover:bg-accent-soft"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Supprimer cette bouteille et son historique ?')) deleteStock(s.id)
                    }}
                    className="rounded-lg p-2 text-danger hover:bg-red-50"
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
                    <p className="text-sm text-muted">Aucun mouvement CERFA pour l’instant.</p>
                  ) : (
                    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white text-sm">
                      {hist.map((m) => (
                        <li
                          key={m.id}
                          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                        >
                          <div>
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
                            <span className="text-muted">
                              {' '}
                              · {m.quantiteAvantKg} → {m.quantiteApresKg} kg · {m.date}
                            </span>
                          </div>
                          <Link
                            to={`/app/interventions/${m.interventionId}`}
                            className="font-medium text-accent hover:underline"
                          >
                            {m.cerfaLabel}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {data.stock.length === 0 && (
          <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-muted">
            Stock vide — ajoutez vos bouteilles (neuves ou récup).
          </p>
        )}
      </div>
    </div>
  )
}
