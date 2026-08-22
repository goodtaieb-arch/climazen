import { enabledSocialLinks } from '../lib/socialLinks'
import {
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  YouTubeIcon,
} from './SocialBrandIcons'

const ICONS = {
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  linkedin: LinkedInIcon,
  youtube: YouTubeIcon,
} as const

type Props = {
  className?: string
  /** Taille des icônes */
  size?: 'sm' | 'md'
  /** Variante visuelle */
  tone?: 'light' | 'dark'
}

export function SocialLinksRow({ className = '', size = 'md', tone = 'light' }: Props) {
  const links = enabledSocialLinks()
  if (links.length === 0) return null
  const iconClass = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'
  const btnClass =
    tone === 'dark'
      ? 'border-white/25 bg-white/10 text-white hover:bg-white/20'
      : 'border-line bg-white text-ink hover:border-accent/50 hover:bg-accent-soft'

  return (
    <ul className={`flex flex-wrap items-center gap-2 ${className}`}>
      {links.map((l) => {
        const Icon = ICONS[l.id as keyof typeof ICONS]
        if (!Icon) return null
        return (
          <li key={l.id}>
            <a
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={l.label}
              title={l.label}
              className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${btnClass}`}
            >
              <Icon className={iconClass} title={l.label} />
            </a>
          </li>
        )
      })}
    </ul>
  )
}
