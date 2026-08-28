import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Building2,
  ClipboardList,
  Ellipsis,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  MapPin,
  Mic,
  Package,
  Settings,
  Sparkles,
  User,
  Users,
  X,
} from 'lucide-react'
import { BrandLogo } from './BrandLogo'
import { ImportLocalBanner } from './ImportLocalBanner'
import { CloudShareWarningBanner } from './CloudShareWarningBanner'
import { AideAssistant } from './AideAssistant'
import { VoiceCommandsFab } from './VoiceCommandsFab'
import { Nav3dIcon } from './Nav3dIcon'
import { useAuth } from '../lib/AuthContext'
import { useStore } from '../lib/store'
import { loadCompanyLogoLocal } from '../lib/companyLogo'
import { formatLastSyncLabel } from '../lib/speech'
import { getLastSyncAt } from '../lib/offlineSync'
import { VersionBadge, VersionUpdateBar, MajButton } from './AppVersion'

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
  { to: '/app/chantiers', label: 'Sites & Parc', icon: MapPin, tone: 'sites' },
  { to: '/app/stock', label: 'Stock fluides', icon: Package, tone: 'stock' },
  { to: '/app/ot', label: 'OT / Demandes', icon: ClipboardList, tone: 'cerfa' },
  { to: '/app/contrats', label: 'Contrats maintenance', icon: ClipboardList, tone: 'sites' },
  { to: '/app/agenda', label: 'Agenda', icon: ClipboardList, tone: 'dashboard' },
  { to: '/app/interventions', label: 'CERFA / Interventions', icon: ClipboardList, tone: 'cerfa' },
  { to: '/app/equipe', label: 'Équipe', icon: Users, tone: 'equipe' },
  { to: '/app/operateur', label: 'Mon entreprise', icon: Settings, tone: 'societe' },
  { to: '/app/profil', label: 'Mon profil', icon: User, tone: 'equipe' },
]

const baseLinksOperator = [
  { to: '/app', end: true, label: 'Accueil terrain', icon: LayoutDashboard, tone: 'dashboard' },
  { to: '/app/clients', label: 'Clients', icon: Building2, tone: 'clients' },
  { to: '/app/chantiers', label: 'Sites & Parc', icon: MapPin, tone: 'sites' },
  { to: '/app/stock', label: 'Stock fluides', icon: Package, tone: 'stock' },
  { to: '/app/ot', label: 'OT / Demandes', icon: ClipboardList, tone: 'cerfa' },
  { to: '/app/contrats', label: 'Contrats maintenance', icon: ClipboardList, tone: 'sites' },
  { to: '/app/agenda', label: 'Agenda', icon: ClipboardList, tone: 'dashboard' },
  { to: '/app/interventions', label: 'CERFA / Interventions', icon: ClipboardList, tone: 'cerfa' },
  { to: '/app/profil', label: 'Mon profil', icon: User, tone: 'equipe' },
]

