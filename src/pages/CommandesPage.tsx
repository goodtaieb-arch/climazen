import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams, Navigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Truck } from 'lucide-react'
import { useStore } from '../lib/store'
import { SearchField, matchesQuery } from '../components/SearchField'
import { MobileFab } from '../components/MobileFab'
import { Field } from './ClientsPage'
import {
  STATUT_COMMANDE_FOURNISSEUR_LABELS,
  type CommandeFournisseur,
  type StatutCommandeFournisseur,
} from '../lib/chaineCommerciale'
import { editionHasFeature } from '../lib/appEdition'
import { formatOtNumero } from '../lib/ordreTravail'

function blankCommande(opts?: {
  clientId?: string
  chantierId?: string
  otId?: string
  libelle?: string
}): Omit<CommandeFournisseur, 'id' | 'createdAt' | 'updatedAt' | 'numero'> {
  return {
    fournisseur: '',
    libelle: opts?.libelle || '',
    statut: 'commandee',
    clientId: opts?.clientId,
    chantierId: opts?.chantierId,
    otId: opts?.otId,
    quantite: 1,
  }
}

export function CommandesPage() {
  const {
    data,
    appEdition,
    upsertCommandeFournisseur,
    deleteCommandeFournisseur,
    marquerCommandeRecue,
  } = useStore()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const editId = params.get('id') || ''
  const newMode = params.get('new') === '1'
  const otFromQuery = params.get('ot') || ''
  const clientFromQuery = params.get('client') || ''
  const chantierFromQuery = params.get('chantier') || ''
  const [q, setQ] = useState('')

  if (!editionHasFeature(appEdition, 'chaine_commerciale')) {
    return <Navigate to="/app" replace state={{ editionBlocked: true }} />
  }

  const existing = useMemo(
    () => (data.commandesFournisseur || []).find((c) => c.id === editId) || null,
    [data.commandesFournisseur, editId],
  )

  const [form, setForm] = useState<Omit<
    CommandeFournisseur,
    'id' | 'createdAt' | 'updatedAt' | 'numero'
  > | null>(null)

  useEffect(() => {
    if (existing) {
      const { id: _i, createdAt: _c, updatedAt: _u, numero: _n, ...rest } = existing
      setForm(rest)
      return
    }
    if (newMode || editId) {
      setForm(
        blankCommande({
          clientId: clientFromQuery || undefined,
          chantierId: chantierFromQuery || undefined,
          otId: otFromQuery || undefined,
        }),
      )
    } else {
      setForm(null)
    }
  }, [
    existing,
    newMode,
    editId,
    clientFromQuery,
    chantierFromQuery,
    otFromQuery,
  ])

  const list = useMemo(() => {
    const items = [...(data.commandesFournisseur || [])].sort((a, b) =>
      (b.updatedAt || '').localeCompare(a.updatedAt || ''),
    )
    if (!q.trim()) return items
    return items.filter((c) =>
      matchesQuery(
        [
          c.numero,
          c.libelle,
          c.fournisseur,
          c.referencePiece,
          STATUT_COMMANDE_FOURNISSEUR_LABELS[c.statut],
        ].join(' '),
        q,
      ),
    )
  }, [data.commandesFournisseur, q])

  const save = (e: FormEvent) => {
    e.preventDefault()
    if (!form) return
    const id = upsertCommandeFournisseur(form)
    navigate(`/app/commandes?id=${encodeURIComponent(id)}`, { replace: true })
  }

  if (form) {
    const ot = form.otId
      ? (data.ordresTravail || []).find((o) => o.id === form.otId)
      : null

    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <button
          type="button"
          onClick={() => navigate('/app/commandes')}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted"
        >
          <ArrowLeft className="h-4 w-4" /> Liste commandes
        </button>
        <h1 className="font-display text-xl font-bold">
          {existing ? `Commande ${existing.numero}` : 'Nouvelle commande fournisseur'}
        </h1>
        <form onSubmit={save} className="space-y-4 rounded-2xl border border-line bg-white p-4">
          <Field
            label="Pièce / matériel"
            value={form.libelle}
            onChange={(v) => setForm({ ...form, libelle: v })}
          />
          <Field
            label="Fournisseur"
            value={form.fournisseur}
            onChange={(v) => setForm({ ...form, fournisseur: v })}
          />
          <Field
            label="Référence pièce"
            value={form.referencePiece || ''}
            onChange={(v) => setForm({ ...form, referencePiece: v || undefined })}
          />
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Statut</span>
            <select
              value={form.statut}
              onChange={(e) =>
                setForm({ ...form, statut: e.target.value as StatutCommandeFournisseur })
              }
              className="w-full rounded-xl border border-line px-3 py-2"
            >
              {(Object.keys(STATUT_COMMANDE_FOURNISSEUR_LABELS) as StatutCommandeFournisseur[]).map(
                (s) => (
                  <option key={s} value={s}>
                    {STATUT_COMMANDE_FOURNISSEUR_LABELS[s]}
                  </option>
                ),
              )}
            </select>
          </label>
          {ot ? (
            <p className="text-xs text-muted">
              OT lié :{' '}
              <Link to={`/app/ot?id=${ot.id}`} className="font-semibold text-accent underline">
                {formatOtNumero(ot.numero)}
              </Link>
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-ink"
            >
              Enregistrer
            </button>
            {existing && existing.statut !== 'recue' ? (
              <button
                type="button"
                onClick={() => {
                  marquerCommandeRecue(existing.id)
                  setForm({ ...form, statut: 'recue' })
                  alert('Commande reçue — stock mis à jour si configuré.')
                }}
                className="rounded-full border border-line px-4 py-2 text-sm font-semibold"
              >
                Marquer reçue
              </button>
            ) : null}
            {existing ? (
              <button
                type="button"
                onClick={() => {
                  if (!confirm('Supprimer cette commande ?')) return
                  deleteCommandeFournisseur(existing.id)
                  navigate('/app/commandes')
                }}
                className="inline-flex items-center gap-1 rounded-full border border-danger/30 px-4 py-2 text-sm font-semibold text-danger"
              >
                <Trash2 className="h-3.5 w-3.5" /> Supprimer
              </button>
            ) : null}
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-xl font-bold">Commandes fournisseur</h1>
        <Link
          to="/app/commandes?new=1"
          className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-2 text-xs font-bold text-ink"
        >
          <Plus className="h-4 w-4" /> Nouvelle
        </Link>
      </div>
      <SearchField value={q} onChange={setQ} placeholder="Chercher une commande…" />
      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
          <Truck className="mx-auto mb-2 h-8 w-8 opacity-40" />
          Aucune commande — créez-en depuis un OT ou ici.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
          {list.map((c) => (
            <li key={c.id}>
              <Link
                to={`/app/commandes?id=${c.id}`}
                className="flex items-center gap-3 px-4 py-3 active:bg-mist"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">
                    {c.numero} · {c.libelle}
                  </p>
                  <p className="text-xs text-muted">
                    {c.fournisseur || '—'} · {STATUT_COMMANDE_FOURNISSEUR_LABELS[c.statut]}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <MobileFab to="/app/commandes?new=1" label="Nouvelle commande" />
    </div>
  )
}
