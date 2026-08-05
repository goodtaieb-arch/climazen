import { Link } from 'react-router-dom'
import { Building2, ClipboardList, MapPin, Package, Plus } from 'lucide-react'
import { useStore } from '../lib/store'

export function Dashboard() {
  const { data } = useStore()
  const actifs = data.chantiers.filter((c) => c.statut === 'actif').length
  const stockKg = data.stock.reduce((s, i) => s + i.quantiteKg, 0)
  const brouillons = data.interventions.filter((i) => i.status === 'brouillon').length

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Tableau de bord</h1>
          <p className="mt-1 text-muted">
            Vue d’ensemble — clients, chantiers, stock et CERFA.
          </p>
        </div>
        <Link
          to="/app/interventions/new"
          className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink hover:bg-accent-hover"
        >
          <Plus className="h-4 w-4" /> Nouvelle intervention
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Building2} label="Clients" value={String(data.clients.length)} to="/app/clients" />
        <Stat icon={MapPin} label="Chantiers actifs" value={String(actifs)} to="/app/chantiers" />
        <Stat
          icon={Package}
          label="Stock fluides"
          value={`${stockKg.toFixed(1)} kg`}
          to="/app/stock"
        />
        <Stat
          icon={ClipboardList}
          label="CERFA brouillons"
          value={String(brouillons)}
          to="/app/interventions"
        />
      </div>

      <section>
        <h2 className="font-display text-xl font-semibold">Dernières interventions</h2>
        {data.interventions.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-line bg-white p-6 text-sm text-muted">
            Aucune fiche pour l’instant.{' '}
            <Link to="/app/interventions/new" className="font-semibold text-accent">
              Créer un CERFA
            </Link>{' '}
            prérempli depuis un chantier.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
            {[...data.interventions]
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
              .slice(0, 6)
              .map((i) => {
                const client = data.clients.find((c) => c.id === i.clientId)
                const chantier = data.chantiers.find((c) => c.id === i.chantierId)
                return (
                  <li key={i.id}>
                    <Link
                      to={`/app/interventions/${i.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-mist/60"
                    >
                      <div>
                        <div className="font-medium">{chantier?.nom || 'Chantier'}</div>
                        <div className="text-sm text-muted">
                          {client?.raisonSociale} · {i.dateIntervention} · {i.fluideType}
                        </div>
                      </div>
                      <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-slate">
                        {i.status}
                      </span>
                    </Link>
                  </li>
                )
              })}
          </ul>
        )}
      </section>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  to,
}: {
  icon: typeof Building2
  label: string
  value: string
  to: string
}) {
  return (
    <Link
      to={to}
      className="rounded-2xl border border-line bg-white p-5 transition-colors hover:border-accent/40"
    >
      <div className="flex items-center gap-2 text-muted">
        <Icon className="h-4 w-4" />
        <span className="text-sm">{label}</span>
      </div>
      <div className="mt-2 font-display text-3xl font-bold">{value}</div>
    </Link>
  )
}
