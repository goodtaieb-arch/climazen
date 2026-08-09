import { useRef, useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import {
  plaqueHasAnyField,
  readPlaqueFromImage,
  type PlaqueFields,
} from '../lib/plaqueOcr'

type Props = {
  onParsed: (fields: PlaqueFields) => void
  className?: string
}

export function PlaquePhotoButton({ onParsed, className = '' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')

  const onFile = async (file: File | null) => {
    if (!file) return
    setError('')
    setBusy(true)
    setProgress(0)
    try {
      const fields = await readPlaqueFromImage(file, setProgress)
      if (!plaqueHasAnyField(fields)) {
        setError(
          'Peu d’infos lues — retakez la photo (plaque nette, bonne lumière) ou complétez à la main.',
        )
      }
      onParsed(fields)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lecture de la plaque impossible')
    } finally {
      setBusy(false)
      setProgress(0)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0] || null)}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent-soft/50 px-4 py-3 text-sm font-semibold text-ink hover:bg-accent-soft disabled:opacity-60 sm:w-auto"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Lecture plaque… {progress ? `${progress}%` : ''}
          </>
        ) : (
          <>
            <Camera className="h-4 w-4" />
            Photo de la plaque signalétique
          </>
        )}
      </button>
      <p className="mt-1.5 text-xs text-muted">
        Remplit type, marque, modèle, n° série, fluide et charge si lisibles sur la plaque.
      </p>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  )
}
