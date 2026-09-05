import { Link } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { TempsHorsIntPanel } from '../components/TempsHorsIntPanel'
import { POINTAGE_CNIL_NOTICE } from '../lib/pointage'

export function TempsHorsIntPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-800">
          <Clock className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Entrées de temps hors INT
          </h1>
          <p className="text-sm text-muted">
            Pointez ce qui n’est pas une intervention : trajet, fournisseur, bureau, pause.
          </p>
        </div>
      </div>

      <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800">
        {POINTAGE_CNIL_NOTICE}{' '}
        <Link to="/confidentialite" className="font-semibold underline">
          Confidentialité
        </Link>
      </p>

      <TempsHorsIntPanel />

      <p className="text-sm text-muted">
        Pour une intervention :{' '}
        <Link to="/app" className="font-semibold text-accent underline">
          Accueil → Mes interventions
        </Link>
        {' · '}
        le dossier INT ne sert plus au pointage porte-à-porte.
      </p>
    </div>
  )
}
