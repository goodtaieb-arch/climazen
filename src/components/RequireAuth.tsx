import { type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, configured } = useAuth()
  const location = useLocation()

  if (!configured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mist px-4">
        <div className="max-w-md rounded-2xl border border-line bg-white p-6 text-sm text-slate">
          <h1 className="font-display text-xl font-bold">Supabase non configuré</h1>
          <p className="mt-2 text-muted">
            Ajoutez <code className="text-xs">VITE_SUPABASE_URL</code> et{' '}
            <code className="text-xs">VITE_SUPABASE_ANON_KEY</code> dans{' '}
            <code className="text-xs">.env.local</code> (voir <code className="text-xs">.env.example</code>
            ), puis exécutez le SQL <code className="text-xs">supabase/schema.sql</code>.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mist text-sm text-muted">
        Chargement…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}
