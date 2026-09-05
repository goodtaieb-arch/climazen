import { useMemo, useState } from 'react'
import { Home } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import { formatOtNumero } from '../lib/ordreTravail'
import { PauseRepasEnCoursBar } from './PauseRepasEnCoursBar'
import {
  POINTAGE_ACTION_LABELS,
  POINTAGE_HORS_INT_MENU,
  actionAutorisee,
  arrondirDate,
  capturerGeoPonctuel,
  datePointageLocale,
  dernierPointage,
  formatHeureIso,
  normaliserAction,
  parsePointageEvents,
  parsePointageRegles,
  pointageEstActif,
  repriseApresPauseRepas,
  statutOtDepuisAction,
  type PointageAction,
  type PointageCible,
} from '../lib/pointage'
import {
  demanderPermissionAlarmePauseRepas,
  preparerSonAlarmePauseRepas,
  resetAlarmePauseRepas,
} from '../lib/pauseRepasAlarme'

/**
 * Entrées de temps hors INT : trajet début/fin, fournisseur, bureau, pause…
 * Pas de pointage « vers une INT » ici — ça reste sur l’accueil (Mes interventions).
 */
export function TempsHorsIntPanel({ className = '' }: { className?: string }) {
  const { data, addPointageEvent, upsertOrdreTravail } = useStore()
  const { user } = useAuth()
  const events = useMemo(() => parsePointageEvents(data.pointageEvents), [data.pointageEvents])
  const regles = useMemo(() => parsePointageRegles(data.pointageRegles), [data.pointageRegles])
  const actif = pointageEstActif(regles)
  const today = datePointageLocale()
  const last = user?.id ? dernierPointage(events, { userId: user.id, date: today }) : undefined
  const lastCanon = last ? normaliserAction(last.action) : undefined

  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const repriseRepas =
    user?.id && lastCanon === 'pause_repas'
      ? repriseApresPauseRepas(events, { userId: user.id, date: today })
      : undefined
  const otRepriseRepas = repriseRepas
    ? (data.ordresTravail || []).find((o) => o.id === repriseRepas.otId)
    : undefined

  const punch = async (
    action: PointageAction,
    opts: { otId?: string; chantierId?: string; cible?: PointageCible },
  ) => {
    if (!user?.id) return
    if (!actif) {
      setMsg('Pointeuse coupée par le bureau.')
      return
    }
    if (!actionAutorisee(last, action)) {
      setMsg(`Action impossible après ${last ? POINTAGE_ACTION_LABELS[last.action] : 'rien'}.`)
      return
    }
    setBusy(true)
    setMsg('')
    try {
      const geoRes = await capturerGeoPonctuel()
      const at = arrondirDate(new Date(), regles.arrondiMinutes).toISOString()
      const canon = normaliserAction(action)
      const cible =
        opts.cible ||
        (action === 'fournisseur' ? 'fournisseur' : action === 'bureau' ? 'bureau' : undefined)
      const otForEvent =
        canon === 'sortie_domicile' || canon === 'retour_domicile' || cible === 'hors_ot'
          ? undefined
          : opts.otId
      addPointageEvent({
        userId: user.id,
        userName: user.fullName || user.email || 'Technicien',
        action,
        at,
        date: today,
        geo: geoRes.ok ? geoRes.geo : undefined,
        geoRefused: !geoRes.ok && geoRes.refused,
        geoError: geoRes.ok ? undefined : geoRes.message,
        otId: otForEvent,
        chantierId: opts.chantierId,
        cible,
      })
      const nextStatut = statutOtDepuisAction(action, cible)
      if (nextStatut && opts.otId) {
        const ot = (data.ordresTravail || []).find((o) => o.id === opts.otId)
        if (ot && ot.statut !== nextStatut) {
          upsertOrdreTravail({ ...ot, statut: nextStatut })
        }
      }
      if (canon === 'pause_repas') {
        preparerSonAlarmePauseRepas()
        demanderPermissionAlarmePauseRepas()
      }
      if (canon === 'intervention_en_cours') resetAlarmePauseRepas()
      setMsg(`${POINTAGE_ACTION_LABELS[action]} · ${formatHeureIso(at)}`)
    } finally {
      setBusy(false)
    }
  }

  const punchHorsInt = (item: (typeof POINTAGE_HORS_INT_MENU)[number]) => {
    if (!actionAutorisee(last, item.action)) {
      if (item.action === 'sortie_domicile') {
        setMsg('Trajet début déjà fait, ou journée close.')
      } else if (!last || lastCanon === 'fin_journee') {
        setMsg('D’abord « Déplacement hors INT début de journée ».')
      } else {
        setMsg(`Action impossible après ${POINTAGE_ACTION_LABELS[last.action]}.`)
      }
      return
    }
    const surInt = lastCanon === 'intervention_en_cours'
    void punch(item.action, {
      cible: item.cible,
      otId:
        (item.action === 'pause_repas' || item.action === 'pause') && surInt
          ? last?.otId
          : undefined,
      chantierId:
        (item.action === 'pause_repas' || item.action === 'pause') && surInt
          ? last?.chantierId
          : undefined,
    })
  }

  const enTrajetFin = lastCanon === 'retour_domicile'
  const journeeClose = lastCanon === 'fin_journee'

  return (
    <section
      className={['space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4', className].join(
        ' ',
      )}
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-700">
          Entrées de temps hors INT
        </p>
        <p className="mt-0.5 font-display text-base font-semibold text-ink">
          {last
            ? `${POINTAGE_ACTION_LABELS[last.action]} · ${formatHeureIso(last.at)}`
            : 'Pas encore pointé aujourd’hui'}
        </p>
        <p className="mt-1 text-xs text-muted">
          Trajet début / fin, fournisseur, bureau, pause — pas le dossier d’intervention. Pour
          pointer une INT : Accueil → Mes interventions.
        </p>
      </div>

      {!actif ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          Pointeuse coupée par le bureau.
        </p>
      ) : null}

      {repriseRepas && last ? (
        <PauseRepasEnCoursBar
          startedAt={last.at}
          numeroOt={otRepriseRepas ? formatOtNumero(otRepriseRepas.numero) : undefined}
          busy={busy}
          disabled={!actif}
          onStop={() => {
            void punch('intervention_en_cours', {
              otId: repriseRepas.otId,
              chantierId: repriseRepas.chantierId || otRepriseRepas?.chantierId,
              cible: 'ot',
            })
          }}
        />
      ) : null}

      {journeeClose ? (
        <p className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-semibold text-muted">
          Journée close — arrivé à la maison. Trajet fin hors quota 7h/8h (franchise 30 min).
        </p>
      ) : enTrajetFin ? (
        <button
          type="button"
          disabled={busy || !actif}
          onClick={() => void punch('fin_journee', { cible: 'domicile' })}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-800 px-3 text-sm font-bold text-white"
        >
          <Home className="h-4 w-4" /> Arrivé à la maison
        </button>
      ) : (
        <label className="block text-sm">
          <span className="mb-1 block text-[11px] font-bold uppercase text-muted">
            Nouvelle entrée hors INT
          </span>
          <select
            disabled={busy || !actif}
            defaultValue=""
            onChange={(e) => {
              const v = e.target.value
              e.target.value = ''
              const item = POINTAGE_HORS_INT_MENU.find((m) => `${m.action}:${m.cible || ''}` === v)
              if (!item) return
              punchHorsInt(item)
            }}
            className="h-11 w-full rounded-xl border border-line bg-white px-3 font-semibold"
          >
            <option value="">Choisir une entrée hors INT…</option>
            {POINTAGE_HORS_INT_MENU.map((m) => (
              <option key={`${m.action}:${m.cible || ''}`} value={`${m.action}:${m.cible || ''}`}>
                {m.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[10px] font-semibold text-muted">
            Début / fin de journée : franchise 30 min, hors quota. Pause = non payée. Pause repas =
            50 min à 1 h, hors quota, prime panier (surplus = pause). Entre deux INT : déplacement
            hors INT au temps entier.
          </span>
        </label>
      )}

      {msg ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
          {msg}
        </p>
      ) : null}
    </section>
  )
}
