import { Link } from 'react-router-dom'
import {
  Building2,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  MapPin,
  Package,
  PenLine,
  Smartphone,
  Timer,
  Users,
} from 'lucide-react'
import { BrandLogo } from '../components/BrandLogo'
import { CONTACT_EMAIL } from '../components/PublicLayout'

const heroPoints = [
  'CERFA officiel 15497*04 — mise en page administration inchangée',
  'Saisie terrain → données dispo au bureau en temps réel',
  'Clients, chantiers, stock fluides et équipe sur le même compte',
]

const whyItems = [
  {
    icon: FileCheck2,
    title: 'Conformité F-Gas / CERFA',
    text: 'Obligation de traçabilité des fluides : ClimaZEN préremplit le CERFA FI 15497-04 à partir de vos données métier.',
  },
  {
    icon: Timer,
    title: 'Moins de double saisie',
    text: 'Le technicien saisit une fois sur le terrain. Le bureau retrouve clients, stock et CERFA sans retaper.',
  },
  {
    icon: PenLine,
    title: 'Signatures sur la fiche',
    text: 'Signatures opérateur et détenteur intégrées à la fiche avant génération du PDF officiel.',
  },
]

const savings = [
  {
    title: 'Fini le papier dispersé',
    text: 'Plus de PDF perdus dans les mails et les dossiers. Chaque CERFA reste dans ClimaZEN, lié au chantier.',
  },
  {
    title: 'Saisie unique',
    text: 'Client, équipement, fluide et bouteilles : une base pour toutes les interventions de l’équipe.',
  },
  {
    title: 'Traçabilité des contenants',
    text: 'Stock vierge / régénéré / récupération et mouvements liés aux CERFA pour un suivi clair.',
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
    title: 'Chantiers & équipements',
    text: 'Fluide, charge, teq CO₂, détection permanente — cadre [3] prêt.',
  },
  {
    icon: Package,
    title: 'Stock fluides',
    text: 'Bouteilles, historique de mouvements et lien avec les fiches CERFA.',
  },
  {
    icon: Users,
    title: 'Équipe terrain',
    text: 'Opérateurs sur le compte société : les CERFA remontent au bureau.',
  },
  {
    icon: Smartphone,
    title: 'Mobile & PC',
    text: 'Navigateur web, pas d’App Store. Même compte sur téléphone et ordinateur.',
  },
  {
    icon: ClipboardList,
    title: 'CERFA 15497-04',
    text: 'PDF officiel généré dans l’app — cadres préremplis, prêt pour contrôle.',
  },
]

const steps = [
  { n: '01', title: 'Compte société', text: 'Créez l’espace ClimaZEN pour votre entreprise.' },
  { n: '02', title: 'Clients & chantiers', text: 'Enregistrez détenteurs, équipements et stock.' },
  { n: '03', title: 'Intervention CERFA', text: 'Préremplissage guidé, signatures, PDF officiel.' },
]

