import { Link } from 'react-router-dom'
import { usePageMeta } from '../lib/usePageMeta'

function SeoShell({
  title,
  description,
  path,
  eyebrow,
  children,
}: {
  title: string
  description: string
  path: string
  eyebrow: string
  children: React.ReactNode
}) {
  usePageMeta({ title: `${title} — ClimaZEN`, description, path })

  return (
    <div className="bg-foam px-4 py-12 text-ink sm:px-6 sm:py-16">
      <article className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">{eyebrow}</p>
        <h1 className="font-display mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">{description}</p>
        <div className="mt-10 space-y-8 text-sm leading-relaxed text-slate sm:text-[15px]">{children}</div>

        <div className="mt-12 rounded-2xl border border-line bg-white p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold text-ink">Essayer ClimaZEN</h2>
          <p className="mt-2 text-sm text-muted">
            Auto-entrepreneurs & micro-sociétés : gratuit. CERFA conforme, mode hors ligne inclus.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/register"
              className="inline-flex rounded-full bg-accent px-6 py-3 text-sm font-bold text-ink hover:bg-accent-hover"
            >
              Créer mon compte
            </Link>
            <Link
              to="/contact"
              className="inline-flex rounded-full border border-line px-6 py-3 text-sm font-semibold hover:bg-mist"
            >
              Contact / démo
            </Link>
          </div>
        </div>

        <nav className="mt-10 border-t border-line pt-6 text-sm text-muted" aria-label="Autres guides">
          <p className="mb-2 font-medium text-ink">Guides liés</p>
          <ul className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:gap-x-4">
            <li>
              <Link to="/cerfa-15497" className="text-accent hover:underline">
                CERFA 15497-04
              </Link>
            </li>
            <li>
              <Link to="/f-gas-hors-ligne" className="text-accent hover:underline">
                F-Gas hors ligne
              </Link>
            </li>
            <li>
              <Link to="/logiciel-cerfa-clim" className="text-accent hover:underline">
                Logiciel CERFA clim
              </Link>
            </li>
            <li>
              <Link to="/" className="hover:text-ink hover:underline">
                Accueil ClimaZEN
              </Link>
            </li>
          </ul>
        </nav>
      </article>
    </div>
  )
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-lg font-semibold text-ink sm:text-xl">{children}</h2>
}

