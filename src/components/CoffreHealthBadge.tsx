import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { HardDrive } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { useStore } from '../lib/store'
import { archivePriveConfigure } from '../lib/documentArchive'
import { fetchCoffreHealth, type CoffreHealth } from '../lib/coffreHealth'

/** Badge gérant : Vert = coffre synchronisé, Rouge = synchro interrompue. */
export function CoffreHealthBadge() {
  const { isOwner } = useAuth()
  const { data } = useStore()
  const actif = Boolean(data.operateur.coffreActif || archivePriveConfigure(data.operateur))
  const [health, setHealth] = useState<CoffreHealth | null>(null)

  useEffect(() => {
    if (!isOwner || !actif) return
    let cancelled = false
    const load = (probe: boolean) => {
      void fetchCoffreHealth({ probe })
        .then((r) => {
          if (!cancelled && r.ok && r.health) setHealth(r.health)
        })
        .catch(() => undefined)
    }
    load(true)
    const t = window.setInterval(() => load(false), 60_000)
    return () => {
      cancelled = true
      window.clearInterval(t)
    }
  }, [isOwner, actif])

  if (!isOwner || !actif) return null
  if (!health) {
    return (
      <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-bold text-muted shadow-sm">
        <HardDrive className="h-3.5 w-3.5 shrink-0" />
        Coffre…
      </span>
    )
  }
  const interrupted = Boolean(health.interrupted)
  const label = interrupted ? 'Synchro interrompue' : 'Coffre synchronisé'
  const cause = interrupted ? health?.message : null

  return (
    <Link
      to="/app/operateur"
      className={[
        'inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold shadow-sm',
        interrupted
          ? 'border border-red-300 bg-red-600 text-white'
          : 'border border-emerald-300 bg-emerald-600 text-white',
      ].join(' ')}
      title={cause || label}
    >
      <HardDrive className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  )
}
