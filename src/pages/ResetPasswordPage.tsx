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
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading')
  const [busy, setBusy] = useState(false)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setStatus('missing')
      return
    }
    const sb = getSupabase()
    let cancelled = false

    const activate = async () => {
      try {
        const url = new URL(window.location.href)
        const code = url.searchParams.get('code')
        const errDesc = url.searchParams.get('error_description') || url.searchParams.get('error')
        if (errDesc) {
          if (!cancelled) {
            setError(decodeURIComponent(errDesc.replace(/\+/g, ' ')))
            setStatus('missing')
          }
          return
        }

        if (code) {
          const { error: exErr } = await sb.auth.exchangeCodeForSession(code)
          if (exErr) throw exErr
          // Nettoyer l’URL
          window.history.replaceState({}, document.title, '/reset-password')
        }

        const { data } = await sb.auth.getSession()
        if (!cancelled) setStatus(data.session ? 'ready' : 'missing')
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Lien invalide ou expiré')
          setStatus('missing')
        }
      }
    }

    void activate()

    const { data: sub } = sb.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setStatus('ready')
        setError('')
      }
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
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
      // Force re-login avec le nouveau MDP
      try {
        await getSupabase().auth.signOut()
      } catch {
        // ignore
      }
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
                Mot de passe mis à jour. Connectez-vous avec le nouveau mot de passe.
              </p>
              <button
                type="button"
                onClick={() => navigate('/login', { replace: true })}
                className="w-full rounded-full bg-accent py-3 text-sm font-bold text-ink hover:bg-accent-hover"
              >
                Se connecter
              </button>
            </div>
          ) : status === 'loading' ? (
            <p className="mt-4 text-sm text-white/65">Vérification du lien…</p>
          ) : status === 'missing' ? (
            <div className="mt-4 space-y-3 text-sm text-white/65">
              <p>
                Lien invalide, expiré, ou pas encore ouvert depuis l’e-mail. Demandez un nouveau lien,
                puis <strong>cliquez le lien dans l’e-mail</strong> (ne changez pas le MDP seulement
                depuis la page « mot de passe oublié »).
              </p>
              {error && (
                <p className="rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-200">{error}</p>
              )}
              <Link to="/forgot-password" className="inline-block font-semibold text-accent hover:underline">
                Renvoyer un lien
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <p className="text-sm text-white/60">Choisissez votre nouveau mot de passe (6 car. min.).</p>
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
                {busy ? 'Enregistrement…' : 'Enregistrer le nouveau mot de passe'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
