import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Building2,
  CheckCircle2,
  ClipboardList,
  MapPin,
  Package,
  Search,
  Wrench,
  X,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { allEquipements } from '../lib/cerfaBatch'
import { matchesQuery } from '../components/SearchField'

const ONBOARDING_KEY = 'climazen_onboarding_dismissed'

export function Dashboard() {
  const { data } = useStore()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [showOnboarding, setShowOnboarding] = useState(false)

  const brouillons = data.interventions.filter((i) => i.status === 'brouillon')
  const actifs = data.chantiers.filter((c) => c.statut === 'actif')
  const stockKg = data.stock.reduce((s, i) => s + i.quantiteKg, 0)

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
      to: '/app/chantiers',
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

  const searchHits = useMemo(() => {
    if (!q.trim()) return []
    return data.chantiers
      .map((c) => {
        const client = data.clients.find((cl) => cl.id === c.clientId)
        const eqs = allEquipements(c)
        const hay = [
          c.nom,
          c.ville,
          c.adresse,
          client?.raisonSociale,
          ...eqs.map((e) => [e.nom, e.type, e.marque, e.modele, e.numeroSerie].join(' ')),
        ]
          .filter(Boolean)
          .join(' ')
        return { c, client, eqs, ok: matchesQuery(hay, q) }
      })
      .filter((x) => x.ok)
      .slice(0, 8)
  }, [data.chantiers, data.clients, q])

  const recentSites = useMemo(() => {
    return [...data.chantiers]
      .sort((a, b) =>
        (b.derniereMaintenanceDate || b.createdAt || '').localeCompare(
          a.derniereMaintenanceDate || a.createdAt || '',
        ),
      )
      .slice(0, 6)
  }, [data.chantiers])

  const goTravaux = (search?: string) => {
    navigate('/app/chantiers', {
      state: search?.trim() ? { search: search.trim() } : { travauxList: Date.now() },
    })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 lg:max-w-none lg:space-y-8">
      {/* Terrain-first (mobile + desktop) */}
      <section className="space-y-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Sur le terrain</h1>
          <p className="mt-1 text-sm text-muted sm:text-base">
            Cherchez le site → touchez l’équipement → fiche clim ou CERFA.
          </p>
        </div>

        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                goTravaux(q)
              }
            }}
            placeholder="Client, site, équipement, n° série…"
            className="h-14 w-full rounded-2xl border-2 border-line bg-white pl-12 pr-4 text-base font-medium outline-none focus:border-accent"
            autoComplete="off"
            inputMode="search"
          />
        </label>

        {q.trim() && (
          <ul className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
            {searchHits.length === 0 ? (
              <li className="px-4 py-4 text-sm text-muted">Aucun site trouvé.</li>
            ) : (
              searchHits.map(({ c, client, eqs }) => (
                <li key={c.id} className="border-b border-line last:border-0">
                  <button
                    type="button"
                    onClick={() => goTravaux(c.nom)}
                    className="flex w-full flex-col gap-0.5 px-4 py-4 text-left active:bg-mist"
                  >
                    <span className="font-semibold text-ink">{c.nom}</span>
                    <span className="text-sm text-muted">
                      {client?.raisonSociale || '—'}
                      {c.ville ? ` · ${c.ville}` : ''}
                      {eqs.length ? ` · ${eqs.length} équip.` : ''}
                    </span>
                  </button>
                </li>
              ))
            )}
            <li>
              <button
                type="button"
                onClick={() => goTravaux(q)}
                className="w-full px-4 py-3 text-left text-sm font-semibold text-accent active:bg-mist"
              >
                Voir tous les résultats dans Travaux →
              </button>
            </li>
          </ul>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => goTravaux()}
            className="flex min-h-[4.5rem] items-center gap-4 rounded-2xl border-2 border-accent bg-accent px-4 py-4 text-left text-ink active:bg-accent-hover"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/80">
              <Wrench className="h-6 w-6" />
            </span>
            <span>
              <span className="block font-display text-lg font-bold">Intervenir</span>
              <span className="block text-sm opacity-80">Ouvrir la liste des sites</span>
            </span>
          </button>
          <Link
            to="/app/interventions"
            className="flex min-h-[4.5rem] items-center gap-4 rounded-2xl border-2 border-line bg-white px-4 py-4 text-left active:bg-mist"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent-soft">
              <ClipboardList className="h-6 w-6 text-accent" />
            </span>
            <span>
              <span className="block font-display text-lg font-bold">Brouillons CERFA</span>
              <span className="block text-sm text-muted">
                {brouillons.length
                  ? `${brouillons.length} à terminer`
                  : 'Aucun brouillon'}
              </span>
            </span>
          </Link>
        </div>
      </section>

      {!q.trim() && recentSites.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-semibold">Sites récents</h2>
          <ul className="mt-2 space-y-2">
            {recentSites.map((c) => {
              const client = data.clients.find((cl) => cl.id === c.clientId)
              const nEq = allEquipements(c).length
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => goTravaux(c.nom)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-4 text-left active:bg-mist"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{c.nom}</span>
                      <span className="block truncate text-sm text-muted">
                        {client?.raisonSociale || '—'}
                        {c.ville ? ` · ${c.ville}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-mist px-3 py-1 text-xs font-semibold text-muted">
                      {nEq} équip.
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {brouillons.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-semibold">À reprendre</h2>
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
            {brouillons
              .slice()
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
              .slice(0, 4)
              .map((i) => {
                const client = data.clients.find((c) => c.id === i.clientId)
                const chantier = data.chantiers.find((c) => c.id === i.chantierId)
                return (
                  <li key={i.id}>
                    <Link
                      to={`/app/interventions/${i.id}`}
                      className="flex items-center justify-between gap-2 px-4 py-4 active:bg-mist"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {chantier?.nom || 'Chantier'}
                        </span>
                        <span className="block truncate text-sm text-muted">
                          {client?.raisonSociale} · {i.dateIntervention}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                        brouillon
                      </span>
                    </Link>
                  </li>
                )
              })}
          </ul>
        </section>
      )}

      {showOnboarding && (
        <section className="rounded-2xl border border-accent/30 bg-accent-soft/50 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-slate sm:text-lg">
                Premiers pas ({progress}/{steps.length})
              </h2>
              <p className="mt-1 text-sm text-muted">
                Une fois → Client + site. Sur le terrain → Accueil ou Travaux.
              </p>
            </div>
            <button
              type="button"
              onClick={dismissOnboarding}
              className="rounded-lg p-2 text-muted hover:bg-white/70"
              aria-label="Masquer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {steps.map(({ id, done, label, to, icon: Icon }) => (
              <li key={id}>
                <Link
                  to={to}
                  className={[
                    'flex min-h-12 items-center gap-3 rounded-xl border px-3 py-3 text-sm',
                    done
                      ? 'border-line/60 bg-white/60 text-ink/45'
                      : 'border-line bg-white text-ink',
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

      {/* Bureau : stats (desktop) */}
      <div className="hidden gap-4 lg:grid lg:grid-cols-4">
        <Stat icon={Building2} label="Clients" value={String(data.clients.length)} to="/app/clients" />
        <Stat icon={MapPin} label="Chantiers actifs" value={String(actifs.length)} to="/app/chantiers" />
        <Stat icon={Package} label="Stock fluides" value={`${stockKg.toFixed(1)} kg`} to="/app/stock" />
        <Stat
          icon={ClipboardList}
          label="CERFA brouillons"
          value={String(brouillons.length)}
          to="/app/interventions"
        />
      </div>
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
