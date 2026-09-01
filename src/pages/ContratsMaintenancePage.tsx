import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, FileSignature, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import { SearchField, matchesQuery } from '../components/SearchField'
import { MobileFab } from '../components/MobileFab'
import { ClientSiteSignature } from '../components/ClientSiteSignature'
import { IntervenantSignature } from '../components/IntervenantSignature'
import {
  FAMILLE_CONTRAT_LABELS,
  MODELES_CONTRAT,
  PERIODICITE_LABELS,
  STATUT_CONTRAT_LABELS,
  VISITES_PAR_AN_OPTIONS,
  createContratFromModele,
  fillCorpsContrat,
  isContratActif,
  parseFamilleContrat,
  parseVisitesParAn,
  resolveFamilleContrat,
  resolveGenererOtAuto,
  resolveSecteurContrat,
  resolveVisitesParAn,
  type ContratMaintenance,
  type FamilleContrat,
  type ModeleContratId,
  type StatutContrat,
} from '../lib/contratMaintenance'
import {
  NIVEAU_VISITE_LABELS,
  periodiciteDepuisVisites,
  visitesDepuisContrat,
} from '../lib/contratOtAuto'
import { SecteurOtSelect } from '../components/PostePersonnelSelect'
import { labelSecteurCourt } from '../lib/postePersonnel'
import { couleurMetier, COULEUR_NON_AFFECTE } from '../lib/agendaPlanning'
import { formatOtNumero, isOtCloture } from '../lib/ordreTravail'

