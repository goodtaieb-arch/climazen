import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { BrandLogo } from '../components/BrandLogo'
import { SocialLinksRow } from '../components/SocialLinksRow'
import { GoogleIcon, GoogleReviewBadge } from '../components/SocialBrandIcons'
import { GOOGLE_MAPS_SEARCH_URL, GOOGLE_REVIEW_URL } from '../lib/socialLinks'
import { CONTACT_EMAIL } from '../components/PublicLayout'

export function AvisGooglePage() {
  return (
    <div className="bg-foam px-4 py-14 text-ink sm:px-6 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <div className="flex justify-center">
          <BrandLogo size="md" />
        </div>
        <h1 className="font-display mt-6 text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Avis Google
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-center text-muted">
          Votre retour aide les frigoristes à choisir ClimaZEN — CERFA F-Gas, terrain et mode hors
          ligne.
        </p>

        <div className="mt-8 overflow-hidden rounded-3xl border border-line bg-white p-6 shadow-sm sm:p-8">
          <div className="flex justify-center">
            <GoogleReviewBadge size="lg" />
          </div>
          <p className="mt-5 text-center text-sm font-semibold text-ink">
            Notez ClimaZEN sur Google
          </p>
          <p className="mt-2 text-center text-sm leading-relaxed text-muted">
            Cliquez ci-dessous pour ouvrir la fiche Google et laisser un avis (étoiles + commentaire).
            Merci — ça compte beaucoup pour l’équipe.
          </p>

          <div className="mt-7 flex flex-col items-stretch gap-3 sm:items-center">
            <a
              href={GOOGLE_REVIEW_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 text-sm font-bold text-ink hover:bg-accent-hover"
            >
              <GoogleIcon className="h-5 w-5" />
              Laisser un avis Google
              <ExternalLink className="h-4 w-4 opacity-70" />
            </a>
            <a
              href={GOOGLE_MAPS_SEARCH_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line bg-white px-5 text-sm font-semibold text-ink hover:bg-mist"
            >
              Voir sur Google Maps
            </a>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-line bg-white p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold">Suivez ClimaZEN</h2>
          <p className="mt-1 text-sm text-muted">Astuces terrain, nouveautés CERFA et actus produit.</p>
          <SocialLinksRow className="mt-4" />
        </div>

        <p className="mt-8 text-center text-sm text-muted">
          Une question ?{' '}
          <a className="font-semibold text-accent hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          {' · '}
          <Link to="/contact" className="font-semibold text-accent hover:underline">
            Contact
          </Link>
        </p>
      </div>
    </div>
  )
}
