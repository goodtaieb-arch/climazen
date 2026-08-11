import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Building2,
  ClipboardList,
  Ellipsis,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  PenLine,
  Settings,
  Users,
  X,
} from 'lucide-react'
import { BrandLogo } from './BrandLogo'
import { ImportLocalBanner } from './ImportLocalBanner'
import { useAuth } from '../lib/AuthContext'
import { useStore } from '../lib/store'
import { loadCompanyLogoLocal } from '../lib/companyLogo'

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
  more: {
    band: 'rgba(100, 116, 139, 0.12)',
    icon: '#475569',
    card: 'rgba(100, 116, 139, 0.05)',
    cardActive: 'rgba(100, 116, 139, 0.12)',
    border: 'rgba(100, 116, 139, 0.2)',
    borderActive: 'rgba(100, 116, 139, 0.4)',
    page: 'rgba(100, 116, 139, 0.06)',
  },
}

const baseLinksOwner = [
  { to: '/app', end: true, label: 'Accueil terrain', icon: LayoutDashboard, tone: 'dashboard' },
  { to: '/app/clients', label: 'Clients', icon: Building2, tone: 'clients' },
  { to: '/app/chantiers', label: 'Travaux', icon: MapPin, tone: 'sites' },
  { to: '/app/stock', label: 'Stock fluides', icon: Package, tone: 'stock' },
  { to: '/app/interventions', label: 'CERFA / Interventions', icon: ClipboardList, tone: 'cerfa' },
  { to: '/app/equipe', label: 'Équipe', icon: Users, tone: 'equipe' },
  { to: '/app/operateur', label: 'Mon entreprise', icon: Settings, tone: 'societe' },
  { to: '/app/profil', label: 'Ma signature', icon: PenLine, tone: 'equipe' },
]

const baseLinksOperator = [
  { to: '/app', end: true, label: 'Accueil terrain', icon: LayoutDashboard, tone: 'dashboard' },
  { to: '/app/clients', label: 'Clients', icon: Building2, tone: 'clients' },
  { to: '/app/chantiers', label: 'Travaux', icon: MapPin, tone: 'sites' },
  { to: '/app/stock', label: 'Stock fluides', icon: Package, tone: 'stock' },
  { to: '/app/interventions', label: 'CERFA / Interventions', icon: ClipboardList, tone: 'cerfa' },
  { to: '/app/profil', label: 'Ma signature', icon: PenLine, tone: 'equipe' },
]