export function ContratsMaintenancePage() {
  const {
    data,
    upsertContratMaintenance,
    deleteContratMaintenance,
    syncAgendaFromSources,
    syncOtsDepuisContrats,
  } = useStore()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const editId = params.get('id') || ''
  const clientFromQuery = params.get('client') || ''
  const newMode = params.get('new') === '1'
  const [q, setQ] = useState('')
  /** Fiche de saisie d’abord — pas directement signatures / texte long */
  const [step, setStep] = useState<'infos' | 'texte' | 'signatures'>('infos')

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
    setStep('infos')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [existing?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (form && !pickModele) {
      window.scrollTo(0, 0)
    }
  }, [step, form?.numero, pickModele]) // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => {
    return [...(data.contratsMaintenance || [])]
      .filter((c) => {
        const client = data.clients.find((x) => x.id === c.clientId)
        return matchesQuery(
          [
            c.numero,
            c.titre,
            client?.raisonSociale,
            c.statut,
            FAMILLE_CONTRAT_LABELS[resolveFamilleContrat(c)],
            labelSecteurCourt(resolveSecteurContrat(c)),
          ]
            .filter(Boolean)
            .join(' '),
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
    setStep('infos')
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
    if (form.statut === 'signe' && resolveGenererOtAuto(form)) {
      const n = syncAgendaFromSources()
      alert(
        `Contrat ${form.numero} enregistré.${
          n > 0 ? ` ${n} OT / rappel(s) de maintenance généré(s).` : ''
        }`,
      )
      return
    }
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
      `Contrat ${form.numero} signé — les OT de maintenance sont créés pour l’agenda.${
        n > 0 ? `\n${n} OT / rappel(s) généré(s).` : ''
      }\nAffectez un tech et décalez la date si besoin (urgence ou visite partielle).`,
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
              <p className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-bold uppercase tracking-wide">
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800">
                  {m.visitesParAn} visites / an
                </span>
                <span className="rounded-full bg-mist px-2 py-0.5 text-muted">
                  {FAMILLE_CONTRAT_LABELS[m.famille]}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 ${
                    (couleurMetier(m.secteur) || COULEUR_NON_AFFECTE).badge
                  }`}
                >
                  {labelSecteurCourt(m.secteur)}
                </span>
              </p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (showForm && form) {
    const client = data.clients.find((c) => c.id === form.clientId)
    const steps = [
      { id: 'infos' as const, label: '1. Fiche' },
      { id: 'texte' as const, label: '2. Texte' },
      { id: 'signatures' as const, label: '3. Signatures' },
    ]
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setForm(null)
              setStep('infos')
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

        <nav className="flex gap-1 rounded-2xl border border-line bg-white p-1" aria-label="Étapes contrat">
          {steps.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              className={[
                'min-h-11 flex-1 rounded-xl px-2 text-xs font-bold sm:text-sm',
                step === s.id
                  ? 'bg-[#0f766e] text-white'
                  : 'text-muted hover:bg-mist',
              ].join(' ')}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <form onSubmit={onSave} className="space-y-4 rounded-2xl border border-line bg-white p-4">
          {step === 'infos' ? (
            <>
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">Fiche de remplissage</h2>
                <p className="mt-0.5 text-sm text-muted">
                  Client, sites, dates et prix — ensuite le texte, puis les signatures.
                </p>
              </div>

              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-ink">Titre</span>
                <input
                  value={form.titre}
                  onChange={(e) => setForm({ ...form, titre: e.target.value })}
                  className="h-11 w-full rounded-xl border border-line px-3 font-semibold"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block font-semibold text-ink">Client *</span>
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
                  <span className="mb-1 block font-semibold text-ink">Famille / fiche</span>
                  <select
                    value={resolveFamilleContrat(form)}
                    onChange={(e) => {
                      const famille = parseFamilleContrat(e.target.value) || 'clim'
                      setForm({ ...form, famille })
                    }}
                    className="h-11 w-full rounded-xl border border-line bg-white px-3"
                  >
                    {(Object.keys(FAMILLE_CONTRAT_LABELS) as FamilleContrat[]).map((f) => (
                      <option key={f} value={f}>
                        {FAMILLE_CONTRAT_LABELS[f]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block font-semibold text-ink">Fréquence des visites</span>
                  <select
                    value={resolveVisitesParAn(form)}
                    onChange={(e) => {
                      const visitesParAn = parseVisitesParAn(e.target.value) || 1
                      setForm({
                        ...form,
                        visitesParAn,
                        periodicite: periodiciteDepuisVisites(visitesParAn),
                      })
                    }}
                    className="h-11 w-full rounded-xl border border-line bg-white px-3"
                  >
                    {VISITES_PAR_AN_OPTIONS.map((opt) => (
                      <option key={opt.n} value={opt.n}>
                        {opt.label} — {opt.hint}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs text-muted">
                    Chaufferie = 12 / an · clim = 2 (S + A) · CTA = 4 (T, S, T, A). Les OT
                    partent chaque mois du cycle pour que vous les affectiez dans l’agenda.
                  </span>
                </label>
                <SecteurOtSelect
                  value={resolveSecteurContrat(form)}
                  onChange={(secteur) => setForm({ ...form, secteur })}
                  label="Couleur / métier (CVC, frigo…)"
                />
              </div>

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={resolveGenererOtAuto(form)}
                  onChange={(e) => setForm({ ...form, genererOtAuto: e.target.checked })}
                />
                <span>
                  <span className="font-semibold text-ink">Créer les OT automatiquement</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    Dès la signature : un OT par visite / site, sans heure (à caler dans
                    l’agenda). La date se décale si le tech n’a pas pu passer ou si la visite
                    est partielle.
                  </span>
                </span>
              </label>

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
                  <span className="mb-1 block font-semibold text-ink">Début</span>
                  <input
                    type="date"
                    value={form.dateDebut}
                    onChange={(e) => setForm({ ...form, dateDebut: e.target.value })}
                    className="h-11 w-full rounded-xl border border-line px-3"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-semibold text-ink">Fin</span>
                  <input
                    type="date"
                    value={form.dateFin}
                    onChange={(e) => setForm({ ...form, dateFin: e.target.value })}
                    className="h-11 w-full rounded-xl border border-line px-3"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-semibold text-ink">Durée (libellé)</span>
                  <input
                    value={form.dureeLabel}
                    onChange={(e) => setForm({ ...form, dureeLabel: e.target.value })}
                    className="h-11 w-full rounded-xl border border-line px-3"
                    placeholder="1 an"
                  />
                </label>
              </div>

              <CalendrierVisitesPreview
                form={form}
                contratId={existing?.id || 'draft'}
                sites={sitesForClient}
                ots={(data.ordresTravail || []).filter(
                  (o) => existing?.id && o.contratId === existing.id,
                )}
                onSync={() => {
                  if (!existing?.id) {
                    alert('Enregistrez le contrat avant de générer les OT.')
                    return
                  }
                  upsertContratMaintenance({ ...form, id: existing.id })
                  const n = syncOtsDepuisContrats()
                  alert(
                    n > 0
                      ? `${n} OT de maintenance créé(s) — à affecter dans l’agenda.`
                      : 'Tous les créneaux ont déjà un OT (y compris si la date a été déplacée).',
                  )
                }}
              />

              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-ink">Prix (libellé)</span>
                <input
                  value={form.prixLabel}
                  onChange={(e) => setForm({ ...form, prixLabel: e.target.value })}
                  className="h-11 w-full rounded-xl border border-line px-3"
                  placeholder="ex. 1 200 € / an"
                />
              </label>

              <label className="block text-sm sm:w-56">
                <span className="mb-1 block font-semibold text-ink">Statut</span>
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

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    refreshCorps()
                    setStep('texte')
                  }}
                  className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-[#0f766e] px-5 text-sm font-bold text-white sm:flex-none"
                >
                  Continuer → Texte
                </button>
                <button
                  type="submit"
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-line px-5 text-sm font-semibold"
                >
                  Enregistrer
                </button>
              </div>
            </>
          ) : null}

          {step === 'texte' ? (
            <>
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">Texte du contrat</h2>
                <p className="mt-0.5 text-sm text-muted">
                  Prérempli depuis le modèle — modifiable. Vérifiez opérateur / client / sites.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={refreshCorps}
                  className="rounded-full border border-line px-4 py-2 text-xs font-semibold"
                >
                  Re-remplir depuis le modèle
                </button>
                <p className="self-center text-xs text-muted">
                  {client?.raisonSociale || '—'} · {form.chantierIds.length || 'tous'} site(s)
                </p>
              </div>

              {!data.operateur?.raisonSociale?.trim() ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                  Opérateur vide dans le texte (« — »). Complétez{' '}
                  <Link to="/app/operateur" className="font-semibold underline">
                    Mon entreprise
                  </Link>{' '}
                  puis « Re-remplir ».
                </p>
              ) : null}

              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-ink">Texte du contrat (modifiable)</span>
                <textarea
                  rows={16}
                  value={form.corps}
                  onChange={(e) => setForm({ ...form, corps: e.target.value })}
                  className="w-full rounded-xl border border-line px-3 py-2 font-mono text-xs leading-relaxed"
                />
              </label>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setStep('infos')}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-line px-4 text-sm font-semibold"
                >
                  ← Fiche
                </button>
                <button
                  type="button"
                  onClick={() => setStep('signatures')}
                  className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-[#0f766e] px-5 text-sm font-bold text-white sm:flex-none"
                >
                  Continuer → Signatures
                </button>
                <button
                  type="submit"
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-line px-5 text-sm font-semibold"
                >
                  Enregistrer
                </button>
              </div>
            </>
          ) : null}

          {step === 'signatures' ? (
            <>
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">Signatures</h2>
                <p className="mt-0.5 text-sm text-muted">
                  Opérateur + client — puis « Signer & activer » pour valider le contrat.
                </p>
              </div>

              <div className="space-y-4">
                <IntervenantSignature
                  label="Signature opérateur / société"
                  nom={form.signatureOperateurNom || user?.signataireNom || user?.fullName || ''}
                  qualite={user?.signataireQualite || 'Opérateur'}
                  image={form.signatureOperateurImage || ''}
                  onNomChange={(v) => setForm({ ...form, signatureOperateurNom: v })}
                  onQualiteChange={() => {}}
                  onImageChange={(v) => setForm({ ...form, signatureOperateurImage: v })}
                  height={140}
                />
                <ClientSiteSignature
                  siteId={form.chantierIds[0] || sitesForClient[0]?.id}
                  nom={form.signatureClientNom || client?.nomContact || ''}
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
                  type="button"
                  onClick={() => setStep('texte')}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-line px-4 text-sm font-semibold"
                >
                  ← Texte
                </button>
                <button
                  type="submit"
                  className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-line px-5 text-sm font-semibold"
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
            </>
          ) : null}
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
            Modèles types — une fois signé, les OT de maintenance se créent tout seuls (bonne
            fiche / période). Affectez le tech dans l’agenda.
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
          const secteur = resolveSecteurContrat(c)
          const col = couleurMetier(secteur) || COULEUR_NON_AFFECTE
          const visites = resolveVisitesParAn(c)
          const otsContrat = (data.ordresTravail || []).filter((o) => o.contratId === c.id)
          return (
            <article
              key={c.id}
              className={`rounded-2xl border p-4 shadow-sm ${col.border} ${col.bg}`}
            >
              <Link to={`/app/contrats?id=${encodeURIComponent(c.id)}`} className="block min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${col.badge}`}>
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
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${col.badge}`}>
                    {labelSecteurCourt(secteur)}
                  </span>
                </div>
                <p className="mt-1 font-display text-base font-semibold">{c.titre}</p>
                <p className="text-sm text-muted">
                  {client?.raisonSociale || '—'}
                  {sites.length === 1
                    ? ` · ${sites[0].nom}`
                    : sites.length > 1
                      ? ` · ${sites.length} sites`
                      : ''}
                  {` · ${FAMILLE_CONTRAT_LABELS[resolveFamilleContrat(c)]}`}
                  {` · ${visites} visites / an`}
                  {otsContrat.length > 0 ? ` · ${otsContrat.length} OT` : ''}
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

function CalendrierVisitesPreview({
  form,
  contratId,
  sites,
  ots,
  onSync,
}: {
  form: Omit<ContratMaintenance, 'id' | 'createdAt' | 'updatedAt'>
  contratId: string
  sites: { id: string; clientId: string; nom: string; agenceCode?: string }[]
  ots: { id: string; numero: string; date: string; contratOtKey?: string; statut: string; visiteNiveau?: string }[]
  onSync: () => void
}) {
  const visites = visitesDepuisContrat(
    { ...form, id: contratId, createdAt: '', updatedAt: '' },
    sites,
  )
  const byKey = new Map(ots.filter((o) => o.contratOtKey).map((o) => [o.contratOtKey!, o]))
  return (
    <div className="rounded-2xl border border-line bg-mist/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-ink">Calendrier des visites</p>
          <p className="text-xs text-muted">
            {resolveVisitesParAn(form)} passage(s) / an · fiche{' '}
            {FAMILLE_CONTRAT_LABELS[resolveFamilleContrat(form)]} ·{' '}
            {PERIODICITE_LABELS[form.periodicite].toLowerCase()}
          </p>
        </div>
        {form.statut === 'signe' ? (
          <button
            type="button"
            onClick={onSync}
            className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold"
          >
            Générer / sync les OT
          </button>
        ) : (
          <p className="text-[11px] text-muted">Les OT se créent à la signature.</p>
        )}
      </div>
      {visites.length === 0 ? (
        <p className="mt-2 text-xs text-amber-800">
          Aucune visite dans la fenêtre (ajoutez un site et une date de début).
        </p>
      ) : (
        <ul className="mt-2 max-h-56 space-y-1 overflow-auto text-xs">
          {visites.slice(0, 24).map((v) => {
            const ot = byKey.get(v.contratOtKey)
            return (
              <li
                key={v.contratOtKey}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-2 py-1.5"
              >
                <span>
                  <span className="font-bold">{v.date}</span>
                  {` · ${NIVEAU_VISITE_LABELS[v.niveau]}`}
                  {sites.length > 1 ? ` · ${v.siteNom}` : ''}
                </span>
                {ot ? (
                  <Link
                    to={`/app/appel?ot=${encodeURIComponent(ot.id)}`}
                    className="font-semibold text-emerald-800 underline"
                  >
                    {formatOtNumero(ot.numero)}
                    {isOtCloture(ot.statut) ? ' · clôturé' : ''}
                  </Link>
                ) : (
                  <span className="text-muted">OT à générer</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
