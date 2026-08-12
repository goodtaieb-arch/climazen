/** Sites & Parc — icône 3D bâtiment + pin */

import { ICON3D } from '../lib/icons3d'

type Props = {
  className?: string
  size?: number
  float?: boolean
  delay?: string
}

export function Sites3dIcon({
  className = '',
  size = 56,
  float = true,
  delay = '0.15s',
}: Props) {
  return (
    <span
      className={['inline-flex items-center justify-center', float ? 'float-3d' : '', className]
        .filter(Boolean)
        .join(' ')}
      style={float ? { animationDelay: delay } : undefined}
    >
      <img
        src={ICON3D.sites}
        alt="Sites & Parc ClimaZEN"
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