/** Nav terrain : 3 actions + menu Plus (Clients / Stock / admin) */
const mobilePrimary = [
  { to: '/app', end: true, label: 'Accueil', icon: LayoutDashboard, tone: 'dashboard' },
  { to: '/app/chantiers', label: 'Travaux', icon: MapPin, tone: 'sites' },
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
  const { syncError, clearSyncError, data, offline, pendingSync, flushPendingSync } = useStore()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)

  const links = isOwner ? baseLinksOwner : baseLinksOperator

  const pageTone = toneForPath(pathname, links)

  const doLogout = () => {
    setMoreOpen(false)
    void logout().then(() => navigate('/login'))
  }

  const roleLabel = isOwner ? 'Administrateur' : 'Employé'
  const orgLabel = organization?.name || data.operateur.raisonSociale || 'Société'
  const companyLogo =
    data.operateur.logoImage || loadCompanyLogoLocal(user?.organizationId) || null
  const companyName = data.operateur.raisonSociale || organization?.name || ''

  /** Sur Travaux, recliquer le menu ferme le formulaire et revient à la liste. */
  const goNav = (to: string) => (e: React.MouseEvent) => {
    setMoreOpen(false)
    if (to === '/app/chantiers' && (pathname === to || pathname.startsWith(`${to}/`))) {
      e.preventDefault()
      navigate('/app/chantiers', { state: { travauxList: Date.now() }, replace: true })
    }
  }

  const moreLinks = [
    { to: '/app/clients', label: 'Clients', icon: Building2, tone: 'clients' },
    { to: '/app/stock', label: 'Stock fluides', icon: Package, tone: 'stock' },
    { to: '/app/profil', label: 'Ma signature', icon: PenLine, tone: 'equipe' },
    ...(isOwner
      ? [
          { to: '/app/operateur', label: 'Mon entreprise', icon: Settings, tone: 'societe' },
          { to: '/app/equipe', label: 'Équipe', icon: Users, tone: 'equipe' },
        ]
      : []),
  ]

  const moreActive = moreLinks.some(
    ({ to }) => pathname === to || pathname.startsWith(`${to}/`),
  )

  return (
    <div
      className="min-h-screen text-ink lg:grid lg:grid-cols-[300px_1fr]"
      style={{
        backgroundColor: '#ffffff',
        backgroundImage: `linear-gradient(${pageTone.page}, ${pageTone.page})`,
      }}
    >
      <aside className="hidden border-r border-line bg-[#fafbfc] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:self-start lg:overflow-y-auto">
        <div className="border-b border-line bg-white px-4 py-4">
          <BrandLogo size="sm" companyLogo={companyLogo} companyName={companyName} />
          <div className="mt-3 min-w-0">
            <div className="truncate text-sm font-semibold text-ink">{orgLabel}</div>
            <div className="truncate text-xs text-muted">
              {user?.fullName || user?.email} · {roleLabel}
            </div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 py-3">
          {links.map(({ to, end, label, icon: Icon, tone }) => {
            const t = tones[tone] || tones.societe
            return (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={goNav(to)}
                className="group flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-[13px] font-semibold transition-colors"
                style={({ isActive }) => ({
                  backgroundColor: isActive ? 'rgba(255,255,255,0.95)' : 'transparent',
                  color: '#0f172a',
                  boxShadow: isActive ? '0 1px 2px rgb(15 23 42 / 0.06)' : undefined,
                  border: isActive ? '1px solid #e5e7eb' : '1px solid transparent',
                })}
              >
                {({ isActive }) => (
                  <>
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                      style={{
                        backgroundColor: t.band,
                        color: t.icon,
                      }}
                    >
                      <Icon className="h-5 w-5" strokeWidth={isActive ? 2.25 : 1.9} />
                    </span>
                    <span className="flex-1 truncate">{label}</span>
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>
      </aside>

      <main className="min-w-0 overflow-x-hidden pb-24 lg:pb-0">
        <div
          className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6 lg:px-8"
          style={{
            backgroundColor: '#ffffff',
            backgroundImage: `linear-gradient(${pageTone.card}, ${pageTone.card})`,
            borderColor: pageTone.border,
          }}
        >
          <div className="min-w-0 lg:hidden">
            <BrandLogo size="sm" companyLogo={companyLogo} companyName={companyName} />
          </div>
          <div className="hidden min-w-0 lg:block">
            <div className="truncate text-sm font-medium text-ink">{orgLabel}</div>
            <div className="truncate text-xs text-muted">
              {user?.fullName || user?.email} · {roleLabel} · {user?.email || user?.username}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={doLogout}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-line bg-white/80 px-3 py-2.5 text-sm font-semibold text-ink hover:bg-white sm:px-4"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Se déconnecter</span>
            </button>
          </div>
        </div>
        <div className="overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <ImportLocalBanner />
          {offline && (
            <div className="mb-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-slate">
              <p className="font-semibold">Mode hors ligne</p>
              <p className="mt-0.5 text-muted">
                Vous pouvez travailler normalement. Les saisies sont enregistrées sur cet appareil
                et seront envoyées dès que le réseau revient.
              </p>
            </div>
          )}
          {!offline && pendingSync && (
            <div className="mb-3 flex items-start justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-slate">
              <p>
                Saisies hors ligne en attente — synchronisation avec le cloud…
              </p>
              <button
                type="button"
                onClick={() => void flushPendingSync()}
                className="shrink-0 text-xs font-semibold text-accent hover:underline"
              >
                Synchroniser
              </button>
            </div>
          )}
          {syncError && !offline && (
            <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-slate">
              <p>
                Connexion cloud temporairement indisponible — vos données restent sur cet appareil.
                Réessayez plus tard ({syncError}).
              </p>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => void flushPendingSync()}
                  className="text-xs font-semibold text-accent hover:underline"
                >
                  Réessayer
                </button>
                <button
                  type="button"
                  onClick={clearSyncError}
                  className="text-xs font-semibold text-muted hover:text-ink"
                >
                  Fermer
                </button>
              </div>
            </div>
          )}
          <Outlet />
        </div>
      </main>

      {moreOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/40"
            aria-label="Fermer"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border border-line bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Plus</h2>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="rounded-full p-2 text-muted hover:bg-mist"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-3 text-sm text-muted">Bureau / réglages — pas pour l’intervention.</p>
            <ul className="space-y-2">
              {moreLinks.map(({ to, label, icon: Icon, tone }) => {
                const t = tones[tone] || tones.more
                return (
                  <li key={to}>
                    <NavLink
                      to={to}
                      onClick={() => setMoreOpen(false)}
                      className="flex min-h-14 items-center gap-3 rounded-2xl border border-line px-4 py-3 font-semibold active:bg-mist"
                      style={({ isActive }) => ({
                        backgroundColor: isActive ? t.cardActive : '#fff',
                        borderColor: isActive ? t.borderActive : undefined,
                      })}
                    >
                      <span
                        className="grid h-10 w-10 place-items-center rounded-xl"
                        style={{ backgroundColor: t.band, color: t.icon }}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      {label}
                    </NavLink>
                  </li>
                )
              })}
              <li>
                <button
                  type="button"
                  onClick={doLogout}
                  className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-line px-4 py-3 font-semibold text-ink active:bg-mist"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-mist text-muted">
                    <LogOut className="h-5 w-5" />
                  </span>
                  Se déconnecter
                </button>
              </li>
            </ul>
          </div>
        </div>
      )}

      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 backdrop-blur-md lg:hidden"
        style={{ paddingBottom: 'max(0.35rem, env(safe-area-inset-bottom))' }}
        aria-label="Navigation principale"
      >
        <div className="mx-auto grid max-w-lg grid-cols-4">
          {mobilePrimary.map(({ to, end, label, icon: Icon, tone }) => {
            const t = tones[tone] || tones.societe
            return (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={goNav(to)}
                className="flex min-h-[3.75rem] flex-col items-center justify-center gap-0.5 py-2 text-xs font-semibold"
                style={({ isActive }) => ({ color: isActive ? t.icon : '#5a7880' })}
              >
                {({ isActive }) => (
                  <>
                    <span
                      className="grid h-9 w-9 place-items-center rounded-xl"
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
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex min-h-[3.75rem] flex-col items-center justify-center gap-0.5 py-2 text-xs font-semibold"
            style={{ color: moreActive || moreOpen ? tones.more.icon : '#5a7880' }}
          >
            <span
              className="grid h-9 w-9 place-items-center rounded-xl"
              style={{
                backgroundColor: moreActive || moreOpen ? tones.more.band : 'transparent',
              }}
            >
              <Ellipsis className="h-5 w-5" strokeWidth={moreActive || moreOpen ? 2.25 : 1.75} />
            </span>
            <span>Plus</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
