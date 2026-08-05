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
import { useAuth } from '../lib/AuthContext'

const baseLinks = [
  { to: '/app', end: true, label: 'Tableau de bord', icon: LayoutDashboard },
  { to: '/app/clients', label: 'Clients', icon: Building2 },
  { to: '/app/chantiers', label: 'Chantiers', icon: MapPin },
  { to: '/app/stock', label: 'Stock fluides', icon: Package },
  { to: '/app/interventions', label: 'CERFA / Interventions', icon: ClipboardList },
  { to: '/app/operateur', label: 'Mon entreprise', icon: Settings },
]

export function AppLayout() {
  const { user, organization, isOwner, logout } = useAuth()
  const navigate = useNavigate()

  const links = isOwner
    ? [
        ...baseLinks.slice(0, 5),
        { to: '/app/equipe', label: 'Équipe', icon: Users },
        ...baseLinks.slice(5),
      ]
    : baseLinks

  const doLogout = () => {
    logout()
    navigate('/login')
  }

  const roleLabel = isOwner ? 'Compte officiel' : 'Opérateur'
  const orgLabel = organization?.name || 'Société'

  return (
    <div className="min-h-screen bg-foam text-ink lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-b border-line bg-ink text-white lg:border-b-0 lg:border-r lg:min-h-screen lg:flex lg:flex-col">
        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <div>
            <BrandLogo onDark size="sm" />
            <div className="mt-2 px-1 text-xs text-white/45">Terrain · CERFA 15497-04</div>
          </div>
          <button
            type="button"
            onClick={doLogout}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 lg:hidden"
          >
            <LogOut className="h-3.5 w-3.5" />
            Déconnexion
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible">
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
        <div className="hidden border-t border-white/10 px-4 py-4 lg:block">
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
      <main className="min-w-0">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-white px-4 py-3 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-ink">{orgLabel}</div>
            <div className="truncate text-xs text-muted">
              {user?.fullName || user?.email} · {roleLabel} · {user?.email || user?.username}
            </div>
          </div>
          <button
            type="button"
            onClick={doLogout}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-line bg-foam px-4 py-2 text-sm font-semibold text-ink hover:bg-mist"
          >
            <LogOut className="h-4 w-4" />
            Se déconnecter
          </button>
        </div>
        <div className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
