import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import {
  POINTAGE_ACTION_LABELS,
  datePointageLocale,
  eventsDuJour,
  formatHeureIso,
  hmVersIsoLocal,
  normaliserAction,
  parsePointageEvents,
} from '../lib/pointage'
import { corrigerArriveeSite, parseHeureCorriger } from '../lib/pointageCorrection'
import { formatOtNumero, isOtCloture } from '../lib/ordreTravail'

/**
 * Bureau / gérant : corriger un oubli « en cours » (le tech n’a pas la main sur l’heure).
 */
export function CorrectionPointageBureau() {
  const { data, addPointageEvent, corrigerPointageEvent, upsertOrdreTravail } = useStore()
  const events = useMemo(() => parsePointageEvents(data.pointageEvents), [data.pointageEvents])
  const today = datePointageLocale()
  const [userId, setUserId] = useState('')
  const [heure, setHeure] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const techs = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of events.filter((x) => x.date === today && !x.annule)) {
      map.set(e.userId, e.userName)
    }
    return [...map.entries()]
  }, [events, today])

  const uid = userId || techs[0]?.[0] || ''
  const jour = uid ? eventsDuJour(events, { userId: uid, date: today }) : []
  const last = jour[jour.length - 1]
  const otId =
    last &&
    (normaliserAction(last.action) === 'deplacement' ||
      normaliserAction(last.action) === 'intervention_en_cours')
      ? last.otId
      : jour
          .slice()
          .reverse()
          .find((e) => e.otId)?.otId
  const ot = otId ? (data.ordresTravail || []).find((o) => o.id === otId) : undefined

  const apply = () => {
    setErr('')
    setMsg('')
    if (!uid) {
      setErr('Choisissez le technicien.')
      return
    }
    if (!otId) {
      setErr('Pas d’INT liée au pointage du jour pour ce tech.')
      return
    }
    if (!heure) {
      setErr('Indiquez l’heure d’arrivée réelle (celle que le tech vous a dite).')
      return
    }
    const result = corrigerArriveeSite({
      events,
      userId: uid,
      userName: techs.find((t) => t[0] === uid)?.[1] || last?.userName || 'Technicien',
      otId,
      chantierId: last?.chantierId || ot?.chantierId,
      arriveeAt: hmVersIsoLocal(today, heure),
      geoRequired: false,
      corrigePar: 'bureau',
      motif: `Appel bureau — arrivée ${heure}`,
    })
    if (!result.ok) {
      setErr(result.error)
      return
    }
    if (result.mode === 'insert' && result.insert) addPointageEvent(result.insert)
    else if (result.mode === 'update' && result.update) {
      corrigerPointageEvent(result.update.id, result.update.patch)
    }
    if (ot && !isOtCloture(ot.statut)) {
      upsertOrdreTravail({ ...ot, statut: 'en_cours' })
    }
    setMsg(
      `Arrivée enregistrée à ${heure}${ot ? ` · ${formatOtNumero(ot.numero)}` : ''} — en cours d’intervention.`,
    )
  }

  const corrigerHeureEvent = (id: string, hm: string) => {
    setErr('')
    setMsg('')
    const ev = jour.find((e) => e.id === id)
    if (!ev) return
    const hmNorm = parseHeureCorriger(hm) || ( /^\d{1,2}:\d{2}$/.test(hm) ? hm : '')
    if (!hmNorm) {
      setErr('Heure manquante (ex. 10:15).')
      return
    }
    const at = hmVersIsoLocal(ev.date, hmNorm)
    if (normaliserAction(ev.action) === 'intervention_en_cours' && ev.otId) {
      const result = corrigerArriveeSite({
        events,
        userId: ev.userId,
        userName: ev.userName,
        otId: ev.otId,
        chantierId: ev.chantierId,
        arriveeAt: at,
        geoRequired: false,
        corrigePar: 'bureau',
        motif: `Heure d’arrivée corrigée à ${hm}`,
      })
      if (!result.ok) {
        setErr(result.error)
        return
      }
      if (result.update) corrigerPointageEvent(result.update.id, result.update.patch)
      setMsg(`Heure corrigée : ${hm}.`)
      return
    }
    corrigerPointageEvent(id, {
      at,
      corrigePar: 'bureau',
      corrigeMotif: `Heure corrigée à ${hm}`,
      corrigeAt: new Date().toISOString(),
    })
    setMsg(`Heure corrigée : ${hm}.`)
  }

  if (techs.length === 0) {
    return (
      <section className="rounded-2xl border border-line bg-white p-4 text-sm text-muted">
        Aucun pointage terrain aujourd’hui. Quand un tech oublie « en cours », il appelle ici ou
        l’Aide IA (GPS).
      </section>
    )
  }

  return (
    <section className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
      <h2 className="font-display text-lg font-bold text-ink">Corriger une arrivée oubliée</h2>
      <p className="text-xs text-muted">
        Le tech n’a pas le droit de retoucher les heures. S’il a oublié « En cours d’intervention »
        en arrivant : vous posez l’heure qu’il vous donne. L’Aide IA peut aussi le faire en
        vérifiant le GPS.
      </p>
      <label className="block text-sm">
        <span className="mb-1 block font-semibold">Technicien</span>
        <select
          value={uid}
          onChange={(e) => setUserId(e.target.value)}
          className="h-11 w-full rounded-xl border border-line bg-white px-3"
        >
          {techs.map(([id, nom]) => (
            <option key={id} value={id}>
              {nom}
            </option>
          ))}
        </select>
      </label>
      {ot ? (
        <p className="text-xs font-semibold text-ink">
          INT {formatOtNumero(ot.numero)}
          {last
            ? ` · dernier pointage : ${POINTAGE_ACTION_LABELS[last.action]} à ${formatHeureIso(last.at)}`
            : ''}
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-2">
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Heure d’arrivée réelle</span>
          <input
            type="time"
            value={heure}
            onChange={(e) => setHeure(e.target.value)}
            className="h-11 rounded-xl border border-line bg-white px-3"
          />
        </label>
        <button
          type="button"
          onClick={apply}
          className="inline-flex min-h-11 items-center rounded-xl bg-amber-800 px-4 text-sm font-bold text-white"
        >
          Enregistrer l’arrivée
        </button>
      </div>
      {jour.length > 0 ? (
        <ul className="space-y-1.5 text-sm">
          {jour.map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2"
            >
              <span>
                {formatHeureIso(e.at)} · {POINTAGE_ACTION_LABELS[e.action]}
                {e.corrigePar ? ` · corrigé ${e.corrigePar}` : ''}
              </span>
              {!e.annule ? (
                <button
                  type="button"
                  className="text-[11px] font-bold text-amber-900"
                  onClick={() => {
                    const hm = window.prompt('Nouvelle heure (HH:MM)', formatHeureIso(e.at)) || ''
                    if (hm.trim()) corrigerHeureEvent(e.id, hm.trim())
                  }}
                >
                  Heure
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {err ? <p className="text-sm font-semibold text-danger">{err}</p> : null}
      {msg ? <p className="text-sm font-semibold text-emerald-800">{msg}</p> : null}
    </section>
  )
}
