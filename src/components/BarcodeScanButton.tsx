import { useEffect, useRef, useState } from 'react'
import { Camera, Loader2, X } from 'lucide-react'

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>
}

type Props = {
  onDetected: (value: string) => void
  className?: string
  title?: string
  /** Ouvre automatiquement le scan (ex. ?scan=1 depuis commande vocale) */
  autoStart?: boolean
}

function getBarcodeDetector(): BarcodeDetectorLike | null {
  const BD = (window as unknown as { BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike })
    .BarcodeDetector
  if (!BD) return null
  try {
    return new BD({
      formats: [
        'qr_code',
        'code_128',
        'code_39',
        'ean_13',
        'ean_8',
        'upc_a',
        'upc_e',
        'codabar',
        'itf',
        'data_matrix',
      ],
    })
  } catch {
    try {
      return new BD()
    } catch {
      return null
    }
  }
}

/** Scan code-barres / QR (BarcodeDetector) — mobile terrain. */
export function BarcodeScanButton({
  onDetected,
  className = '',
  title = 'Scanner code-barres / QR',
  autoStart = false,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const autoStartedRef = useRef(false)

  const stopCamera = () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }

  useEffect(() => () => stopCamera(), [])

  const close = () => {
    stopCamera()
    setOpen(false)
    setBusy(false)
    setError('')
  }

  const accept = (raw: string) => {
    const value = raw.trim()
    if (!value) return
    onDetected(value)
    close()
  }

  const startLive = async () => {
    setError('')
    const detector = getBarcodeDetector()
    if (!detector) {
      setError(
        'Scan live non disponible ici (souvent iPhone) — utilisez « Photo du code » ci-dessous, ou saisissez le n°.',
      )
      setOpen(true)
      return
    }
    setOpen(true)
    setBusy(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play()
      setBusy(false)

      const tick = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          rafRef.current = requestAnimationFrame(() => void tick())
          return
        }
        try {
          const codes = await detector.detect(videoRef.current)
          const raw = codes.find((c) => c.rawValue?.trim())?.rawValue
          if (raw) {
            accept(raw)
            return
          }
        } catch {
          /* ignore frame errors */
        }
        rafRef.current = requestAnimationFrame(() => void tick())
      }
      rafRef.current = requestAnimationFrame(() => void tick())
    } catch {
      setBusy(false)
      setError('Caméra inaccessible — autorisez l’accès ou prenez une photo du code.')
    }
  }

  useEffect(() => {
    if (!autoStart || autoStartedRef.current) return
    autoStartedRef.current = true
    void startLive()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart])

  const onFile = async (file: File | null) => {
    if (!file) return
    setError('')
    setBusy(true)
    try {
      const detector = getBarcodeDetector()
      if (!detector) {
        setError('Lecture code-barres non supportée — saisissez le n° à la main.')
        return
      }
      const bmp = await createImageBitmap(file)
      try {
        const codes = await detector.detect(bmp)
        const raw = codes.find((c) => c.rawValue?.trim())?.rawValue
        if (raw) {
          accept(raw)
          return
        }
        setError('Aucun code détecté — recadrez le code-barres ou saisissez le n°.')
      } finally {
        bmp.close()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lecture impossible')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className={className}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0] || null)}
      />
      <button
        type="button"
        onClick={() => void startLive()}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-ink hover:bg-mist"
        title={title}
        aria-label={title}
      >
        <Camera className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/50 p-3 sm:items-center">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h3 className="font-display text-base font-semibold">Scanner le contenant</h3>
              <button
                type="button"
                onClick={close}
                className="rounded-full p-2 text-muted hover:bg-mist"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 p-4">
              <div className="overflow-hidden rounded-xl bg-ink aspect-[4/3]">
                <video
                  ref={videoRef}
                  className="h-full w-full object-cover"
                  playsInline
                  muted
                />
              </div>
              {busy && (
                <p className="flex items-center gap-2 text-sm text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" /> Démarrage caméra…
                </p>
              )}
              {error && <p className="text-sm text-danger">{error}</p>}
              <p className="text-xs text-muted">
                Cadrez le code-barres / QR du fournisseur (Gazechim, Westfalen, Climalife…).
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold hover:bg-mist disabled:opacity-60"
              >
                <Camera className="h-4 w-4" />
                Ou prendre une photo du code
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
