import { type FormEvent, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Download, ShieldCheck } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import { isBureauUi } from '../lib/uiMode'
import { PointageOtPanel } from '../components/PointageOtPanel'
import {
  POINTAGE_ACTION_LABELS,
  POINTAGE_CNIL_NOTICE,
  POINTAGE_SEGMENT_LABELS,
  blankPointageRegles,
  calculerJournee,
  datesSemaine,
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
  type PointageRegles,
} from '../lib/pointage'

export function PointagePage() {
  const { data, upsertPointageRegles, annulerPointageEvent, peutVoirIdentitesRh } = useStore()
  const { user, isOwner } = useAuth()
  const bureau = isBureauUi({ isOwner: Boolean(isOwner), peutVoirIdentitesRh })
  const events = useMemo(() => parsePointageEvents(data.pointageEvents), [data.pointageEvents])
  const regles = useMemo(() => parsePointageRegles(data.pointageRegles), [data.pointageRegles])
  const actif = pointageEstActif(regles)

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-50 text-sky-800">
          <Clock className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Pointeuse</h1>
          <p className="text-sm text-muted">
            Liée à l’OT — déplacement, intervention, fournisseur, bureau. Heures calculées
            automatiquement.
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
            ? 'Paramétrez les règles ci-dessus puis activez. Ensuite le tech pointe depuis son OT.'
            : 'La pointeuse n’est pas encore activée. Demandez au bureau les règles d’heures.'}
        </div>
      ) : (
        <>
          <PointageOtPanel />
          {user?.id ? <MaJourneeDetail events={events} userId={user.id} regles={regles} /> : null}
        </>
      )}

      {bureau && actif ? (
        <BureauExport
          events={events}
          regles={regles}
          teamIds={[...new Set(events.map((e) => e.userId))]}
          nomOf={(id) => events.find((e) => e.userId === id)?.userName || id}
          onAnnuler={annulerPointageEvent}
        />
      ) : null}
    </div>
  )
}

function MaJourneeDetail({
  events,
  userId,
  regles,
}: {
  events: ReturnType<typeof parsePointageEvents>
  userId: string
  regles: PointageRegles
}) {
  const today = new Date().toISOString().slice(0, 10)
  const maJournee = calculerJournee({ events, userId, date: today, regles })
  if (!maJournee.segments.length) return null
  return (
    <section className="space-y-2 rounded-2xl border border-line bg-white p-4">
      <h2 className="font-display text-lg font-semibold">Créneaux du jour</h2>
      <ul className="space-y-1.5 text-sm">
        {maJournee.segments.map((s, i) => (
          <li key={`${s.from}-${i}`} className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {POINTAGE_SEGMENT_LABELS[s.kind]} · {formatHeureIso(s.from)} → {formatHeureIso(s.to)}
              {s.otId ? ` · OT ${s.otId.slice(0, 8)}…` : ''}
            </span>
            <span className="font-bold">{formatMinutesHhMm(s.minutes)}</span>
          </li>
        ))}
      </ul>
    </section>
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
        Le technicien ne saisit que des actions. Le temps entre deux actions compte pour la paie.
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
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={form.cnilAcceptee}
          onChange={(e) => setForm({ ...form, cnilAcceptee: e.target.checked })}
        />
        <span>J’informe l’équipe : {POINTAGE_CNIL_NOTICE} *</span>
      </label>
      {err ? <p className="text-sm text-danger">{err}</p> : null}
      {!complete ? <p className="text-xs text-amber-800">Manque : {missing.join(', ')}.</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => persist(form, true)}
          className="h-11 rounded-xl bg-ink px-4 text-sm font-bold text-white"
        >
          {form.active ? 'Mettre à jour' : 'Activer la pointeuse'}
        </button>
      </div>
    </form>
  )
}

function BureauExport({
  events,
  regles,
  teamIds,
  nomOf,
  onAnnuler,
}: {
  events: ReturnType<typeof parsePointageEvents>
  regles: PointageRegles
  teamIds: string[]
  nomOf: (id: string) => string
  onAnnuler: (id: string, motif?: string) => void
}) {
  const [jour, setJour] = useState(new Date().toISOString().slice(0, 10))
  const [filterUserId, setFilterUserId] = useState('')
  const semaine = datesSemaine(jour)
  const users = filterUserId ? [filterUserId] : teamIds
  const jours = users
    .flatMap((uid) => semaine.map((d) => calculerJournee({ events, userId: uid, date: d, regles })))
    .filter((j) => j.payeMin > 0 || j.ouvert || j.segments.length > 0)
  const evJour = events.filter(
    (e) => e.date === jour && (!filterUserId || e.userId === filterUserId),
  )

  return (
    <section className="space-y-3 rounded-2xl border border-line bg-white p-4">
      <h2 className="font-display text-lg font-semibold">Paie & facturation</h2>
      <div className="flex flex-wrap gap-2">
        <input
          type="date"
          value={jour}
          onChange={(e) => setJour(e.target.value)}
          className="h-10 rounded-xl border border-line px-3 text-sm"
        />
        {teamIds.length > 1 ? (
          <select
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            className="h-10 rounded-xl border border-line px-3 text-sm"
          >
            <option value="">Toute l’équipe</option>
            {teamIds.map((id) => (
              <option key={id} value={id}>
                {nomOf(id)}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            telechargerCsv(`pointage-semaine-${semaine[0]}.csv`, exportJourneesCsv(jours))
          }
          className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-[#0f766e] px-3 text-xs font-bold text-white"
        >
          <Download className="h-3.5 w-3.5" /> Export semaine
        </button>
        <button
          type="button"
          onClick={() =>
            telechargerCsv(`pointage-events-${jour}.csv`, exportEvenementsCsv(evJour))
          }
          className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-line px-3 text-xs font-bold"
        >
          <Download className="h-3.5 w-3.5" /> Export horodatages
        </button>
      </div>
      <ul className="space-y-1.5 text-sm">
        {evJour.map((e) => (
          <li key={e.id} className="flex justify-between gap-2">
            <span>
              {formatHeureIso(e.at)} · {POINTAGE_ACTION_LABELS[e.action]}
              {e.otId ? ` · OT` : ''}
            </span>
            {!e.annule ? (
              <button
                type="button"
                className="text-[11px] font-bold text-danger"
                onClick={() => {
                  const motif = prompt('Motif ?') || ''
                  if (motif.trim()) onAnnuler(e.id, motif.trim())
                }}
              >
                Annuler
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
