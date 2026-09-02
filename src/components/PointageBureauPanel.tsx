import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Clock } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import {
  calculerJourneeBureau,
  datePointageLocale,
  formatMinutesHhMm,
  parsePointageBureauJours,
  parsePointageRegles,
  pointageEstActif,
  type PointageBureauJour,
} from '../lib/pointage'

export function PointageBureauPanel({ className = '' }: { className?: string }) {
  const { data, upsertPointageBureauJour } = useStore()
  const { user } = useAuth()
  const regles = useMemo(() => parsePointageRegles(data.pointageRegles), [data.pointageRegles])
  const actif = pointageEstActif(regles)
  const today = datePointageLocale()
  const jours = useMemo(
    () => parsePointageBureauJours(data.pointageBureauJours),
    [data.pointageBureauJours],
  )
  const existant = user?.id
    ? jours.find((j) => j.userId === user.id && j.date === today)
    : undefined

  const [heureDebut, setHeureDebut] = useState('')
  const [heureFin, setHeureFin] = useState('')
  const [heurePauseDebut, setHeurePauseDebut] = useState('')
  const [heurePauseFin, setHeurePauseFin] = useState('')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!existant) return
    setHeureDebut(existant.heureDebut)
    setHeureFin(existant.heureFin || '')
    setHeurePauseDebut(existant.heurePauseDebut || '')
    setHeurePauseFin(existant.heurePauseFin || '')
    setNote(existant.note || '')
  }, [existant?.id, existant?.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  const apercu: PointageBureauJour | undefined =
    user?.id && heureDebut
      ? {
          id: existant?.id || 'preview',
          userId: user.id,
          userName: user.fullName || user.email || 'Employé',
          date: today,
          heureDebut,
          heureFin: heureFin || undefined,
          heurePauseDebut: heurePauseDebut || undefined,
          heurePauseFin: heurePauseFin || undefined,
          updatedAt: existant?.updatedAt || new Date().toISOString(),
        }
      : undefined
  const maJournee = apercu ? calculerJourneeBureau(apercu, regles) : undefined

  const save = (e: FormEvent) => {
    e.preventDefault()
    if (!user?.id) return
    if (!actif) {
      setMsg('Pointeuse inactive — le bureau doit activer les règles.')
      return
    }
    if (!heureDebut.trim()) {
      setMsg('Indiquez l’heure de début.')
      return
    }
    upsertPointageBureauJour({
      id: existant?.id,
      userId: user.id,
      userName: user.fullName || user.email || 'Employé',
      date: today,
      heureDebut: heureDebut.trim(),
      heureFin: heureFin.trim() || undefined,
      heurePauseDebut: heurePauseDebut.trim() || undefined,
      heurePauseFin: heurePauseFin.trim() || undefined,
      note: note.trim() || undefined,
    })
    setMsg('Pointage enregistré — heures mises à jour.')
  }

  if (!actif) {
    return (
      <div
        className={`rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 ${className}`}
      >
        Pointeuse non activée. Demandez au responsable les règles d’heures.
      </div>
    )
  }

  return (
    <form
      onSubmit={save}
      className={['space-y-4 rounded-2xl border border-violet-200 bg-violet-50/70 p-4', className].join(
        ' ',
      )}
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-violet-900">Pointage bureau</p>
        <p className="font-display text-base font-semibold text-ink">
          Heure de début, de fin et pause — sans déplacement OT
        </p>
        {maJournee && maJournee.payeMin > 0 ? (
          <p className="text-xs text-muted">
            Payé {formatMinutesHhMm(maJournee.payeMin)}
            {maJournee.pauseMin > 0 ? ` · pause ${formatMinutesHhMm(maJournee.pauseMin)}` : ''}
            {maJournee.ouvert ? ' · en cours' : ''}
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-ink">Heure de début *</span>
          <input
            type="time"
            required
            value={heureDebut}
            onChange={(e) => setHeureDebut(e.target.value)}
            className="h-11 w-full rounded-xl border border-line bg-white px-3"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-ink">Heure de fin</span>
          <input
            type="time"
            value={heureFin}
            onChange={(e) => setHeureFin(e.target.value)}
            className="h-11 w-full rounded-xl border border-line bg-white px-3"
          />
          <span className="mt-1 block text-[11px] text-muted">Vide si vous êtes encore au bureau</span>
        </label>
      </div>

      <fieldset className="rounded-xl border border-violet-200 bg-white p-3">
        <legend className="px-1 text-sm font-semibold text-ink">Pause</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink">Début pause</span>
            <input
              type="time"
              value={heurePauseDebut}
              onChange={(e) => setHeurePauseDebut(e.target.value)}
              className="h-11 w-full rounded-xl border border-line px-3"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink">Fin pause</span>
            <input
              type="time"
              value={heurePauseFin}
              onChange={(e) => setHeurePauseFin(e.target.value)}
              className="h-11 w-full rounded-xl border border-line px-3"
            />
          </label>
        </div>
      </fieldset>

      <label className="block text-sm">
        <span className="mb-1 block font-semibold text-ink">Note (optionnel)</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="h-11 w-full rounded-xl border border-line bg-white px-3"
          placeholder="Ex. télétravail matin, réunion…"
        />
      </label>

      <button
        type="submit"
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-bold text-white sm:w-auto"
      >
        <Clock className="h-4 w-4" />
        Enregistrer mon pointage
      </button>

      {msg ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
          {msg}
        </p>
      ) : null}
    </form>
  )
}
