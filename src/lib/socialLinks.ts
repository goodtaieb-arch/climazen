/**
 * Liens réseaux sociaux & avis Google — centralisés (landing, footer, page /avis).
 * Mettez à jour les URL dès que les comptes / fiche Google sont prêts.
 */
export type SocialLink = {
  id: string
  label: string
  href: string
  /** Afficher dans le footer / landing */
  enabled: boolean
}

/** Profils publics ClimaZEN */
export const SOCIAL_LINKS: SocialLink[] = [
  {
    id: 'facebook',
    label: 'Facebook',
    href: 'https://www.facebook.com/people/Climazen/61593827602781/',
    enabled: true,
  },
  {
    id: 'instagram',
    label: 'Instagram',
    href: 'https://www.instagram.com/climazen',
    enabled: true,
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/company/climazen',
    enabled: true,
  },
  {
    id: 'youtube',
    label: 'YouTube',
    href: 'https://www.youtube.com/@climazen',
    enabled: true,
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    href: 'https://www.tiktok.com/@climazen95',
    enabled: true,
  },
]

/**
 * Lien « Laisser un avis » Google.
 * Idéal : URL courte g.page/r/…/review ou writereview?placeid=…
 * En attendant la fiche Google Business, on ouvre la recherche ClimaZEN.
 */
export const GOOGLE_REVIEW_URL =
  'https://www.google.com/search?q=ClimaZEN+avis'

export const GOOGLE_MAPS_SEARCH_URL =
  'https://www.google.com/maps/search/?api=1&query=ClimaZEN'

export function enabledSocialLinks(): SocialLink[] {
  return SOCIAL_LINKS.filter((l) => l.enabled && l.href.trim())
}
