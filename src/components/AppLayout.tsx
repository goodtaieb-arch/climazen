import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Building2,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  Settings,
  Users,
} from 'lucide-react'
import { BrandLogo } from './BrandLogo'
import { ImportLocalBanner } from './ImportLocalBanner'
import { useAuth } from '../lib/AuthContext'

const baseLinks = [
  { to: '/app', end: true, label: 'Tableau de bord', icon: LayoutDashboard, short: 'Accueil' },
  { to: '/app/clients', label: 'Clients', icon: Building2, short: 'Clients' },
  { to: '/app/chantiers', label: 'Chantiers', icon: MapPin, short: 'Chantiers' },
  { to: '/app/stock', label: 'Stock fluides', icon: Package, short: 'Stock' },
  { to: '/app/interventions', label: 'CERFA / Interventions', icon: ClipboardList, short: 'CERFA' },
  { to: '/app/operateur', label: 'Mon entreprise', icon: Settings, short: 'Société' },
]

const mobilePrimary = [
  { to: '/app', end: true, label: 'Accueil', icon: LayoutDashboard },
  { to: '/app/clients', label: 'Clients', icon: Building2 },
  { to: '/app/chantiers', label: 'Chantiers', icon: MapPin },
  { to: '/app/stock', label: 'Stock', icon: Package },
  { to: '/app/interventions', label: 'CERFA', icon: ClipboardList },
]

export function AppLayout() {
  const { user, organization, isOwner, logout } = useAuth()
  const navigate = useNavigate()

  const links = isOwner
    ? [
        ...baseLinks.slice(0, 5),
        { to: '/app/equipe', label: 'Équipe', icon: Users, short: 'Équipe' },
        ...baseLinks.slice(5),
      ]
    : baseLinks

  const doLogout = () => {
    void logout().then(() => navigate('/login'))
  }

  const roleLabel = isOwner ? 'Compte officiel' : 'Opérateur'
  const orgLabel = organization?.name || 'Société'

  return (
    <div className="min-h-screen bg-foam text-ink lg:grid lg:grid-cols-[260px_1fr]">
      {/* Desktop sidebar */}
      <aside className="hidden border-r border-line bg-ink text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:self-start lg:overflow-y-auto">
        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <div>
            <BrandLogo onDark size="sm" />
            <div className="mt-2 px-1 text-xs text-white/45">Terrain · CERFA 15497-04</div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-3">
          {links.map(({ to, end, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  'flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent text-ink'
                    : 'text-white/75 hover:bg-white/10 hover:text-white',
                ].join(' ')
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 px-4 py-4">
          <div className="truncate text-sm font-medium">{orgLabel}</div>
          <div className="truncate text-xs text-white/45">
            {user?.fullName || user?.email} · {roleLabel}
          </div>
          <div className="truncate text-[11px] text-white/35">{user?.email || user?.username}</div>
          <button
            type="button"
            onClick={doLogout}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm font-semibold text-white hover:bg-white/15"
          >
            <LogOut className="h-4 w-4" /> Se déconnecter
          </button>
        </div>
      </aside>

      <main className="min-w-0 pb-20 lg:pb-0">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-white px-4 py-3 sm:px-6 lg:px-8">
          <div className="min-w-0 lg:hidden">
            <BrandLogo size="sm" />
          </div>
          <div className="hidden min-w-0 lg:block">
            <div className="truncate text-sm font-medium text-ink">{orgLabel}</div>
            <div className="truncate text-xs text-muted">
              {user?.fullName || user?.email} · {roleLabel} · {user?.email || user?.username}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NavLink
              to="/app/operateur"
              className="rounded-full border border-line bg-foam px-3 py-2 text-xs font-semibold text-ink hover:bg-mist lg:hidden"
            >
              Société
            </NavLink>
            {isOwner && (
              <NavLink
                to="/app/equipe"
                className="hidden rounded-full border border-line bg-foam px-3 py-2 text-xs font-semibold text-ink hover:bg-mist sm:inline-flex lg:hidden"
              >
                Équipe
              </NavLink>
            )}
            <button
              type="button"
              onClick={doLogout}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-line bg-foam px-3 py-2 text-sm font-semibold text-ink hover:bg-mist sm:px-4"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Se déconnecter</span>
            </button>
          </div>
        </div>
        <div className="p-4 sm:p-6 lg:p-8">
          <ImportLocalBanner />
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 backdrop-blur-md lg:hidden"
        style={{ paddingBottom: 'max(0.35rem, env(safe-area-inset-bottom))' }}
        aria-label="Navigation principale"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {mobilePrimary.map(({ to, end, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  'flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium',
                  isActive ? 'text-accent' : 'text-muted',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="h-5 w-5" strokeWidth={isActive ? 2.25 : 1.75} />
                  <span className="truncate">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
