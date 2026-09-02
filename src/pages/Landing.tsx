import { Link } from 'react-router-dom'
import { APP_EDITION_PRICING, APP_EDITION_PRICING_AFTER_BETA } from '../lib/appEdition'
import { APP_IS_BETA } from '../lib/buildStamp'
import {
  Building2,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  MapPin,
  Package,
  Search,
  ShieldCheck,
  SignalZero,
  Smartphone,
  Users,
  WifiOff,
  BadgeEuro,
  Sparkles,
} from 'lucide-react'
import { BrandLogo } from '../components/BrandLogo'
import { CONTACT_EMAIL } from '../components/PublicLayout'
import { BetaBadge } from '../components/BetaBadge'
import { GoogleIcon, GoogleReviewBadge } from '../components/SocialBrandIcons'
import { SocialLinksRow } from '../components/SocialLinksRow'
import { ICON3D } from '../lib/icons3d'
import { GOOGLE_REVIEW_URL } from '../lib/socialLinks'

/** Tuiles Accueil mobile (icônes 3D) — mockup marketing landing. */
const LANDING_PHONE_TILES = [
  { title: 'Sites & Parc', img: ICON3D.sites, delay: '0s' },
  { title: 'Agenda', img: ICON3D.search, delay: '0.15s' },
  { title: 'CERFA', img: ICON3D.cerfa, delay: '0.3s' },
  { title: 'Stock fluides', img: ICON3D.bottle, delay: '0.45s' },
  { title: 'Clients', img: ICON3D.clients, delay: '0.6s' },
  { title: 'Ordres de travail', img: ICON3D.maintenance, delay: '0.75s' },
] as const

const LANDING_PHONE_NAV = [
  { label: 'Accueil', img: ICON3D.accueil, active: true },
  { label: 'Sites', img: ICON3D.sites, active: false },
  { label: 'Fluides', img: ICON3D.bottle, active: false },
  { label: 'CERFA', img: ICON3D.cerfa, active: false },
] as const

/** Aperçu Sites & Parc (données fictives) — mockup desktop landing. */
const LANDING_SITES_MOCK = [
  {
    client: 'Client A — Collectivité',
    open: true,
    sites: [
      { nom: 'Site Nord', eqs: '3 équipements · R-32' },
      { nom: 'Site Sud', eqs: '1 équipement · R-410A' },
    ],
  },
  {
    client: 'Client B — Tertiaire',
    open: false,
    sites: [{ nom: 'Siège', eqs: '2 équipements' }],
  },
] as const

const heroPoints = [
  '100 % conforme F-Gas & attestation de capacité (CERFA FI 15497-04)',
  'Mode hors ligne — local technique, sous-sol, chambre froide : ça continue',
  'Pensé smartphone : Sites → équipements → CERFA / fiche clim',
]

const whyItems = [
  {
    icon: ShieldCheck,
    title: 'Preuve réglementaire',
    text: 'CERFA officiel 15497-04, traçabilité fluides et contrôles liés à l’attestation de capacité — le frein n°1 des frigoristes, levé.',
  },
  {
    icon: WifiOff,
    title: 'Mode hors ligne',
    text: 'Saisie sans réseau. Dès que le 4G revient, toutes les nouvelles interventions sont synchronisées automatiquement.',
  },
  {
    icon: Smartphone,
    title: 'Fait pour le chantier',
    text: '90 % des CERFA se saisissent sur téléphone. Menu compact, gros boutons, parcours terrain en 3 taps.',
  },
]

const savings = [
  {
    title: 'Fini le papier dispersé',
    text: 'Chaque CERFA reste dans ClimaZEN, lié au site et à l’équipement — prêt pour un contrôle.',
  },
  {
    title: 'Saisie unique',
    text: 'Client, équipement, fluide et bouteilles : une base pour toute l’équipe, bureau inclus.',
  },
  {
    title: 'Signatures & PDF officiels',
    text: 'Signatures opérateur / détenteur intégrées, PDF CERFA généré dans l’app.',
  },
]

