import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'

type Props = {
  label: string
  onClick?: () => void
  to?: string
  /** Masquer le FAB (ex. formulaire ouvert) */
  hidden?: boolean
}

/**
 * Bouton d’action flottant — mobile only, pouce en bas à droite.
 * Au-dessus de la bottom nav + safe area.
 */
export function MobileFab({ label, onClick, to, hidden }: Props) {
  if (hidden) return null

  const className =
    'fixed z-30 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#0f766e] px-5 text-sm font-bold text-white shadow-[0_8px_24px_rgba(15,118,110,0.45)] active:scale-[0.98] md:hidden'

  const style = {
    bottom: 'calc(4.75rem + env(safe-area-inset-bottom, 0px))',
    right: 'max(1rem, env(safe-area-inset-right, 0px))',
  } as const

  if (to) {
    return (
      <Link to={to} className={className} style={style} aria-label={label}>
        <Plus className="h-5 w-5" strokeWidth={2.5} />
        <span>{label}</span>
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className={className} style={style} aria-label={label}>
      <Plus className="h-5 w-5" strokeWidth={2.5} />
      <span>{label}</span>
    </button>
  )
}
