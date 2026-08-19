import { useEffect } from 'react'

type Props = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Confirmation in-app (remplace window.confirm, souvent bloqué / silencieux sur mobile). */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Supprimer',
  cancelLabel = 'Annuler',
  danger = true,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-line bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="font-display text-lg font-bold text-ink">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate">{message}</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-12 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink active:bg-mist"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={[
              'min-h-12 rounded-xl px-4 text-sm font-bold text-white active:opacity-90',
              danger ? 'bg-danger' : 'bg-accent text-ink',
            ].join(' ')}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
