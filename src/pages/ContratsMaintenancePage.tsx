import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, FileSignature, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import { SearchField, matchesQuery } from '../components/SearchField'
import { MobileFab } from '../components/MobileFab'
import { SignaturePad } from '../components/SignaturePad'
import { ClientSiteSignature } from '../components/ClientSiteSignature'
import {
  MODELES_CONTRAT,
  PERIODICITE_LABELS,
  STATUT_CONTRAT_LABELS,
  createContratFromModele,
  fillCorpsContrat,
  isContratActif,
  type ContratMaintenance,
  type ModeleContratId,
  type PeriodiciteContrat,
  type StatutContrat,
} from '../lib/contratMaintenance'

export function ContratsMaintenancePage() {
  const { data, upsertContratMaintenance, deleteContratMaintenance, syncAgendaFromSources } =
    useStore()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const editId = params.get('id') || ''
  const clientFromQuery = params.get('client') || ''
  const newMode = params.get('new') === '1'
  const [q, setQ] = useState('')

  const existing = useMemo(
    () => (data.contratsMaintenance || []).find((c) => c.id === editId) || null,
    [data.contratsMaintenance, editId],
  )

  const [pickModele, setPickModele] = useState(newMode && !editId)
  const [form, setForm] = useState<Omit<ContratMaintenance, 'id' | 'createdAt' | 'updatedAt'> | null>(
    null,
  )

  useEffect(() => {
    if (!existing) return
    const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = existing
    setForm(rest)
    setPickModele(false)
  }, [existing?.id, existing?.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => {
    return [...(data.contratsMaintenance || [])]
      .filter((c) => {
        const client = data.clients.find((x) => x.id === c.clientId)
        return matchesQuery(
          [c.numero, c.titre, client?.raisonSociale, c.statut].filter(Boolean).join(' '),
          q,
        )
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [data.contratsMaintenance, data.clients, q])

  const sitesForClient = useMemo(() => {
    if (!form?.clientId) return []
    return data.chantiers.filter((s) => s.clientId === form.clientId)
  }, [data.chantiers, form?.clientId])

  const startFromModele = (modeleId: ModeleContratId) => {
    const clientId = clientFromQuery || data.clients[0]?.id || ''
    const client = data.clients.find((c) => c.id === clientId)
    const sites = data.chantiers.filter((s) => s.clientId === clientId)
    const draft = createContratFromModele(
      modeleId,
      {
        clientId,
        chantierIds: sites.map((s) => s.id),
        operateur: data.operateur,
        client: client || {},
        sites,
      },
      data.contratsMaintenance || [],
    )
    setForm(draft)
    setPickModele(false)
    navigate('/app/contrats?new=1', { replace: true })
  }

  const refreshCorps = () => {
    if (!form) return
    const modele = MODELES_CONTRAT.find((m) => m.id === form.modeleId)
    if (!modele) return
    const client = data.clients.find((c) => c.id === form.clientId)
    const sites = data.chantiers.filter(
      (s) =>
        s.clientId === form.clientId &&
        (form.chantierIds.length === 0 || form.chantierIds.includes(s.id)),
    )
    setForm({
      ...form,
      corps: fillCorpsContrat(
        { ...modele, prestations: form.prestations },
        {
          operateur: data.operateur,
          client: client || {},
          sites,
        },
        {
          dureeLabel: form.dureeLabel,
          prixLabel: form.prixLabel,
          periodicite: form.periodicite,
        },
      ),
    })
  }

  const onSave = (e: FormEvent) => {
    e.preventDefault()
    if (!form) return
    if (!form.clientId) {
      alert('Choisissez un client.')
      return
    }
    const id = upsertContratMaintenance({
      ...form,
      id: existing?.id,
      signatureOperateurNom:
        form.signatureOperateurNom || user?.signataireNom || user?.fullName || '',
      signatureOperateurImage:
        form.signatureOperateurImage || user?.signatureImage || '',
    })
    navigate(`/app/contrats?id=${encodeURIComponent(id)}`, { replace: true })
    alert(`Contrat ${form.numero} enregistré.`)
  }

  const markSigne = () => {
    if (!form) return
    if (!form.signatureOperateurImage) {
      alert('Signature opérateur requise.')
      return
    }
    if (!form.signatureClientImage) {
      alert('Signature client requise.')
      return
    }
    const id = upsertContratMaintenance({
      ...form,
      id: existing?.id,
      statut: 'signe',
      signeAt: new Date().toISOString(),
      signatureOperateurNom:
        form.signatureOperateurNom || user?.signataireNom || user?.fullName || '',
    })
    setForm({ ...form, statut: 'signe', signeAt: new Date().toISOString() })
    navigate(`/app/contrats?id=${encodeURIComponent(id)}`, { replace: true })
    const n = syncAgendaFromSources()
    alert(
      `Contrat ${form.numero} signé — visible sur le client / les sites.${
        n > 0 ? `\n${n} rappel(s) agenda créé(s).` : ''
      }`,
    )
  }

  const showForm = !!form || pickModele

  if (pickModele) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/app/contrats')}
            className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line bg-white px-3 text-sm font-semibold"
          >
            <ArrowLeft className="h-4 w-4" /> Contrats
          </button>
          <h1 className="font-display text-xl font-bold">Choisir un modèle</h1>
        </div>
        <p className="text-sm text-muted">
          Le contrat est prérempli (opérateur, client, sites). Vous pouvez tout modifier avant
          signature.
        </p>
        <div className="grid gap-3">
          {MODELES_CONTRAT.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => startFromModele(m.id)}
              className="rounded-2xl border border-line bg-white p-4 text-left shadow-sm transition hover:border-emerald-300 active:bg-mist"
            >
              <p className="font-display text-base font-semibold text-ink">{m.titre}</p>
              <p className="mt-1 text-sm text-muted">{m.resume}</p>
              <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-emerald-800">
                {PERIODICITE_LABELS[m.periodicite]}
              </p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (showForm && form) {
    const client = data.clients.find((c) => c.id === form.clientId)
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setForm(null)
              navigate('/app/contrats')
            }}
            className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line bg-white px-3 text-sm font-semibold"
          >
            <ArrowLeft className="h-4 w-4" /> Liste
          </button>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-800">
            {form.numero}
          </span>
          <span className="rounded-full bg-mist px-2 py-0.5 text-[10px] font-bold uppercase text-muted">
            {STATUT_CONTRAT_LABELS[form.statut]}
          </span>
        </div>

        <form onSubmit={onSave} className="space-y-4 rounded-2xl border border-line bg-white p-4">
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Titre</span>
            <input
              value={form.titre}
              onChange={(e) => setForm({ ...form, titre: e.target.value })}
              className="h-11 w-full rounded-xl border border-line px-3 font-semibold"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Client *</span>
              <select
                required
                value={form.clientId}
                onChange={(e) => {
                  const clientId = e.target.value
                  const sites = data.chantiers.filter((s) => s.clientId === clientId)
                  setForm({
                    ...form,
                    clientId,
                    chantierIds: sites.map((s) => s.id),
                  })
                }}
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
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Périodicité</span>
              <select
                value={form.periodicite}
                onChange={(e) =>
                  setForm({ ...form, periodicite: e.target.value as PeriodiciteContrat })
                }
                className="h-11 w-full rounded-xl border border-line bg-white px-3"
              >
                {(Object.keys(PERIODICITE_LABELS) as PeriodiciteContrat[]).map((p) => (
                  <option key={p} value={p}>
                    {PERIODICITE_LABELS[p]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {sitesForClient.length > 0 ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-muted">
                Sites couverts {sitesForClient.length > 1 ? '(plusieurs sites)' : ''}
              </legend>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.chantierIds.length === sitesForClient.length}
                  onChange={(e) => {
                    setForm({
                      ...form,
                      chantierIds: e.target.checked ? sitesForClient.map((s) => s.id) : [],
                    })
                  }}
                />
                Tous les sites du client
              </label>
              <div className="flex flex-wrap gap-2">
                {sitesForClient.map((s) => {
                  const on = form.chantierIds.includes(s.id)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        const next = on
                          ? form.chantierIds.filter((id) => id !== s.id)
                          : [...form.chantierIds, s.id]
                        setForm({ ...form, chantierIds: next })
                      }}
                      className={[
                        'rounded-full px-3 py-1.5 text-xs font-semibold',
                        on ? 'bg-emerald-100 text-emerald-900' : 'border border-line text-muted',
                      ].join(' ')}
                    >
                      {s.nom}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          ) : (
            <p className="text-sm text-amber-800">
              Aucun site pour ce client.{' '}
              <Link className="font-semibold underline" to="/app/chantiers">
                Créer un site
              </Link>
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Début</span>
              <input
                type="date"
                value={form.dateDebut}
                onChange={(e) => setForm({ ...form, dateDebut: e.target.value })}
                className="h-11 w-full rounded-xl border border-line px-3"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Fin</span>
              <input
                type="date"
                value={form.dateFin}
                onChange={(e) => setForm({ ...form, dateFin: e.target.value })}
                className="h-11 w-full rounded-xl border border-line px-3"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Durée (libellé)</span>
              <input
                value={form.dureeLabel}
                onChange={(e) => setForm({ ...form, dureeLabel: e.target.value })}
                className="h-11 w-full rounded-xl border border-line px-3"
                placeholder="1 an"
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block text-muted">Prix (libellé)</span>
            <input
              value={form.prixLabel}
              onChange={(e) => setForm({ ...form, prixLabel: e.target.value })}
              className="h-11 w-full rounded-xl border border-line px-3"
              placeholder="ex. 1 200 € / an"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={refreshCorps}
              className="rounded-full border border-line px-4 py-2 text-xs font-semibold"
            >
              Re-remplir le texte depuis le modèle
            </button>
            <p className="text-xs text-muted self-center">
              {client?.raisonSociale || '—'} · {form.chantierIds.length || 'tous'} site(s)
            </p>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block text-muted">Texte du contrat (modifiable)</span>
            <textarea
              rows={14}
              value={form.corps}
              onChange={(e) => setForm({ ...form, corps: e.target.value })}
              className="w-full rounded-xl border border-line px-3 py-2 font-mono text-xs leading-relaxed"
            />
          </label>

          <label className="block text-sm sm:w-56">
            <span className="mb-1 block text-muted">Statut</span>
            <select
              value={form.statut}
              onChange={(e) => setForm({ ...form, statut: e.target.value as StatutContrat })}
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            >
              {(Object.keys(STATUT_CONTRAT_LABELS) as StatutContrat[]).map((s) => (
                <option key={s} value={s}>
                  {STATUT_CONTRAT_LABELS[s]}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-4">
            <SignaturePad
              label="Signature opérateur / société"
              value={form.signatureOperateurImage || ''}
              onChange={(v) => setForm({ ...form, signatureOperateurImage: v })}
              height={140}
            />
            <ClientSiteSignature
              siteId={form.chantierIds[0] || sitesForClient[0]?.id}
              nom={form.signatureClientNom || client?.raisonSociale || ''}
              qualite="Représentant client"
              image={form.signatureClientImage || ''}
              onNomChange={(v) => setForm({ ...form, signatureClientNom: v })}
              onQualiteChange={() => {}}
              onImageChange={(v) => setForm({ ...form, signatureClientImage: v })}
              height={140}
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="submit"
              className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#0f766e] px-5 text-sm font-bold text-white"
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={markSigne}
              className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-5 text-sm font-bold text-emerald-900"
            >
              <FileSignature className="h-4 w-4" /> Signer & activer
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Contrats maintenance</h1>
          <p className="mt-1 text-muted">
            Modèles types préremplis — visibles à côté du client / des sites une fois signés.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setPickModele(true)
            setForm(null)
            navigate('/app/contrats?new=1')
          }}
          className="hidden min-h-12 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-ink md:inline-flex"
        >
          <Plus className="h-4 w-4" /> Nouveau contrat
        </button>
      </div>

      <SearchField
        value={q}
        onChange={setQ}
        placeholder="N° contrat, client…"
        testId="contrat-search"
      />

      <div className="grid gap-3">
        {list.map((c) => {
          const client = data.clients.find((x) => x.id === c.clientId)
          const sites = data.chantiers.filter(
            (s) =>
              s.clientId === c.clientId &&
              (c.chantierIds.length === 0 || c.chantierIds.includes(s.id)),
          )
          return (
            <article key={c.id} className="rounded-2xl border border-line bg-white p-4 shadow-sm">
              <Link to={`/app/contrats?id=${encodeURIComponent(c.id)}`} className="block min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                    {c.numero}
                  </span>
                  {isContratActif(c) ? (
                    <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold uppercase text-teal-900">
                      Actif
                    </span>
                  ) : (
                    <span className="rounded-full bg-mist px-2 py-0.5 text-[10px] font-bold uppercase text-muted">
                      {STATUT_CONTRAT_LABELS[c.statut]}
                    </span>
                  )}
                </div>
                <p className="mt-1 font-display text-base font-semibold">{c.titre}</p>
                <p className="text-sm text-muted">
                  {client?.raisonSociale || '—'}
                  {sites.length === 1
                    ? ` · ${sites[0].nom}`
                    : sites.length > 1
                      ? ` · ${sites.length} sites`
                      : ''}
                  {` · ${PERIODICITE_LABELS[c.periodicite]}`}
                </p>
              </Link>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                <Link
                  to={`/app/contrats?id=${encodeURIComponent(c.id)}`}
                  className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-line px-3 text-xs font-semibold sm:flex-none"
                >
                  Ouvrir
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Supprimer ${c.numero} ?`)) deleteContratMaintenance(c.id)
                  }}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line px-3 text-xs font-semibold text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </article>
          )
        })}
        {list.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line bg-white px-4 py-10 text-center text-sm text-muted">
            Aucun contrat. Créez-en un depuis un modèle type.
          </div>
        )}
      </div>

      <MobileFab
        label="Nouveau contrat"
        onClick={() => {
          setPickModele(true)
          setForm(null)
          navigate('/app/contrats?new=1')
        }}
      />
    </div>
  )
}
