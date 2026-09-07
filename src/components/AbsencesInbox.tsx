import { CalendarOff, Check, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useStore } from '../lib/store'
import { isBureauUi } from '../lib/uiMode'
import {
  ABSENCE_TYPE_LABELS,
  demandesEnAttente,
  titreDemandeAbsence,
} from '../lib/demandesAbsence'

/** Accueil bureau — demandes d’absence à trancher. */
export function AbsencesInbox() {
  const { data, decideDemandeAbsence, peutVoirIdentitesRh } = useStore()
  const { user, isOwner } = useAuth()
  const bureau = isBureauUi({ isOwner: Boolean(isOwner), peutVoirIdentitesRh })
  const pending = demandesEnAttente(data.demandesAbsence)

  if (!bureau || pending.length === 0) return null

  return (
    <section className="rounded-2xl border border-teal-300 bg-teal-50 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-600 text-white">
          <CalendarOff className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-bold text-teal-950">
            Absences à valider ({pending.length})
          </h2>
          <p className="mt-0.5 text-xs text-teal-900/85">
            Congés / RTT / absences envoyés par l’équipe — validez pour bloquer l’agenda.
          </p>
        </div>
        <Link
          to="/app/absences"
          className="shrink-0 text-xs font-bold text-teal-900 underline"
        >
          Tout voir
        </Link>
      </div>
      <ul className="mt-3 space-y-2">
        {pending.slice(0, 5).map((d) => (
          <li
            key={d.id}
            className="rounded-xl border border-teal-200 bg-white px-3 py-2.5 text-sm"
          >
            <div className="text-[11px] font-semibold uppercase tracking-wide text-teal-800">
              {ABSENCE_TYPE_LABELS[d.type]} · {d.joursDemandes} j
            </div>
            <p className="mt-0.5 font-semibold text-ink">{titreDemandeAbsence(d)}</p>
            {d.motif ? <p className="text-xs text-muted">{d.motif}</p> : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  decideDemandeAbsence(d.id, 'validee', {
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
                onClick={() => {
                  const motif = window.prompt('Motif du refus (optionnel) :') || ''
                  decideDemandeAbsence(d.id, 'refusee', {
                    userId: user?.id,
                    userName: user?.fullName || user?.email,
                    motifRefus: motif,
                  })
                }}
                className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-3 text-xs font-extrabold text-rose-900"
              >
                <X className="h-3.5 w-3.5" /> Refuser
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