export function Landing() {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 85% 0%, #7ee8d955, transparent 50%), radial-gradient(ellipse 55% 50% at 0% 80%, #93c5fd44, transparent 55%), linear-gradient(165deg, #f0fdfb 0%, #e8f7f5 40%, #eff6ff 100%)',
          }}
        />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-14 lg:pb-24 lg:pt-14">
          <div className="animate-[fadeUp_0.7s_ease-out]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
              Application frigoristes · fluides · CERFA
            </p>
            <div className="mt-5 inline-flex rounded-2xl border border-line/80 bg-white px-4 py-3 shadow-lg shadow-accent/10 sm:px-5 sm:py-4">
              <BrandLogo size="lg" />
            </div>
            <h1 className="font-display mt-7 max-w-xl text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl lg:text-[2.75rem]">
              Simplifiez la gestion réglementaire des fluides frigorigènes
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted sm:text-lg">
              ClimaZEN dématérialise le CERFA 15497-04 : clients, travaux, stock et équipe —
              une saisie terrain, un PDF officiel prêt.
            </p>
            <ul className="mt-7 space-y-3">
              {heroPoints.map((p) => (
                <li key={p} className="flex items-start gap-3 text-sm text-slate sm:text-base">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                to="/register"
                className="inline-flex items-center justify-center rounded-full bg-accent px-7 py-3.5 text-sm font-bold text-ink shadow-lg shadow-accent/30 transition-transform hover:bg-accent-hover hover:scale-[1.02]"
              >
                Créer le compte société
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center justify-center rounded-full border border-line bg-white px-7 py-3.5 text-sm font-semibold text-ink transition-colors hover:bg-mist"
              >
                Demander une démo
              </Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md animate-[fadeUp_0.9s_ease-out]">
            <div className="absolute -inset-6 rounded-[2.75rem] bg-accent/20 blur-3xl" aria-hidden />
            <div className="relative rotate-[-1.5deg] rounded-[2rem] border border-line bg-white p-3 shadow-xl shadow-slate/10 sm:rotate-[-2deg] sm:p-4">
              <div className="rounded-[1.5rem] bg-gradient-to-br from-foam to-mist/80 p-4 text-ink sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <BrandLogo size="sm" />
                  <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate">
                    Terrain
                  </span>
                </div>
                <div className="font-display text-sm font-bold text-slate">CERFA 15497-04</div>
                <div className="mt-3 space-y-2.5 text-sm">
                  <Field label="Travaux" value="Chambre froide — Rayon frais" />
                  <Field label="Client / détenteur" value="Supermarché Dupont" />
                  <Field label="Fluide" value="R-32 · 4,2 kg" />
                  <div className="rounded-xl bg-accent-soft px-3 py-2 text-xs font-medium text-slate">
                    Cadres [1]→[14] préremplis · PDF officiel dans l’app
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-line bg-white px-3 py-3">
                    <span className="text-xs text-muted">Signature détenteur</span>
                    <span className="font-display text-sm italic text-accent">M. Dupont</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* POURQUOI */}
      <section id="pourquoi" className="scroll-mt-20 bg-white px-4 py-16 text-ink sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Pourquoi ClimaZEN</p>
          <h2 className="font-display mt-3 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
            Pensé pour les pros du froid — pas pour la paperasse
          </h2>
          <p className="mt-4 max-w-2xl text-muted">
            Attestation de capacité, interventions sur équipements à fluides : le CERFA FI 15497
            fait partie du quotidien. ClimaZEN le rend plus rapide et plus fiable.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {whyItems.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-2xl border border-line bg-foam/80 p-6 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md"
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
          background:
            'linear-gradient(135deg, #ecfdf8 0%, #e0f2fe 55%, #f0fdfa 100%)',
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
      <section className="bg-foam px-4 py-16 text-ink sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">En 3 étapes</p>
          <h2 className="font-display mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Opérationnel rapidement
          </h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <li key={s.n} className="relative rounded-2xl border border-line bg-white p-6 shadow-sm">
                <span className="font-display text-3xl font-bold text-accent/40">{s.n}</span>
                <h3 className="font-display mt-2 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FONCTIONNALITÉS */}
      <section id="fonctionnalites" className="scroll-mt-20 bg-white px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">L’application</p>
          <h2 className="font-display mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Tout le parcours dans une seule app
          </h2>
          <p className="mt-3 max-w-2xl text-muted">
            Compatible navigateur — smartphone, tablette ou PC. Toujours à jour, sans installer
            d’application store.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-2xl border border-line bg-foam/60 p-5 transition-colors hover:border-accent/40 hover:bg-accent-soft/40"
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
            Démarrez avec ClimaZEN
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted sm:text-base">
            Créez le compte société, invitez vos opérateurs, générez vos CERFA. Une question ?
            Écrivez-nous.
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  )
}
