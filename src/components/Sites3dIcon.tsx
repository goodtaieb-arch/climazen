/** Sites & Parc — icône 3D bâtiment + pin */

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
        src="/icons/3d/climazen-sites.png"
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
