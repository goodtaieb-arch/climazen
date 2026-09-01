import { APP_IS_BETA } from '../lib/buildStamp'

type BetaBadgeProps = {
  className?: string
  size?: 'sm' | 'md'
}

/**
 * Pastille « Bêta » — visible à côté du logo / de la version.
 * Couper le mode : APP_IS_BETA = false dans buildStamp.ts
 */
export function BetaBadge({ className = '', size = 'md' }: BetaBadgeProps) {
  if (!APP_IS_BETA) return null
  const pad = size === 'sm' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[11px]'
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full bg-amber-400 font-extrabold uppercase tracking-[0.14em] text-ink ${pad} ${className}`}
      title="ClimaZEN est actuellement en version bêta"
    >
      Bêta
    </span>
  )
}

/** Bandeau site public — impossible à rater. */
export function BetaSiteBanner({ dark = false }: { dark?: boolean }) {
  if (!APP_IS_BETA) return null
  return (
    <div
      className={
        dark
          ? 'bg-amber-400 px-3 py-2 text-center text-[12px] font-bold leading-snug text-ink sm:text-sm'
          : 'border-b border-amber-500/40 bg-amber-400 px-3 py-2 text-center text-[12px] font-bold leading-snug text-ink sm:text-sm'
      }
      role="status"
    >
      Version bêta — ClimaZEN est actuellement en cours de finalisation
    </div>
  )
}
