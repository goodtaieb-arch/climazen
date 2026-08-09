import { Link } from 'react-router-dom'
import {
  Building2,
  CheckCircle2,
  ClipboardList,
  MapPin,
  Package,
  Users,
} from 'lucide-react'
import { BrandLogo } from '../components/BrandLogo'

const points = [
  'CERFA officiel 15497*04 prérempli (forme administration inchangée)',
  'Compte société + opérateurs — les CERFA remontent sur le compte de la boîte',
  'Clients, chantiers, stock fluides — saisie terrain guidée',
]

const features = [
  {
    icon: Building2,
    title: 'Clients / détenteurs',
    text: 'Cadre [2] prêt : raison sociale, adresse, contact — réutilisé sur chaque intervention.',
  },
  {
    icon: MapPin,
    title: 'Chantiers & équipements',
    text: 'Fluide, charge, teq CO₂ et détection permanente — cadre [3] sans double saisie.',
  },
  {
    icon: Package,
    title: 'Stock fluides',
    text: 'Bouteilles vierges, régénérées, récupération — mouvements liés aux CERFA.',
  },
  {
    icon: Users,
    title: 'Équipe terrain',
    text: 'Opérateurs sur le même compte société : les fiches remontent au bureau.',
  },
]

export function Landing() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 70% 20%, #1aa89655, transparent), radial-gradient(ellipse 50% 40% at 10% 80%, #3dd6c333, transparent)',
          }}
        />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
              Frigoristes · Fluides · CERFA
            </p>
            <h1 className="sr-only">ClimaZEN by TAIEB</h1>
            <div className="mt-4 inline-flex rounded-2xl bg-white px-4 py-3 shadow-lg shadow-black/20 sm:px-5 sm:py-4">
              <BrandLogo size="lg" />
            </div>
            <p className="mt-6 max-w-xl text-lg text-white/75 sm:text-xl">
              Fini les CERFA PDF dispersés : clients, chantiers, stock fluides — et la fiche
              15497-04 remplie automatiquement.
            </p>
            <ul className="mt-8 space-y-3">
              {points.map((p) => (
                <li key={p} className="flex items-start gap-3 text-white/90">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                to="/register"
                className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-bold text-ink transition-colors hover:bg-accent-hover"
              >
                Créer le compte société
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Se connecter
              </Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute -inset-4 rounded-[2.5rem] bg-accent/20 blur-2xl" aria-hidden />
            <div className="relative rounded-[2rem] border border-white/15 bg-slate p-4 shadow-2xl shadow-black/40">
              <div className="rounded-[1.5rem] bg-foam p-4 text-ink">
                <div className="mb-3">
                  <BrandLogo size="sm" />
                </div>
                <div className="font-display text-sm font-bold text-slate">CERFA 15497-04</div>
                <div className="mt-3 space-y-3 text-sm">
                  <Field label="Chantier" value="Chambre froide — Rayon frais" />
                  <Field label="Client / détenteur" value="Supermarché Dupont" />
                  <Field label="Fluide" value="R-32 · 4,2 kg" />
                  <div className="rounded-xl bg-accent-soft px-3 py-2 text-xs font-medium text-slate">
                    Cadres [1]→[14] préremplis depuis clients, chantiers et stock
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

      <section className="bg-foam px-4 py-16 text-ink sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            Le CERFA papier ralentit vos équipes et augmente les risques d’erreurs
          </h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            <Pain
              icon={ClipboardList}
              title="Oublis et incohérences"
              text="Champs manquants, quantités incohérentes, signatures oubliées : la traçabilité en pâtit."
            />
            <Pain
              icon={MapPin}
              title="Double saisie inutile"
              text="Le tech note sur le terrain, le bureau retape. ClimaZEN préremplit depuis le chantier et le stock."
            />
            <Pain
              icon={Package}
              title="Suivi & conformité"
              text="Conservez interventions, stock fluides et historiques prêts pour contrôle — 5 ans."
            />
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-ink px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Tout le parcours terrain dans une seule app
          </h2>
          <p className="mt-3 max-w-2xl text-white/60">
            De la fiche client au PDF officiel CERFA — sans changer la mise en page de
            l’administration.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {features.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-2xl border border-white/10 bg-white/5 p-5 transition-colors hover:border-accent/40"
              >
                <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/65">{text}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 rounded-2xl border border-accent/30 bg-accent/10 px-6 py-8 text-center sm:px-10">
            <p className="font-display text-xl font-semibold sm:text-2xl">
              Prêt pour le terrain et le bureau
            </p>
            <p className="mx-auto mt-2 max-w-lg text-sm text-white/65">
              Créez le compte société, invitez vos opérateurs, générez le CERFA 15497-04.
            </p>
            <Link
              to="/register"
              className="mt-6 inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-bold text-ink transition-colors hover:bg-accent-hover"
            >
              Créer le compte société
            </Link>
          </div>
        </div>
      </section>
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

function Pain({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof ClipboardList
  title: string
  text: string
}) {
  return (
    <div>
      <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
    </div>
  )
}
