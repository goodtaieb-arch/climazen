import { useEffect, useState } from 'react'
import { CalendarOff, Eye, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useStore } from '../lib/store'
import { isBureauUi } from '../lib/uiMode'
import {
  ABSENCE_TYPE_LABELS,
  demandesEnAttente,
  titreDemandeAbsence,
  type DemandeAbsence,
} from '../lib/demandesAbsence'
import { buildAbsencePdf, companyFromOperateur } from '../lib/absencePdf'
import { AbsencePdfPreview } from './AbsencePdfPreview'

/** Accueil bureau — demandes d’absence à trancher. */
export function AbsencesInbox() {
  const { data, decideDemandeAbsence, peutVoirIdentitesRh } = useStore()
  const { user, isOwner } = useAuth()
  const bureau = isBureauUi({ isOwner: Boolean(isOwner), peutVoirIdentitesRh })
  const pending = demandesEnAttente(data.demandesAbsence)
  const [preview, setPreview] = useState<{ url: string; id: string } | null>(null)

  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!bureau || pending.length === 0) return null

  const openValidatePreview = (d: DemandeAbsence) => {
    const rendered: DemandeAbsence = {
      ...d,
      statut: 'validee',
      decidedByName: user?.fullName || user?.email || 'Responsable',
      decidedAt: new Date().toISOString(),
    }
    const blob = buildAbsencePdf(rendered, companyFromOperateur(data.operateur), {
      forceStatut: 'validee',
      signatureDirection: user?.signatureImage,
    })
    if (preview?.url) URL.revokeObjectURL(preview.url)
    setPreview({ url: URL.createObjectURL(blob), id: d.id })
  }

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
            Ouvrez la feuille PDF, vérifiez le visuel, puis validez pour bloquer l’agenda.
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
                onClick={() => openValidatePreview(d)}
                className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-[#0f766e] px-3 text-xs font-extrabold text-white"
              >
                <Eye className="h-3.5 w-3.5" /> Voir et valider
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
      {preview ? (
        <AbsencePdfPreview
          url={preview.url}
          title="Visuel du certificat — confirmez la validation"
          hint="Vérifiez logo, dates et motif avant de valider."
          confirmLabel="Valider et enregistrer"
          onConfirm={() => {
            decideDemandeAbsence(preview.id, 'validee', {
              userId: user?.id,
              userName: user?.fullName || user?.email,
            })
            URL.revokeObjectURL(preview.url)
            setPreview(null)
          }}
          onClose={() => {
            URL.revokeObjectURL(preview.url)
            setPreview(null)
          }}
        />
      ) : null}
    </section>
  )
}
