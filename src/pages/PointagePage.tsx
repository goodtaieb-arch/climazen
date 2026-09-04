import { type FormEvent, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Download, ShieldCheck } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import { isBureauUi } from '../lib/uiMode'
import { dossierForUser } from '../lib/rhDocuments'
import { PointageOtPanel } from '../components/PointageOtPanel'
import { PointageBureauPanel } from '../components/PointageBureauPanel'
import {
  POINTAGE_ACTION_LABELS,
  POINTAGE_CNIL_NOTICE,
  POINTAGE_SEGMENT_LABELS,
  blankPointageRegles,
  calculerJourneePourUser,
  datePointageLocale,
  datesSemaine,
  exportBureauJoursCsv,
  exportEvenementsCsv,
  exportJourneesCsv,
  formatHeureIso,
  formatMinutesHhMm,
  motifsReglesIncompletes,
  parsePointageBureauJours,
  parsePointageEvents,
  parsePointageRegles,
  pointageEstActif,
  pointageModePourUser,
  pointageReglesCompletes,
  preparerActivation,
  telechargerCsv,
  type PointageRegles,
} from '../lib/pointage'
import {
  STATUT_LIVE_OT_CLASS,
  avancementTechVsPlanning,
  blocsPlanifiesDuTech,
  labelAvancementTech,
} from '../lib/pointageAvancement'
import { isPosteTerrain } from '../lib/postePersonnel'

export function PointagePage() {
  const { data, upsertPointageRegles, annulerPointageEvent, peutVoirIdentitesRh } = useStore()
  const { user, isOwner } = useAuth()
  const bureau = isBureauUi({ isOwner: Boolean(isOwner), peutVoirIdentitesRh })
  const events = useMemo(() => parsePointageEvents(data.pointageEvents), [data.pointageEvents])
  const bureauJours = useMemo(
    () => parsePointageBureauJours(data.pointageBureauJours),
    [data.pointageBureauJours],
  )
  const regles = useMemo(() => parsePointageRegles(data.pointageRegles), [data.pointageRegles])
  const actif = pointageEstActif(regles)
  const dossier = dossierForUser(data.personnelDossiers, user?.id)
  const mode = pointageModePourUser({
    poste: dossier?.poste,
    isOwner: Boolean(isOwner),
    peutVoirIdentitesRh,
  })

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-50 text-sky-800">
          <Clock className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Pointeuse</h1>
          <p className="text-sm text-muted">
            {mode === 'bureau'
              ? 'Personnel bureau — heure de début, de fin et pause.'
              : 'Technicien terrain — de la sortie domicile jusqu’au retour. Heures porte-à-porte calculées automatiquement.'}
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
            ? 'Paramétrez les règles ci-dessus puis activez. Ensuite chaque employé pointe selon son poste.'
            : 'La pointeuse n’est pas encore activée. Demandez au bureau les règles d’heures.'}
        </div>
      ) : (
        <>
          {mode === 'bureau' ? <PointageBureauPanel /> : <PointageOtPanel />}
          {user?.id ? (
            <MaJourneeDetail
              events={events}
              bureauJours={bureauJours}
              userId={user.id}
              regles={regles}
              mode={mode}
            />
          ) : null}
        </>
      )}

      {bureau && actif ? (
        <>
          <AvancementEquipe
            events={events}
            regles={regles}
            ots={data.ordresTravail || []}
            dossiers={data.personnelDossiers || []}
          />
          <BureauExport
          events={events}
          bureauJours={bureauJours}
          regles={regles}
          dossiers={data.personnelDossiers || []}
          teamIds={[...new Set([...events.map((e) => e.userId), ...bureauJours.map((j) => j.userId)])]}
          nomOf={(id) =>
            events.find((e) => e.userId === id)?.userName ||
            bureauJours.find((j) => j.userId === id)?.userName ||
            id
          }
          onAnnuler={annulerPointageEvent}
        />
        </>
      ) : null}
    </div>
  )
}

