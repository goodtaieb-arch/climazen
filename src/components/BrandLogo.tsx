type BrandLogoProps = {
  variant?: 'full' | 'mark'
  className?: string
  /** Fond sombre : pastille blanche derrière le logo */
  onDark?: boolean
  /** Taille du logo */
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Logo ClimaZEN + « by TAIEB » petit, en italique, aligné sous les lettres ZEN.
 */
export function BrandLogo({
  variant = 'full',
  className = '',
  onDark = false,
  size = 'md',
}: BrandLogoProps) {
  const heights = {
    sm: 'h-8 sm:h-9',
    md: 'h-10 sm:h-11',
    lg: 'h-16 sm:h-20 lg:h-24',
  }

  /** Plus petit, calé sous ZEN (droite du mot-marque) */
  const bylineSize = {
    sm: 'text-[8px]',
    md: 'text-[9px]',
    lg: 'text-[11px] sm:text-xs',
  }

  const byline = (
    <p
      className={[
        'mt-0.5 self-end pr-[2%] text-right font-serif italic leading-none tracking-wide',
        bylineSize[size],
        onDark ? 'text-white/65' : 'text-[#4a4a50]',
      ].join(' ')}
      style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
    >
      by <span className="tracking-wider">TAIEB</span>
    </p>
  )

  const img = (
    <img
      src="/logo-original.png"
      alt="ClimaZEN"
      className={[
        'block w-auto object-contain object-left',
        variant === 'full' ? heights[size] : 'h-9 w-9',
        className,
      ].join(' ')}
    />
  )

  if (variant === 'mark') {
    return img
  }

  const block = (
    <div className="inline-flex flex-col items-stretch">
      {img}
      {byline}
    </div>
  )

  if (onDark) {
    return (
      <div className="inline-flex flex-col items-stretch rounded-xl bg-white px-2.5 py-1.5 shadow-sm">
        {img}
        <p
          className={[
            'mt-0.5 self-end pr-[2%] text-right font-serif italic leading-none tracking-wide text-[#4a4a50]',
            bylineSize[size],
          ].join(' ')}
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          by <span className="tracking-wider">TAIEB</span>
        </p>
      </div>
    )
  }

  return block
}
