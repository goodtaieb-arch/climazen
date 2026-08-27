import { useState, type MouseEvent } from 'react'
import { ExternalLink, FolderOpen, Loader2 } from 'lucide-react'
import { hrefDossierCloudTech } from '../lib/rhDocuments'
import { openExactOperatorCloudLink } from '../lib/cloudLinkGuard'

type Props = {
  techName: string
  lienCloudDossier?: string
  /** Ignoré à l’ouverture : uniquement le lien exact de l’opérateur. */
  racineCloud?: string
  label?: string
  className?: string
  variant?: 'button' | 'link' | 'compact'
  /** Sur OT : ne rien afficher tant que le lien exact n’est pas collé. */
  hideIfMissing?: boolean
}

/** Ouvre le dossier cloud EXACT du tech, après contrôle « pas public ». */
export function DossierCloudTechButton({
  techName,
  lienCloudDossier,
  label = 'Photos pièces',
  className = '',
  variant = 'button',
  hideIfMissing = false,
}: Props) {
  const href = hrefDossierCloudTech({ lienCloudDossier, techName })
  const [busy, setBusy] = useState(false)
  if (hideIfMissing && !href) return null

  const clsBase =
    variant === 'compact'
      ? 'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold'
      : variant === 'link'
        ? 'inline-flex items-center gap-1.5 text-sm font-semibold'
        : 'inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-xs font-semibold'

  const clsEnabled =
    variant === 'link'
      ? 'text-accent hover:underline'
      : 'bg-accent text-ink hover:bg-accent-hover'

  const clsDisabled = 'cursor-not-allowed border border-line bg-mist text-muted'

  const onOpen = async (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (busy) return
    setBusy(true)
    try {
      const result = await openExactOperatorCloudLink(href)
      if (!result.ok) {
        window.alert(result.message)
      }
    } finally {
      setBusy(false)
    }
  }

  const title = href
    ? `Ouvrir le dossier exact de ${techName} (bloqué s’il est public)`
    : `Collez d’abord le lien exact du dossier de ${techName} (Équipe)`

  return (
    <button
      type="button"
      onClick={(e) => void onOpen(e)}
      disabled={!href || busy}
      className={[clsBase, href ? clsEnabled : clsDisabled, className].filter(Boolean).join(' ')}
      title={title}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : variant === 'link' ? (
        <FolderOpen className="h-3.5 w-3.5" />
      ) : (
        <ExternalLink className="h-3.5 w-3.5" />
      )}
      {busy ? 'Vérification…' : label}
    </button>
  )
}
