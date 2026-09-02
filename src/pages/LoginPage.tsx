import { type FormEvent, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { BrandLogo } from '../components/BrandLogo'
import { PasswordField } from '../components/PasswordField'
import { VersionBadge, VersionUpdateBar } from '../components/AppVersion'
import { BetaBadge, BetaSiteBanner } from '../components/BetaBadge'
import { useAuth } from '../lib/AuthContext'
import { APP_VERSION } from '../lib/buildStamp'
import { SANDBOX_LOGIN_DEMOS } from '../lib/sandboxAccount'

const CLOUD_HOST = (() => {
  try {
    const u = import.meta.env.VITE_SUPABASE_URL as string | undefined
    return u ? new URL(u).hostname.replace('.supabase.co', '') : ''
  } catch {
    return ''
  }
})()

export function LoginPage() {
  const { user, login, loading, configured } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from || '/app'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink text-sm text-white/60">
        Chargement…
      </div>
    )
  }

  if (user) return <Navigate to="/app" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4 py-10 text-white">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3">
          <BrandLogo onDark size="md" />
          <div className="flex items-center gap-2">
            <BetaBadge />
            <VersionBadge />
          </div>
        </div>
        <BetaSiteBanner dark />
        <VersionUpdateBar dark />
        <form
          onSubmit={onSubmit}
          autoComplete="off"
          className="mt-4 rounded-2xl border border-white/10 bg-slate p-6 shadow-xl sm:p-8"
        >
          <h1 className="font-display text-2xl font-bold">Connexion</h1>
          <p className="mt-1 text-sm text-white/60">
            Compte <strong>cloud</strong> — tape le MDP à la main (évite l’auto-remplissage).
          </p>
          <p className="mt-2 text-[11px] font-bold text-accent">Version attendue : {APP_VERSION}</p>
          {configured && CLOUD_HOST ? (
            <p className="mt-2 text-[11px] text-white/35">Cloud : {CLOUD_HOST}</p>
          ) : null}

          {!configured && (
            <p className="mt-4 rounded-xl bg-amber-500/15 px-3 py-2 text-sm text-amber-100">
              Configurez Supabase (.env.local) avant de vous connecter.
            </p>
          )}

          <label className="mt-6 block text-sm">
            <span className="mb-1 block text-white/70">E-mail</span>
            <input
              type="email"
              autoComplete="username"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 w-full rounded-xl border border-white/15 bg-ink/40 px-3 text-white outline-none focus:border-accent"
              placeholder="ex. gerant@societe.fr"
            />
          </label>
          <PasswordField
            dark
            className="mt-4"
            label="Mot de passe"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <p className="mt-4 rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-200">{error}</p>}

          <button
            type="submit"
            disabled={busy || !configured}
            className="mt-6 w-full rounded-full bg-accent py-3 text-sm font-bold text-ink hover:bg-accent-hover disabled:opacity-60"
          >
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>

          <p className="mt-4 text-center text-sm">
            <Link to="/forgot-password" className="font-semibold text-accent hover:underline">
              Mot de passe oublié ?
            </Link>
          </p>

          <p className="mt-4 text-center text-sm text-white/60">
            Pas encore de compte ?{' '}
            <Link to="/register" className="font-semibold text-accent hover:underline">
              Créer un compte société
            </Link>
          </p>

          <div className="mt-6 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={() => setDemoOpen((v) => !v)}
              className="w-full text-left text-sm font-semibold text-accent hover:underline"
            >
              {demoOpen ? '▼' : '▶'} Comptes démo sandbox (gérant + opérateurs)
            </button>
            {demoOpen ? (
              <div className="mt-3 space-y-2">
                <p className="text-[11px] leading-snug text-white/50">
                  Nécessite <code className="text-white/70">npm run provision:sandbox</code> pour les
                  opérateurs. Cliquez pour préremplir le formulaire.
                </p>
                <ul className="space-y-1.5">
                  {SANDBOX_LOGIN_DEMOS.map((demo) => (
                    <li key={demo.email}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setEmail(demo.email)
                          setPassword(demo.password)
                          setError('')
                        }}
                        className="w-full rounded-lg border border-white/10 bg-ink/30 px-3 py-2 text-left text-xs hover:border-accent/40 disabled:opacity-60"
                      >
                        <span className="font-bold text-white">{demo.label}</span>
                        <span className="mt-0.5 block truncate text-white/55">{demo.email}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </form>
        <p className="mt-4 text-center text-xs text-white/40">
          <Link to="/" className="hover:text-white/70">
            ← Retour à l’accueil
          </Link>
        </p>
      </div>
    </div>
  )
}
