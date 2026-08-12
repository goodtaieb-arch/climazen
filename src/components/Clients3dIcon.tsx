/** Clients / détenteurs — icône 3D poignée de main */

import { ICON3D } from '../lib/icons3d'

type Props = {
  className?: string
  size?: number
  float?: boolean
  delay?: string
}

export function Clients3dIcon({
  className = '',
  size = 56,
  float = true,
  delay = '0.4s',
}: Props) {
  return (
    <span
      className={['inline-flex items-center justify-center', float ? 'float-3d' : '', className]
        .filter(Boolean)
        .join(' ')}
      style={float ? { animationDelay: delay } : undefined}
    >
      <img
        src={ICON3D.clients}
        alt="Clients ClimaZEN"
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
