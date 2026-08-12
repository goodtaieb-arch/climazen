import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ClipboardList, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import { SearchField, matchesQuery } from '../components/SearchField'
import { MobileFab } from '../components/MobileFab'
import { SignaturePad } from '../components/SignaturePad'
import { Cerfa3dIcon } from '../components/Cerfa3dIcon'
import {
  TYPE_OT_LABELS,
  STATUT_OT_LABELS,
  blankOrdreTravail,
  nextNumeroOt,
  type TypeOt,
  type StatutOt,
} from '../lib/ordreTravail'
import { allEquipements } from '../lib/cerfaBatch'

export function OrdresTravailPage() {
  const { data, upsertOrdreTravail, deleteOrdreTravail } = useStore()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const editId = params.get('id') || ''
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState<'tous' | TypeOt>('tous')

  const existing = useMemo(
    () => (data.ordresTravail || []).find((o) => o.id === editId) || null,
    [data.ordresTravail, editId],
  )

  const [form, setForm] = useState(() => {
    if (existing) {
      const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = existing
      return rest
    }
    return {
      ...blankOrdreTravail(),
      numero: nextNumeroOt(data),
      technicien: user?.signataireNom || user?.fullName || user?.email || '',
      clientId: params.get('client') || '',
      chantierId: params.get('chantier') || '',
      equipementId: params.get('equipement') || '',
      typeOt: (params.get('type') as TypeOt) || 'entretien',
      action: params.get('action') || '',
      signatureTechnicienImage: user?.signatureImage || '',
    }
  })

  useEffect(() => {
    if (!existing) return
    const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = existing
    setForm(rest)
  }, [existing?.id, existing?.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => {
    return [...(data.ordresTravail || [])]
      .filter((o) => (typeFilter === 'tous' ? true : o.typeOt === typeFilter))
      .filter((o) => {
        const client = data.clients.find((c) => c.id === o.clientId)
        const site = data.chantiers.find((c) => c.id === o.chantierId)
        return matchesQuery(
          [o.numero, o.action, o.typeOt, o.technicien, client?.raisonSociale, site?.nom, o.statut]
            .filter(Boolean)
            .join(' '),
          q,
        )
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [data.ordresTravail, data.clients, data.chantiers, q, typeFilter])

  const site = data.chantiers.find((c) => c.id === form.chantierId)
  const eqs = site ? allEquipements(site) : []

  const onSave = (e: FormEvent) => {
    e.preventDefault()
    if (!form.action.trim()) {
      alert('Indiquez l’action / mission de l’OT.')
      return
    }
    const id = upsertOrdreTravail({
      ...form,
      id: existing?.id,
      signatureTechnicienImage:
        form.signatureTechnicienImage || user?.signatureImage || '',
      signatureClientImage:
        form.signatureClientImage || site?.signatureDetenteurImage || '',
    })
    navigate(`/app/ot?id=${encodeURIComponent(id)}`, { replace: true })
    alert(`OT enregistré — ${form.numero}`)
  }

  const openNew = () => {
    navigate('/app/ot?new=1')
    setForm({
      ...blankOrdreTravail(),
      numero: nextNumeroOt(data),
      technicien: user?.signataireNom || user?.fullName || user?.email || '',
      signatureTechnicienImage: user?.signatureImage || '',
    })
  }

  const showForm = !!editId || params.get('new') === '1'

  if (showForm) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/app/ot')}
            className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line bg-white px-3 text-sm font-semibold"
          >
            <ArrowLeft className="h-4 w-4" /> Liste OT
          </button>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-800">
            {form.numero || 'Nouvel OT'}
          </span>
        </div>

        <form onSubmit={onSave} className="space-y-4 rounded-2xl border border-line bg-white p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="mb-1 block text-muted">N° OT</span>
              <input
                value={form.numero}
                onChange={(e) => setForm({ ...form, numero: e.target.value })}
                className="h-11 w-full rounded-xl border border-line px-3 font-bold tracking-wide"
                placeholder="OT20260001"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Date</span>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="h-11 w-full rounded-xl border border-line px-3"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Type d’OT</span>
              <select
                value={form.typeOt}
                onChange={(e) => setForm({ ...form, typeOt: e.target.value as TypeOt })}
                className="h-11 w-full rounded-xl border border-line bg-white px-3"
              >
                {(Object.keys(TYPE_OT_LABELS) as TypeOt[]).map((t) => (
                  <option key={t} value={t}>
                    {TYPE_OT_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Site</span>
              <select
                value={form.chantierId || ''}
                onChange={(e) => {
                  const chantierId = e.target.value
                  const s = data.chantiers.find((c) => c.id === chantierId)
                  setForm({
                    ...form,
                    chantierId,
                    clientId: s?.clientId || form.clientId,
                    equipementId: '',
                    signatureClientImage:
                      s?.signatureDetenteurImage || form.signatureClientImage || '',
                  })
                }}
                className="h-11 w-full rounded-xl border border-line bg-white px-3"
              >
                <option value="">— Choisir —</option>
                {data.chantiers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Équipement</span>
              <select
                value={form.equipementId || ''}
                onChange={(e) => setForm({ ...form, equipementId: e.target.value })}
                className="h-11 w-full rounded-xl border border-line bg-white px-3"
                disabled={!site}
              >
                <option value="">— Choisir —</option>
                {eqs.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.nom || eq.type || 'Équipement'}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block text-muted">Technicien</span>
            <input
              required
              value={form.technicien}
              onChange={(e) => setForm({ ...form, technicien: e.target.value })}
              className="h-11 w-full rounded-xl border border-line px-3"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-muted">Action / mission *</span>
            <textarea
              required
              rows={2}
              value={form.action}
              onChange={(e) => setForm({ ...form, action: e.target.value })}
              className="w-full rounded-xl border border-line px-3 py-2"
              placeholder="Ex. Contrôle étanchéité groupe froid cuisine…"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-muted">Rapport d’action</span>
            <textarea
              rows={4}
              value={form.rapportAction}
              onChange={(e) => setForm({ ...form, rapportAction: e.target.value })}
              className="w-full rounded-xl border border-line px-3 py-2"
              placeholder="Ce qui a été fait sur place…"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-muted">Observations</span>
            <textarea
              rows={3}
              value={form.observations}
              onChange={(e) => setForm({ ...form, observations: e.target.value })}
              className="w-full rounded-xl border border-line px-3 py-2"
              placeholder="Remarques, réserves, pièces à commander…"
            />
          </label>

          <label className="block text-sm sm:w-56">
            <span className="mb-1 block text-muted">Statut</span>
            <select
              value={form.statut}
              onChange={(e) => setForm({ ...form, statut: e.target.value as StatutOt })}
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            >
              {(Object.keys(STATUT_OT_LABELS) as StatutOt[]).map((s) => (
                <option key={s} value={s}>
                  {STATUT_OT_LABELS[s]}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <SignaturePad
              label="Signature technicien"
              value={form.signatureTechnicienImage || ''}
              onChange={(v) => setForm({ ...form, signatureTechnicienImage: v })}
              height={140}
            />
            <SignaturePad
              label="Signature client"
              value={form.signatureClientImage || ''}
              onChange={(v) => setForm({ ...form, signatureClientImage: v })}
              height={140}
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="submit"
              className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#0f766e] px-5 text-sm font-bold text-white"
            >
              Enregistrer l’OT
            </button>
            {form.chantierId && (
              <Link
                to={`/app/interventions/new?chantier=${encodeURIComponent(form.chantierId)}${
                  form.equipementId
                    ? `&equipement=${encodeURIComponent(form.equipementId)}`
                    : ''
                }&ot=${encodeURIComponent(existing?.id || '')}&numero=${encodeURIComponent(form.numero)}`}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold"
              >
                + CERFA lié
              </Link>
            )}
            {form.chantierId && (
              <Link
                to={`/app/fiche-maintenance-clim?chantier=${encodeURIComponent(form.chantierId)}${
                  form.equipementId
                    ? `&equipement=${encodeURIComponent(form.equipementId)}`
                    : ''
                }&numero=${encodeURIComponent(form.numero)}`}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold"
              >
                + Rapport sans CERFA
              </Link>
            )}
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Cerfa3dIcon size={52} float delay="0.1s" className="shrink-0" />
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-bold tracking-tight">Ordres de travail</h1>
            <p className="mt-1 text-muted">
              Chaque action terrain = un OT unique (OT2026xxxx) + rapport d’action.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="hidden min-h-12 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-ink hover:bg-accent-hover md:inline-flex"
        >
          <Plus className="h-4 w-4" /> Nouvel OT
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchField
          value={q}
          onChange={setQ}
          placeholder="N° OT, site, technicien…"
          testId="ot-search"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
          className="h-12 w-full rounded-xl border border-line bg-white px-3 text-base sm:w-auto md:h-11 md:text-sm"
        >
          <option value="tous">Tous les types</option>
          {(Object.keys(TYPE_OT_LABELS) as TypeOt[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_OT_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3">
        {list.map((o) => {
          const client = data.clients.find((c) => c.id === o.clientId)
          const siteRow = data.chantiers.find((c) => c.id === o.chantierId)
          return (
            <div
              key={o.id}
              className="rounded-2xl border border-line bg-white p-4 shadow-sm"
            >
              <Link to={`/app/ot?id=${encodeURIComponent(o.id)}`} className="block min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                    {o.numero}
                  </span>
                  <span className="font-display text-base font-semibold">
                    {TYPE_OT_LABELS[o.typeOt]}
                  </span>
                  <span className="rounded-full bg-mist px-2 py-0.5 text-[10px] font-bold uppercase text-muted">
                    {STATUT_OT_LABELS[o.statut]}
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink">{o.action || '—'}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {siteRow?.nom || '—'} · {client?.raisonSociale || '—'} · {o.date}
                  {o.technicien ? ` · ${o.technicien}` : ''}
                </p>
              </Link>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                <Link
                  to={`/app/ot?id=${encodeURIComponent(o.id)}`}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line px-3 text-xs font-semibold sm:flex-none"
                >
                  <ClipboardList className="h-4 w-4" /> Ouvrir
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Supprimer ${o.numero} ?`)) deleteOrdreTravail(o.id)
                  }}
                  className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-line px-3 text-xs font-semibold text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          )
        })}
        {list.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line bg-white px-4 py-10 text-center text-sm text-muted">
            Aucun OT. Créez-en un depuis Sites & Parc ou ici.
          </div>
        )}
      </div>

      <MobileFab label="Nouvel OT" onClick={openNew} />
    </div>
  )
}
