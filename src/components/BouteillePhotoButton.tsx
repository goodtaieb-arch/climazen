import { useRef, useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import {
  bouteilleScanHasData,
  readBouteilleFromImage,
  summarizeBouteilleScan,
  type BouteilleScanFields,
} from '../lib/bouteilleOcr'

type Props = {
  onParsed: (fields: BouteilleScanFields) => void
  className?: string
}

/** Photo de l’étiquette bouteille → préremplit le formulaire stock. */
export function BouteillePhotoButton({ onParsed, className = '' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [hint, setHint] = useState('')

  const onFile = async (file: File | null) => {
    if (!file) return
    setError('')
    setHint('')
    setBusy(true)
    setProgress(0)
    try {
      const fields = await readBouteilleFromImage(file, setProgress)
      if (!bouteilleScanHasData(fields)) {
        setError(
          'Peu d’infos lues — photo nette de l’étiquette (fluide, UN, n°, capacité) ou complétez à la main.',
        )
      } else {
        setHint(`Lu : ${summarizeBouteilleScan(fields)}`)
      }
      onParsed(fields)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lecture de l’étiquette impossible')
    } finally {
      setBusy(false)
      setProgress(0)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div
      className={`rounded-xl border border-accent/35 bg-accent-soft/40 p-3 sm:p-4 sm:col-span-2 ${className}`}
    >
      <p className="mb-2 text-sm font-semibold text-ink">Remplir par photo / scan</p>
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
        className="inline-flex w-full min-h-12 items-center justify-center gap-2 rounded-xl border border-accent/50 bg-surface px-4 py-3 text-sm font-semibold text-ink shadow-sm hover:bg-accent-soft disabled:opacity-60"
      >
        {busy ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Lecture étiquette… {progress ? `${progress}%` : ''}
          </>
        ) : (
          <>
            <Camera className="h-5 w-5 text-accent" />
            Photo de l’étiquette bouteille
          </>
        )}
      </button>
      <p className="mt-2 text-xs text-muted">
        Ouvre l’appareil photo — tente de lire fluide (R-xxx), n° série, UN, capacité, tare,
        réépreuve. Vérifiez puis enregistrez. Le bouton caméra à côté du n° scanne aussi QR /
        code-barres.
      </p>
      {hint && <p className="mt-1.5 text-xs font-medium text-emerald-800">{hint}</p>}
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  )
}
