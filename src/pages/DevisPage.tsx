import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams, Navigate } from 'react-router-dom'
import { ArrowLeft, Download, FileText, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { SearchField, matchesQuery } from '../components/SearchField'
import { MobileFab } from '../components/MobileFab'
import { Field } from './ClientsPage'
import {
  STATUT_DEVIS_LABELS,
  blankDevis,
  otsPourDevis,
  type Devis,
  type StatutDevis,
} from '../lib/chaineCommerciale'
import { editionHasFeature } from '../lib/appEdition'
import { downloadDevisPdf } from '../lib/commercialPdf'
import { formatOtNumero } from '../lib/ordreTravail'

export function DevisPage() {
  const { data, appEdition, upsertDevis, deleteDevis, creerOtDepuisDevis } = useStore()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const editId = params.get('id') || ''
  const newMode = params.get('new') === '1'
  const clientFromQuery = params.get('client') || ''
  const otFromQuery = params.get('ot') || ''
  const [q, setQ] = useState('')
  const [pdfBusy, setPdfBusy] = useState(false)

  if (!editionHasFeature(appEdition, 'chaine_commerciale')) {
    return <Navigate to="/app" replace state={{ editionBlocked: true }} />
  }

  const existing = useMemo(
    () => (data.devis || []).find((d) => d.id === editId) || null,
    [data.devis, editId],
  )

  const [form, setForm] = useState<Omit<Devis, 'id' | 'createdAt' | 'updatedAt' | 'numero'> | null>(
    null,
  )

  useEffect(() => {
    if (existing) {
      const { id: _i, createdAt: _c, updatedAt: _u, numero: _n, ...rest } = existing
      setForm(rest)
      return
    }
    if (newMode || editId) {
      setForm(
        blankDevis(clientFromQuery || data.clients[0]?.id || '', {
          clientId: clientFromQuery || data.clients[0]?.id || '',
          otOrigineId: otFromQuery || undefined,
        }),
      )
    } else {
      setForm(null)
    }
  }, [existing, newMode, editId, clientFromQuery, otFromQuery, data.clients])

  const list = useMemo(() => {
    const items = [...(data.devis || [])].sort((a, b) =>
      (b.updatedAt || '').localeCompare(a.updatedAt || ''),
    )
    if (!q.trim()) return items
    return items.filter((d) => {
      const client = data.clients.find((c) => c.id === d.clientId)
      return matchesQuery(
        [d.numero, d.libelle, client?.raisonSociale, STATUT_DEVIS_LABELS[d.statut]].join(' '),
        q,
      )
    })
  }, [data.devis, data.clients, q])

  const company = {
    raisonSociale: data.operateur?.raisonSociale,
    adresse: data.operateur?.adresse,
    telephone: data.operateur?.telephone,
    email: data.operateur?.email,
    siret: data.operateur?.siret,
  }

  const pdfCtxFor = (d: Pick<Devis, 'clientId' | 'chantierId' | 'otOrigineId'>) => {
    const ot = d.otOrigineId
      ? (data.ordresTravail || []).find((o) => o.id === d.otOrigineId)
      : undefined
    return {
      company,
      clientNom: data.clients.find((c) => c.id === d.clientId)?.raisonSociale,
      siteNom: data.chantiers.find((s) => s.id === d.chantierId)?.nom,
      otNumero: ot?.numero,
    }
  }

  const save = (e: FormEvent) => {
    e.preventDefault()
    if (!form) return
    setPdfBusy(true)
    try {
      const { id, numero } = upsertDevis({ ...form, id: existing?.id, numero: existing?.numero })
      const now = new Date().toISOString()
      const devis: Devis = {
        ...form,
        id,
        numero,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      }
      downloadDevisPdf(devis, pdfCtxFor(devis))
      navigate(`/app/devis?id=${encodeURIComponent(id)}`, { replace: true })
    } finally {
      setPdfBusy(false)
    }
  }

  if (form) {
    const client = data.clients.find((c) => c.id === form.clientId)
    const ots = existing ? otsPourDevis(data.ordresTravail, existing.id) : []
    const otOrigine = form.otOrigineId
      ? (data.ordresTravail || []).find((o) => o.id === form.otOrigineId)
      : null

    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <button
          type="button"
          onClick={() => navigate('/app/devis')}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted"
        >
          <ArrowLeft className="h-4 w-4" /> Liste devis
        </button>
        <h1 className="font-display text-xl font-bold">
          {existing ? `Devis ${existing.numero}` : 'Nouveau devis'}
        </h1>
        <form onSubmit={save} className="space-y-4 rounded-2xl border border-line bg-white p-4">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Client</span>
            <select
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              className="w-full rounded-xl border border-line px-3 py-2"
              required
            >
              {data.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.raisonSociale}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Site (optionnel)</span>
            <select
              value={form.chantierId || ''}
              onChange={(e) =>
                setForm({ ...form, chantierId: e.target.value || undefined })
              }
              className="w-full rounded-xl border border-line px-3 py-2"
            >
              <option value="">—</option>
              {data.chantiers
                .filter((s) => s.clientId === form.clientId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nom}
                  </option>
                ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Lien OT (optionnel)</span>
            <select
              value={form.otOrigineId || ''}
              onChange={(e) =>
                setForm({ ...form, otOrigineId: e.target.value || undefined })
              }
              className="w-full rounded-xl border border-line px-3 py-2"
            >
              <option value="">— Aucun (devis commercial)</option>
              {(data.ordresTravail || [])
                .filter((o) => !form.clientId || o.clientId === form.clientId || !o.clientId)
                .slice()
                .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {formatOtNumero(o.numero)} · {o.action || o.typeOt || 'OT'}
                  </option>
                ))}
            </select>
            <span className="mt-1 block text-[11px] text-muted">
              Relie ce devis à un OT (ex. régularisation après dépannage).
            </span>
          </label>
          {otOrigine ? (
            <p className="text-xs text-muted">
              OT lié :{' '}
              <Link
                to={`/app/ot?id=${otOrigine.id}`}
                className="font-semibold text-accent underline"
              >
                {formatOtNumero(otOrigine.numero)}
              </Link>
            </p>
          ) : null}
          <Field
            label="Libellé"
            value={form.libelle}
            onChange={(v) => setForm({ ...form, libelle: v })}
          />
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Statut</span>
            <select
              value={form.statut}
              onChange={(e) => setForm({ ...form, statut: e.target.value as StatutDevis })}
              className="w-full rounded-xl border border-line px-3 py-2"
            >
              {(Object.keys(STATUT_DEVIS_LABELS) as StatutDevis[]).map((s) => (
                <option key={s} value={s}>
                  {STATUT_DEVIS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Montant HT (€)"
            value={form.montantHt != null ? String(form.montantHt) : ''}
            onChange={(v) =>
              setForm({ ...form, montantHt: v ? Number(v.replace(',', '.')) : undefined })
            }
          />
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Notes</span>
            <textarea
              rows={3}
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full rounded-xl border border-line px-3 py-2"
            />
          </label>
          {client ? (
            <p className="text-xs text-muted">Client : {client.raisonSociale}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pdfBusy}
              className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-ink disabled:opacity-60"
            >
              {pdfBusy ? 'PDF…' : 'Enregistrer + PDF'}
            </button>
            {existing ? (
              <button
                type="button"
                onClick={() => downloadDevisPdf(existing, pdfCtxFor(existing))}
                className="inline-flex items-center gap-1 rounded-full border border-line px-4 py-2 text-sm font-semibold"
              >
                <Download className="h-3.5 w-3.5" /> PDF
              </button>
            ) : null}
            {existing && form.statut === 'accepte' ? (
              <button
                type="button"
                onClick={() => {
                  const { id, numero } = creerOtDepuisDevis(existing.id)
                  navigate(`/app/ot?id=${encodeURIComponent(id)}`)
                  alert(`OT ${numero} créé depuis le devis.`)
                }}
                className="rounded-full border border-line px-4 py-2 text-sm font-semibold"
              >
                Créer OT d’exécution
              </button>
            ) : null}
            {existing ? (
              <button
                type="button"
                onClick={() => {
                  if (!confirm('Supprimer ce devis ?')) return
                  deleteDevis(existing.id)
                  navigate('/app/devis')
                }}
                className="inline-flex items-center gap-1 rounded-full border border-danger/30 px-4 py-2 text-sm font-semibold text-danger"
              >
                <Trash2 className="h-3.5 w-3.5" /> Supprimer
              </button>
            ) : null}
          </div>
          {ots.length ? (
            <div className="border-t border-line pt-3 text-sm">
              <p className="font-semibold">OT liés</p>
              <ul className="mt-1 space-y-1">
                {ots.map((o) => (
                  <li key={o.id}>
                    <Link to={`/app/ot?id=${o.id}`} className="text-accent underline">
                      {o.numero}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </form>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-xl font-bold">Devis</h1>
        <Link
          to="/app/devis?new=1"
          className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-2 text-xs font-bold text-ink"
        >
          <Plus className="h-4 w-4" /> Nouveau
        </Link>
      </div>
      <SearchField value={q} onChange={setQ} placeholder="Chercher un devis…" />
      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
          <FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />
          Aucun devis — créez-en un ou générez une régularisation depuis un OT.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
          {list.map((d) => {
            const client = data.clients.find((c) => c.id === d.clientId)
            return (
              <li key={d.id}>
                <Link
                  to={`/app/devis?id=${d.id}`}
                  className="flex items-center gap-3 px-4 py-3 active:bg-mist"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">
                      {d.numero} · {d.libelle}
                    </p>
                    <p className="text-xs text-muted">
                      {client?.raisonSociale || '—'} · {STATUT_DEVIS_LABELS[d.statut]}
                      {d.montantHt != null ? ` · ${d.montantHt} € HT` : ''}
                      {d.otOrigineId ? ' · lié OT' : ''}
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      <MobileFab to="/app/devis?new=1" label="Nouveau devis" />
    </div>
  )
}
