import { type FormEvent, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { BrandLogo } from '../components/BrandLogo'
import { useAuth } from '../lib/AuthContext'

export function RegisterPage() {
  const { user, registerCompany } = useAuth()
  const navigate = useNavigate()

  const [companyName, setCompanyName] = useState('')
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/app" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== password2) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    setBusy(true)
    try {
      await registerCompany({ companyName, username, password, fullName })
      navigate('/app', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inscription impossible')
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
          <h1 className="font-display text-2xl font-bold">Compte officiel société</h1>
          <p className="mt-1 text-sm text-white/60">
            Créez le compte de la boîte. Vous pourrez ensuite ajouter des opérateurs : leurs CERFA
            arriveront ici.
          </p>

          <label className="mt-6 block text-sm">
            <span className="mb-1 block text-white/70">Nom de la société *</span>
            <input
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="h-11 w-full rounded-xl border border-white/15 bg-ink/40 px-3 text-white outline-none focus:border-accent"
              placeholder="Ex. Climazen Froid SARL"
            />
          </label>
          <label className="mt-4 block text-sm">
            <span className="mb-1 block text-white/70">Votre nom (gérant / responsable) *</span>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-11 w-full rounded-xl border border-white/15 bg-ink/40 px-3 text-white outline-none focus:border-accent"
            />
          </label>
          <label className="mt-4 block text-sm">
            <span className="mb-1 block text-white/70">Identifiant de connexion *</span>
            <input
              autoComplete="username"
              required
              minLength={3}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-11 w-full rounded-xl border border-white/15 bg-ink/40 px-3 text-white outline-none focus:border-accent"
            />
          </label>
          <label className="mt-4 block text-sm">
            <span className="mb-1 block text-white/70">Mot de passe (6 car. min.) *</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 w-full rounded-xl border border-white/15 bg-ink/40 px-3 text-white outline-none focus:border-accent"
            />
          </label>
          <label className="mt-4 block text-sm">
            <span className="mb-1 block text-white/70">Confirmer le mot de passe *</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className="h-11 w-full rounded-xl border border-white/15 bg-ink/40 px-3 text-white outline-none focus:border-accent"
            />
          </label>

          {error && <p className="mt-4 rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-200">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="mt-6 w-full rounded-full bg-accent py-3 text-sm font-bold text-ink hover:bg-accent-hover disabled:opacity-60"
          >
            {busy ? 'Création…' : 'Créer le compte société'}
          </button>

          <p className="mt-5 text-center text-sm text-white/60">
            Déjà un compte ?{' '}
            <Link to="/login" className="font-semibold text-accent hover:underline">
              Se connecter
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
