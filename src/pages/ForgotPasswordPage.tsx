import { type FormEvent, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { BrandLogo } from '../components/BrandLogo'
import { BetaBadge } from '../components/BetaBadge'
import { useAuth } from '../lib/AuthContext'

export function ForgotPasswordPage() {
  const { user, requestPasswordReset } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/app" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await requestPasswordReset(email)
      setOk(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Envoi impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4 py-10 text-white">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3">
          <BrandLogo onDark size="md" />
          <BetaBadge />
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate p-6 shadow-xl sm:p-8">
          <h1 className="font-display text-2xl font-bold">Mot de passe oublié</h1>
          <p className="mt-1 text-sm text-white/60">
            Entrez votre <strong>e-mail</strong> : vous recevrez un lien pour choisir un nouveau mot
            de passe.
          </p>

          {ok ? (
            <div className="mt-6 space-y-4">
              <p className="rounded-xl bg-accent/15 px-3 py-3 text-sm text-accent">
                Un e-mail a été envoyé (si le compte existe). Ouvrez-le et cliquez le lien — c’est
                seulement sur la page suivante que vous choisissez le nouveau mot de passe.
              </p>
              <p className="text-xs text-white/45">
                Vérifiez aussi les spams. Le lien doit ouvrir climazen-roan.vercel.app/reset-password
              </p>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full rounded-full bg-accent py-3 text-sm font-bold text-ink hover:bg-accent-hover"
              >
                Retour connexion
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

              {error && (
                <p className="rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-200">{error}</p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-full bg-accent py-3 text-sm font-bold text-ink hover:bg-accent-hover disabled:opacity-60"
              >
                {busy ? 'Envoi…' : 'Envoyer le lien'}
              </button>
            </form>
          )}

          <p className="mt-5 text-center text-sm text-white/60">
            <Link to="/login" className="font-semibold text-accent hover:underline">
              ← Retour connexion
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
