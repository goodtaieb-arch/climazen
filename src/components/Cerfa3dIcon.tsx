/** CERFA / Interventions — icône 3D document + signature */

import { ICON3D } from '../lib/icons3d'

type Props = {
  className?: string
  size?: number
  float?: boolean
  delay?: string
}

export function Cerfa3dIcon({
  className = '',
  size = 56,
  float = true,
  delay = '0.55s',
}: Props) {
  return (
    <span
      className={['inline-flex items-center justify-center', float ? 'float-3d' : '', className]
        .filter(Boolean)
        .join(' ')}
      style={float ? { animationDelay: delay } : undefined}
    >
      <img
        src={ICON3D.cerfa}
        alt="CERFA ClimaZEN"
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
