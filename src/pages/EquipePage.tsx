import { type FormEvent, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { UserPlus, UserX, UserCheck } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'

export function EquipePage() {
  const { user, organization, isOwner, createOperator, setOperatorActive, listTeam } = useAuth()
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)
  const [tick, setTick] = useState(0)

  if (!isOwner) return <Navigate to="/app" replace />

  void tick
  const members = listTeam()

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setOk('')
    setBusy(true)
    try {
      const op = await createOperator({ fullName, username, password })
      setOk(`Opérateur « ${op.username} » créé — il se connecte avec cet identifiant.`)
      setFullName('')
      setUsername('')
      setPassword('')
      setTick((t) => t + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Équipe / Opérateurs</h1>
        <p className="mt-1 text-muted">
          Société <strong>{organization?.name}</strong> — les CERFA remplis par les opérateurs
          arrivent sur ce compte officiel.
        </p>
      </div>

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
          <span className="mb-1 block text-muted">Identifiant *</span>
          <input
            required
            minLength={3}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="h-11 w-full rounded-xl border border-line px-3"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Mot de passe temporaire *</span>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 w-full rounded-xl border border-line px-3"
          />
        </label>
        {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
        {ok && <p className="text-sm text-accent sm:col-span-2">{ok}</p>}
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
                  <span className="text-xs font-normal text-muted">@{m.username}</span>
                </div>
                <div className="text-xs text-muted">
                  {m.role === 'owner' ? 'Compte officiel société' : 'Opérateur'}
                  {m.active === false ? ' · désactivé' : ''}
                </div>
              </div>
              {m.role === 'operateur' && m.id !== user?.id && (
                <button
                  type="button"
                  onClick={() => {
                    setOperatorActive(m.id, m.active === false)
                    setTick((t) => t + 1)
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
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
