import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, CheckCircle2, ClipboardList, MapPin, Package, Plus, X } from 'lucide-react'
import { useStore } from '../lib/store'

const ONBOARDING_KEY = 'climazen_onboarding_dismissed'

export function Dashboard() {
  const { data } = useStore()
  const actifs = data.chantiers.filter((c) => c.statut === 'actif').length
  const stockKg = data.stock.reduce((s, i) => s + i.quantiteKg, 0)
  const brouillons = data.interventions.filter((i) => i.status === 'brouillon').length
  const [showOnboarding, setShowOnboarding] = useState(false)

  const steps = [
    {
      id: 'client',
      done: data.clients.length > 0,
      label: 'Ajouter un client / détenteur',
      to: '/app/clients',
      icon: Building2,
    },
    {
      id: 'chantier',
      done: data.chantiers.length > 0,
      label: 'Créer un chantier / équipement',
      to: '/app/chantiers',
      icon: MapPin,
    },
    {
      id: 'stock',
      done: data.stock.length > 0,
      label: 'Enregistrer une bouteille de stock',
      to: '/app/stock',
      icon: Package,
    },
    {
      id: 'cerfa',
      done: data.interventions.length > 0,
      label: 'Créer une fiche CERFA',
      to: '/app/interventions/new',
      icon: ClipboardList,
    },
  ]
  const allDone = steps.every((s) => s.done)
  const progress = steps.filter((s) => s.done).length

  useEffect(() => {
    if (allDone) {
      setShowOnboarding(false)
      return
    }
    try {
      if (localStorage.getItem(ONBOARDING_KEY) === '1') {
        setShowOnboarding(false)
        return
      }
    } catch {
      /* ignore */
    }
    setShowOnboarding(true)
  }, [allDone])

  const dismissOnboarding = () => {
    try {
      localStorage.setItem(ONBOARDING_KEY, '1')
    } catch {
      /* ignore */
    }
    setShowOnboarding(false)
  }

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

      {showOnboarding && (
        <section className="rounded-2xl border border-accent/30 bg-accent-soft/50 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate">
                Premiers pas ({progress}/{steps.length})
              </h2>
              <p className="mt-1 text-sm text-muted">
                Client → Chantier → Stock → CERFA — pour être opérationnel rapidement.
              </p>
            </div>
            <button
              type="button"
              onClick={dismissOnboarding}
              className="rounded-lg p-1.5 text-muted hover:bg-white/70"
              aria-label="Masquer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {steps.map(({ id, done, label, to, icon: Icon }) => (
              <li key={id}>
                <Link
                  to={to}
                  className={[
                    'flex items-center gap-3 rounded-xl border px-3 py-3 text-sm transition-colors',
                    done
                      ? 'border-line/60 bg-white/60 text-ink/45 hover:border-line hover:text-ink/70'
                      : 'border-line bg-white text-ink hover:border-accent/40',
                  ].join(' ')}
                >
                  {done ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-accent/70" />
                  ) : (
                    <Icon className="h-5 w-5 shrink-0 text-accent" />
                  )}
                  <span className="font-medium">{label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

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