function AvancementEquipe({
  events,
  regles,
  ots,
  dossiers,
}: {
  events: ReturnType<typeof parsePointageEvents>
  regles: PointageRegles
  ots: import('../lib/ordreTravail').OrdreTravail[]
  dossiers: import('../lib/rhDocuments').PersonnelDossier[]
}) {
  const today = datePointageLocale()
  const ids = [
    ...new Set([
      ...dossiers.filter((d) => isPosteTerrain(d.poste)).map((d) => d.userId),
      ...events.filter((e) => e.date === today).map((e) => e.userId),
      ...ots
        .filter((o) => (o.date || '').slice(0, 10) === today)
        .flatMap((o) => [o.technicienUserId, ...(o.technicienUserIds || [])].filter(Boolean) as string[]),
    ]),
  ]
  if (ids.length === 0) return null
  return (
    <section className="space-y-3 rounded-2xl border border-line bg-white p-4">
      <h2 className="font-display text-lg font-semibold">Avancement vs planning</h2>
      <p className="text-xs text-muted">
        Temps réel pointé (porte-à-porte) comparé aux OT posés sur l’agenda du jour.
      </p>
      <ul className="space-y-2">
        {ids.map((uid) => {
          const av = avancementTechVsPlanning({
            userId: uid,
            date: today,
            events,
            blocs: blocsPlanifiesDuTech(ots, { userId: uid, date: today }),
            regles,
          })
          if (av.planifieMin <= 0 && av.porteAPorteMin <= 0) return null
          const nom =
            events.find((e) => e.userId === uid)?.userName ||
            dossiers.find((d) => d.userId === uid)?.userName ||
            uid
          const cls = av.enRetard
            ? STATUT_LIVE_OT_CLASS.en_retard
            : av.ouvert
              ? STATUT_LIVE_OT_CLASS.en_cours
              : STATUT_LIVE_OT_CLASS.planifie
          return (
            <li
              key={uid}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-sm"
            >
              <span className="font-semibold text-ink">{nom}</span>
              <span className="text-muted">{labelAvancementTech(av)}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${cls}`}>
                {av.statutLabel}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function MaJourneeDetail({
  events,
  bureauJours,
  userId,
  regles,
  mode,
}: {
  events: ReturnType<typeof parsePointageEvents>
  bureauJours: ReturnType<typeof parsePointageBureauJours>
  userId: string
  regles: PointageRegles
  mode: ReturnType<typeof pointageModePourUser>
}) {
  const today = datePointageLocale()
  const maJournee = calculerJourneePourUser({
    mode,
    events,
    bureauJours,
    userId,
    date: today,
    regles,
  })
  if (!maJournee.segments.length && maJournee.payeMin <= 0) return null
  return (
    <section className="space-y-2 rounded-2xl border border-line bg-white p-4">
      <h2 className="font-display text-lg font-semibold">Créneaux du jour</h2>
      {mode !== 'bureau' && maJournee.porteAPorteMin > 0 ? (
        <p className="text-sm text-muted">
          Porte-à-porte {formatMinutesHhMm(maJournee.porteAPorteMin)}
          {maJournee.travailMin > 0
            ? ` · travail ${formatMinutesHhMm(maJournee.travailMin)} / quota ${formatMinutesHhMm(Math.round(maJournee.heuresJour * 60))}`
            : ''}
          {maJournee.trajetMatinMin + maJournee.retourMin > 0
            ? ` · trajet ${formatMinutesHhMm(maJournee.trajetMatinMin + maJournee.retourMin)} dont ${formatMinutesHhMm(maJournee.trajetRetenuMin)} retenu (> 30 min)`
            : ''}
          {maJournee.departDomicileIso
            ? ` · sortie ${formatHeureIso(maJournee.departDomicileIso)}`
            : ''}
          {maJournee.retourDomicileIso
            ? ` → retour ${formatHeureIso(maJournee.retourDomicileIso)}`
            : maJournee.ouvert
              ? ' · en cours'
              : ''}
        </p>
      ) : null}
      {mode === 'bureau' ? (
        <p className="text-sm text-muted">
          Début, fin et pause enregistrés — {formatMinutesHhMm(maJournee.payeMin)} payé
          {maJournee.pauseMin > 0 ? ` (${formatMinutesHhMm(maJournee.pauseMin)} de pause)` : ''}
        </p>
      ) : (
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
      )}
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
        Bureau : saisie début / fin / pause. Terrain : actions OT — le temps se calcule entre
        chaque action.
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
  bureauJours,
  regles,
  dossiers,
  teamIds,
  nomOf,
  onAnnuler,
}: {
  events: ReturnType<typeof parsePointageEvents>
  bureauJours: ReturnType<typeof parsePointageBureauJours>
  regles: PointageRegles
  dossiers: import('../lib/rhDocuments').PersonnelDossier[]
  teamIds: string[]
  nomOf: (id: string) => string
  onAnnuler: (id: string, motif?: string) => void
}) {
  const [jour, setJour] = useState(new Date().toISOString().slice(0, 10))
  const [filterUserId, setFilterUserId] = useState('')
  const semaine = datesSemaine(jour)
  const users = filterUserId ? [filterUserId] : teamIds
  const jours = users
    .flatMap((uid) => {
      const mode = pointageModePourUser({
        poste: dossierForUser(dossiers, uid)?.poste,
        isOwner: false,
        peutVoirIdentitesRh: true,
      })
      return semaine.map((d) =>
        calculerJourneePourUser({
          mode,
          events,
          bureauJours,
          userId: uid,
          date: d,
          regles,
        }),
      )
    })
    .filter((j) => j.payeMin > 0 || j.ouvert || j.segments.length > 0)
  const evJour = events.filter(
    (e) => e.date === jour && (!filterUserId || e.userId === filterUserId),
  )
  const bjJour = bureauJours.filter(
    (j) => j.date === jour && (!filterUserId || j.userId === filterUserId),
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
          <Download className="h-3.5 w-3.5" /> Export horodatages terrain
        </button>
        <button
          type="button"
          onClick={() =>
            telechargerCsv(`pointage-bureau-${jour}.csv`, exportBureauJoursCsv(bjJour))
          }
          className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-line px-3 text-xs font-bold"
        >
          <Download className="h-3.5 w-3.5" /> Export saisies bureau
        </button>
      </div>
      {bjJour.length > 0 ? (
        <ul className="space-y-1.5 text-sm">
          {bjJour.map((j) => (
            <li key={j.id}>
              {j.userName} · {j.heureDebut}
              {j.heureFin ? ` → ${j.heureFin}` : ' · en cours'}
              {j.heurePauseDebut && j.heurePauseFin
                ? ` · pause ${j.heurePauseDebut}-${j.heurePauseFin}`
                : ''}
            </li>
          ))}
        </ul>
      ) : null}
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
