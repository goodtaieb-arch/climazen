import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BrandLogo } from '../components/BrandLogo'
import { PasswordField } from '../components/PasswordField'
import { useAuth } from '../lib/AuthContext'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'

/** Page ouverte après le lien e-mail Supabase (recovery). */
export function ResetPasswordPage() {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured()) return
    const sb = getSupabase()
    // Session recovery créée via detectSessionInUrl / hash
    void sb.auth.getSession().then(({ data }) => {
      setReady(!!data.session)
    })
    const { data: sub } = sb.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== password2) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    setBusy(true)
    try {
      await updatePassword(password)
      setOk(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mise à jour impossible')
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
          <h1 className="font-display text-2xl font-bold">Nouveau mot de passe</h1>

          {ok ? (
            <div className="mt-6 space-y-4">
              <p className="rounded-xl bg-accent/15 px-3 py-3 text-sm text-accent">
                Mot de passe mis à jour.
              </p>
              <button
                type="button"
                onClick={() => navigate('/app', { replace: true })}
                className="w-full rounded-full bg-accent py-3 text-sm font-bold text-ink hover:bg-accent-hover"
              >
                Continuer
              </button>
            </div>
          ) : !ready ? (
            <p className="mt-4 text-sm text-white/65">
              Ouvrez le lien reçu par e-mail pour définir un nouveau mot de passe.{' '}
              <Link to="/forgot-password" className="font-semibold text-accent hover:underline">
                Renvoyer un lien
              </Link>
            </p>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <PasswordField
                dark
                label="Nouveau mot de passe *"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <PasswordField
                dark
                label="Confirmer *"
                autoComplete="new-password"
                required
                minLength={6}
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
              />
              {error && (
                <p className="rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-200">{error}</p>
              )}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-full bg-accent py-3 text-sm font-bold text-ink hover:bg-accent-hover disabled:opacity-60"
              >
                {busy ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
