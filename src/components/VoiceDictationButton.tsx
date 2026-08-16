import { useEffect, useRef, useState } from 'react'
import { Loader2, Mic, MicOff } from 'lucide-react'
import {
  getSpeechRecognitionCtor,
  isSpeechSupported,
  type SpeechRecognitionLike,
} from '../lib/speech'

type Props = {
  value: string
  onChange: (next: string) => void
  /** Remplacer le texte au lieu d’ajouter à la fin */
  replace?: boolean
  className?: string
  title?: string
}

/**
 * Bouton micro : dicte dans un champ texte (observations, rapport, panne…).
 */
export function VoiceDictationButton({
  value,
  onChange,
  replace = false,
  className = '',
  title = 'Dicter',
}: Props) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const valueRef = useRef(value)
  valueRef.current = value

  useEffect(() => {
    return () => {
      try {
        recRef.current?.abort()
      } catch {
        /* ignore */
      }
      recRef.current = null
    }
  }, [])

  if (!isSpeechSupported()) {
    return null
  }

  const stop = () => {
    try {
      recRef.current?.stop()
    } catch {
      /* ignore */
    }
    setListening(false)
  }

  const start = () => {
    setError('')
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      setError('Vocal indisponible sur ce navigateur')
      return
    }
    try {
      recRef.current?.abort()
    } catch {
      /* ignore */
    }
    const rec = new Ctor()
    rec.lang = 'fr-FR'
    rec.continuous = false
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onresult = (ev) => {
      let transcript = ''
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const piece = ev.results[i]?.[0]?.transcript
        if (piece) transcript += piece
      }
      transcript = transcript.trim()
      if (!transcript) return
      const base = valueRef.current.trim()
      const next = replace || !base ? transcript : `${base} ${transcript}`.trim()
      onChange(next)
    }
    rec.onerror = (ev) => {
      const code = ev.error || ''
      if (code === 'not-allowed') setError('Autorisez le micro')
      else if (code === 'no-speech') setError('Aucune parole détectée')
      else if (code && code !== 'aborted') setError('Dictée interrompue')
      setListening(false)
    }
    rec.onend = () => setListening(false)
    recRef.current = rec
    try {
      rec.start()
      setListening(true)
    } catch {
      setError('Impossible de démarrer le micro')
      setListening(false)
    }
  }

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={() => (listening ? stop() : start())}
        className={
          listening
            ? 'inline-flex h-8 items-center gap-1 rounded-lg bg-rose-600 px-2 text-[11px] font-bold text-white'
            : 'inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-white px-2 text-[11px] font-semibold text-ink hover:bg-mist'
        }
        title={listening ? 'Arrêter la dictée' : title}
        aria-label={listening ? 'Arrêter la dictée' : title}
        aria-pressed={listening}
      >
        {listening ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Écoute…
          </>
        ) : (
          <>
            <Mic className="h-3.5 w-3.5" />
            Dicter
          </>
        )}
      </button>
      {error ? (
        <span className="max-w-[9rem] truncate text-[10px] text-rose-700" title={error}>
          <MicOff className="mr-0.5 inline h-3 w-3" />
          {error}
        </span>
      ) : null}
    </span>
  )
}
