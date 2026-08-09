import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
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

/** Couleurs pastel très claires (quasi transparentes) */
const tones: Record<
  string,
  {
    band: string
    icon: string
    card: string
    cardActive: string
    border: string
    borderActive: string
    page: string
  }
> = {
  dashboard: {
    band: 'rgba(59, 130, 246, 0.12)',
    icon: '#3b82f6',
    card: 'rgba(59, 130, 246, 0.06)',
    cardActive: 'rgba(59, 130, 246, 0.14)',
    border: 'rgba(59, 130, 246, 0.22)',
    borderActive: 'rgba(59, 130, 246, 0.45)',
    page: 'rgba(59, 130, 246, 0.07)',
  },
  clients: {
    band: 'rgba(168, 85, 247, 0.12)',
    icon: '#9333ea',
    card: 'rgba(168, 85, 247, 0.06)',
    cardActive: 'rgba(168, 85, 247, 0.14)',
    border: 'rgba(168, 85, 247, 0.22)',
    borderActive: 'rgba(168, 85, 247, 0.45)',
    page: 'rgba(168, 85, 247, 0.07)',
  },
  sites: {
    band: 'rgba(249, 115, 22, 0.12)',
    icon: '#ea580c',
    card: 'rgba(249, 115, 22, 0.06)',
    cardActive: 'rgba(249, 115, 22, 0.14)',
    border: 'rgba(249, 115, 22, 0.22)',
    borderActive: 'rgba(249, 115, 22, 0.45)',
    page: 'rgba(249, 115, 22, 0.07)',
  },
  stock: {
    band: 'rgba(234, 179, 8, 0.14)',
    icon: '#ca8a04',
    card: 'rgba(234, 179, 8, 0.07)',
    cardActive: 'rgba(234, 179, 8, 0.16)',
    border: 'rgba(234, 179, 8, 0.25)',
    borderActive: 'rgba(234, 179, 8, 0.5)',
    page: 'rgba(234, 179, 8, 0.08)',
  },
  cerfa: {
    band: 'rgba(34, 197, 94, 0.12)',
    icon: '#16a34a',
    card: 'rgba(34, 197, 94, 0.06)',
    cardActive: 'rgba(34, 197, 94, 0.14)',
    border: 'rgba(34, 197, 94, 0.22)',
    borderActive: 'rgba(34, 197, 94, 0.45)',
    page: 'rgba(34, 197, 94, 0.07)',
  },
  equipe: {
    band: 'rgba(244, 63, 94, 0.11)',
    icon: '#e11d48',
    card: 'rgba(244, 63, 94, 0.05)',
    cardActive: 'rgba(244, 63, 94, 0.13)',
    border: 'rgba(244, 63, 94, 0.2)',
    borderActive: 'rgba(244, 63, 94, 0.42)',
    page: 'rgba(244, 63, 94, 0.06)',
  },
  societe: {
    band: 'rgba(100, 116, 139, 0.12)',
    icon: '#475569',
    card: 'rgba(100, 116, 139, 0.05)',
    cardActive: 'rgba(100, 116, 139, 0.12)',
    border: 'rgba(100, 116, 139, 0.2)',
    borderActive: 'rgba(100, 116, 139, 0.4)',
    page: 'rgba(100, 116, 139, 0.06)',
  },
}

const baseLinks = [
  { to: '/app', end: true, label: 'Tableau de bord', icon: LayoutDashboard, tone: 'dashboard' },
  { to: '/app/clients', label: 'Clients', icon: Building2, tone: 'clients' },
  { to: '/app/chantiers', label: 'Travaux', icon: MapPin, tone: 'sites' },
  { to: '/app/stock', label: 'Stock fluides', icon: Package, tone: 'stock' },
  { to: '/app/interventions', label: 'CERFA / Interventions', icon: ClipboardList, tone: 'cerfa' },
  { to: '/app/operateur', label: 'Mon entreprise', icon: Settings, tone: 'societe' },
]

const mobilePrimary = [
  { to: '/app', end: true, label: 'Accueil', icon: LayoutDashboard, tone: 'dashboard' },
  { to: '/app/clients', label: 'Clients', icon: Building2, tone: 'clients' },
  { to: '/app/chantiers', label: 'Travaux', icon: MapPin, tone: 'sites' },
  { to: '/app/stock', label: 'Stock', icon: Package, tone: 'stock' },
  { to: '/app/interventions', label: 'CERFA', icon: ClipboardList, tone: 'cerfa' },
]

function toneForPath(pathname: string, links: { to: string; end?: boolean; tone: string }[]) {
  const match = links.find(({ to, end }) =>
    end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`),
  )
  return tones[match?.tone || 'dashboard'] || tones.dashboard
}

export function AppLayout() {
  const { user, organization, isOwner, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const links = isOwner
    ? [
        ...baseLinks.slice(0, 5),
        { to: '/app/equipe', label: 'Équipe', icon: Users, tone: 'equipe' },
        ...baseLinks.slice(5),
      ]
    : baseLinks

  const pageTone = toneForPath(pathname, links)

  const doLogout = () => {
    void logout().then(() => navigate('/login'))
  }

  const roleLabel = isOwner ? 'Compte officiel' : 'Opérateur'
  const orgLabel = organization?.name || 'Société'

  return (
    <div
      className="min-h-screen text-ink lg:grid lg:grid-cols-[272px_1fr]"
      style={{
        backgroundColor: '#ffffff',
        backgroundImage: `linear-gradient(${pageTone.page}, ${pageTone.page})`,
      }}
    >
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
        <div
          className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6 lg:px-8"
          style={{
            backgroundColor: '#ffffff',
            backgroundImage: `linear-gradient(${pageTone.card}, ${pageTone.card})`,
            borderColor: pageTone.border,
          }}
        >
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
              className="rounded-full border border-line bg-white/80 px-3 py-2 text-xs font-semibold text-ink hover:bg-white lg:hidden"
            >
              Société
            </NavLink>
            {isOwner && (
              <NavLink
                to="/app/equipe"
                className="hidden rounded-full border border-line bg-white/80 px-3 py-2 text-xs font-semibold text-ink hover:bg-white sm:inline-flex lg:hidden"
              >
                Équipe
              </NavLink>
            )}
            <button
              type="button"
              onClick={doLogout}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-line bg-white/80 px-3 py-2 text-sm font-semibold text-ink hover:bg-white sm:px-4"
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
