import { useEffect, useMemo, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import {
  pickSafetyTip,
  type SafetyTip,
} from '../lib/safetyTips'
import type { OrdreTravail } from '../lib/ordreTravail'
import type { Site } from '../lib/types'
import type { PointageAction } from '../lib/pointage'
import { allEquipements } from '../lib/cerfaBatch'
import { speakFr } from '../lib/speech'

type Props = {
  lastAction?: PointageAction | string | null
  ot?: OrdreTravail | null
  site?: Site | null
  /** Relance le tirage (ex. après un punch). */
  refreshKey?: string | number
  /** Lire le rappel à voix haute une fois. */
  speakOnce?: boolean
  onSpoken?: () => void
  className?: string
}

/**
 * Petite bannière sensibilisation sécurité — un message à la fois, qui tourne.
 */
export function SafetyTipBanner({
  lastAction,
  ot,
  site,
  refreshKey,
  speakOnce,
  onSpoken,
  className,
}: Props) {
  const [tip, setTip] = useState<SafetyTip | null>(null)
  const eqs = useMemo(() => (site ? allEquipements(site) : []), [site])

  useEffect(() => {
    const next = pickSafetyTip({
      lastAction,
      ot: ot || null,
      site: site || null,
      equipements: eqs,
    })
    setTip(next)
  }, [lastAction, ot, site, eqs, refreshKey])

  useEffect(() => {
    if (!speakOnce || !tip) return
    speakFr(tip.speak, { onEnd: onSpoken })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speakOnce, tip?.id])

  if (!tip) return null

  return (
    <p
      className={[
        'flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950',
        className || '',
      ].join(' ')}
      role="status"
      aria-live="polite"
    >
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
      <span>
        <span className="font-bold">Sécurité — </span>
        {tip.text}
      </span>
    </p>
  )
}
