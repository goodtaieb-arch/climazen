import { Link } from 'react-router-dom'
import {
  Building2,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  MapPin,
  Package,
  ShieldCheck,
  SignalZero,
  Smartphone,
  Users,
  WifiOff,
} from 'lucide-react'
import { BrandLogo } from '../components/BrandLogo'
import { CONTACT_EMAIL } from '../components/PublicLayout'

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
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:pb-20 lg:pt-12">
          <div className="animate-[fadeUp_0.7s_ease-out]">
            <div className="inline-flex rounded-2xl border border-line/70 bg-white/90 px-4 py-3 shadow-lg shadow-accent/15 backdrop-blur">
              <BrandLogo size="lg" />
            </div>

            <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white">
              <ShieldCheck className="h-3.5 w-3.5 text-accent" />
              100 % conforme F-Gas
            </p>

            <h1 className="font-display mt-4 max-w-xl text-3xl font-bold leading-[1.12] tracking-tight text-ink sm:text-4xl lg:text-[2.65rem]">
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
                Essayer gratuitement
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center justify-center rounded-full border border-line bg-white px-7 py-3.5 text-sm font-semibold text-ink hover:bg-mist"
              >
                Demander une démo
              </Link>
            </div>
          </div>

          {/* Capture mobile — téléphone */}
          <div className="relative mx-auto w-full max-w-[280px] animate-[fadeUp_0.9s_ease-out] sm:max-w-[300px]">
            <div
              className="pointer-events-none absolute -inset-8 rounded-full bg-accent/25 blur-3xl"
              aria-hidden
            />
            <div className="relative mx-auto overflow-hidden rounded-[2.35rem] border-[10px] border-ink bg-ink shadow-2xl shadow-slate/30">
              <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-ink" />
              <img
                src="/landing-mobile-terrain.png"
                alt="ClimaZEN sur smartphone — Accueil terrain et mode hors ligne"
                className="block aspect-[9/16] w-full object-cover object-top"
                width={720}
                height={1280}
                loading="eager"
              />
            </div>
            <p className="mt-4 text-center text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              Rendu smartphone · chantier
            </p>
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
          <div className="flex justify-center">
            <BrandLogo size="md" />
          </div>
          <h2 className="font-display mt-6 text-2xl font-bold tracking-tight sm:text-3xl">
            Convaincu ? Essayez ClimaZEN sur un chantier
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted sm:text-base">
            Compte société, opérateurs, CERFA conforme F-Gas, mode hors ligne. Une question ?
            On vous répond.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/register"
              className="inline-flex rounded-full bg-accent px-7 py-3.5 text-sm font-bold text-ink hover:bg-accent-hover"
            >
              Créer le compte société
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
