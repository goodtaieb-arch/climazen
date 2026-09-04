import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, MapPin, Navigation, Wrench } from 'lucide-react'
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
 * Une nouvelle action arrête la précédente. L’OT ne se clôture que via « Fin d’intervention ».
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
      setMsg('Pointeuse inactive — le bureau doit activer les règles.')
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
      if (!geoRes.ok && regles.geoObligatoire) {
        setMsg(geoRes.message)
        return
      }
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

  if (mesInt.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-line bg-white p-4">
        <p className="text-sm font-semibold text-ink">Aucune intervention affectée</p>
        <p className="mt-1 text-xs text-muted">
          Le bureau vous pose une INT, ou ouvrez-en une nouvelle (cercle Intervenir).
        </p>
        {msg ? <p className="mt-2 text-xs font-semibold text-emerald-800">{msg}</p> : null}
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
          Pointeuse non activée par le bureau — les INT restent visibles, le pointage est bloqué.
        </p>
      ) : null}
      {msg ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-950">
          {msg}
        </p>
      ) : null}
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
              <button
                type="button"
                onClick={() => setOpenId(expanded ? null : o.id)}
                className="flex w-full items-start gap-2 px-3 py-3 text-left"
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
              {expanded ? (
                <div className="space-y-2 border-t border-line bg-mist/40 px-3 py-3">
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
                      Déplacement
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
                    <>
                      <Link
                        to={`/app/appel?ot=${encodeURIComponent(o.id)}`}
                        className="flex min-h-11 items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 px-3 text-sm font-bold text-emerald-950"
                      >
                        Ouvrir (rédiger / signer / fin)
                      </Link>
                      <label className="block text-sm">
                        <span className="mb-1 block text-[11px] font-bold uppercase text-muted">
                          Nouvelle entrée hors intervention
                        </span>
                        <select
                          disabled={busy || !actif}
                          defaultValue=""
                          onChange={(e) => {
                            const v = e.target.value
                            e.target.value = ''
                            const item = POINTAGE_HORS_INT_MENU.find(
                              (m) => `${m.action}:${m.cible || ''}` === v,
                            )
                            if (!item) return
                            void punch(item.action, {
                              otId: o.id,
                              chantierId: o.chantierId,
                              cible: item.cible,
                            })
                          }}
                          className="h-11 w-full rounded-xl border border-line bg-white px-3 font-semibold"
                        >
                          <option value="">Choisir…</option>
                          {POINTAGE_HORS_INT_MENU.map((m) => (
                            <option key={`${m.action}:${m.cible || ''}`} value={`${m.action}:${m.cible || ''}`}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
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
                  {peutReprendre && !enCoursIci && !enDeplacementOt ? (
                    <label className="block text-sm">
                      <span className="mb-1 block text-[11px] font-bold uppercase text-muted">
                        Changer d’action
                      </span>
                      <select
                        disabled={busy || !actif}
                        defaultValue=""
                        onChange={(e) => {
                          const v = e.target.value
                          e.target.value = ''
                          const item = POINTAGE_HORS_INT_MENU.find(
                            (m) => `${m.action}:${m.cible || ''}` === v,
                          )
                          if (!item) return
                          void punch(item.action, {
                            otId: o.id,
                            chantierId: o.chantierId,
                            cible: item.cible,
                          })
                        }}
                        className="h-11 w-full rounded-xl border border-line bg-white px-3 font-semibold"
                      >
                        <option value="">Choisir…</option>
                        {POINTAGE_HORS_INT_MENU.map((m) => (
                          <option key={`${m.action}:${m.cible || ''}`} value={`${m.action}:${m.cible || ''}`}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </label>
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
