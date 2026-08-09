import { Link, NavLink, Outlet } from 'react-router-dom'
import { BrandLogo } from './BrandLogo'

const CONTACT_EMAIL = 'contact@climazen.fr'

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-ink text-white">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
        <Link to="/" aria-label="ClimaZEN — accueil">
          <BrandLogo onDark size="sm" />
        </Link>
        <nav className="hidden items-center gap-1 text-sm md:flex">
          <a
            href="/#pourquoi"
            className="rounded-full px-3 py-2 font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            Pourquoi
          </a>
          <a
            href="/#fonctionnalites"
            className="rounded-full px-3 py-2 font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            Fonctionnalités
          </a>
          <NavLink
            to="/contact"
            className={({ isActive }) =>
              [
                'rounded-full px-3 py-2 font-medium transition-colors',
                isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white',
              ].join(' ')
            }
          >
            Contact
          </NavLink>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="rounded-full border border-white/25 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10 sm:px-4"
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
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-white/10 px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <BrandLogo onDark size="sm" />
            <p className="mt-3 max-w-sm text-sm text-white/50">
              CERFA 15497-04, clients, chantiers et stock fluides — pour les frigoristes.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm text-white/60">
            <Link to="/contact" className="hover:text-white">
              Contact
            </Link>
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-white">
              {CONTACT_EMAIL}
            </a>
            <Link to="/mentions-legales" className="hover:text-white">
              Mentions légales
            </Link>
            <Link to="/cgu" className="hover:text-white">
              CGU
            </Link>
            <Link to="/confidentialite" className="hover:text-white">
              Confidentialité
            </Link>
            <Link to="/login" className="hover:text-white">
              Connexion
            </Link>
          </div>
        </div>
        <p className="mx-auto mt-8 max-w-6xl text-center text-xs text-white/35 sm:text-left">
          ClimaZEN by TAIEB · Référence fiche CERFA FI 15497-04 · Usage métier
        </p>
      </footer>
    </div>
  )
}

export { CONTACT_EMAIL }
