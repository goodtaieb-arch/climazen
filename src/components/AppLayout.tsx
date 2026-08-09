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

/** Couleurs distinctes par entrée menu (inline = toujours visibles) */
const tones: Record<
  string,
  { band: string; icon: string; card: string; cardActive: string; border: string; borderActive: string }
> = {
  dashboard: {
    band: '#bfdbfe',
    icon: '#1d4ed8',
    card: '#eff6ff',
    cardActive: '#dbeafe',
    border: '#93c5fd',
    borderActive: '#3b82f6',
  },
  clients: {
    band: '#e9d5ff',
    icon: '#7e22ce',
    card: '#faf5ff',
    cardActive: '#f3e8ff',
    border: '#d8b4fe',
    borderActive: '#a855f7',
  },
  sites: {
    band: '#fdba74',
    icon: '#c2410c',
    card: '#fff7ed',
    cardActive: '#ffedd5',
    border: '#fb923c',
    borderActive: '#ea580c',
  },
  stock: {
    band: '#fde68a',
    icon: '#b45309',
    card: '#fffbeb',
    cardActive: '#fef3c7',
    border: '#fcd34d',
    borderActive: '#f59e0b',
  },
  cerfa: {
    band: '#86efac',
    icon: '#166534',
    card: '#f0fdf4',
    cardActive: '#bbf7d0',
    border: '#4ade80',
    borderActive: '#16a34a',
  },
  equipe: {
    band: '#fecdd3',
    icon: '#be123c',
    card: '#fff1f2',
    cardActive: '#ffe4e6',
    border: '#fda4af',
    borderActive: '#f43f5e',
  },
  societe: {
    band: '#e2e8f0',
    icon: '#334155',
    card: '#f8fafc',
    cardActive: '#e2e8f0',
    border: '#cbd5e1',
    borderActive: '#64748b',
  },
}

const baseLinks = [
  { to: '/app', end: true, label: 'Tableau de bord', icon: LayoutDashboard, tone: 'dashboard' },
  { to: '/app/clients', label: 'Clients', icon: Building2, tone: 'clients' },
  { to: '/app/chantiers', label: 'Sites', icon: MapPin, tone: 'sites' },
  { to: '/app/stock', label: 'Stock fluides', icon: Package, tone: 'stock' },
  { to: '/app/interventions', label: 'CERFA / Interventions', icon: ClipboardList, tone: 'cerfa' },
  { to: '/app/operateur', label: 'Mon entreprise', icon: Settings, tone: 'societe' },
]

const mobilePrimary = [
  { to: '/app', end: true, label: 'Accueil', icon: LayoutDashboard, tone: 'dashboard' },
  { to: '/app/clients', label: 'Clients', icon: Building2, tone: 'clients' },
  { to: '/app/chantiers', label: 'Sites', icon: MapPin, tone: 'sites' },
  { to: '/app/stock', label: 'Stock', icon: Package, tone: 'stock' },
  { to: '/app/interventions', label: 'CERFA', icon: ClipboardList, tone: 'cerfa' },
]

export function AppLayout() {
  const { user, organization, isOwner, logout } = useAuth()
  const navigate = useNavigate()

  const links = isOwner
    ? [
        ...baseLinks.slice(0, 5),
        { to: '/app/equipe', label: 'Équipe', icon: Users, tone: 'equipe' },
        ...baseLinks.slice(5),
      ]
    : baseLinks

  const doLogout = () => {
    void logout().then(() => navigate('/login'))
  }

  const roleLabel = isOwner ? 'Compte officiel' : 'Opérateur'
  const orgLabel = organization?.name || 'Société'

  return (
    <div className="min-h-screen bg-mist/40 text-ink lg:grid lg:grid-cols-[272px_1fr]">
      <aside className="hidden border-r border-line bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:self-start lg:overflow-y-auto">
        <div className="border-b border-line px-4 py-5">
          <BrandLogo size="sm" />
          <div className="mt-2 px-0.5 text-xs text-muted">Terrain · CERFA 15497-04</div>
        </div>

        <nav className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-3 py-4">
          {links.map(({ to, end, label, icon: Icon, tone }) => {
            const t = tones[tone] || tones.societe
            return (
              <NavLink
                key={to}
                to={to}
                end={end}
                className="group flex items-stretch overflow-hidden rounded-xl border text-sm font-semibold transition-all"
                style={({ isActive }) => ({
                  backgroundColor: isActive ? t.cardActive : t.card,
                  borderColor: isActive ? t.borderActive : t.border,
                  color: '#071820',
                  boxShadow: isActive ? '0 1px 2px rgb(0 0 0 / 0.06)' : undefined,
                })}
              >
                {({ isActive }) => (
                  <>
                    <span
                      className="grid w-11 shrink-0 place-items-center border-e"
                      style={{
                        backgroundColor: t.band,
                        color: t.icon,
                        borderColor: isActive ? 'rgb(0 0 0 / 0.1)' : 'rgb(0 0 0 / 0.05)',
                      }}
                    >
                      <Icon className="h-4 w-4" strokeWidth={isActive ? 2.35 : 1.85} />
                    </span>
                    <span className="flex flex-1 items-center px-3 py-2.5">{label}</span>
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>

        <div className="border-t border-line bg-foam/80 px-4 py-4">
          <div className="truncate text-sm font-semibold text-ink">{orgLabel}</div>
          <div className="truncate text-xs text-muted">
            {user?.fullName || user?.email} · {roleLabel}
          </div>
          <div className="truncate text-[11px] text-muted/80">{user?.email || user?.username}</div>
          <button
            type="button"
            onClick={doLogout}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-white px-3 py-2.5 text-sm font-semibold text-ink hover:bg-mist"
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

      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 backdrop-blur-md lg:hidden"
        style={{ paddingBottom: 'max(0.35rem, env(safe-area-inset-bottom))' }}
        aria-label="Navigation principale"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {mobilePrimary.map(({ to, end, label, icon: Icon, tone }) => {
            const t = tones[tone] || tones.societe
            return (
              <NavLink
                key={to}
                to={to}
                end={end}
                className="flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium"
                style={({ isActive }) => ({ color: isActive ? t.icon : '#5a7880' })}
              >
                {({ isActive }) => (
                  <>
                    <span
                      className="grid h-8 w-8 place-items-center rounded-lg"
                      style={{ backgroundColor: isActive ? t.band : 'transparent' }}
                    >
                      <Icon className="h-5 w-5" strokeWidth={isActive ? 2.25 : 1.75} />
                    </span>
                    <span className="truncate">{label}</span>
                  </>
                )}
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
