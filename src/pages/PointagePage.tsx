import { type FormEvent, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Car,
  Clock,
  Coffee,
  Download,
  Home,
  MapPin,
  Navigation,
  ShieldCheck,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import { isBureauUi } from '../lib/uiMode'
import { formatOtNumero, isOtCloture } from '../lib/ordreTravail'
import {
  POINTAGE_ACTION_HINTS,
  POINTAGE_ACTION_LABELS,
  POINTAGE_ACTIONS,
  POINTAGE_CNIL_NOTICE,
  POINTAGE_SEGMENT_LABELS,
  actionAutorisee,
  actionsSuivantes,
  arrondirDate,
  blankPointageRegles,
  calculerJournee,
  calculerSemaine,
  capturerGeoPonctuel,
  datePointageLocale,
  datesSemaine,
  dernierPointage,
  exportEvenementsCsv,
  exportJourneesCsv,
  formatHeureIso,
  formatMinutesHhMm,
  motifsReglesIncompletes,
  parsePointageEvents,
  parsePointageRegles,
  pointageEstActif,
  pointageReglesCompletes,
  preparerActivation,
  telechargerCsv,
  type PointageAction,
  type PointageRegles,
} from '../lib/pointage'

const ACTION_ICON: Record<PointageAction, typeof Car> = {
  prise_vehicule: Car,
  trajet: Navigation,
  arrivee_chantier: MapPin,
  pause: Coffee,
  retour: Home,
}

export function PointagePage() {
  const { data, upsertPointageRegles, addPointageEvent, annulerPointageEvent, peutVoirIdentitesRh } =
    useStore()
  const { user, isOwner } = useAuth()
  const bureau = isBureauUi({ isOwner: Boolean(isOwner), peutVoirIdentitesRh })
  const events = useMemo(() => parsePointageEvents(data.pointageEvents), [data.pointageEvents])
  const regles = useMemo(() => parsePointageRegles(data.pointageRegles), [data.pointageRegles])
  const actif = pointageEstActif(regles)
  const today = datePointageLocale()
  const [jour, setJour] = useState(today)
  const [filterUserId, setFilterUserId] = useState(user?.id || '')
  const [otId, setOtId] = useState('')
  const [voitureId, setVoitureId] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const last = user?.id
    ? dernierPointage(events, { userId: user.id, date: today })
    : undefined
  const next = actionsSuivantes(last?.action)
  const maJournee = user?.id
    ? calculerJournee({ events, userId: user.id, date: today, regles })
    : undefined

  const otsOuverts = useMemo(
    () =>
      (data.ordresTravail || []).filter((o) => {
        if (isOtCloture(o.statut)) return false
        if (!bureau && user?.id) {
          const ids = [o.technicienUserId, ...(o.technicienUserIds || [])].filter(Boolean)
          if (ids.length && !ids.includes(user.id)) return false
        }
        return true
      }),
    [data.ordresTravail, bureau, user?.id],
  )

  const teamIds = useMemo(() => {
    const set = new Set<string>()
    for (const e of events) set.add(e.userId)
    if (user?.id) set.add(user.id)
    return [...set]
  }, [events, user?.id])

  const punch = async (action: PointageAction) => {
    if (!user?.id) return
    if (!actif) {
      setMsg('La pointeuse n’est pas activée. Le bureau doit d’abord paramétrer les règles.')
      return
    }
    if (!actionAutorisee(last?.action, action)) {
      setMsg(`Enchaînement impossible : ${POINTAGE_ACTION_LABELS[action]} après ${last ? POINTAGE_ACTION_LABELS[last.action] : 'rien'}.`)
      return
    }
    setBusy(true)
    setMsg('')
    try {
      const geoRes = await capturerGeoPonctuel()
      if (!geoRes.ok && regles.geoObligatoire) {
        setMsg(geoRes.message)
        return
      }
      const at = arrondirDate(new Date(), regles.arrondiMinutes).toISOString()
      addPointageEvent({
        userId: user.id,
        userName: user.fullName || user.email || 'Technicien',
        action,
        at,
        date: at.slice(0, 10),
        geo: geoRes.ok ? geoRes.geo : undefined,
        geoRefused: !geoRes.ok && geoRes.refused,
        geoError: geoRes.ok ? undefined : geoRes.message,
        otId: otId || undefined,
        voitureId: voitureId || undefined,
        note: note.trim() || undefined,
      })
      setNote('')
      setMsg(`${POINTAGE_ACTION_LABELS[action]} enregistré à ${formatHeureIso(at)}.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-50 text-sky-800">
          <Clock className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Pointeuse</h1>
          <p className="text-sm text-muted">
            Temps de travail — horodatage + GPS ponctuel (pas de tracking).
          </p>
        </div>
      </div>

      <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950">
        <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
        {POINTAGE_CNIL_NOTICE}{' '}
        <Link to="/confidentialite" className="font-semibold underline">
          Confidentialité
        </Link>
      </p>

      {bureau ? <ReglesBloc regles={regles} onSave={upsertPointageRegles} userId={user?.id} /> : null}

      {!actif ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
          {bureau
            ? 'Paramétrez les règles ci-dessus (heures + information CNIL) puis activez. Sans ça, aucun tech ne peut pointer.'
            : 'La pointeuse n’est pas encore activée. Demandez au bureau de régler les heures (7h/35h, pauses…) avant le premier pointage.'}
        </div>
      ) : (
        <>
          <section className="space-y-3 rounded-2xl border border-line bg-white p-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase text-muted">Maintenant</p>
                <p className="font-display text-lg font-semibold">
                  {last
                    ? `${POINTAGE_ACTION_LABELS[last.action]} · ${formatHeureIso(last.at)}`
                    : 'Pas encore pointé aujourd’hui'}
                </p>
                {maJournee ? (
                  <p className="text-xs text-muted">
                    Payé {formatMinutesHhMm(maJournee.payeMin)}
                    {maJournee.heuresSupMin > 0
                      ? ` · HS ${formatMinutesHhMm(maJournee.heuresSupMin)}`
                      : ''}
                    {maJournee.ouvert ? ' · journée ouverte' : last ? ' · journée close' : ''}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-ink">OT (si arrivée chantier)</span>
                <select
                  value={otId}
                  onChange={(e) => setOtId(e.target.value)}
                  className="h-11 w-full rounded-xl border border-line bg-white px-3"
                >
                  <option value="">— Sans OT —</option>
                  {otsOuverts.map((o) => (
                    <option key={o.id} value={o.id}>
                      {formatOtNumero(o.numero)} · {o.action || o.typeOt}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-ink">Véhicule</span>
                <select
                  value={voitureId}
                  onChange={(e) => setVoitureId(e.target.value)}
                  className="h-11 w-full rounded-xl border border-line bg-white px-3"
                >
                  <option value="">—</option>
                  {(data.voitures || []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {[v.matricule, v.marque, v.modele].filter(Boolean).join(' ') || 'Véhicule'}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-ink">Note (optionnel)</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="h-11 w-full rounded-xl border border-line px-3"
                placeholder="Ex. bouchons A8, attente pièces…"
              />
            </label>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {POINTAGE_ACTIONS.map((action) => {
                const Icon = ACTION_ICON[action]
                const on = next.includes(action)
                return (
                  <button
                    key={action}
                    type="button"
                    disabled={busy || !on}
                    onClick={() => void punch(action)}
                    className={[
                      'flex min-h-[4.5rem] flex-col items-start justify-center rounded-2xl border px-3 py-2 text-left',
                      on
                        ? 'border-sky-300 bg-sky-50 text-sky-950'
                        : 'border-line bg-mist text-muted opacity-60',
                    ].join(' ')}
                  >
                    <span className="inline-flex items-center gap-1 text-xs font-extrabold uppercase">
                      <Icon className="h-3.5 w-3.5" />
                      {POINTAGE_ACTION_LABELS[action]}
                    </span>
                    <span className="mt-0.5 text-[11px] leading-snug">{POINTAGE_ACTION_HINTS[action]}</span>
                  </button>
                )
              })}
            </div>
            {msg ? (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
                {msg}
              </p>
            ) : null}
          </section>

          {maJournee && maJournee.segments.length > 0 ? (
            <section className="space-y-2 rounded-2xl border border-line bg-white p-4">
              <h2 className="font-display text-lg font-semibold">Ma journée</h2>
              <ul className="space-y-1.5 text-sm">
                {maJournee.segments.map((s, i) => (
                  <li key={`${s.from}-${i}`} className="flex items-center justify-between gap-2">
                    <span>
                      {POINTAGE_SEGMENT_LABELS[s.kind]} · {formatHeureIso(s.from)} →{' '}
                      {formatHeureIso(s.to)}
                    </span>
                    <span className="font-bold">{formatMinutesHhMm(s.minutes)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted">
                Trajet {formatMinutesHhMm(maJournee.trajetMin)} · Chantier{' '}
                {formatMinutesHhMm(maJournee.chantierMin)} · Pause{' '}
                {formatMinutesHhMm(maJournee.pauseMin)}
              </p>
            </section>
          ) : null}
        </>
      )}

      {bureau && actif ? (
        <BureauExport
          events={events}
          regles={regles}
          jour={jour}
          setJour={setJour}
          filterUserId={filterUserId}
          setFilterUserId={setFilterUserId}
          teamIds={teamIds}
          nomOf={(id) => events.find((e) => e.userId === id)?.userName || id}
          onAnnuler={annulerPointageEvent}
        />
      ) : null}
    </div>
  )
}

function ReglesBloc({
  regles,
  onSave,
  userId,
}: {
  regles: PointageRegles
  onSave: (r: PointageRegles) => void
  userId?: string
}) {
  const [form, setForm] = useState<PointageRegles>(() =>
    regles.heuresJour ? regles : blankPointageRegles(),
  )
  const [err, setErr] = useState('')
  const missing = motifsReglesIncompletes(form)
  const complete = pointageReglesCompletes(form)

  const persist = (next: PointageRegles, activer: boolean) => {
    setErr('')
    if (activer) {
      const prep = preparerActivation(next, { userId })
      if (!prep.ok) {
        setErr(`À renseigner avant activation : ${prep.erreurs.join(', ')}.`)
        return
      }
      onSave(prep.regles)
      setForm(prep.regles)
      return
    }
    onSave({ ...parsePointageRegles(next), active: false, updatedAt: new Date().toISOString() })
    setForm({ ...next, active: false })
  }

  return (
    <form
      className="space-y-3 rounded-2xl border border-line bg-white p-4"
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        persist(form, false)
      }}
    >
      <h2 className="font-display text-lg font-semibold">Règles de calcul d’heures</h2>
      <p className="text-xs text-muted">
        Obligatoire avant d’activer la pointeuse. Distingue trajet, chantier et pauses pour la
        paie / facturation.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Heures / jour *</span>
          <input
            type="number"
            min={1}
            max={16}
            step={0.5}
            value={form.heuresJour}
            onChange={(e) => setForm({ ...form, heuresJour: Number(e.target.value) })}
            className="h-11 w-full rounded-xl border border-line px-3"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Heures / semaine *</span>
          <input
            type="number"
            min={1}
            max={60}
            step={0.5}
            value={form.heuresSemaine}
            onChange={(e) => setForm({ ...form, heuresSemaine: Number(e.target.value) })}
            className="h-11 w-full rounded-xl border border-line px-3"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Début théorique</span>
          <input
            type="time"
            value={form.debutJournee}
            onChange={(e) => setForm({ ...form, debutJournee: e.target.value })}
            className="h-11 w-full rounded-xl border border-line px-3"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Fin théorique</span>
          <input
            type="time"
            value={form.finJournee}
            onChange={(e) => setForm({ ...form, finJournee: e.target.value })}
            className="h-11 w-full rounded-xl border border-line px-3"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Arrondi pointage</span>
          <select
            value={form.arrondiMinutes}
            onChange={(e) => setForm({ ...form, arrondiMinutes: Number(e.target.value) })}
            className="h-11 w-full rounded-xl border border-line bg-white px-3"
          >
            <option value={0}>Exact (à la minute)</option>
            <option value={5}>5 minutes</option>
            <option value={10}>10 minutes</option>
            <option value={15}>15 minutes</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Pause forfait si non pointée</span>
          <input
            type="number"
            min={0}
            max={180}
            value={form.pauseAutoMinutes}
            onChange={(e) => setForm({ ...form, pauseAutoMinutes: Number(e.target.value) })}
            className="h-11 w-full rounded-xl border border-line px-3"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.pauseNonPayee}
          onChange={(e) => setForm({ ...form, pauseNonPayee: e.target.checked })}
        />
        Pause non payée (déduite du temps de paie)
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.geoObligatoire}
          onChange={(e) => setForm({ ...form, geoObligatoire: e.target.checked })}
        />
        Position GPS obligatoire à chaque action (ponctuelle)
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={form.cnilAcceptee}
          onChange={(e) => setForm({ ...form, cnilAcceptee: e.target.checked })}
        />
        <span>
          J’informe l’équipe : {POINTAGE_CNIL_NOTICE} *
        </span>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-semibold">Note paie / export</span>
        <input
          value={form.notePaie || ''}
          onChange={(e) => setForm({ ...form, notePaie: e.target.value })}
          className="h-11 w-full rounded-xl border border-line px-3"
          placeholder="Ex. convention 35h, pause 30 min déduite…"
        />
      </label>
      {err ? <p className="text-sm text-danger">{err}</p> : null}
      {!complete ? (
        <p className="text-xs text-amber-800">
          Manque : {missing.join(', ')}.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          className="h-11 rounded-xl border border-line bg-white px-4 text-sm font-bold"
        >
          Enregistrer sans activer
        </button>
        <button
          type="button"
          onClick={() => persist(form, true)}
          className="h-11 rounded-xl bg-ink px-4 text-sm font-bold text-white"
        >
          {form.active ? 'Mettre à jour et garder actif' : 'Activer la pointeuse'}
        </button>
        {form.active ? (
          <button
            type="button"
            onClick={() => persist({ ...form, active: false }, false)}
            className="h-11 rounded-xl border border-line px-4 text-sm font-bold text-muted"
          >
            Désactiver
          </button>
        ) : null}
      </div>
    </form>
  )
}

function BureauExport({
  events,
  regles,
  jour,
  setJour,
  filterUserId,
  setFilterUserId,
  teamIds,
  nomOf,
  onAnnuler,
}: {
  events: ReturnType<typeof parsePointageEvents>
  regles: PointageRegles
  jour: string
  setJour: (v: string) => void
  filterUserId: string
  setFilterUserId: (v: string) => void
  teamIds: string[]
  nomOf: (id: string) => string
  onAnnuler: (id: string, motif?: string) => void
}) {
  const semaine = datesSemaine(jour)
  const users = filterUserId ? [filterUserId] : teamIds
  const jours = users.flatMap((uid) =>
    semaine.map((d) =>
      calculerJournee({ events, userId: uid, date: d, regles }),
    ),
  ).filter((j) => j.payeMin > 0 || j.ouvert || j.segments.length > 0)

  const evJour = events.filter(
    (e) => e.date === jour && (!filterUserId || e.userId === filterUserId),
  )

  return (
    <section className="space-y-3 rounded-2xl border border-line bg-white p-4">
      <h2 className="font-display text-lg font-semibold">Paie & facturation</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Jour</span>
          <input
            type="date"
            value={jour}
            onChange={(e) => setJour(e.target.value)}
            className="h-11 w-full rounded-xl border border-line px-3"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Technicien</span>
          <select
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            className="h-11 w-full rounded-xl border border-line bg-white px-3"
          >
            <option value="">Toute l’équipe</option>
            {teamIds.map((id) => (
              <option key={id} value={id}>
                {nomOf(id)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            telechargerCsv(
              `pointage-semaine-${semaine[0]}.csv`,
              exportJourneesCsv(jours),
            )
          }
          className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-[#0f766e] px-3 text-xs font-bold text-white"
        >
          <Download className="h-3.5 w-3.5" /> Export semaine (paie)
        </button>
        <button
          type="button"
          onClick={() =>
            telechargerCsv(
              `pointage-events-${jour}.csv`,
              exportEvenementsCsv(evJour),
            )
          }
          className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-line px-3 text-xs font-bold"
        >
          <Download className="h-3.5 w-3.5" /> Export horodatages
        </button>
      </div>
      <ul className="space-y-2">
        {users.map((uid) => {
          const s = calculerSemaine({ events, userId: uid, date: jour, regles })
          return (
            <li key={uid} className="rounded-xl border border-line px-3 py-2 text-sm">
              <p className="font-bold">{nomOf(uid)}</p>
              <p className="text-xs text-muted">
                Semaine {formatMinutesHhMm(s.payeMin)} / {formatMinutesHhMm(s.quotaMin)}
                {s.heuresSupMin > 0 ? ` · HS ${formatMinutesHhMm(s.heuresSupMin)}` : ''}
              </p>
            </li>
          )
        })}
      </ul>
      <h3 className="text-sm font-bold">Horodatages du jour</h3>
      {evJour.length === 0 ? (
        <p className="text-xs text-muted">Aucun pointage ce jour.</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {evJour.map((e) => (
            <li
              key={e.id}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-1 ${
                e.annule ? 'bg-mist text-muted line-through' : ''
              }`}
            >
              <span>
                {formatHeureIso(e.at)} · {e.userName} · {POINTAGE_ACTION_LABELS[e.action]}
                {e.geo ? ' · GPS' : e.geoRefused ? ' · GPS refusé' : ''}
              </span>
              {!e.annule ? (
                <button
                  type="button"
                  className="text-[11px] font-bold text-danger"
                  onClick={() => {
                    const motif = prompt('Motif d’annulation (reste au dossier) ?') || ''
                    if (motif.trim()) onAnnuler(e.id, motif.trim())
                  }}
                >
                  Annuler
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
