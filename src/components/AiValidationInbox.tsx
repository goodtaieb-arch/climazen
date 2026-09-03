import { Bell, Check, Phone, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useStore } from '../lib/store'
import {
  labelAiPendingKind,
  labelAiPendingSource,
  pendingValidationsForUser,
} from '../lib/aiPendingValidation'
import { labelSecteurCourt } from '../lib/postePersonnel'

/**
 * Boîte de réception — validations humaines IA pour le responsable du secteur.
 */
export function AiValidationInbox() {
  const { data, decideAiPendingValidation } = useStore()
  const { user } = useAuth()
  const isOwner = user?.role === 'owner'
  const mine = pendingValidationsForUser(data.aiPendingValidations, user?.id, {
    isOwner,
    includeUnassigned: isOwner,
  })

  if (mine.length === 0) return null

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
            Lola / assistant a préparé une action — rien n’est écrit sans votre OK
            {mine[0]?.assigneeName ? ` (${mine[0].assigneeName})` : ''}.
          </p>
        </div>
      </div>

      <ul className="mt-3 space-y-2">
        {mine.slice(0, 8).map((item) => (
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
                {[item.clientHint && `Client : ${item.clientHint}`, item.siteHint && `Site : ${item.siteHint}`, item.callerHint]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  decideAiPendingValidation(item.id, 'validee', {
                    userId: user?.id,
                    userName: user?.fullName || user?.email,
                  })
                }
                className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-[#0f766e] px-3 text-xs font-extrabold text-white"
              >
                <Check className="h-3.5 w-3.5" /> Valider
              </button>
              <button
                type="button"
                onClick={() =>
                  decideAiPendingValidation(item.id, 'refusee', {
                    userId: user?.id,
                    userName: user?.fullName || user?.email,
                  })
                }
                className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-line bg-white px-3 text-xs font-bold text-ink"
              >
                <X className="h-3.5 w-3.5" /> Refuser
              </button>
              {item.source === 'phone' ? (
                <Link
                  to="/app/appel"
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-bold text-indigo-950"
                >
                  <Phone className="h-3.5 w-3.5" /> Ouvrir OT
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