const features = [
  {
    icon: Building2,
    title: 'Clients / détenteurs',
    text: 'Cadre [2] : raison sociale, adresse, contact — réutilisé à chaque intervention.',
  },
  {
    icon: MapPin,
    title: 'Sites & parc équipements',
    text: 'Inventaire sous contrat : sites, équipements, fluide. CERFA à la demande, sans dossier travaux inutile.',
  },
  {
    icon: Package,
    title: 'Stock fluides',
    text: 'Bouteilles, mouvements et lien avec les fiches CERFA.',
  },
  {
    icon: Users,
    title: 'Équipe terrain',
    text: 'Opérateurs sur le compte société : les CERFA remontent au bureau.',
  },
  {
    icon: SignalZero,
    title: 'Hors ligne + sync',
    text: 'Travaillez sans réseau ; sync auto des saisies dès le retour de connexion.',
  },
  {
    icon: ClipboardList,
    title: 'CERFA 15497-04',
    text: 'PDF officiel généré dans l’app — cadres préremplis, prêt pour contrôle.',
  },
]

const steps = [
  { n: '01', title: 'Compte société', text: 'Créez l’espace ClimaZEN pour votre entreprise.' },
  { n: '02', title: 'Clients & sites', text: 'Enregistrez détenteurs, équipements et stock.' },
  { n: '03', title: 'Terrain → CERFA', text: 'Hors ligne ou en ligne : signatures et PDF officiel.' },
]

