type BrandLogoProps = {
  variant?: 'full' | 'mark'
  className?: string
  /** Fond sombre : pastille blanche derrière le logo */
  onDark?: boolean
  /** Taille du logo */
  size?: 'sm' | 'md' | 'lg'
  /** Logo de la boîte (data URL ou URL) — à côté de ClimaZEN */
  companyLogo?: string | null
  /** Nom société (alt / titre) */
  companyName?: string
}

/**
 * Logo ClimaZEN + « by TAIEB » + logo société optionnel à droite.
 */
export function BrandLogo({
  variant = 'full',
  className = '',
  onDark = false,
  size = 'md',
  companyLogo,
  companyName,
}: BrandLogoProps) {
  const heights = {
    sm: 'h-8 sm:h-9',
    md: 'h-10 sm:h-11',
    lg: 'h-16 sm:h-20 lg:h-24',
  }

  const companyHeights = {
    sm: 'h-7 sm:h-8',
    md: 'h-9 sm:h-10',
    lg: 'h-12 sm:h-14',
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

  const company = companyLogo ? (
    <>
      <span
        className={[
          'mx-2 h-6 w-px shrink-0 self-center sm:mx-2.5',
          onDark ? 'bg-white/25' : 'bg-line',
        ].join(' ')}
        aria-hidden
      />
      <img
        src={companyLogo}
        alt={companyName ? `Logo ${companyName}` : 'Logo société'}
        title={companyName || 'Logo société'}
        className={[
          'block max-w-[7.5rem] object-contain object-left sm:max-w-[9rem]',
          companyHeights[size],
        ].join(' ')}
      />
    </>
  ) : null

  if (variant === 'mark') {
    return (
      <div className="inline-flex items-center">
        {img}
        {company}
      </div>
    )
  }

  const climazenBlock = (
    <div className="inline-flex flex-col items-stretch">
      {img}
      {byline}
    </div>
  )

  if (onDark) {
    return (
      <div className="inline-flex items-center gap-0">
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
        {companyLogo ? (
          <>
            <span className="mx-2 h-6 w-px shrink-0 bg-white/25 sm:mx-2.5" aria-hidden />
            <img
              src={companyLogo}
              alt={companyName ? `Logo ${companyName}` : 'Logo société'}
              className={[
                'block max-w-[7.5rem] rounded-md bg-white/95 object-contain object-left px-1 py-0.5 sm:max-w-[9rem]',
                companyHeights[size],
              ].join(' ')}
            />
          </>
        ) : null}
      </div>
    )
  }

  return (
    <div className="inline-flex items-center">
      {climazenBlock}
      {company}
    </div>
  )
}
