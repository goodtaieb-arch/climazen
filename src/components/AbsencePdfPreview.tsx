import { useEffect } from 'react'
import { Check, Loader2, X } from 'lucide-react'

type Props = {
  url: string
  title: string
  hint?: string
  confirmLabel: string
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}

/** Aperçu visuel de la feuille PDF avant envoi ou validation. */
export function AbsencePdfPreview({
  url,
  title,
  hint,
  confirmLabel,
  busy,
  onConfirm,
  onClose,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink/70 p-3 sm:p-6" role="dialog" aria-modal>
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-line px-4 py-3">
          <h2 className="font-display text-base font-semibold">{title}</h2>
          {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
        </div>
        <iframe title={title} src={url} className="min-h-0 flex-1 w-full bg-mist" />
        <div className="flex flex-col-reverse gap-2 border-t border-line p-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold disabled:opacity-60"
          >
            <X className="h-4 w-4" /> Annuler
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-bold text-ink disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
