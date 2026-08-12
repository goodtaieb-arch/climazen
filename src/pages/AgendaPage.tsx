import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { SearchField, matchesQuery } from '../components/SearchField'
import { MobileFab } from '../components/MobileFab'
import {
  AGENDA_STATUT_LABELS,
  AGENDA_TYPE_LABELS,
  agendaSortDate,
  blankAgendaEvent,
  isAgendaDueSoon,
  isAgendaOverdue,
  mailtoHref,
  telHref,
  type AgendaEvent,
  type AgendaEventType,
  type AgendaStatut,
} from '../lib/agenda'

function formatFr(iso?: string) {
  if (!iso) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${m[3]}/${m[2]}/${m[1]}`
}

type Filter = 'a_contacter' | 'semaine' | 'mois' | 'tous'

export function AgendaPage() {
  const {
    data,
    upsertAgendaEvent,
    deleteAgendaEvent,
    syncAgendaFromSources,
  } = useStore()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const editId = params.get('id') || ''
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('a_contacter')
  const [formOpen, setFormOpen] = useState(params.get('new') === '1')
  const [syncMsg, setSyncMsg] = useState('')

  const existing = useMemo(
    () => (data.agendaEvents || []).find((e) => e.id === editId) || null,
    [data.agendaEvents, editId],
  )

  const [form, setForm] = useState(() => blankAgendaEvent())

  useEffect(() => {
    if (!existing) return
    const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = existing
    setForm(rest)
    setFormOpen(true)
  }, [existing?.id, existing?.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Sync douce à l’ouverture
    const n = syncAgendaFromSources()
    if (n > 0) setSyncMsg(`${n} rappel(s) généré(s) depuis les contrats / contrôles.`)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const in7 = new Date()
    in7.setDate(in7.getDate() + 7)
    const limit7 = in7.toISOString().slice(0, 10)
    const in30 = new Date()
    in30.setDate(in30.getDate() + 30)
    const limit30 = in30.toISOString().slice(0, 10)

    return [...(data.agendaEvents || [])]
      .filter((e) => {
        const client = data.clients.find((c) => c.id === e.clientId)
        const site = data.chantiers.find((c) => c.id === e.chantierId)
        if (
          !matchesQuery(
            [e.title, e.notes, client?.raisonSociale, site?.nom, e.statut].filter(Boolean).join(' '),
            q,
          )
        ) {
          return false
        }
        const sort = agendaSortDate(e)
        if (filter === 'tous') return true
        if (filter === 'a_contacter') {
          return (
            (e.statut === 'a_faire' || e.statut === 'contacte') &&
            (isAgendaOverdue(e) || isAgendaDueSoon(e, 21))
          )
        }
        if (filter === 'semaine') {
          return sort >= today && sort <= limit7 && e.statut !== 'annule'
        }
        if (filter === 'mois') {
          return sort >= today && sort <= limit30 && e.statut !== 'annule'
        }
        return true
      })
      .sort((a, b) => agendaSortDate(a).localeCompare(agendaSortDate(b)))
  }, [data.agendaEvents, data.clients, data.chantiers, q, filter])

  const onSync = () => {
    const n = syncAgendaFromSources()
    setSyncMsg(
      n > 0
        ? `${n} nouveau(x) rappel(s) ajouté(s).`
        : 'Agenda à jour (contrats & contrôles déjà synchronisés).',
    )
  }

  const openNew = () => {
    setForm(blankAgendaEvent())
    setFormOpen(true)
    navigate('/app/agenda?new=1')
  }

  const onSave = (e: FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) {
      alert('Indiquez un titre.')
      return
    }
    const id = upsertAgendaEvent({
      ...form,
      id: existing?.id,
      dateRappel: form.dateRappel || form.date,
    })
    setFormOpen(false)
    navigate(`/app/agenda`, { replace: true })
    setSyncMsg(`Événement enregistré.`)
    void id
  }

  const setStatut = (ev: AgendaEvent, statut: AgendaStatut) => {
    upsertAgendaEvent({
      ...ev,
      id: ev.id,
      statut,
    })
  }

  if (formOpen) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setFormOpen(false)
              navigate('/app/agenda')
            }}
            className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line bg-white px-3 text-sm font-semibold"
          >
            <ArrowLeft className="h-4 w-4" /> Agenda
          </button>
          <h1 className="font-display text-xl font-bold">
            {existing ? 'Modifier' : 'Nouvel événement'}
          </h1>
        </div>

        <form onSubmit={onSave} className="space-y-3 rounded-2xl border border-line bg-white p-4">
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Titre *</span>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="h-11 w-full rounded-xl border border-line px-3"
              placeholder="Ex. Appeler client pour RDV maintenance"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Date rappel (appeler)</span>
              <input
                type="date"
                value={form.dateRappel || form.date}
                onChange={(e) => setForm({ ...form, dateRappel: e.target.value })}
                className="h-11 w-full rounded-xl border border-line px-3"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Date visite / échéance</span>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="h-11 w-full rounded-xl border border-line px-3"
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Type</span>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as AgendaEventType })}
                className="h-11 w-full rounded-xl border border-line bg-white px-3"
              >
                {(Object.keys(AGENDA_TYPE_LABELS) as AgendaEventType[]).map((t) => (
                  <option key={t} value={t}>
                    {AGENDA_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Statut</span>
              <select
                value={form.statut}
                onChange={(e) => setForm({ ...form, statut: e.target.value as AgendaStatut })}
                className="h-11 w-full rounded-xl border border-line bg-white px-3"
              >
                {(Object.keys(AGENDA_STATUT_LABELS) as AgendaStatut[]).map((s) => (
                  <option key={s} value={s}>
                    {AGENDA_STATUT_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Client</span>
            <select
              value={form.clientId || ''}
              onChange={(e) =>
                setForm({ ...form, clientId: e.target.value || undefined, chantierId: undefined })
              }
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            >
              <option value="">—</option>
              {data.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.raisonSociale}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Site</span>
            <select
              value={form.chantierId || ''}
              onChange={(e) => setForm({ ...form, chantierId: e.target.value || undefined })}
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
              disabled={!form.clientId}
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
            <span className="mb-1 block text-muted">Notes</span>
            <textarea
              rows={3}
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full rounded-xl border border-line px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#0f766e] px-5 text-sm font-bold text-white"
          >
            Enregistrer
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-50 text-teal-800">
            <CalendarDays className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Agenda</h1>
            <p className="mt-0.5 text-sm text-muted">
              Rappels maintenance annuelle / semestrielle — appeler pour prendre RDV.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSync}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-semibold"
          >
            <RefreshCw className="h-4 w-4" /> Sync contrats
          </button>
          <button
            type="button"
            onClick={openNew}
            className="hidden min-h-11 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-ink md:inline-flex"
          >
            <Plus className="h-4 w-4" /> Ajouter
          </button>
        </div>
      </div>

      {syncMsg ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {syncMsg}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchField
          value={q}
          onChange={setQ}
          placeholder="Client, site, titre…"
          testId="agenda-search"
        />
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['a_contacter', 'À contacter'],
              ['semaine', '7 jours'],
              ['mois', '30 jours'],
              ['tous', 'Tous'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={[
                'rounded-full px-3 py-1.5 text-xs font-bold',
                filter === id ? 'bg-accent text-ink' : 'border border-line text-muted',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        {list.map((ev) => {
          const client = data.clients.find((c) => c.id === ev.clientId)
          const site = data.chantiers.find((c) => c.id === ev.chantierId)
          const overdue = isAgendaOverdue(ev)
          const tel = telHref(client?.telephone)
          const mail = mailtoHref(
            client?.email,
            `RDV maintenance — ${site?.nom || client?.raisonSociale || ''}`,
            `Bonjour,\n\nNous souhaitons planifier la maintenance prévue vers le ${formatFr(ev.date)}.\nQuelles disponibilités avez-vous ?\n\nCordialement`,
          )
          return (
            <article
              key={ev.id}
              className={[
                'rounded-2xl border bg-white p-4 shadow-sm',
                overdue ? 'border-amber-300 bg-amber-50/40' : 'border-line',
              ].join(' ')}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold uppercase text-teal-900">
                      {AGENDA_TYPE_LABELS[ev.type]}
                    </span>
                    <span className="rounded-full bg-mist px-2 py-0.5 text-[10px] font-bold uppercase text-muted">
                      {AGENDA_STATUT_LABELS[ev.statut]}
                    </span>
                    {overdue ? (
                      <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                        En retard
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 font-display text-base font-semibold text-ink">{ev.title}</p>
                  <p className="text-sm text-muted">
                    {client?.raisonSociale || 'Client —'}
                    {site ? ` · ${site.nom}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Rappel : <strong>{formatFr(ev.dateRappel || ev.date)}</strong>
                    {' · '}
                    Visite : <strong>{formatFr(ev.date)}</strong>
                  </p>
                </div>
              </div>

              {/* Contact direct */}
              <div className="mt-3 flex flex-wrap gap-2">
                {tel ? (
                  <a
                    href={tel}
                    className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white active:bg-emerald-700 sm:flex-none"
                  >
                    <Phone className="h-4 w-4" /> Appeler
                    {client?.telephone ? (
                      <span className="text-xs font-medium opacity-90">{client.telephone}</span>
                    ) : null}
                  </a>
                ) : (
                  <span className="inline-flex min-h-12 items-center rounded-xl border border-dashed border-line px-3 text-xs text-muted">
                    Pas de téléphone
                  </span>
                )}
                {mail ? (
                  <a
                    href={mail}
                    className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink active:bg-mist sm:flex-none"
                  >
                    <Mail className="h-4 w-4" /> E-mail
                  </a>
                ) : (
                  <span className="inline-flex min-h-12 items-center rounded-xl border border-dashed border-line px-3 text-xs text-muted">
                    Pas d’e-mail
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                {ev.statut === 'a_faire' ? (
                  <button
                    type="button"
                    onClick={() => setStatut(ev, 'contacte')}
                    className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-line px-3 text-xs font-semibold"
                  >
                    <Phone className="h-3.5 w-3.5" /> Marquer contacté
                  </button>
                ) : null}
                {ev.statut === 'a_faire' || ev.statut === 'contacte' ? (
                  <button
                    type="button"
                    onClick={() => setStatut(ev, 'rdv_pris')}
                    className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-900"
                  >
                    <Check className="h-3.5 w-3.5" /> RDV pris
                  </button>
                ) : null}
                {ev.statut !== 'fait' ? (
                  <button
                    type="button"
                    onClick={() => setStatut(ev, 'fait')}
                    className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-line px-3 text-xs font-semibold"
                  >
                    Fait
                  </button>
                ) : null}
                {ev.clientId ? (
                  <Link
                    to={`/app/appel?client=${encodeURIComponent(ev.clientId)}${
                      ev.chantierId ? `&chantier=${encodeURIComponent(ev.chantierId)}` : ''
                    }`}
                    className="inline-flex min-h-11 items-center rounded-xl border border-line px-3 text-xs font-semibold"
                  >
                    Créer OT
                  </Link>
                ) : null}
                <Link
                  to={`/app/agenda?id=${encodeURIComponent(ev.id)}`}
                  className="inline-flex min-h-11 items-center rounded-xl border border-line px-3 text-xs font-semibold"
                >
                  Modifier
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Supprimer cet événement ?')) deleteAgendaEvent(ev.id)
                  }}
                  className="inline-flex min-h-11 items-center rounded-xl border border-line px-3 text-xs font-semibold text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </article>
          )
        })}
        {list.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line bg-white px-4 py-10 text-center text-sm text-muted">
            Aucun rappel. Signez un contrat de maintenance puis « Sync contrats », ou ajoutez un
            événement.
          </div>
        )}
      </div>

      <MobileFab label="Ajouter" onClick={openNew} />
    </div>
  )
}
