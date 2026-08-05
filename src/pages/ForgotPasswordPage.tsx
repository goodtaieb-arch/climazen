import { type FormEvent, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { BrandLogo } from '../components/BrandLogo'
import { useAuth } from '../lib/AuthContext'

export function ForgotPasswordPage() {
  const { user, resetPasswordWithRecovery } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)
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
      await resetPasswordWithRecovery({ email, recoveryCode, newPassword: password })
      setOk(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Réinitialisation impossible')
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
        <div className="rounded-2xl border border-white/10 bg-slate p-6 shadow-xl sm:p-8">
          <h1 className="font-display text-2xl font-bold">Mot de passe oublié</h1>
          <p className="mt-1 text-sm text-white/60">
            Entrez votre <strong>e-mail</strong> et le <strong>code de récupération</strong> reçu à
            la création du compte, puis choisissez un nouveau mot de passe.
          </p>

          {ok ? (
            <div className="mt-6 space-y-4">
              <p className="rounded-xl bg-accent/15 px-3 py-3 text-sm text-accent">
                Mot de passe régénéré. Vous pouvez vous connecter avec votre e-mail.
              </p>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full rounded-full bg-accent py-3 text-sm font-bold text-ink hover:bg-accent-hover"
              >
                Se connecter
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <label className="block text-sm">
                <span className="mb-1 block text-white/70">E-mail *</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 w-full rounded-xl border border-white/15 bg-ink/40 px-3 text-white outline-none focus:border-accent"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-white/70">Code de récupération *</span>
                <input
                  required
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value)}
                  placeholder="CZ-XXXX-XXXX"
                  className="h-11 w-full rounded-xl border border-white/15 bg-ink/40 px-3 font-mono uppercase text-white outline-none focus:border-accent"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-white/70">Nouveau mot de passe *</span>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 w-full rounded-xl border border-white/15 bg-ink/40 px-3 text-white outline-none focus:border-accent"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-white/70">Confirmer *</span>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  className="h-11 w-full rounded-xl border border-white/15 bg-ink/40 px-3 text-white outline-none focus:border-accent"
                />
              </label>

              {error && (
                <p className="rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-200">{error}</p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-full bg-accent py-3 text-sm font-bold text-ink hover:bg-accent-hover disabled:opacity-60"
              >
                {busy ? 'Régénération…' : 'Régénérer le mot de passe'}
              </button>
            </form>
          )}

          <p className="mt-5 text-center text-xs text-white/45">
            Opérateur sans code ? Demandez au <strong>compte société</strong> de réinitialiser via
            Équipe.
          </p>
          <p className="mt-3 text-center text-sm text-white/60">
            <Link to="/login" className="font-semibold text-accent hover:underline">
              ← Retour connexion
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
