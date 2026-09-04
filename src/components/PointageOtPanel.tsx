import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  Clock,
  Coffee,
  Flag,
  Home,
  MapPin,
  Navigation,
  Package,
  UtensilsCrossed,
  Wrench,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import { formatOtNumero, isOtCloture, techIdsOt } from '../lib/ordreTravail'
import {
  POINTAGE_ACTION_HINTS,
  POINTAGE_ACTION_LABELS,
  POINTAGE_ACTIONS_HORS_OT,
  POINTAGE_ACTIONS_PARCOURS,
  POINTAGE_CIBLE_LABELS,
  POINTAGE_HORS_INT_MENU,
  actionAutorisee,
  actionsSuivantes,
  arrondirDate,
  calculerJournee,
  capturerGeoPonctuel,
  datePointageLocale,
  dernierPointage,
  formatHeureIso,
  formatMinutesHhMm,
  normaliserAction,
  otIdObligatoire,
  parsePointageEvents,
  parsePointageRegles,
  pointageEstActif,
  statutOtDepuisAction,
  type PointageAction,
  type PointageActionCanon,
  type PointageCible,
} from '../lib/pointage'

const ACTION_ICON: Record<PointageActionCanon, typeof Navigation> = {
  sortie_domicile: Home,
  deplacement: Navigation,
  intervention_en_cours: Wrench,
  fin_intervention: Flag,
  fournisseur: Package,
  bureau: Building2,
  pause: Coffee,
  pause_repas: UtensilsCrossed,
  retour_domicile: Home,
  fin_journee: Clock,
}

type Props = {
  otId?: string
  chantierId?: string
  compact?: boolean
  className?: string
}

