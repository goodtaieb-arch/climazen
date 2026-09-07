import { Bell, Check, Phone, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useStore } from '../lib/store'
import {
  groupPendingByTech,
  labelAiPendingKind,
  labelAiPendingSource,
  pendingValidationsForUser,
} from '../lib/aiPendingValidation'
import { labelSecteurCourt } from '../lib/postePersonnel'
import { formatOtNumero } from '../lib/ordreTravail'

/**
 * Boîte de réception — validations humaines IA pour le responsable du secteur.
 * Affectation INT : un bouton par tech (tout son lot) et un bouton par INT.
 */
export function AiValidationInbox() {
  const { data, decideAiPendingValidation, decideAiPendingValidations } = useStore()
  const { user } = useAuth()
  const isOwner = user?.role === 'owner'
  const mine = pendingValidationsForUser(data.aiPendingValidations, user?.id, {
    isOwner,
    includeUnassigned: isOwner,
  })

  if (mine.length === 0) return null

  const actor = {
    userId: user?.id,
    userName: user?.fullName || user?.email,
  }
  const { groups, others } = groupPendingByTech(mine)
  const agendaDate =
    groups
      .flatMap((g) => g.items)
      .map((x) => (x.proposal?.type === 'assign_ot' ? x.proposal.slot.date : ''))
      .find((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)) || ''
  const agendaHref = agendaDate ? `/app/agenda?date=${encodeURIComponent(agendaDate)}` : '/app/agenda'

  const decideOne = (id: string, decision: 'validee' | 'refusee') => {
    decideAiPendingValidation(id, decision, actor)
  }
  const decideMany = (ids: string[], decision: 'validee' | 'refusee') => {
    decideAiPendingValidations(ids, decision, actor)
  }

  return (
    <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500 text-white">
          <Bell className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-bold text-amber-950">
            Validations IA à confirmer
          </h2>
          <p className="mt-0.5 text-xs text-amber-900/85">
            Lola a préparé le travail — rien n’est écrit sans votre OK. Validez par
            technicien ou par INT.
            {mine[0]?.assigneeName ? ` (${mine[0].assigneeName})` : ''}.
          </p>
        </div>
      </div>

      {groups.length > 0 ? (
        <div className="mt-3 space-y-3">
          {groups.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  decideMany(
                    groups.flatMap((g) => g.items.map((x) => x.id)),
                    'validee',
                  )
                }
                className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-[#0f766e] px-3 text-xs font-extrabold text-white"
              >
                <Check className="h-3.5 w-3.5" /> Valider tout le planning
              </button>
              <Link
                to={agendaHref}
                className="inline-flex min-h-9 items-center rounded-lg border border-teal-200 bg-teal-50 px-3 text-xs font-bold text-teal-950"
              >
                Ouvrir l’agenda
              </Link>
            </div>
          ) : null}
          {groups.map((g) => {
            const ids = g.items.map((x) => x.id)
            return (
              <div
                key={g.key}
                className="rounded-xl border border-amber-200 bg-white px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{g.techName}</p>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                      {g.items.length} INT
                      {g.secteur ? ` · ${labelSecteurCourt(g.secteur)}` : ''}
                      {' · '}secteur conservé
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => decideMany(ids, 'validee')}
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-[#0f766e] px-3 text-xs font-extrabold text-white"
                    >
                      <Check className="h-3.5 w-3.5" /> Valider {g.techName.split(' ')[0]}
                    </button>
                    <button
                      type="button"
                      onClick={() => decideMany(ids, 'refusee')}
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-line bg-white px-3 text-xs font-bold text-ink"
                    >
                      <X className="h-3.5 w-3.5" /> Refuser le tech
                    </button>
                  </div>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {g.items.map((item) => {
                    const slot = item.proposal?.type === 'assign_ot' ? item.proposal.slot : null
                    return (
                      <li
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-100 bg-amber-50/60 px-2.5 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-ink">
                            {slot
                              ? `${formatOtNumero(slot.otNumero)} · ${slot.otAction}`
                              : item.title}
                          </p>
                          <p className="text-[11px] text-slate">
                            {slot
                              ? `${slot.date} à ${slot.heure}${
                                  slot.siteLabel ? ` · ${slot.siteLabel}` : ''
                                }${slot.clientLabel ? ` · ${slot.clientLabel}` : ''}`
                              : item.summary}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => decideOne(item.id, 'validee')}
                            className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-[#0f766e] px-2.5 text-[11px] font-extrabold text-white"
                          >
                            <Check className="h-3 w-3" /> Valider INT
                          </button>
                          <button
                            type="button"
                            onClick={() => decideOne(item.id, 'refusee')}
                            className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-line bg-white px-2.5 text-[11px] font-bold text-ink"
                          >
                            <X className="h-3 w-3" /> Refuser
                          </button>
                          {slot ? (
                            <Link
                              to={`/app/agenda?date=${encodeURIComponent(slot.date)}`}
                              className="inline-flex min-h-8 items-center rounded-lg border border-teal-200 bg-teal-50 px-2.5 text-[11px] font-bold text-teal-950"
                            >
                              Agenda
                            </Link>
                          ) : null}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      ) : null}

      {others.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {others.slice(0, 8).map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                <span>{labelAiPendingKind(item.kind)}</span>
                <span>·</span>
                <span>{labelAiPendingSource(item.source)}</span>
                {item.secteur ? (
                  <>
                    <span>·</span>
                    <span>Secteur {labelSecteurCourt(item.secteur)}</span>
                  </>
                ) : null}
              </div>
              <p className="mt-1 font-semibold text-ink">{item.title}</p>
              <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate">{item.summary}</p>
              {(item.clientHint || item.siteHint || item.callerHint) && (
                <p className="mt-1 text-[11px] text-muted">
                  {[
                    item.clientHint && `Client : ${item.clientHint}`,
                    item.siteHint && `Site : ${item.siteHint}`,
                    item.callerHint,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => decideOne(item.id, 'validee')}
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-[#0f766e] px-3 text-xs font-extrabold text-white"
                >
                  <Check className="h-3.5 w-3.5" /> Valider
                </button>
                <button
                  type="button"
                  onClick={() => decideOne(item.id, 'refusee')}
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-line bg-white px-3 text-xs font-bold text-ink"
                >
                  <X className="h-3.5 w-3.5" /> Refuser
                </button>
                {item.source === 'phone' ? (
                  <Link
                    to="/app/appel"
                    className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-bold text-indigo-950"
                  >
                    <Phone className="h-3.5 w-3.5" /> Ouvrir INT
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
