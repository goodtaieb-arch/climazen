import { type FormEvent, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { BrandLogo } from '../components/BrandLogo'
import { PasswordField } from '../components/PasswordField'
import { useAuth } from '../lib/AuthContext'

export function LoginPage() {
  const { user, login, loading, configured } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from || '/app'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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
        <div className="mb-8 flex justify-center">
          <BrandLogo onDark size="md" />
        </div>
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-white/10 bg-slate p-6 shadow-xl sm:p-8"
        >
          <h1 className="font-display text-2xl font-bold">Connexion</h1>
          <p className="mt-1 text-sm text-white/60">
            Compte <strong>cloud Supabase</strong> uniquement (pas l’ancien compte local du navigateur).
          </p>

          {!configured && (
            <p className="mt-4 rounded-xl bg-amber-500/15 px-3 py-2 text-sm text-amber-100">
              Configurez Supabase (.env.local) avant de vous connecter.
            </p>
          )}

          <label className="mt-6 block text-sm">
            <span className="mb-1 block text-white/70">E-mail</span>
            <input
              type="email"
              autoComplete="email"
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
            autoComplete="current-password"
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
