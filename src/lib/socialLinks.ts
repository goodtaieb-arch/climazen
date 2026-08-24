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
    href: 'https://www.linkedin.com/in/issam-taieb-a1a4672a1/',
    enabled: true,
  },
  {
    id: 'youtube',
    label: 'YouTube',
    href: 'https://www.youtube.com/channel/UCSM4g0G6hcC7yHKbyN3CCyw',
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
 * Lien « Laisser un avis » Google (fiche Google Business).
 */
export const GOOGLE_REVIEW_URL = 'https://g.page/r/CZCj5azzPNXMEBM/review'

export const GOOGLE_MAPS_SEARCH_URL =
  'https://www.google.com/maps/search/?api=1&query=ClimaZEN'

export function enabledSocialLinks(): SocialLink[] {
  return SOCIAL_LINKS.filter((l) => l.enabled && l.href.trim())
}
