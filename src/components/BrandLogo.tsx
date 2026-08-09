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
 * Logo ClimaZEN + « by TAIEB » + logo société à droite (automatique si fourni).
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
    sm: 'h-8 sm:h-9',
    md: 'h-10 sm:h-11',
    lg: 'h-14 sm:h-16',
  }

  const bylineSize = {
    sm: 'text-[8px]',
    md: 'text-[9px]',
    lg: 'text-[11px] sm:text-xs',
  }

  const climazenImg = (
    <img
      src="/logo-original.png"
      alt="ClimaZEN"
      className={[
        'block w-auto shrink-0 object-contain object-left',
        variant === 'full' ? heights[size] : 'h-9 w-9',
        className,
      ].join(' ')}
    />
  )

  const companyImg = companyLogo ? (
    <img
      src={companyLogo}
      alt={companyName ? `Logo ${companyName}` : 'Logo société'}
      title={companyName || 'Logo société'}
      className={[
        'block max-w-[6.5rem] shrink-0 object-contain object-left sm:max-w-[8rem]',
        companyHeights[size],
      ].join(' ')}
    />
  ) : null

  const divider = companyLogo ? (
    <span
      className={[
        'mx-2 h-7 w-px shrink-0 self-center sm:mx-3',
        onDark ? 'bg-white/30' : 'bg-slate-300',
      ].join(' ')}
      aria-hidden
    />
  ) : null

  if (variant === 'mark') {
    return (
      <div className="inline-flex max-w-full items-center">
        {climazenImg}
        {divider}
        {companyImg}
      </div>
    )
  }

  const climazenBlock = (
    <div className="inline-flex shrink-0 flex-col items-stretch">
      {climazenImg}
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
    </div>
  )

  if (onDark) {
    return (
      <div className="inline-flex max-w-full items-center">
        <div className="inline-flex shrink-0 flex-col items-stretch rounded-xl bg-white px-2.5 py-1.5 shadow-sm">
          {climazenImg}
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
        {divider}
        {companyImg ? (
          <div className="rounded-md bg-white/95 px-1.5 py-1">{companyImg}</div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="inline-flex max-w-full items-center gap-0 overflow-visible">
      {climazenBlock}
      {divider}
      {companyImg}
    </div>
  )
}
