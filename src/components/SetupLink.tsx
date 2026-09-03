import type { ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'

export function SetupLink({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-bold text-teal-800 underline decoration-teal-400 underline-offset-2 hover:text-teal-950"
    >
      {children}
      <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
    </a>
  )
}
