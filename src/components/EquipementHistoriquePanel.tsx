import { Link } from 'react-router-dom'
import { ClipboardList, Droplets, FileText, Package, Wrench } from 'lucide-react'
import type { HistoriqueEntree } from '../lib/equipementHistorique'
import { labelHistoriqueKind } from '../lib/equipementHistorique'

const ICONS = {
  ot: ClipboardList,
  cerfa: Droplets,
  fiche_clim: FileText,
  fiche_chaufferie: FileText,
  fiche_cta_vmc: FileText,
  piece: Package,
} as const

type Props = {
  entries: HistoriqueEntree[]
  title?: string
  limit?: number
}

export function EquipementHistoriquePanel({ entries, title = 'Historique maintenance', limit = 30 }: Props) {
  const shown = entries.slice(0, limit)
  if (!shown.length) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-mist/40 px-4 py-6 text-center text-sm text-muted">
        <Wrench className="mx-auto mb-2 h-6 w-6 opacity-40" />
        Aucune intervention enregistrée pour l’instant.
      </div>
    )
  }

  return (
    <section className="rounded-2xl border border-line bg-white">
      <div className="border-b border-line px-4 py-3">
        <h3 className="font-display text-sm font-bold text-ink">{title}</h3>
        <p className="text-xs text-muted">{entries.length} événement(s) GMAO</p>
      </div>
      <ul className="divide-y divide-line">
        {shown.map((e) => {
          const Icon = ICONS[e.kind] || ClipboardList
          return (
            <li key={e.id} className="flex gap-3 px-4 py-3 text-sm">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-ink">{e.titre}</div>
                <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted">
                  <span>{new Date(e.date).toLocaleDateString('fr-FR')}</span>
                  <span>{labelHistoriqueKind(e.kind)}</span>
                  {e.statut ? <span>{e.statut}</span> : null}
                  {e.otNumero ? <span>{e.otNumero}</span> : null}
                </div>
                {e.detail ? <p className="mt-1 text-xs text-slate">{e.detail}</p> : null}
                {e.otId ? (
                  <Link
                    to={`/app/appel?ot=${encodeURIComponent(e.otId)}`}
                    className="mt-1 inline-block text-xs font-semibold text-accent underline"
                  >
                    Voir l’OT
                  </Link>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