export function PointageOtPanel({ otId: otIdProp, chantierId, compact, className = '' }: Props) {
  const { data, addPointageEvent, upsertOrdreTravail } = useStore()
  const { user } = useAuth()
  const events = useMemo(() => parsePointageEvents(data.pointageEvents), [data.pointageEvents])
  const regles = useMemo(() => parsePointageRegles(data.pointageRegles), [data.pointageRegles])
  const actif = pointageEstActif(regles)
  const today = datePointageLocale()

  const [otId, setOtId] = useState(otIdProp || '')
  const [cibleDeplacement, setCibleDeplacement] = useState<PointageCible>('ot')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (otIdProp) setOtId(otIdProp)
  }, [otIdProp])

  const last = user?.id
    ? dernierPointage(events, { userId: user.id, date: today })
    : undefined
  const next = actionsSuivantes(last)
  const deplacementSuivant = next.includes('deplacement')
  const effectiveOtId =
    otIdProp && !deplacementSuivant ? otIdProp : otId || otIdProp
  const showCiblePicker = deplacementSuivant
  const showOtPicker =
    (deplacementSuivant && cibleDeplacement === 'ot') ||
    ((next.includes('intervention_en_cours') || next.includes('fin_intervention')) &&
      !effectiveOtId)

  const maJournee = user?.id
    ? calculerJournee({ events, userId: user.id, date: today, regles })
    : undefined

  const otsOuverts = useMemo(
    () =>
      (data.ordresTravail || []).filter((o) => {
        if (isOtCloture(o.statut)) return false
        if (!user?.id) return true
        return techIdsOt(o).includes(user.id)
      }),
    [data.ordresTravail, user?.id],
  )

  const otCourant = effectiveOtId
    ? otsOuverts.find((o) => o.id === effectiveOtId)
    : maJournee?.otIdCourant
      ? otsOuverts.find((o) => o.id === maJournee.otIdCourant)
      : undefined

  const punch = async (action: PointageAction, cibleOverride?: PointageCible) => {
    if (!user?.id) return
    if (!actif) {
      setMsg('Pointeuse inactive — le bureau doit activer les règles.')
      return
    }
    if (!actionAutorisee(last, action)) {
      setMsg(`Action impossible après ${last ? POINTAGE_ACTION_LABELS[last.action] : 'rien'}.`)
      return
    }

    const canon = normaliserAction(action)
    let cible: PointageCible | undefined
    let otForEvent = effectiveOtId

    if (canon === 'sortie_domicile' || canon === 'retour_domicile') {
      cible = 'domicile'
      otForEvent = ''
    }
    if (canon === 'deplacement') {
      cible = cibleOverride || cibleDeplacement
      if (cible === 'ot' && !otForEvent) {
        setMsg('Choisissez l’OT vers lequel vous vous déplacez.')
        return
      }
      if (cible !== 'ot') otForEvent = ''
    }
    if (canon === 'intervention_en_cours' || action === 'fin_intervention') {
      if (!otForEvent) {
        setMsg('Sélectionnez l’OT sur lequel vous intervenez.')
        return
      }
    }
    if (otIdObligatoire(action, cible) && !otForEvent) {
      setMsg('Cette action doit être liée à un OT.')
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
        date: datePointageLocale(),
        geo: geoRes.ok ? geoRes.geo : undefined,
        geoRefused: !geoRes.ok && geoRes.refused,
        geoError: geoRes.ok ? undefined : geoRes.message,
        otId: otForEvent || undefined,
        chantierId: chantierId || otCourant?.chantierId,
        cible,
      })
      const nextStatut = statutOtDepuisAction(action, cible)
      if (nextStatut && otForEvent) {
        const ot = (data.ordresTravail || []).find((o) => o.id === otForEvent)
        if (ot && !isOtCloture(ot.statut) && ot.statut !== nextStatut) {
          upsertOrdreTravail({ ...ot, statut: nextStatut })
        }
      }
      setMsg(`${POINTAGE_ACTION_LABELS[action]} · ${formatHeureIso(at)} — heures mises à jour.`)
    } finally {
      setBusy(false)
    }
  }

  if (!actif) {
    return (
      <div
        className={`rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 ${className}`}
      >
        Pointeuse non activée.{' '}
        <Link to="/app/pointage" className="font-semibold underline">
          Paramètres
        </Link>
      </div>
    )
  }

  const parcoursBtns = next.filter((a) =>
    (POINTAGE_ACTIONS_PARCOURS as readonly string[]).includes(a),
  )
  const horsOtBtns = next.filter((a) =>
    (POINTAGE_ACTIONS_HORS_OT as readonly string[]).includes(a),
  )

  const renderBtn = (action: PointageActionCanon) => {
    const Icon = ACTION_ICON[action]
    const label =
      action === 'deplacement'
        ? POINTAGE_CIBLE_LABELS[cibleDeplacement] === POINTAGE_CIBLE_LABELS.ot
          ? 'En déplacement'
          : POINTAGE_CIBLE_LABELS[cibleDeplacement]
        : POINTAGE_ACTION_LABELS[action]
    return (
      <button
        key={action}
        type="button"
        disabled={busy}
        onClick={() => void punch(action)}
        className="flex min-h-[4rem] flex-col items-start justify-center rounded-2xl border border-sky-300 bg-white px-3 py-2 text-left shadow-sm active:scale-[0.99]"
      >
        <span className="inline-flex items-center gap-1 text-xs font-extrabold uppercase text-sky-950">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </span>
        <span className="mt-0.5 text-[11px] leading-snug text-muted">
          {POINTAGE_ACTION_HINTS[action]}
        </span>
      </button>
    )
  }

  return (
    <section
      className={['space-y-3 rounded-2xl border border-sky-200 bg-sky-50/80 p-4', className].join(
        ' ',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-sky-900">
            Pointage porte-à-porte
          </p>
          <p className="font-display text-base font-semibold text-ink">
            {last
              ? `${POINTAGE_ACTION_LABELS[last.action]} · ${formatHeureIso(last.at)}`
              : 'Démarrez par le trajet début de journée (sortie domicile)'}
          </p>
          {maJournee ? (
            <p className="text-xs text-muted">
              {maJournee.porteAPorteMin > 0
                ? `Porte-à-porte ${formatMinutesHhMm(maJournee.porteAPorteMin)}`
                : 'Pas encore sorti'}
              {maJournee.interventionMin > 0
                ? ` · OT ${formatMinutesHhMm(maJournee.interventionMin)}`
                : ''}
              {maJournee.deplacementMin > 0
                ? ` · route ${formatMinutesHhMm(maJournee.deplacementMin)}`
                : ''}
              {maJournee.ouvert ? ' · en cours' : ' · journée close'}
            </p>
          ) : null}
        </div>
        {!compact ? (
          <Link to="/app/pointage" className="text-xs font-semibold text-sky-800 underline">
            Détail journée
          </Link>
        ) : null}
      </div>

      {showOtPicker || showCiblePicker ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {showCiblePicker ? (
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-semibold text-ink">Type d’activité / destination</span>
              <select
                value={cibleDeplacement}
                onChange={(e) => setCibleDeplacement(e.target.value as PointageCible)}
                className="h-11 w-full rounded-xl border border-line bg-white px-3"
              >
                <option value="ot">{POINTAGE_CIBLE_LABELS.ot}</option>
                <option value="hors_ot">{POINTAGE_CIBLE_LABELS.hors_ot}</option>
                <option value="fournisseur">{POINTAGE_CIBLE_LABELS.fournisseur}</option>
                <option value="bureau">{POINTAGE_CIBLE_LABELS.bureau}</option>
              </select>
            </label>
          ) : null}
          {showOtPicker && (!showCiblePicker || cibleDeplacement === 'ot') ? (
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-semibold text-ink">
                OT du déplacement / intervention *
              </span>
              <select
                value={effectiveOtId}
                onChange={(e) => setOtId(e.target.value)}
                className="h-11 w-full rounded-xl border border-line bg-white px-3"
              >
                <option value="">— Choisir un OT —</option>
                {otsOuverts.map((o) => (
                  <option key={o.id} value={o.id}>
                    {formatOtNumero(o.numero)} · {o.action || o.typeOt}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : otCourant ? (
        <p className="rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm">
          <MapPin className="mr-1 inline h-4 w-4 text-sky-700" />
          INT {formatOtNumero(otCourant.numero)} — {otCourant.action || otCourant.typeOt}
        </p>
      ) : null}

      {parcoursBtns.length > 0 ? (
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-sky-900">
            Parcours du jour
          </p>
          <div className="grid grid-cols-2 gap-2">{parcoursBtns.map(renderBtn)}</div>
        </div>
      ) : null}

      {horsOtBtns.length > 0 || next.includes('deplacement') ? (
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-sky-900">
            Nouvelle entrée hors intervention
          </p>
          <select
            disabled={busy}
            defaultValue=""
            onChange={(e) => {
              const v = e.target.value
              e.target.value = ''
              const item = POINTAGE_HORS_INT_MENU.find((m) => `${m.action}:${m.cible || ''}` === v)
              if (!item) return
              void punch(item.action, item.cible)
            }}
            className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm font-semibold"
          >
            <option value="">Choisir (pièce, gasoil, bureau…)</option>
            {POINTAGE_HORS_INT_MENU.map((m) => (
              <option key={`${m.action}:${m.cible || ''}`} value={`${m.action}:${m.cible || ''}`}>
                {m.label}
              </option>
            ))}
          </select>
          {horsOtBtns.length > 0 ? (
            <div className="mt-2 grid grid-cols-2 gap-2">{horsOtBtns.map(renderBtn)}</div>
          ) : null}
        </div>
      ) : null}

      {msg ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
          {msg}
        </p>
      ) : null}

      <p className="text-[11px] text-muted">
        Les heures comptent de la sortie domicile jusqu’au retour. Une action à la fois : le temps
        se calcule jusqu’à la suivante.
      </p>
    </section>
  )
}
