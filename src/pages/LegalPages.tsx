import { Link } from 'react-router-dom'
import { CONTACT_EMAIL } from '../components/PublicLayout'

function LegalShell({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-foam px-4 py-14 text-ink sm:px-6 sm:py-16">
      <article className="prose-legal mx-auto max-w-3xl">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted">Dernière mise à jour : août 2026</p>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate">{children}</div>
        <p className="mt-10 text-sm">
          <Link to="/" className="font-semibold text-accent hover:underline">
            ← Retour à l’accueil
          </Link>
        </p>
      </article>
    </div>
  )
}

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-lg font-semibold text-ink">{children}</h2>
}

export function MentionsLegalesPage() {
  return (
    <LegalShell title="Mentions légales">
      <section className="space-y-2">
        <H>Éditeur</H>
        <p>
          Le site et l’application <strong>ClimaZEN</strong> sont édités par{' '}
          <strong>TAIEB</strong> (marque ClimaZEN by TAIEB).
        </p>
        <p>
          Contact :{' '}
          <a className="text-accent hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
        </p>
        <p className="text-muted">
          Compléter ici : raison sociale complète, forme juridique, SIRET, adresse du siège,
          nom du responsable de publication.
        </p>
      </section>
      <section className="space-y-2">
        <H>Hébergement</H>
        <p>
          Application hébergée notamment via <strong>Vercel</strong> (front) et{' '}
          <strong>Supabase</strong> (données / authentification). Domaine enregistré auprès
          d’Infomaniak.
        </p>
      </section>
      <section className="space-y-2">
        <H>Objet</H>
        <p>
          ClimaZEN est un outil métier destiné aux professionnels du froid (frigoristes /
          installateurs) pour la gestion de clients, chantiers, stock de fluides et le
          préremplissage du CERFA 15497-04.
        </p>
      </section>
    </LegalShell>
  )
}

export function CguPage() {
  return (
    <LegalShell title="Conditions générales d’utilisation">
      <section className="space-y-2">
        <H>1. Objet</H>
        <p>
          Les présentes CGU régissent l’accès et l’utilisation de ClimaZEN. En créant un
          compte, vous acceptez ces conditions.
        </p>
      </section>
      <section className="space-y-2">
        <H>2. Compte société</H>
        <p>
          L’accès est réservé aux professionnels. Le titulaire du compte société est
          responsable des opérateurs qu’il invite et des données saisies.
        </p>
      </section>
      <section className="space-y-2">
        <H>3. Usage du CERFA</H>
        <p>
          ClimaZEN préremplit le formulaire officiel CERFA 15497-04 sans en modifier la
          mise en page. L’utilisateur reste responsable de l’exactitude des informations
          et du respect de la réglementation applicable.
        </p>
      </section>
      <section className="space-y-2">
        <H>4. Disponibilité</H>
        <p>
          Nous nous efforçons d’assurer un service continu, sans garantie d’absence
          d’interruption. Des maintenances peuvent avoir lieu.
        </p>
      </section>
      <section className="space-y-2">
        <H>5. Contact</H>
        <p>
          <a className="text-accent hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
        </p>
      </section>
    </LegalShell>
  )
}

export function ConfidentialitePage() {
  return (
    <LegalShell title="Politique de confidentialité">
      <section className="space-y-2">
        <H>Données collectées</H>
        <p>
          Compte (e-mail, nom), données métier saisies (clients, chantiers, stock,
          interventions, signatures), horodatages de pointage et, le cas échéant, une
          position GPS ponctuelle au moment de l’action (pas de suivi continu), et données
          techniques de connexion nécessaires au fonctionnement du service.
        </p>
      </section>
      <section className="space-y-2">
        <H>Pointeuse / temps de travail</H>
        <p>
          Si la société active la pointeuse, chaque action (prise de véhicule, trajet,
          arrivée chantier, pause, retour) est horodatée. Une géolocalisation peut être
          demandée <strong>uniquement à cet instant</strong> — aucun tracking GPS en
          continu. Ces données servent à la paie et à la facturation (distinction trajet /
          chantier / pauses). Elles restent dans le dossier de la société.
        </p>
      </section>
      <section className="space-y-2">
        <H>Finalités</H>
        <p>
          Fournir l’application ClimaZEN, sécuriser les accès, assurer la synchronisation
          multi-appareils et le support utilisateur.
        </p>
      </section>
      <section className="space-y-2">
        <H>Sous-traitants</H>
        <p>
          Hébergement et authentification via des prestataires (notamment Vercel et
          Supabase). Les données sont traitées dans le cadre du service.
        </p>
      </section>

      <section className="space-y-2">
        <H>Mesures de sécurité</H>
        <p>
          Accès par compte authentifié, isolation des données par société (règles d’accès
          serveur), connexion HTTPS, mots de passe renforcés. Les clés secrètes d’administration
          ne sont jamais exposées dans l’application. En cas d’incident, contactez{' '}
          <a className="text-accent hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>

      <section className="space-y-2">
        <H>Vos droits</H>
        <p>
          Conformément au RGPD, vous pouvez demander l’accès, la rectification ou la
          suppression de vos données via{' '}
          <a className="text-accent hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>
    </LegalShell>
  )
}
