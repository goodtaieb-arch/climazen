import { icon3dForRoute } from '../lib/icons3d'

type Props = {
  to: string
  size?: number
  float?: boolean
  delay?: string
  className?: string
}

/** Affiche l’icône 3D de la route, ou null si absente. */
export function Nav3dIcon({
  to,
  size = 28,
  float = true,
  delay = '0.2s',
  className = '',
}: Props) {
  const src = icon3dForRoute(to)
  if (!src) return null
  return (
    <span
      className={['inline-flex items-center justify-center', float ? 'float-3d' : '', className]
        .filter(Boolean)
        .join(' ')}
      style={float ? { animationDelay: delay } : undefined}
    >
      <img
        src={src}
        alt=""
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