export function Landing() {
  return (
    <>
      {/* HERO — une composition : marque + promesse + mobile */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 90% 70% at 100% 0%, #5eead455, transparent 55%), radial-gradient(ellipse 60% 50% at 0% 100%, #bae6fd44, transparent 50%), linear-gradient(165deg, #ecfdf9 0%, #f0fdfa 45%, #eff6ff 100%)',
          }}
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-12 lg:pb-20 lg:pt-12 xl:gap-16">
          <div className="relative z-10 min-w-0 animate-[fadeUp_0.7s_ease-out] lg:pr-2">
            <div className="flex flex-col items-start gap-5">
              <div className="overflow-visible rounded-2xl border border-line/70 bg-white/90 px-5 py-4 shadow-lg shadow-accent/15 backdrop-blur">
                <div className="flex flex-wrap items-end gap-3">
                  <BrandLogo size="lg" />
                  <BetaBadge />
                </div>
              </div>

              <div className="flex flex-col items-start gap-2.5">
                <p className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-ink">
                  Version bêta
                </p>
                <p className="inline-flex items-center gap-2 rounded-full bg-ink px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white">
                  <ShieldCheck className="h-3.5 w-3.5 text-accent" />
                  100 % conforme F-Gas
                </p>
                <p className="inline-flex flex-wrap items-center gap-2 rounded-full border border-accent/40 bg-white/90 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-slate shadow-sm">
                  <Sparkles className="h-3.5 w-3.5 text-accent" />
                  Gratuit pour auto-entrepreneurs &amp; micro-sociétés
                </p>
              </div>
            </div>

            <h1 className="font-display mt-6 max-w-lg text-3xl font-bold leading-[1.12] tracking-tight text-ink sm:text-4xl lg:text-[2.55rem] xl:max-w-xl xl:text-[2.65rem]">
              ClimaZEN — CERFA fluides, même sans réseau
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-slate sm:text-lg">
              100 % conforme à la réglementation F-Gas et aux contrôles d’attestation de capacité.
              Saisie sur smartphone au chantier, sync auto dès que le réseau revient.
            </p>

            <ul className="mt-6 space-y-2.5">
              {heroPoints.map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-sm text-slate sm:text-[15px]">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                  <span className="font-medium">{p}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/register"
                className="inline-flex items-center justify-center rounded-full bg-accent px-7 py-3.5 text-sm font-bold text-ink shadow-lg shadow-accent/30 transition-transform hover:scale-[1.02] hover:bg-accent-hover"
              >
                Essayer gratuitement — AE / micro
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center justify-center rounded-full border border-line bg-white px-7 py-3.5 text-sm font-semibold text-ink hover:bg-mist"
              >
                Demander une démo
              </Link>
            </div>
            <p className="mt-3 text-xs text-muted">
              Version bêta : l’édition <strong>Light</strong> reste gratuite. L’édition{' '}
              <strong>Pro</strong> est payante à terme mais <strong>gratuite pendant la bêta</strong>{' '}
              —{' '}
              <a href="/#tarifs" className="font-semibold text-accent hover:underline">
                voir les tarifs
              </a>
              .
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <SocialLinksRow size="sm" />
              <a
                href={GOOGLE_REVIEW_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-white px-3.5 text-xs font-bold text-ink hover:bg-mist"
              >
                <GoogleIcon className="h-4 w-4" />
                Avis Google
              </a>
            </div>
          </div>

          {/* Téléphone + PC + pub Assistant IA (à droite, sans chevaucher le titre) */}
          <div className="relative z-0 flex min-w-0 w-full flex-col items-center gap-6 lg:flex-row lg:items-center lg:justify-end lg:gap-5 xl:gap-6">
          {/* Composition : téléphone + aperçu site (navigateur) */}
          <div className="relative mx-auto w-full max-w-[360px] animate-[fadeUp_0.9s_ease-out] overflow-visible sm:max-w-[400px] lg:mx-0 lg:max-w-[340px] lg:shrink xl:max-w-[360px]">
            <div
              className="pointer-events-none absolute -inset-8 rounded-[50%] bg-gradient-to-br from-accent/35 via-sky-300/25 to-transparent blur-3xl sm:-inset-12"
              aria-hidden
            />

            <div className="relative flex flex-col items-center gap-6 sm:block sm:min-h-[480px] lg:min-h-[520px]">
              {/* Navigateur — Sites & Parc (derrière / à côté) */}
              <div className="relative order-2 w-full max-w-[340px] sm:absolute sm:left-3 sm:top-6 sm:order-none sm:w-[70%] sm:max-w-none lg:left-4 lg:top-4 lg:w-[74%]">
                <div className="overflow-hidden rounded-2xl border border-slate-700/40 bg-gradient-to-b from-slate-700 to-slate-900 p-[7px] shadow-[0_22px_50px_-18px_rgba(7,24,32,0.5)] sm:rotate-[-2deg]">
                  {/* Barre fenêtre */}
                  <div className="flex items-center gap-2 rounded-t-xl bg-slate-800/90 px-3 py-2">
                    <span className="flex gap-1.5" aria-hidden>
                      <span className="h-2 w-2 rounded-full bg-rose-400/90" />
                      <span className="h-2 w-2 rounded-full bg-amber-300/90" />
                      <span className="h-2 w-2 rounded-full bg-emerald-400/90" />
                    </span>
                    <div className="ml-1 flex min-w-0 flex-1 items-center gap-1.5 rounded-md bg-slate-950/50 px-2 py-1">
                      <span className="float-3d shrink-0" style={{ animationDelay: '0.4s' }}>
                        <img
                          src={ICON3D.sites}
                          alt=""
                          width={14}
                          height={14}
                          className="h-3.5 w-3.5 object-contain"
                          draggable={false}
                        />
                      </span>
                      <span className="truncate text-[9px] font-medium text-slate-300">
                        climazen.fr/app/chantiers
                      </span>
                    </div>
                  </div>
                  <div
                    className="overflow-hidden rounded-b-[0.65rem] bg-mist"
                    role="img"
                    aria-label="ClimaZEN sur ordinateur — Sites & Parc, clients et équipements"
                  >
                    <div className="border-b border-line bg-white px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="float-3d" style={{ animationDelay: '0.2s' }}>
                          <img
                            src={ICON3D.sites}
                            alt=""
                            width={28}
                            height={28}
                            className="h-7 w-7 object-contain drop-shadow-md"
                            draggable={false}
                          />
                        </span>
                        <div className="min-w-0">
                          <p className="font-display text-sm font-extrabold tracking-tight text-ink">
                            Sites &amp; Parc
                          </p>
                          <p className="text-[9px] font-medium text-muted">
                            Client → site → équipements
                          </p>
                        </div>
                      </div>
                      <div className="relative mt-2">
                        <Search
                          className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted"
                          aria-hidden
                        />
                        <div className="h-7 w-full rounded-lg border border-line bg-white py-1.5 pl-7 pr-2 text-[10px] text-muted">
                          Rechercher un client ou un site…
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2 px-2.5 py-2.5">
                      {LANDING_SITES_MOCK.map((row) => (
                        <div
                          key={row.client}
                          className="overflow-hidden rounded-xl border border-line bg-white shadow-sm"
                        >
                          <div className="flex items-center gap-2 px-2.5 py-2">
                            <span className="float-3d shrink-0" style={{ animationDelay: '0.55s' }}>
                              <img
                                src={ICON3D.clients}
                                alt=""
                                width={22}
                                height={22}
                                className="h-5 w-5 object-contain"
                                draggable={false}
                              />
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-ink">
                              {row.client}
                            </span>
                            <span className="text-[10px] font-bold text-muted">
                              {row.open ? '▾' : '▸'}
                            </span>
                          </div>
                          {row.open ? (
                            <ul className="border-t border-line bg-mist/40 px-2 py-1.5">
                              {row.sites.map((s) => (
                                <li
                                  key={s.nom}
                                  className="flex items-center gap-2 rounded-lg px-1.5 py-1.5"
                                >
                                  <MapPin className="h-3 w-3 shrink-0 text-accent" aria-hidden />
                                  <span className="min-w-0 flex-1">
                                    <span className="block text-[10px] font-semibold text-ink">
                                      {s.nom}
                                    </span>
                                    <span className="block text-[9px] text-muted">{s.eqs}</span>
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ))}
                      <div className="flex items-center gap-2 rounded-xl border border-dashed border-line bg-white/70 px-2.5 py-2">
                        <span className="float-3d" style={{ animationDelay: '0.7s' }}>
                          <img
                            src={ICON3D.cerfa}
                            alt=""
                            width={20}
                            height={20}
                            className="h-5 w-5 object-contain"
                            draggable={false}
                          />
                        </span>
                        <span className="text-[10px] font-semibold text-slate">
                          CERFA lié au site · 1 clic
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Téléphone — Accueil 3D (premier plan) */}
              <div className="relative z-10 order-1 w-full max-w-[240px] sm:absolute sm:bottom-0 sm:right-0 sm:order-none sm:w-[46%] sm:max-w-[230px] lg:right-0 lg:w-[44%]">
                <div className="relative mx-auto rounded-[2.75rem] bg-gradient-to-b from-slate-800 via-ink to-slate-950 p-[11px] shadow-[0_28px_60px_-12px_rgba(7,24,32,0.55),0_0_0_1px_rgba(255,255,255,0.08)_inset] sm:rotate-[3deg]">
                  <span
                    className="pointer-events-none absolute -left-[3px] top-28 h-8 w-[3px] rounded-l-sm bg-slate-700"
                    aria-hidden
                  />
                  <span
                    className="pointer-events-none absolute -left-[3px] top-40 h-12 w-[3px] rounded-l-sm bg-slate-700"
                    aria-hidden
                  />
                  <span
                    className="pointer-events-none absolute -right-[3px] top-36 h-16 w-[3px] rounded-r-sm bg-slate-700"
                    aria-hidden
                  />
                  <div className="relative overflow-hidden rounded-[2.15rem] bg-white ring-1 ring-white/20">
                    <div className="absolute left-1/2 top-2.5 z-10 h-[22px] w-[92px] -translate-x-1/2 rounded-full bg-ink shadow-inner" />
                    <div
                      className="flex aspect-[9/16] w-full flex-col bg-gradient-to-b from-mist via-white to-white"
                      role="img"
                      aria-label="ClimaZEN sur smartphone — accueil terrain avec icônes 3D"
                    >
                      <div className="shrink-0 px-3.5 pb-2 pt-9">
                        <p className="text-center font-display text-[11px] font-extrabold tracking-[0.12em] text-accent">
                          ClimaZEN
                        </p>
                        <h3 className="mt-0.5 text-center font-display text-base font-extrabold tracking-tight text-ink">
                          Sur le terrain
                        </h3>
                        <p className="mt-0.5 text-center text-[10px] font-medium text-muted">
                          Gérez vos interventions et vos sites
                        </p>
                        <div className="relative mt-3">
                          <Search
                            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
                            aria-hidden
                          />
                          <div className="h-9 w-full rounded-xl border border-line bg-white py-2 pl-8 pr-3 text-[11px] font-medium text-muted shadow-sm">
                            Rechercher un site, une intervention…
                          </div>
                        </div>
                      </div>

                      <div className="min-h-0 flex-1 overflow-hidden px-2.5 pb-1">
                        <div className="grid grid-cols-2 gap-x-2 gap-y-3">
                          {LANDING_PHONE_TILES.map((tile) => (
                            <div key={tile.title} className="flex flex-col items-center">
                              <span className="relative grid h-[4.35rem] w-[4.35rem] place-items-center rounded-full border-[1.5px] border-ink/85 bg-white shadow-sm">
                                <span className="float-3d" style={{ animationDelay: tile.delay }}>
                                  <img
                                    src={tile.img}
                                    alt=""
                                    width={48}
                                    height={48}
                                    className="h-11 w-11 object-contain drop-shadow-md"
                                    draggable={false}
                                    loading="eager"
                                    decoding="async"
                                  />
                                </span>
                              </span>
                              <span className="mt-1.5 block px-0.5 text-center text-[10px] font-semibold leading-tight text-ink">
                                {tile.title}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mx-2.5 mb-1.5 flex items-start gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-[9px] font-semibold leading-snug text-orange-900">
                        <SignalZero
                          className="mt-0.5 h-3 w-3 shrink-0 text-orange-600"
                          aria-hidden
                        />
                        <span>
                          Mode hors ligne. Certaines actions seront synchronisées dès votre retour
                          en ligne.
                        </span>
                      </div>

                      <div className="shrink-0 border-t border-line bg-white/95 px-1 pb-2 pt-1.5">
                        <div className="grid grid-cols-4">
                          {LANDING_PHONE_NAV.map((item) => (
                            <div
                              key={item.label}
                              className="flex flex-col items-center justify-center gap-0.5 py-1"
                              style={{ color: item.active ? '#0d9488' : '#5a7880' }}
                            >
                              <span
                                className={[
                                  'grid h-9 w-9 place-items-center rounded-full border bg-white',
                                  item.active ? 'border-teal-600 shadow-sm' : 'border-line',
                                ].join(' ')}
                                style={
                                  item.active
                                    ? { boxShadow: '0 0 0 2px rgba(13, 148, 136, 0.18)' }
                                    : undefined
                                }
                              >
                                <span
                                  className={item.active ? 'float-3d' : undefined}
                                  style={item.active ? { animationDelay: '0s' } : undefined}
                                >
                                  <img
                                    src={item.img}
                                    alt=""
                                    width={22}
                                    height={22}
                                    className="h-[22px] w-[22px] object-contain drop-shadow-md"
                                    draggable={false}
                                    loading="eager"
                                    decoding="async"
                                  />
                                </span>
                              </span>
                              <span className="truncate text-[9px] font-semibold">{item.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-10 mt-5 flex flex-col items-center gap-1.5 sm:mt-8">
              <p className="rounded-full border border-line/80 bg-white/90 px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate shadow-sm">
                Smartphone · Sites &amp; Parc
              </p>
              <p className="max-w-[280px] text-center text-xs text-muted">
                Accueil terrain 3D + parc clients / sites — sans données réelles.
              </p>
            </div>
          </div>

          {/* Pub Assistant IA — à droite du mockup téléphone / PC */}
          <aside
            className="relative z-20 w-full max-w-[320px] animate-[fadeUp_1.05s_ease-out] lg:w-[250px] lg:shrink-0 xl:w-[270px]"
            aria-label="Assistant IA ClimaZEN"
          >
            <div
              className="pointer-events-none absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-teal-400/25 via-transparent to-sky-300/20 blur-2xl"
              aria-hidden
            />
            <div className="relative overflow-hidden rounded-[1.75rem] border border-teal-800/20 bg-gradient-to-b from-[#0f766e] to-[#134e4a] px-5 py-6 text-white shadow-[0_24px_50px_-20px_rgba(15,118,110,0.55)]">
              <div className="flex items-center gap-2">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                  <Sparkles className="h-5 w-5 text-teal-100" aria-hidden />
                </span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-100/90">
                    Nouveau
                  </p>
                  <p className="font-display text-lg font-extrabold tracking-tight">
                    Assistant IA
                  </p>
                </div>
              </div>

              <p className="mt-4 text-sm font-semibold leading-snug text-white">
                L’IA remplit à votre place — OT, CERFA, agenda &amp; stock
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-teal-50/90">
                Vous dictez. ClimaZEN prépare les documents, l’agenda et les fiches terrain. Le
                technicien vérifie et valide.
              </p>

              <blockquote className="mt-4 rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-[11px] italic leading-snug text-teal-50">
                « Agenda RDV demain 14h pour Mr Martin site Atelier »
              </blockquote>

              <ul className="mt-4 space-y-1.5 text-[12px] font-medium text-teal-50/95">
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-200" />
                  OT + CERFA brouillon
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-200" />
                  Agenda / RDV / rappels
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-200" />
                  Bouteilles / stock fluides
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-200" />
                  Fiches maintenance &amp; détecteurs
                </li>
              </ul>

              <Link
                to="/register"
                className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-white px-4 text-sm font-extrabold text-teal-950 transition-transform hover:scale-[1.02]"
              >
                Essayer l’assistant
              </Link>
            </div>
          </aside>
          </div>
        </div>
      </section>

      {/* MODE HORS LIGNE — très visible */}
      <section
        id="hors-ligne"
        className="relative scroll-mt-20 overflow-hidden px-4 py-14 text-ink sm:px-6 sm:py-16"
        style={{
          background: 'linear-gradient(120deg, #0f766e 0%, #134e4a 45%, #0c4a6e 100%)',
        }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-30" aria-hidden>
          <div className="absolute -right-10 top-0 h-64 w-64 rounded-full bg-accent blur-3xl" />
          <div className="absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-sky-400 blur-3xl" />
        </div>
        <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-accent">
              <WifiOff className="h-5 w-5" />
              Mode hors ligne
            </p>
            <h2 className="font-display mt-3 text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
              Sous-sol, local technique, chambre froide : continuez sans 4G
            </h2>
            <p className="mt-4 text-base leading-relaxed text-teal-50/90 sm:text-lg">
              Les frigoristes saisissent souvent hors couverture. Avec ClimaZEN, l’app reste
              utilisable. Toutes les nouvelles saisies partent automatiquement vers le cloud dès
              que le réseau revient.
            </p>
          </div>
          <ul className="w-full max-w-md space-y-3 text-sm text-white sm:text-base">
            {[
              'Saisie CERFA & fiche maintenance hors ligne',
              'Données sécurisées sur l’appareil',
              'Sync auto au retour du réseau',
            ].map((t) => (
              <li
                key={t}
                className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur"
              >
                <CheckCircle2 className="h-5 w-5 shrink-0 text-accent" />
                <span className="font-semibold">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CONFORMITÉ */}
      <section id="conformite" className="scroll-mt-20 bg-white px-4 py-14 text-ink sm:px-6 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-3xl border border-accent/30 bg-accent-soft/40 px-6 py-8 sm:px-10 sm:py-10">
            <div className="flex flex-wrap items-start gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent text-ink">
                <FileCheck2 className="h-7 w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
                  Preuve réglementaire
                </p>
                <h2 className="font-display mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                  100 % conforme à la réglementation F-Gas et aux contrôles d’attestation de
                  capacité
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate sm:text-base">
                  CERFA FI 15497-04 officiel (mise en page administration), traçabilité des
                  manipulations de fluides, signatures et PDF prêts pour un contrôle. C’est le
                  critère n°1 pour un technicien ou un patron qui hésite encore.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TARIFS */}
      <section id="tarifs" className="scroll-mt-20 bg-white px-4 py-14 text-ink sm:px-6 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-accent">
            <BadgeEuro className="h-4 w-4" />
            Tarifs
          </p>
          <h2 className="font-display mt-3 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
            Light gratuit · Pro payant (gratuit en bêta)
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
            L’édition <strong>Light</strong> (solo / auto-entrepreneur) reste{' '}
            <strong>gratuite pour toujours</strong>. L’édition <strong>Pro</strong> (équipes, PME)
            sera <strong>payante</strong> — mais tant que ClimaZEN est en version bêta, elle reste{' '}
            <strong>gratuite</strong> pour tester sans engagement.
          </p>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <div className="relative overflow-hidden rounded-3xl border-2 border-accent bg-accent-soft/50 p-6 shadow-sm sm:p-8">
              <span className="absolute right-4 top-4 rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-ink">
                Gratuit
              </span>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-accent">Édition Light</p>
              <h3 className="font-display mt-2 text-2xl font-bold">Auto-entrepreneur &amp; micro</h3>
              <p className="mt-2 font-display text-4xl font-bold text-ink">
                {APP_EDITION_PRICING.light.price}{' '}
                <span className="text-base font-semibold text-muted">
                  {APP_EDITION_PRICING.light.priceSuffix}
                </span>
              </p>
              <p className="mt-2 text-sm text-muted">{APP_EDITION_PRICING.light.detail}</p>
              <ul className="mt-5 space-y-2.5 text-sm text-slate">
                {[
                  'CERFA F-Gas & stock fluides (obligatoire)',
                  'Mon entreprise (SIRET, attestation…)',
                  'Étalonnages & détecteur CERFA',
                  'Mises à jour incluses',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-accent px-5 text-sm font-bold text-ink hover:bg-accent-hover sm:w-auto"
              >
                Créer mon compte gratuit
              </Link>
            </div>

            <div className="relative overflow-hidden rounded-3xl border border-line bg-foam p-6 sm:p-8">
              {APP_IS_BETA ? (
                <span className="absolute right-4 top-4 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-950">
                  Gratuit en bêta
                </span>
              ) : null}
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Édition Pro</p>
              <h3 className="font-display mt-2 text-2xl font-bold">SARL, SAS &amp; équipes</h3>
              <p className="mt-2 font-display text-4xl font-bold text-ink">
                {APP_IS_BETA ? (
                  <>
                    {APP_EDITION_PRICING.pro.price}{' '}
                    <span className="text-base font-semibold text-muted">
                      {APP_EDITION_PRICING.pro.priceSuffix}
                    </span>
                  </>
                ) : (
                  <>
                    Payant <span className="text-base font-semibold text-muted">/ mois</span>
                  </>
                )}
              </p>
              <p className="mt-2 text-sm text-muted">
                {APP_IS_BETA
                  ? APP_EDITION_PRICING.pro.detail
                  : 'Multi-techniciens, équipe, agenda, pointeuse et pilotage — abonnement Pro.'}
              </p>
              <ul className="mt-5 space-y-2.5 text-sm text-slate">
                {[
                  'Tout le plan Light',
                  'Équipe terrain + compte bureau',
                  'Agenda, pointeuse & multi-tech',
                  'Devis / démo sur demande',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/contact"
                className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-full border border-line bg-white px-5 text-sm font-semibold text-ink hover:bg-mist sm:w-auto"
              >
                Contacter pour une offre
              </Link>
            </div>
          </div>

          <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-slate">
            <strong className="font-semibold text-ink">Version bêta :</strong>{' '}
            {APP_IS_BETA ? (
              <>
                l’édition <strong>Light</strong> est <strong>gratuite pour toujours</strong>.
                L’édition <strong>Pro</strong> sera payante à la sortie de la bêta —{' '}
                <strong>gratuite en attendant</strong>. {APP_EDITION_PRICING_AFTER_BETA}
              </>
            ) : (
              <>
                {APP_EDITION_PRICING_AFTER_BETA} Inscription ouverte pour Light (gratuit) et Pro
                (abonnement).
              </>
            )}
          </p>
        </div>
      </section>

      {/* POURQUOI */}
      <section id="pourquoi" className="scroll-mt-20 bg-foam px-4 py-16 text-ink sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
            Pourquoi ClimaZEN
          </p>
          <h2 className="font-display mt-3 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
            Ce qui fait la différence pour convaincre l’équipe
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {whyItems.map(({ icon: Icon, title, text }, i) => (
              <div
                key={title}
                className="rounded-2xl border border-line bg-white p-6 shadow-sm"
                style={{ animation: `fadeUp 0.6s ease-out ${0.1 * i}s both` }}
              >
                <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GAINS */}
      <section
        className="border-y border-line px-4 py-16 text-ink sm:px-6 sm:py-20"
        style={{
          background: 'linear-gradient(135deg, #ecfdf8 0%, #e0f2fe 55%, #f0fdfa 100%)',
        }}
      >
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Gains concrets</p>
          <h2 className="font-display mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            Moins d’administratif, plus de terrain
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {savings.map((s) => (
              <div
                key={s.title}
                className="rounded-2xl border border-white/80 bg-white/80 p-6 shadow-sm backdrop-blur"
              >
                <h3 className="font-display text-lg font-semibold text-accent">{s.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMMENT ÇA MARCHE */}
      <section className="bg-white px-4 py-16 text-ink sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">En 3 étapes</p>
          <h2 className="font-display mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Opérationnel rapidement
          </h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <li key={s.n} className="relative rounded-2xl border border-line bg-foam p-6">
                <span className="font-display text-3xl font-bold text-accent/40">{s.n}</span>
                <h3 className="font-display mt-2 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FONCTIONNALITÉS */}
      <section id="fonctionnalites" className="scroll-mt-20 bg-foam px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">L’application</p>
          <h2 className="font-display mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Tout le parcours dans une seule app
          </h2>
          <p className="mt-3 max-w-2xl text-muted">
            Smartphone, tablette ou PC. Installable sur l’écran d’accueil. Toujours à jour.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-2xl border border-line bg-white p-5 transition-colors hover:border-accent/40"
              >
                <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RÉSEAUX & AVIS */}
      <section
        id="reseaux"
        className="scroll-mt-20 border-y border-line bg-white px-4 py-14 text-ink sm:px-6 sm:py-16"
      >
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Communauté</p>
            <h2 className="font-display mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Réseaux sociaux &amp; avis Google
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
              Suivez ClimaZEN pour les nouveautés terrain, et laissez un avis Google si l’app vous
              aide au chantier — ça aide les autres frigoristes à nous trouver.
            </p>
            <SocialLinksRow className="mt-6" />
          </div>
          <div className="rounded-3xl border border-line bg-white p-6 shadow-sm sm:p-8">
            <div className="flex justify-center sm:justify-start">
              <GoogleReviewBadge />
            </div>
            <h3 className="font-display mt-4 text-xl font-bold">Votre avis compte</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              30 secondes sur Google : étoiles + un mot sur le CERFA ou le hors-ligne.
            </p>
            <a
              href={GOOGLE_REVIEW_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-bold text-white hover:bg-slate-800"
            >
              <GoogleIcon className="h-4 w-4" />
              Laisser un avis Google
            </a>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="relative overflow-hidden px-4 py-16 text-ink sm:px-6 sm:py-20">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 80% at 50% 100%, #5eead44d, transparent), linear-gradient(180deg, #f4fbfb, #e0f2fe)',
          }}
        />
        <div className="relative mx-auto max-w-3xl rounded-3xl border border-line bg-white px-6 py-10 text-center shadow-lg shadow-accent/10 sm:px-12 sm:py-14">
          <div className="flex items-center justify-center gap-2">
            <BrandLogo size="md" />
            <BetaBadge />
          </div>
          <h2 className="font-display mt-6 text-2xl font-bold tracking-tight sm:text-3xl">
            Light gratuit · Pro gratuit en bêta
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted sm:text-base">
            Édition <strong>Light</strong> (solo / AE) : 0 € pour toujours. Édition{' '}
            <strong>Pro</strong> (équipes) : payante à terme,{' '}
            <strong>gratuite tant que ClimaZEN est en bêta</strong>. CERFA F-Gas, mode hors ligne
            inclus.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/register"
              className="inline-flex rounded-full bg-accent px-7 py-3.5 text-sm font-bold text-ink hover:bg-accent-hover"
            >
              Créer mon compte gratuit
            </Link>
            <Link
              to="/contact"
              className="inline-flex rounded-full border border-line px-7 py-3.5 text-sm font-semibold hover:bg-mist"
            >
              Contact / démo
            </Link>
          </div>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="mt-5 inline-block text-sm font-medium text-accent hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
        </div>
      </section>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
