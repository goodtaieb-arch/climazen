import { useState } from 'react'
import { Info, X } from 'lucide-react'
import {
  AI_LEARNING_INFO_FR,
  dismissAiLearningInfo,
  isAiLearningInfoDismissed,
} from '../lib/aiLearningInfo'

type Props = {
  /** compact = une ligne ; full = paragraphe */
  variant?: 'compact' | 'full'
  className?: string
  /** Si true, mémorise la fermeture (bandeau Accueil / Mon entreprise). */
  dismissible?: boolean
}

/**
 * Message d’information — collecte vocabulaire technique anonymisée.
 */
export function AiLearningInfoNotice({
  variant = 'full',
  className = '',
  dismissible = false,
}: Props) {
  const [hidden, setHidden] = useState(() =>
    dismissible ? isAiLearningInfoDismissed() : false,
  )

  if (hidden) return null

  return (
    <div
      className={[
        'flex gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sky-950',
        variant === 'compact' ? 'items-center text-[11px] leading-snug' : 'items-start text-xs leading-relaxed',
        className,
      ].join(' ')}
      role="status"
    >
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-700" aria-hidden />
      <p className="min-w-0 flex-1 font-medium">
        {variant === 'compact'
          ? 'Vocabulaire technique uniquement — noms / tél / adresses non enregistrés pour l’apprentissage.'
          : AI_LEARNING_INFO_FR}
      </p>
      {dismissible ? (
        <button
          type="button"
          onClick={() => {
            dismissAiLearningInfo()
            setHidden(true)
          }}
          className="shrink-0 rounded-lg p-1 text-sky-800 hover:bg-sky-100"
          aria-label="Fermer l’information"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  )
}
