import { ExternalLink, FolderOpen } from 'lucide-react'
import { hrefDossierCloudTech } from '../lib/rhDocuments'

type Props = {
  techName: string
  lienCloudDossier?: string
  racineCloud?: string
  /** Libellé court du bouton */
  label?: string
  className?: string
  /** compact = pastille liste équipe */
  variant?: 'button' | 'link' | 'compact'
}

/** Ouvre le dossier cloud du tech (photos de pièces : CNI, permis, F-Gas…). */
export function DossierCloudTechButton({
  techName,
  lienCloudDossier,
  racineCloud,
  label = 'Photos pièces',
  className = '',
  variant = 'button',
}: Props) {
  const href = hrefDossierCloudTech({
    racineCloud,
    lienCloudDossier,
    techName,
  })
  if (!href) return null

  const cls =
    variant === 'compact'
      ? 'inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-ink hover:bg-accent-hover'
      : variant === 'link'
        ? 'inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline'
        : 'inline-flex min-h-10 items-center gap-1.5 rounded-full bg-accent px-3 text-xs font-semibold text-ink hover:bg-accent-hover'

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={[cls, className].filter(Boolean).join(' ')}
      title={`Ouvrir le dossier cloud de ${techName} (photos de pièces)`}
    >
      {variant === 'link' ? <FolderOpen className="h-3.5 w-3.5" /> : <ExternalLink className="h-3.5 w-3.5" />}
      {label}
    </a>
  )
}