/** Nav terrain mobile (<768px) : 4 actions principales */
const mobilePrimary = [
  { to: '/app', end: true, label: 'Accueil', icon: LayoutDashboard, tone: 'dashboard' },
  { to: '/app/chantiers', label: 'Sites', icon: MapPin, tone: 'sites' },
  { to: '/app/stock', label: 'Fluides', icon: Package, tone: 'stock' },
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
  const { syncError, clearSyncError, data, offline, pendingSync, flushPendingSync, pullFromCloud, peutVoirIdentitesRh } =
    useStore()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const [voiceListening, setVoiceListening] = useState(false)

  useEffect(() => {
    const onVoice = (e: Event) => {
      const detail = (e as CustomEvent<{ listening?: boolean }>).detail
      setVoiceListening(Boolean(detail?.listening))
    }
    window.addEventListener('climazen:voice-state', onVoice)
    return () => window.removeEventListener('climazen:voice-state', onVoice)
  }, [])

  const links = isOwner
    ? baseLinksOwner
    : [
        ...baseLinksOperator,
        ...(peutVoirIdentitesRh
          ? [{ to: '/app/equipe', label: 'Équipe / dossiers', icon: Users, tone: 'equipe' }]
          : user
            ? [{ to: `/app/equipe/${user.id}`, label: 'Mon dossier', icon: FolderOpen, tone: 'equipe' }]
            : []),
      ]

  const pageTone = toneForPath(pathname, links)

  const doLogout = () => {
    setMoreOpen(false)
    void logout().then(() => navigate('/login'))
  }

  /** Force le rechargement de la dernière version (contre cache PWA). */
  // (bouton MajButton + forceLatestAppVersion)

  const roleLabel = isOwner ? 'Administrateur' : 'Employé'
  const orgLabel = organization?.name || data.operateur.raisonSociale || 'Société'
  const companyLogo =
    data.operateur.logoImage || loadCompanyLogoLocal(user?.organizationId) || null
  const companyName = data.operateur.raisonSociale || organization?.name || ''
  const lastSyncLabel = formatLastSyncLabel(getLastSyncAt(user?.organizationId))

  /** Sur Travaux, recliquer le menu ferme le formulaire et revient à la liste. */
  const goNav = (to: string) => (e: React.MouseEvent) => {
    setMoreOpen(false)
    if (to === '/app/chantiers' && (pathname === to || pathname.startsWith(`${to}/`))) {
      e.preventDefault()
      navigate('/app/chantiers', { state: { travauxList: Date.now() }, replace: true })
    }
  }

  const moreLinks = [
    { to: '/app/agenda', label: 'Agenda', icon: ClipboardList, tone: 'dashboard' },
    { to: '/app/ot', label: 'OT / Demandes', icon: ClipboardList, tone: 'cerfa' },
    { to: '/app/contrats', label: 'Contrats maintenance', icon: ClipboardList, tone: 'sites' },
    { to: '/app/clients', label: 'Clients', icon: Building2, tone: 'clients' },
    { to: '/app/profil', label: 'Mon profil', icon: User, tone: 'equipe' },
    ...(user
      ? [{ to: `/app/equipe/${user.id}`, label: 'Mon dossier', icon: FolderOpen, tone: 'equipe' }]
      : []),
    ...(isOwner
      ? [
          { to: '/app/operateur', label: 'Mon entreprise', icon: Settings, tone: 'societe' },
          { to: '/app/equipe', label: 'Équipe', icon: Users, tone: 'equipe' },
        ]
      : peutVoirIdentitesRh
        ? [{ to: '/app/equipe', label: 'Équipe / dossiers', icon: Users, tone: 'equipe' }]
        : []),
  ]

  return (
    <div
      className="min-h-screen text-ink md:grid md:grid-cols-[280px_1fr] lg:grid-cols-[300px_1fr]"
      style={{
        backgroundColor: '#ffffff',
        backgroundImage: `linear-gradient(${pageTone.page}, ${pageTone.page})`,
      }}
    >
      <aside className="hidden border-r border-line bg-[#fafbfc] md:sticky md:top-0 md:flex md:h-screen md:flex-col md:self-start md:overflow-y-auto">
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
                className="group flex min-h-12 items-center gap-2.5 rounded-xl px-2 py-2 text-[13px] font-semibold transition-colors"
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
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                      style={{
                        backgroundColor: t.band,
                        color: t.icon,
                      }}
                    >
                      {(() => {
                        const threeD = (
                          <Nav3dIcon
                            to={to}
                            size={28}
                            float
                            delay={
                              to === '/app'
                                ? '0s'
                                : to === '/app/chantiers'
                                  ? '0.1s'
                                  : to === '/app/stock'
                                    ? '0.2s'
                                    : to === '/app/ot'
                                      ? '0.25s'
                                    : to === '/app/clients'
                                      ? '0.3s'
                                      : to === '/app/interventions'
                                        ? '0.4s'
                                        : to === '/app/equipe'
                                          ? '0.5s'
                                          : to === '/app/operateur'
                                            ? '0.6s'
                                            : '0.7s'
                            }
                          />
                        )
                        return threeD || (
                          <Icon className="h-5 w-5" strokeWidth={isActive ? 2.25 : 1.9} />
                        )
                      })()}
                    </span>
                    <span className="flex-1 truncate">{label}</span>
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>
      </aside>

      <main className="min-w-0 overflow-x-hidden pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <div
          className="sticky top-0 z-20 border-b bg-white"
          style={{
            backgroundImage: `linear-gradient(${pageTone.card}, ${pageTone.card})`,
            borderColor: pageTone.border,
          }}
        >
          <div className="flex min-h-14 flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-6 lg:px-8">
            <div className="min-w-0 flex-1 md:hidden">
              <BrandLogo size="sm" companyLogo={companyLogo} companyName={companyName} />
            </div>
            <div className="hidden min-w-0 flex-1 md:block">
              <div className="truncate text-sm font-semibold text-ink">{orgLabel}</div>
              <div className="truncate text-xs text-muted">
                {user?.fullName || user?.email} · {roleLabel}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
              <VersionBadge />
              <MajButton />
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('climazen:toggle-voice'))}
                onContextMenu={(e) => {
                  e.preventDefault()
                  window.dispatchEvent(new CustomEvent('climazen:voice-help'))
                }}
                className={
                  voiceListening
                    ? 'touch-target inline-flex items-center gap-1 rounded-full bg-rose-600 px-2.5 text-sm font-bold text-white sm:px-3'
                    : 'touch-target inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 text-sm font-bold text-[#0f766e] hover:bg-mist sm:px-3'
                }
                aria-label={voiceListening ? 'Arrêter la commande vocale' : 'Commande vocale'}
                aria-pressed={voiceListening}
                title="Commande vocale"
              >
                <Mic className="h-4 w-4" />
                <span className="hidden lg:inline">Micro</span>
              </button>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('climazen:open-aide'))}
                className="touch-target inline-flex items-center gap-1.5 rounded-full bg-[#0f766e] px-2.5 text-sm font-bold text-white hover:bg-teal-800 sm:px-3"
                aria-label="Aide IA"
                title="Aide IA"
              >
                <Sparkles className="h-4 w-4" />
                <span>Aide IA</span>
              </button>
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                className="touch-target inline-flex items-center justify-center rounded-full border border-line bg-white px-3 text-sm font-semibold text-ink hover:bg-mist md:hidden"
                aria-label="Menu Plus"
                title="Clients & réglages"
              >
                <Ellipsis className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={doLogout}
                className="touch-target inline-flex shrink-0 items-center gap-2 rounded-full border border-line bg-white px-3 text-sm font-semibold text-ink hover:bg-mist sm:px-4"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Se déconnecter</span>
              </button>
            </div>
          </div>
          <VersionUpdateBar dark />
        </div>
        <div className="overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <ImportLocalBanner />
          <CloudShareWarningBanner />
          {offline && (
            <div className="mb-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-slate">
              <p className="font-semibold">Mode hors ligne</p>
              <p className="mt-0.5 text-muted">
                Vous pouvez travailler : les saisies restent sur cet appareil. En revanche,{' '}
                <strong className="text-ink">les mises à jour de l’app ne se chargent pas</strong>{' '}
                sans réseau — d’où une interface parfois « ancienne ».
              </p>
              <p className="mt-2 text-xs font-semibold text-amber-950">
                Dès que le Wi‑Fi / 4G revient : appuyez sur{' '}
                <span className="rounded bg-amber-200 px-1">MAJ</span> en haut — le bouton
                indique la version à installer (ex. MAJ v75).
              </p>
              {lastSyncLabel && (
                <p className="mt-1 text-[11px] text-muted">Dernière sync réussie : {lastSyncLabel}</p>
              )}
              <div className="mt-3">
                <MajButton className="inline-flex min-h-10 items-center rounded-xl border border-amber-600 bg-amber-400 px-4 text-xs font-extrabold uppercase tracking-wide text-amber-950" />
              </div>
            </div>
          )}
          {!offline && pendingSync && (
            <div className="mb-3 flex items-start justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-slate">
              <div>
                <p className="font-medium">Saisies hors ligne en attente</p>
                <p className="text-muted">Synchronisation avec le cloud…</p>
                {lastSyncLabel && (
                  <p className="mt-0.5 text-[11px] text-muted">Dernière sync : {lastSyncLabel}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => void flushPendingSync()}
                className="touch-target shrink-0 px-2 text-xs font-semibold text-accent hover:underline"
              >
                Synchroniser
              </button>
            </div>
          )}
          {!offline && !pendingSync && (
            <div className="mb-3 flex items-center justify-between gap-2 text-[11px] text-muted">
              <span>
                Sync auto PC ↔ téléphone
                {lastSyncLabel ? ` · ${lastSyncLabel}` : ''}
              </span>
              <button
                type="button"
                onClick={() => void pullFromCloud()}
                className="font-semibold text-accent hover:underline"
              >
                Actualiser maintenant
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
                  className="touch-target px-2 text-xs font-semibold text-accent hover:underline"
                >
                  Réessayer
                </button>
                <button
                  type="button"
                  onClick={clearSyncError}
                  className="touch-target px-2 text-xs font-semibold text-muted hover:text-ink"
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
        <div className="fixed inset-0 z-40 md:hidden">
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
                className="touch-target rounded-full p-2 text-muted hover:bg-mist"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-3 text-sm text-muted">Clients, signature, aide et réglages.</p>
            <ul className="space-y-2">
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false)
                    window.dispatchEvent(new CustomEvent('climazen:toggle-voice'))
                  }}
                  className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-line px-4 py-3 font-semibold text-ink active:bg-mist"
                >
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#0f766e]/10 text-[#0f766e]">
                    <Mic className="h-5 w-5" />
                  </span>
                  Commande vocale
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false)
                    window.dispatchEvent(new CustomEvent('climazen:open-aide'))
                  }}
                  className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-[#0f766e]/25 bg-[#0f766e]/5 px-4 py-3 font-semibold text-[#0f766e] active:bg-[#0f766e]/10"
                >
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#0f766e]/15 text-[#0f766e]">
                    <Sparkles className="h-5 w-5" />
                  </span>
                  Aide IA
                </button>
              </li>
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
                        className="grid h-12 w-12 place-items-center rounded-xl"
                        style={{ backgroundColor: t.band, color: t.icon }}
                      >
                        {(() => {
                          const threeD = <Nav3dIcon to={to} size={32} float delay="0.2s" />
                          return threeD || <Icon className="h-5 w-5" />
                        })()}
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
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-mist text-muted">
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
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 backdrop-blur-md md:hidden"
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
                className="flex min-h-14 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold"
                style={({ isActive }) => ({ color: isActive ? t.icon : '#5a7880' })}
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={[
                        'grid h-11 w-11 place-items-center overflow-hidden rounded-full border transition',
                        isActive ? 'border-current bg-white shadow-sm' : 'border-line bg-white',
                      ].join(' ')}
                      style={
                        isActive
                          ? { borderColor: t.icon, boxShadow: `0 0 0 3px ${t.band}` }
                          : undefined
                      }
                    >
                      {(() => {
                        const threeD = (
                          <Nav3dIcon to={to} size={26} float={isActive} delay="0s" />
                        )
                        return (
                          threeD || (
                            <Icon className="h-5 w-5" strokeWidth={isActive ? 2.25 : 1.75} />
                          )
                        )
                      })()}
                    </span>
                    <span className="truncate px-0.5">{label}</span>
                  </>
                )}
              </NavLink>
            )
          })}
        </div>
      </nav>

      <VoiceCommandsFab />
      <AideAssistant />
    </div>
  )
}
