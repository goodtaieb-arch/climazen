import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, Eye, Home, MapPin, Navigation, Wrench } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import { formatOtNumero, isOtCloture, techIdsOt, TYPE_OT_LABELS } from '../lib/ordreTravail'
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
  statutOtDepuisAction,
  type PointageAction,
  type PointageCible,
} from '../lib/pointage'

/**
 * Accueil tech : INT affectées + pointage (déplacement → en cours → hors INT).
 * Une nouvelle action arrête la précédente. La clôture du dossier arrête le temps d’INT.
 */
export function TerrainAccueilPointage() {
  const { data, addPointageEvent, upsertOrdreTravail } = useStore()
  const { user } = useAuth()
  const events = useMemo(() => parsePointageEvents(data.pointageEvents), [data.pointageEvents])
  const regles = useMemo(() => parsePointageRegles(data.pointageRegles), [data.pointageRegles])
  const actif = pointageEstActif(regles)
  const today = datePointageLocale()
  const last = user?.id ? dernierPointage(events, { userId: user.id, date: today }) : undefined
  const lastCanon = last ? normaliserAction(last.action) : undefined

  const [openId, setOpenId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const mesInt = useMemo(() => {
    if (!user?.id) return []
    return (data.ordresTravail || [])
      .filter((o) => !isOtCloture(o.statut) && techIdsOt(o).includes(user.id))
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (a.numero || '').localeCompare(b.numero || ''))
  }, [data.ordresTravail, user?.id])

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
      /* GPS ponctuel si dispo — ne bloque jamais le pointage téléphone. */
      const at = arrondirDate(new Date(), regles.arrondiMinutes).toISOString()
      const canon = normaliserAction(action)
      const cible =
        opts.cible ||
        (action === 'fournisseur'
          ? 'fournisseur'
          : action === 'bureau'
            ? 'bureau'
            : undefined)
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
        if (ot && !isOtCloture(ot.statut) && ot.statut !== nextStatut) {
          upsertOrdreTravail({ ...ot, statut: nextStatut })
        }
      }
      setMsg(`${POINTAGE_ACTION_LABELS[action]} · ${formatHeureIso(at)}`)
    } finally {
      setBusy(false)
    }
  }

  if (mesInt.length === 0 && lastCanon === 'fin_journee') {
    return (
      <section className="rounded-2xl border border-line bg-white p-4">
        <p className="text-sm font-semibold text-ink">Journée close</p>
        <p className="mt-1 text-xs text-muted">
          Trajet fin arrêté à l’arrivée. Aucune INT ouverte. Nouvelle INT : cercle Intervenir.
        </p>
        {msg ? <p className="mt-2 text-xs font-semibold text-emerald-800">{msg}</p> : null}
      </section>
    )
  }

  const enIntervention = lastCanon === 'intervention_en_cours'
  const enTrajetFin = lastCanon === 'retour_domicile'
  const journeeClose = lastCanon === 'fin_journee'
  const showApresInt =
    !journeeClose &&
    !enIntervention &&
    lastCanon === 'fin_intervention'

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
    void punch(item.action, { cible: item.cible })
  }

  const horsIntSelect =
    !journeeClose && !enTrajetFin ? (
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
          Début / fin de journée : franchise 30 min, hors quota. Pause = non payée. Entre deux INT :
          déplacement hors INT au temps entier. Consulter une INT ne lance pas le pointage.
        </span>
      </label>
    ) : null

  const trajetFinBtn = enTrajetFin ? (
    <button
      type="button"
      disabled={busy || !actif}
      onClick={() => void punch('fin_journee', { cible: 'domicile' })}
      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-800 px-3 text-sm font-bold text-white"
    >
      <Home className="h-4 w-4" /> Arrivé à la maison
    </button>
  ) : null

  const journeeBar = journeeClose ? (
    <p className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-semibold text-muted">
      Journée close — arrivé à la maison. Trajet fin hors quota 7h/8h (franchise 30 min).
    </p>
  ) : (
    <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-700">
        Pointage hors INT
      </p>
      {horsIntSelect}
      {enTrajetFin ? trajetFinBtn : null}
      {showApresInt ? (
        <Link
          to="/app/appel"
          className="flex min-h-11 items-center justify-center rounded-xl border border-accent bg-accent/15 px-3 text-sm font-bold text-ink"
        >
          Nouvelle intervention
        </Link>
      ) : null}
    </div>
  )

  if (mesInt.length === 0) {
    return (
      <section className="space-y-2">
        {journeeBar}
        {msg ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-950">
            {msg}
          </p>
        ) : null}
      </section>
    )
  }

  return (
    <section className="space-y-2">
      <div className="flex items-end justify-between gap-2 px-1">
        <h2 className="font-display text-lg font-semibold">Mes interventions</h2>
        {last ? (
          <p className="text-[11px] font-semibold text-muted">
            {POINTAGE_ACTION_LABELS[last.action]} · {formatHeureIso(last.at)}
          </p>
        ) : (
          <p className="text-[11px] font-semibold text-muted">Pas encore pointé aujourd’hui</p>
        )}
      </div>
      {!actif ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          Pointeuse coupée par le bureau — les INT restent visibles.
        </p>
      ) : null}
      {msg ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-950">
          {msg}
        </p>
      ) : null}
      {journeeBar}
      <ul className="space-y-2">
        {mesInt.map((o) => {
          const client = data.clients.find((c) => c.id === o.clientId)
          const site = data.chantiers.find((c) => c.id === o.chantierId)
          const expanded = openId === o.id
          const lastOnThis =
            last?.otId === o.id ||
            (lastCanon === 'intervention_en_cours' && last?.otId === o.id)
          const enDeplacementOt =
            lastCanon === 'deplacement' && last?.otId === o.id && (last.cible || 'ot') === 'ot'
          const enCoursIci = lastCanon === 'intervention_en_cours' && last?.otId === o.id
          const horsIntEnCours =
            lastCanon === 'deplacement' ||
            lastCanon === 'fournisseur' ||
            lastCanon === 'bureau' ||
            lastCanon === 'pause' ||
            lastCanon === 'pause_repas'
          const peutReprendre =
            horsIntEnCours && !enDeplacementOt && actionAutorisee(last, 'intervention_en_cours')

          return (
            <li key={o.id} className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
              <div className="flex w-full items-start gap-2 px-3 py-3">
                <button
                  type="button"
                  onClick={() => setOpenId(expanded ? null : o.id)}
                  className="flex min-w-0 flex-1 items-start gap-2 text-left"
                >
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-ink/20 bg-mist">
                    {enCoursIci ? (
                      <Wrench className="h-4 w-4 text-emerald-700" />
                    ) : enDeplacementOt ? (
                      <Navigation className="h-4 w-4 text-sky-700" />
                    ) : (
                      <MapPin className="h-4 w-4 text-muted" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-extrabold text-ink">{formatOtNumero(o.numero)}</span>
                      <span className="text-[10px] font-bold uppercase text-muted">
                        {TYPE_OT_LABELS[o.typeOt]}
                      </span>
                      {enDeplacementOt ? (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-950">
                          Déplacement
                        </span>
                      ) : null}
                      {enCoursIci ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-950">
                          En cours
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-sm font-semibold text-ink">
                      {client?.raisonSociale || 'Client —'}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {site?.nom || 'Site —'}
                      {o.action ? ` · ${o.action}` : ''}
                    </span>
                  </span>
                  <ChevronDown
                    className={`mt-1 h-4 w-4 shrink-0 text-muted transition ${expanded ? 'rotate-180' : ''}`}
                  />
                </button>
                <Link
                  to={`/app/appel?ot=${encodeURIComponent(o.id)}`}
                  className="mt-0.5 inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-line bg-white px-2.5 text-[11px] font-bold text-ink"
                  title="Consulter sans pointer"
                >
                  <Eye className="h-3.5 w-3.5" />
                  {enCoursIci ? 'Dossier' : 'Voir'}
                </Link>
              </div>
              {expanded && enTrajetFin ? (
                <p className="border-t border-line bg-mist/40 px-3 py-3 text-xs font-semibold text-muted">
                  Trajet fin en cours — arrêtez-le avec « Arrivé à la maison » en haut.
                </p>
              ) : null}
              {expanded && !enTrajetFin ? (
                <div className="space-y-2 border-t border-line bg-mist/40 px-3 py-3">
                  <p className="text-[10px] font-semibold text-muted">
                    « Voir » ouvre le dossier sans vous mettre en cours. Le pointage hors INT est
                    au-dessus.
                  </p>
                  {!enDeplacementOt && !enCoursIci ? (
                    <label className="flex min-h-11 items-center gap-2 rounded-xl border border-sky-200 bg-white px-3 text-sm font-semibold text-sky-950">
                      <input
                        type="checkbox"
                        disabled={busy || !actif}
                        checked={false}
                        onChange={() =>
                          void punch('deplacement', {
                            otId: o.id,
                            chantierId: o.chantierId,
                            cible: 'ot',
                          })
                        }
                        className="h-5 w-5 accent-sky-700"
                      />
                      Déplacement vers cette INT
                    </label>
                  ) : null}
                  {enDeplacementOt ? (
                    <button
                      type="button"
                      disabled={busy || !actif}
                      onClick={() =>
                        void punch('intervention_en_cours', {
                          otId: o.id,
                          chantierId: o.chantierId,
                          cible: 'ot',
                        })
                      }
                      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-bold text-white"
                    >
                      <Check className="h-4 w-4" /> En cours d’intervention
                    </button>
                  ) : null}
                  {enCoursIci ? (
                    <Link
                      to={`/app/appel?ot=${encodeURIComponent(o.id)}`}
                      className="flex min-h-11 items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 px-3 text-sm font-bold text-emerald-950"
                    >
                      Rédiger / signer / fin
                    </Link>
                  ) : null}
                  {peutReprendre && lastOnThis ? (
                    <button
                      type="button"
                      disabled={busy || !actif}
                      onClick={() =>
                        void punch('intervention_en_cours', {
                          otId: o.id,
                          chantierId: o.chantierId,
                          cible: 'ot',
                        })
                      }
                      className="flex min-h-11 w-full items-center justify-center rounded-xl border border-emerald-300 bg-white px-3 text-sm font-bold text-emerald-950"
                    >
                      Reprendre l’intervention
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
