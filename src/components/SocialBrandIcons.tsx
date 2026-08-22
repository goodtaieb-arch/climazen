import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { title?: string }

function base(props: IconProps) {
  const { title, ...rest } = props
  return { title, rest }
}

export function FacebookIcon(props: IconProps) {
  const { title, rest } = base(props)
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden={!title} {...rest}>
      {title ? <title>{title}</title> : null}
      <path d="M14 8.5h2.5V5.2C16.1 5.1 15 5 13.7 5 11.1 5 9.3 6.6 9.3 9.6V12H6.5v3.5h2.8V22h3.5v-6.5H15.5L16.2 12h-3.1V9.8c0-1 .3-1.7 1.7-1.7z" />
    </svg>
  )
}

export function InstagramIcon(props: IconProps) {
  const { title, rest } = base(props)
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden={!title} {...rest}>
      {title ? <title>{title}</title> : null}
      <path d="M12 7.2A4.8 4.8 0 1 0 12 16.8 4.8 4.8 0 0 0 12 7.2zm0 7.9a3.1 3.1 0 1 1 0-6.2 3.1 3.1 0 0 1 0 6.2z" />
      <path d="M17.5 6.2a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0z" />
      <path d="M12 3.5c2.2 0 2.5 0 3.4.1 1.1.1 1.9.3 2.5.6.7.3 1.3.7 1.8 1.3.5.5.9 1.1 1.2 1.8.3.7.5 1.4.6 2.5.1.9.1 1.2.1 3.4s0 2.5-.1 3.4c-.1 1.1-.3 1.9-.6 2.5-.3.7-.7 1.3-1.2 1.8-.5.5-1.1.9-1.8 1.2-.7.3-1.4.5-2.5.6-.9.1-1.2.1-3.4.1s-2.5 0-3.4-.1c-1.1-.1-1.9-.3-2.5-.6a4.9 4.9 0 0 1-1.8-1.2 4.9 4.9 0 0 1-1.2-1.8c-.3-.7-.5-1.4-.6-2.5C3.5 14.5 3.5 14.2 3.5 12s0-2.5.1-3.4c.1-1.1.3-1.9.6-2.5.3-.7.7-1.3 1.2-1.8.5-.5 1.1-.9 1.8-1.2.7-.3 1.4-.5 2.5-.6C9.5 3.5 9.8 3.5 12 3.5zm0-1.5c-2.3 0-2.6 0-3.5.1-1.2.1-2.1.3-2.9.6a6.4 6.4 0 0 0-2.3 1.5A6.4 6.4 0 0 0 1.8 5.6c-.4.8-.6 1.7-.7 2.9C1 9.4 1 9.7 1 12s0 2.6.1 3.5c.1 1.2.3 2.1.6 2.9.4.9.8 1.6 1.5 2.3a6.4 6.4 0 0 0 2.3 1.5c.8.3 1.7.5 2.9.6 1 .1 1.2.1 3.5.1s2.6 0 3.5-.1c1.2-.1 2.1-.3 2.9-.6a6.4 6.4 0 0 0 2.3-1.5 6.4 6.4 0 0 0 1.5-2.3c.3-.8.5-1.7.6-2.9.1-.9.1-1.2.1-3.5s0-2.6-.1-3.5c-.1-1.2-.3-2.1-.6-2.9a6.4 6.4 0 0 0-1.5-2.3A6.4 6.4 0 0 0 18.4 2.2c-.8-.3-1.7-.5-2.9-.6C14.6 1.5 14.3 1.5 12 1.5z" />
    </svg>
  )
}

export function LinkedInIcon(props: IconProps) {
  const { title, rest } = base(props)
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden={!title} {...rest}>
      {title ? <title>{title}</title> : null}
      <path d="M6.4 9.3H3.6V20h2.8V9.3zM5 4.5a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zM20.4 20h-2.8v-5.6c0-1.5-.5-2.5-1.8-2.5-1 0-1.5.7-1.8 1.3-.1.2-.1.5-.1.8V20H11V9.3h2.7v1.5c.4-.7 1.2-1.7 3-1.7 2.2 0 3.7 1.4 3.7 4.5V20z" />
    </svg>
  )
}

export function YouTubeIcon(props: IconProps) {
  const { title, rest } = base(props)
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden={!title} {...rest}>
      {title ? <title>{title}</title> : null}
      <path d="M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18 5 12 5 12 5s-6 0-7.7.3a2.7 2.7 0 0 0-1.9 1.9C2 8.9 2 12 2 12s0 3.1.4 4.8a2.7 2.7 0 0 0 1.9 1.9C6 19 12 19 12 19s6 0 7.7-.3a2.7 2.7 0 0 0 1.9-1.9c.4-1.7.4-4.8.4-4.8s0-3.1-.4-4.8zM10 15.2V8.8L15.5 12 10 15.2z" />
    </svg>
  )
}

export function TikTokIcon(props: IconProps) {
  const { title, rest } = base(props)
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden={!title} {...rest}>
      {title ? <title>{title}</title> : null}
      <path d="M19.6 8.2a6.6 6.6 0 0 1-3.8-1.2v7.1a5.9 5.9 0 1 1-5.9-5.9c.3 0 .6 0 .9.1v2.9a3 3 0 1 0 2.1 2.9V2.5h2.9c.2 1.7 1.3 3.2 2.8 4.1a6.4 6.4 0 0 0 3 .9v2.7z" />
    </svg>
  )
}

/** Logo Google « G » officiel (couleurs marque). */
export function GoogleIcon(props: IconProps) {
  const { title, rest } = base(props)
  return (
    <svg viewBox="0 0 24 24" aria-hidden={!title} {...rest}>
      {title ? <title>{title}</title> : null}
      <path
        fill="#4285F4"
        d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 5-.9 6.7-2.4l-3.2-2.5c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.9v2.6A10 10 0 0 0 12 22z"
      />
      <path
        fill="#FBBC05"
        d="M6.2 13.8A6 6 0 0 1 5.9 12c0-.6.1-1.2.3-1.8V7.6H2.9A10 10 0 0 0 2 12c0 1.6.4 3.1 1 4.4l3.2-2.6z"
      />
      <path
        fill="#EA4335"
        d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9C16.9 2.9 14.7 2 12 2A10 10 0 0 0 2.9 7.6l3.3 2.6C7 7.7 9.3 5.9 12 5.9z"
      />
    </svg>
  )
}

type ReviewBadgeProps = {
  className?: string
  /** Taille du G */
  size?: 'sm' | 'md' | 'lg'
}

/** Badge avis Google : G couleurs + 5 étoiles jaunes. */
export function GoogleReviewBadge({ className = '', size = 'md' }: ReviewBadgeProps) {
  const gClass = size === 'lg' ? 'h-14 w-14' : size === 'sm' ? 'h-8 w-8' : 'h-11 w-11'
  const starClass = size === 'lg' ? 'h-6 w-6' : size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'
  return (
    <div
      className={`inline-flex flex-col items-center gap-2 rounded-2xl border border-line bg-[#f8f9fa] px-6 py-5 ${className}`}
      aria-label="Avis Google"
    >
      <GoogleIcon className={gClass} title="Google" />
      <div className="flex items-center gap-0.5" aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => (
          <svg key={i} viewBox="0 0 24 24" className={starClass} fill="#FBBC04">
            <path d="M12 2.5l2.9 6.1 6.7.9-4.9 4.6 1.3 6.6L12 17.5 5.9 20.7l1.3-6.6L2.4 9.5l6.7-.9L12 2.5z" />
          </svg>
        ))}
      </div>
    </div>
  )
}
