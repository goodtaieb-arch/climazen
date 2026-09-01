import { type FormEvent, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { BrandLogo } from '../components/BrandLogo'
import { PasswordField } from '../components/PasswordField'
import { BetaBadge } from '../components/BetaBadge'
import { useAuth } from '../lib/AuthContext'
import { PASSWORD_MIN_LENGTH } from '../lib/passwordPolicy'

export function RegisterPage() {
  const { user, loading, registerCompany, configured } = useAuth()
  const navigate = useNavigate()

  const [companyName, setCompanyName] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [needsConfirm, setNeedsConfirm] = useState(false)

  if (!loading && user && !needsConfirm) return <Navigate to="/app" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== password2) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    setBusy(true)
    try {
      const { needsEmailConfirmation } = await registerCompany({
        companyName,
        email,
        password,
        fullName,
      })
      if (needsEmailConfirmation) {
        setNeedsConfirm(true)
      } else {
        navigate('/app', { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inscription impossible')
    } finally {
      setBusy(false)
    }
  }

  if (needsConfirm) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink px-4 py-10 text-white">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <BrandLogo onDark size="sm" />
            <BetaBadge />
          </div>
          <h1 className="mt-6 font-display text-2xl font-bold">Vérifiez votre e-mail</h1>
          <p className="mt-2 text-sm text-white/65">
            Un lien de confirmation a été envoyé à <strong>{email}</strong>. Ouvrez-le, puis
            connectez-vous.
          </p>
          <button
            type="button"
            onClick={() => navigate('/login', { replace: true })}
            className="mt-6 w-full rounded-full bg-accent py-3 text-sm font-bold text-ink hover:bg-accent-hover"
          >
            Aller à la connexion
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4 py-10 text-white">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3">
          <BrandLogo onDark size="md" />
          <BetaBadge />
        </div>
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-white/10 bg-slate p-6 shadow-xl sm:p-8"
        >
          <h1 className="font-display text-2xl font-bold">Compte officiel société</h1>
          <p className="mt-1 text-sm text-white/60">
            Connexion par <strong>e-mail</strong> — synchronisé ordi et téléphone via Supabase.
          </p>

          {!configured && (
            <p className="mt-4 rounded-xl bg-amber-500/15 px-3 py-2 text-sm text-amber-100">
              Configurez Supabase (.env.local) avant de créer un compte.
            </p>
          )}

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
            <span className="mb-1 block text-white/70">E-mail de connexion *</span>
            <input
              type="email"
              autoComplete="email"
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
            label={`Mot de passe (${PASSWORD_MIN_LENGTH} car. min.) *`}
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <PasswordField
            dark
            className="mt-4"
            label="Confirmer le mot de passe *"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
          />

          {error && <p className="mt-4 rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-200">{error}</p>}

          <button
            type="submit"
            disabled={busy || !configured}
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
