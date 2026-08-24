import { Link, NavLink, Outlet } from 'react-router-dom'
import { BrandLogo } from './BrandLogo'
import { SocialLinksRow } from './SocialLinksRow'
import { GoogleIcon } from './SocialBrandIcons'
import { GOOGLE_REVIEW_URL } from '../lib/socialLinks'

const CONTACT_EMAIL = 'contact@climazen.fr'

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-foam text-ink">
      <header className="sticky top-0 z-20 border-b border-line/70 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <Link to="/" aria-label="ClimaZEN — accueil">
            <BrandLogo size="sm" />
          </Link>
          <nav className="hidden items-center gap-1 text-sm md:flex">
            <a
              href="/#conformite"
              className="rounded-full px-3 py-2 font-medium text-muted transition-colors hover:bg-mist hover:text-ink"
            >
              Conformité
            </a>
            <a
              href="/#hors-ligne"
              className="rounded-full px-3 py-2 font-medium text-muted transition-colors hover:bg-mist hover:text-ink"
            >
              Hors ligne
            </a>
            <a
              href="/#tarifs"
              className="rounded-full px-3 py-2 font-medium text-muted transition-colors hover:bg-mist hover:text-ink"
            >
              Tarifs
            </a>
            <a
              href="/#fonctionnalites"
              className="rounded-full px-3 py-2 font-medium text-muted transition-colors hover:bg-mist hover:text-ink"
            >
              Fonctionnalités
            </a>
            <NavLink
              to="/avis"
              className={({ isActive }) =>
                [
                  'rounded-full px-3 py-2 font-medium transition-colors',
                  isActive ? 'bg-accent-soft text-ink' : 'text-muted hover:bg-mist hover:text-ink',
                ].join(' ')
              }
            >
              Avis Google
            </NavLink>
            <NavLink
              to="/contact"
              className={({ isActive }) =>
                [
                  'rounded-full px-3 py-2 font-medium transition-colors',
                  isActive ? 'bg-accent-soft text-ink' : 'text-muted hover:bg-mist hover:text-ink',
                ].join(' ')
              }
            >
              Contact
            </NavLink>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="rounded-full border border-line px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-mist sm:px-4"
            >
              Connexion
            </Link>
            <Link
              to="/register"
              className="rounded-full bg-accent px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-accent-hover sm:px-4"
            >
              Compte société
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-line bg-white px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <BrandLogo size="sm" />
            <p className="mt-3 max-w-sm text-sm text-muted">
              CERFA 15497-04, clients, travaux et stock fluides — pour les frigoristes.
            </p>
            <SocialLinksRow className="mt-4" size="sm" />
            <a
              href={GOOGLE_REVIEW_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
            >
              <GoogleIcon className="h-4 w-4" />
              Laisser un avis Google
            </a>
          </div>
          <div className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm text-muted">
            <Link to="/contact" className="hover:text-ink">
              Contact
            </Link>
            <Link to="/avis" className="hover:text-ink">
              Avis Google
            </Link>
            <a href="/#tarifs" className="hover:text-ink">
              Tarifs
            </a>
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-ink">
              {CONTACT_EMAIL}
            </a>
            <Link to="/mentions-legales" className="hover:text-ink">
              Mentions légales
            </Link>
            <Link to="/cgu" className="hover:text-ink">
              CGU
            </Link>
            <Link to="/confidentialite" className="hover:text-ink">
              Confidentialité
            </Link>
            <Link to="/login" className="hover:text-ink">
              Connexion
            </Link>
          </div>
        </div>
        <p className="mx-auto mt-8 max-w-6xl text-center text-xs text-muted/80 sm:text-left">
          ClimaZEN by TAIEB · Référence fiche CERFA FI 15497-04 · Usage métier
        </p>
      </footer>
    </div>
  )
}

export { CONTACT_EMAIL }
