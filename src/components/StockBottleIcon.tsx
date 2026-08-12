/** Bouteille fluide ClimaZEN 3D — Stock fluides */

import { ICON3D } from '../lib/icons3d'

type Props = {
  className?: string
  size?: number
  float?: boolean
  delay?: string
}

export function StockBottleIcon({
  className = '',
  size = 56,
  float = true,
  delay = '0.25s',
}: Props) {
  return (
    <span
      className={['inline-flex items-center justify-center', float ? 'float-3d' : '', className]
        .filter(Boolean)
        .join(' ')}
      style={float ? { animationDelay: delay } : undefined}
    >
      <img
        src={ICON3D.bottle}
        alt="Bouteille ClimaZEN"
        width={size}
        height={size}
        className="object-contain drop-shadow-md"
        style={{ width: size, height: size }}
        loading="eager"
        decoding="async"
        draggable={false}
      />
    </span>
  )
}