function Ul({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-muted">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  )
}

export function Cerfa15497Page() {
  return (
    <SeoShell
      path="/cerfa-15497"
      eyebrow="CERFA officiel"
      title="CERFA 15497-04 sur smartphone"
      description="Remplissez le CERFA 15497-04 (fiche d’intervention fluides frigorigènes) directement sur chantier avec ClimaZEN — mise en page conforme, données clients et équipements préremplies."
    >
      <section className="space-y-3">
        <H2>Qu’est-ce que le CERFA 15497-04 ?</H2>
        <p>
          Le <strong>CERFA 15497-04</strong> est le formulaire officiel utilisé pour consigner
          les opérations sur fluides frigorigènes (charge, récupération, contrôle d’étanchéité,
          etc.). Les professionnels du froid doivent le remplir dans le cadre de la réglementation
          F-Gas et de l’attestation de capacité.
        </p>
        <p>
          ClimaZEN ne modifie pas la mise en page du formulaire : l’objectif est de{' '}
          <strong>préremplir correctement</strong> les champs à partir de vos clients, sites et
          équipements, puis de produire un PDF prêt à envoyer ou à archiver.
        </p>
      </section>

      <section className="space-y-3">
        <H2>Pourquoi un logiciel plutôt qu’un PDF vierge ?</H2>
        <Ul
          items={[
            'Moins d’erreurs de saisie (coordonnées client, n° de série, fluide déjà en base)',
            'Gain de temps sur chaque intervention',
            'Historique des CERFA par client / chantier / ordre de travail',
            'Saisie possible sur téléphone, même hors réseau (puis synchronisation)',
            'Envoi groupé (ZIP / e-mail) pour un lot annuel ou un OT multi-équipements',
          ]}
        />
      </section>

      <section className="space-y-3">
        <H2>Comment ClimaZEN gère le CERFA 15497</H2>
        <p>
          Depuis un <strong>ordre de travail</strong> ou une intervention, vous ouvrez le CERFA
          lié à l’équipement. Les informations société, détenteur, site et plaque signalétique
          sont reprises automatiquement. Pour plusieurs équipements, ClimaZEN enchaîne les pages
          (page 1/2, 2/2…) sans perdre le contexte.
        </p>
        <p>
          Vous restez responsable de l’exactitude des données et du respect de la réglementation.
          ClimaZEN est un outil métier pour accélérer une saisie conforme.
        </p>
      </section>

      <section className="space-y-3">
        <H2>Pour qui ?</H2>
        <p>
          Frigoristes, installateurs clim, sociétés de maintenance, auto-entrepreneurs et équipes
          qui doivent produire des CERFA régulièrement sur le terrain.
        </p>
      </section>
    </SeoShell>
  )
}

export function FGasHorsLignePage() {
  return (
    <SeoShell
      path="/f-gas-hors-ligne"
      eyebrow="Terrain & conformité"
      title="F-Gas et mode hors ligne sur chantier"
      description="Saisissez vos interventions F-Gas, CERFA et fiches maintenance même sans réseau. ClimaZEN synchronise dès que la connexion revient."
    >
      <section className="space-y-3">
        <H2>Le problème terrain</H2>
        <p>
          En sous-sol, en salle technique ou en zone blanche, le réseau mobile coupe souvent.
          Remplir un CERFA ou une fiche de maintenance dans un navigateur classique devient
          impossible — ou vous force à tout retaper au bureau.
        </p>
        <p>
          ClimaZEN est pensé <strong>mobile-first</strong> et <strong>hors ligne</strong> : vous
          continuez à travailler sur le chantier, puis les données partent dès le retour du
          réseau.
        </p>
      </section>

      <section className="space-y-3">
        <H2>Ce que vous pouvez faire hors ligne</H2>
        <Ul
          items={[
            'Ouvrir un appel / ordre de travail déjà synchronisé',
            'Saisir ou compléter un CERFA 15497-04',
            'Remplir une fiche de maintenance clim',
            'Consulter clients, sites et équipements en cache',
            'Reprendre au bureau sans perdre la saisie',
          ]}
        />
      </section>

      <section className="space-y-3">
        <H2>Conformité F-Gas & attestation de capacité</H2>
        <p>
          L’outil aide à documenter les opérations fluides (traçabilité, stock bouteilles,
          interventions) dans une logique compatible avec les exigences F-Gas. Le formulaire
          CERFA reste le support officiel ; ClimaZEN accélère la production et l’archivage.
        </p>
      </section>

      <section className="space-y-3">
        <H2>Installation sur l’écran d’accueil</H2>
        <p>
          ClimaZEN s’installe comme une application (PWA) sur smartphone ou tablette : accès
          rapide, usage terrain, mises à jour automatiques.
        </p>
      </section>
    </SeoShell>
  )
}

export function LogicielCerfaClimPage() {
  return (
    <SeoShell
      path="/logiciel-cerfa-clim"
      eyebrow="Logiciel métier"
      title="Logiciel CERFA clim pour frigoristes"
      description="ClimaZEN centralise clients, sites, parc équipements, stock fluides, ordres de travail et CERFA 15497 — un seul outil pour la clim et le froid."
    >
      <section className="space-y-3">
        <H2>Un logiciel, tout le parcours</H2>
        <p>
          Au lieu de jongler entre Excel, PDF et mails, ClimaZEN relie le{' '}
          <strong>parc client</strong>, les <strong>travaux</strong>, le <strong>stock de
          bouteilles</strong> et les <strong>documents réglementaires</strong> (CERFA, fiches
          maintenance, rapports d’OT).
        </p>
      </section>

      <section className="space-y-3">
        <H2>Fonctions clés</H2>
        <Ul
          items={[
            'Fiches clients & sites avec équipements et plaques',
            'Ordres de travail et appels terrain',
            'CERFA 15497-04 prérempli (multi-équipements)',
            'Fiches de maintenance clim',
            'Stock fluides / bouteilles (traçabilité)',
            'Contrats de maintenance & agenda',
            'Envoi groupé de documents (ZIP, partage, e-mail)',
          ]}
        />
      </section>

      <section className="space-y-3">
        <H2>Pour les indépendants et les sociétés</H2>
        <p>
          Les auto-entrepreneurs et micro-structures peuvent démarrer gratuitement. Les
          structures avec équipes utilisent le compte société, les opérateurs et le suivi des
          interventions.
        </p>
      </section>

      <section className="space-y-3">
        <H2>Essayer sans engagement</H2>
        <p>
          Créez un compte, ajoutez un client test, lancez un OT et générez un CERFA pour voir le
          flux complet en quelques minutes. Une question ?{' '}
          <Link to="/contact" className="font-semibold text-accent hover:underline">
            Contactez-nous
          </Link>
          .
        </p>
      </section>
    </SeoShell>
  )
}
