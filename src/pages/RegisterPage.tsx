import { type FormEvent, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { BrandLogo } from '../components/BrandLogo'
import { useAuth } from '../lib/AuthContext'

export function RegisterPage() {
  const { user, registerCompany } = useAuth()
  const navigate = useNavigate()

  const [companyName, setCompanyName] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null)

  if (user && !recoveryCode) return <Navigate to="/app" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== password2) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    setBusy(true)
    try {
      const code = await registerCompany({ companyName, email, password, fullName })
      setRecoveryCode(code)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inscription impossible')
    } finally {
      setBusy(false)
    }
  }

  if (recoveryCode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink px-4 py-10 text-white">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate p-6 sm:p-8">
          <BrandLogo onDark size="sm" />
          <h1 className="mt-6 font-display text-2xl font-bold">Notez votre code de récupération</h1>
          <p className="mt-2 text-sm text-white/65">
            Si vous oubliez votre mot de passe, utilisez votre <strong>e-mail</strong> + ce code pour
            en créer un nouveau. Il ne sera plus affiché.
          </p>
          <div className="mt-6 rounded-xl border border-accent/40 bg-ink/50 px-4 py-4 text-center">
            <div className="text-xs uppercase tracking-wide text-white/45">Code de récupération</div>
            <div className="mt-2 font-mono text-2xl font-bold tracking-wider text-accent">
              {recoveryCode}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(recoveryCode)
            }}
            className="mt-4 w-full rounded-full border border-white/20 py-2.5 text-sm font-semibold hover:bg-white/10"
          >
            Copier le code
          </button>
          <button
            type="button"
            onClick={() => navigate('/app', { replace: true })}
            className="mt-3 w-full rounded-full bg-accent py-3 text-sm font-bold text-ink hover:bg-accent-hover"
          >
            J’ai noté mon code — continuer
          </button>
        </div>
      </div>
    )
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
            Connexion par <strong>e-mail</strong> — en cas d’oubli, vous pourrez régénérer le mot de
            passe.
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
