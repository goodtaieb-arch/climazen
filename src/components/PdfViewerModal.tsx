import { useEffect } from 'react'
import { X } from 'lucide-react'

type Props = {
  url: string
  title?: string
  onClose: () => void
}

/** Aperçu PDF dans l’app (évite les onglets blob bloqués par le navigateur). */
export function PdfViewerModal({ url, title = 'CERFA 15497-04', onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink/70 p-3 sm:p-6" role="dialog" aria-modal>
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="font-display truncate text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm font-medium hover:bg-mist"
          >
            <X className="h-4 w-4" /> Fermer
          </button>
        </div>
        <iframe title={title} src={url} className="min-h-0 flex-1 w-full bg-mist" />
      </div>
    </div>
  )
}
