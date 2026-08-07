import { type FormEvent, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { KeyRound, UserPlus, UserX, UserCheck } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { generateTempPassword, type UserAccount } from '../lib/auth'
import { PasswordField } from '../components/PasswordField'

export function EquipePage() {
  const {
    user,
    organization,
    isOwner,
    createOperator,
    setOperatorActive,
    resetOperatorPassword,
    listTeam,
  } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(() => generateTempPassword())
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)
  const [members, setMembers] = useState<UserAccount[]>([])
  const [createdCodes, setCreatedCodes] = useState<{
    email: string
    password: string
  } | null>(null)

  const refresh = async () => {
    const team = await listTeam()
    setMembers(team)
  }

  useEffect(() => {
    if (!isOwner) return
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.organizationId, isOwner])

  if (!isOwner) return <Navigate to="/app" replace />

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setOk('')
    setCreatedCodes(null)
    setBusy(true)
    try {
      const { user: op } = await createOperator({ fullName, email, password })
      setCreatedCodes({ email: op.email, password })
      setOk(`Opérateur créé — connexion avec l’e-mail ${op.email}.`)
      setFullName('')
      setEmail('')
      setPassword(generateTempPassword())
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setBusy(false)
    }
  }

  const onResetPassword = async (memberId: string, memberEmail: string) => {
    if (
      !confirm(
        `Envoyer un e-mail de réinitialisation à ${memberEmail} ?`,
      )
    ) {
      return
    }
    try {
      const { email: sentTo } = await resetOperatorPassword(memberId)
      setCreatedCodes(null)
      setOk(`Lien de réinitialisation envoyé à ${sentTo}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Équipe / Opérateurs</h1>
        <p className="mt-1 text-muted">
          Société <strong>{organization?.name}</strong> — connexion par e-mail (cloud Supabase).
        </p>
      </div>

      {createdCodes && (
        <div className="rounded-2xl border border-accent/40 bg-accent-soft/50 p-5 text-sm text-slate">
          <div className="font-display text-base font-semibold">À transmettre à l’opérateur</div>
          <ul className="mt-2 space-y-1">
            <li>
              E-mail : <strong>{createdCodes.email}</strong>
            </li>
            <li>
              Mot de passe temporaire :{' '}
              <strong className="font-mono">{createdCodes.password}</strong>
            </li>
          </ul>
          <p className="mt-2 text-xs text-muted">
            S’il a oublié son MDP, utilisez « Reset MDP » pour lui envoyer un lien par e-mail.
          </p>
          <button
            type="button"
            className="mt-3 text-xs font-semibold text-accent hover:underline"
            onClick={() => setCreatedCodes(null)}
          >
            Masquer
          </button>
        </div>
      )}

      <form
        onSubmit={onCreate}
        className="grid gap-3 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2"
      >
        <h2 className="font-display text-lg font-semibold sm:col-span-2">
          <UserPlus className="mr-2 inline h-5 w-5" />
          Ajouter un opérateur
        </h2>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-muted">Nom complet *</span>
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="h-11 w-full rounded-xl border border-line px-3"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">E-mail (identifiant) *</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="operateur@societe.fr"
            className="h-11 w-full rounded-xl border border-line px-3"
          />
        </label>
        <PasswordField
          label="Mot de passe temporaire *"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
        {ok && !createdCodes && <p className="text-sm text-accent sm:col-span-2">{ok}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink hover:bg-accent-hover disabled:opacity-60 sm:col-span-2"
        >
          {busy ? 'Création…' : 'Créer le compte opérateur'}
        </button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="border-b border-line px-4 py-3 font-display font-semibold">
          Membres ({members.length})
        </div>
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <div className="font-medium">
                  {m.fullName}{' '}
                  <span className="text-xs font-normal text-muted">{m.email || m.username}</span>
                </div>
                <div className="text-xs text-muted">
                  {m.role === 'owner' ? 'Compte officiel société' : 'Opérateur'}
                  {m.active === false ? ' · désactivé' : ''}
                </div>
              </div>
              {m.role === 'operateur' && m.id !== user?.id && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void onResetPassword(m.id, m.email || m.username)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted hover:bg-mist"
                  >
                    <KeyRound className="h-3.5 w-3.5" /> Reset MDP
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void setOperatorActive(m.id, m.active === false).then(() => refresh())
                    }}
                    className={[
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold',
                      m.active === false
                        ? 'bg-accent-soft text-slate'
                        : 'border border-line text-muted hover:bg-mist',
                    ].join(' ')}
                  >
                    {m.active === false ? (
                      <>
                        <UserCheck className="h-3.5 w-3.5" /> Réactiver
                      </>
                    ) : (
                      <>
                        <UserX className="h-3.5 w-3.5" /> Désactiver
                      </>
                    )}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
