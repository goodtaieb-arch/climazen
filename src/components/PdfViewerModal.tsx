import { useEffect } from 'react'
import { Download, X } from 'lucide-react'
import { downloadBlob } from '../lib/cerfaPdf'

type Props = {
  url: string
  title?: string
  /** Nom de fichier si téléchargement (sinon dérivé du titre). */
  fileName?: string
  onClose: () => void
}

/** Aperçu PDF dans l’app (évite les onglets blob bloqués par le navigateur). */
export function PdfViewerModal({
  url,
  title = 'CERFA 15497-04',
  fileName,
  onClose,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const onDownload = async () => {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const name =
        fileName ||
        `${title.replace(/[^\w.-]+/g, '-').replace(/^-|-$/g, '') || 'document'}.pdf`
      downloadBlob(blob, name.endsWith('.pdf') ? name : `${name}.pdf`)
    } catch (err) {
      console.error('ClimaZEN: download PDF modal', err)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink/70 p-3 sm:p-6" role="dialog" aria-modal>
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="font-display truncate text-base font-semibold">{title}</h2>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void onDownload()}
              className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm font-medium hover:bg-mist"
            >
              <Download className="h-4 w-4" /> Enregistrer
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm font-medium hover:bg-mist"
            >
              <X className="h-4 w-4" /> Fermer
            </button>
          </div>
        </div>
        <iframe title={title} src={url} className="min-h-0 flex-1 w-full bg-mist" />
      </div>
    </div>
  )
}
