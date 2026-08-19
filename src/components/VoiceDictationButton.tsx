import { useEffect, useRef, useState } from 'react'
import { Loader2, Mic, MicOff } from 'lucide-react'
import {
  SPEECH_SILENCE_MS,
  applySpeechCorrections,
  getSpeechRecognitionCtor,
  isSpeechSupported,
  mergeSpeechFinals,
  type SpeechRecognitionLike,
} from '../lib/speech'

type Props = {
  value: string
  onChange: (next: string) => void
  /** Remplacer le texte au lieu d’ajouter à la fin */
  replace?: boolean
  className?: string
  title?: string
  /** Icône seule (ex. pied de chat) — évite de chevaucher le bouton voisin */
  iconOnly?: boolean
}

/**
 * Bouton micro : dictée continue, laisse le temps de corriger (« non plutôt… »).
 * Arrêt auto après ~4,8 s de silence, ou tap pour stopper.
 */
export function VoiceDictationButton({
  value,
  onChange,
  replace = false,
  className = '',
  title = 'Dicter',
  iconOnly = false,
}: Props) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const valueRef = useRef(value)
  valueRef.current = value
  const baseRef = useRef('')
  const finalsRef = useRef<string[]>([])
  const wantListenRef = useRef(false)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const replaceRef = useRef(replace)
  replaceRef.current = replace

  const clearSilence = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
  }

  const commitFinals = () => {
    const spoken = mergeSpeechFinals(finalsRef.current)
    if (!spoken) return
    const base = baseRef.current.trim()
    const next =
      replaceRef.current || !base ? spoken : `${base} ${spoken}`.trim()
    onChangeRef.current(applySpeechCorrections(next))
  }

  const stop = () => {
    wantListenRef.current = false
    clearSilence()
    try {
      recRef.current?.stop()
    } catch {
      /* ignore */
    }
    setListening(false)
    setInterim('')
  }

  const armSilence = () => {
    clearSilence()
    silenceTimerRef.current = setTimeout(() => {
      // Silence long → on considère la phrase terminée
      commitFinals()
      stop()
    }, SPEECH_SILENCE_MS)
  }

  useEffect(() => {
    return () => {
      wantListenRef.current = false
      clearSilence()
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

  const start = () => {
    setError('')
    setInterim('')
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

    baseRef.current = replace ? '' : valueRef.current
    finalsRef.current = []
    wantListenRef.current = true

    const rec = new Ctor()
    rec.lang = 'fr-FR'
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 3

    rec.onresult = (ev) => {
      if (!wantListenRef.current) return
      armSilence()
      let interimText = ''
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const result = ev.results[i]
        if (!result) continue
        // Meilleure alternative si dispo
        let best = result[0]?.transcript || ''
        let bestConf = result[0]?.confidence ?? 0
        const altCount = typeof result.length === 'number' ? result.length : 1
        for (let a = 1; a < altCount; a++) {
          const alt = (result as unknown as ArrayLike<{ transcript?: string; confidence?: number }>)[a]
          const conf = alt?.confidence ?? 0
          if (alt?.transcript && conf > bestConf) {
            best = alt.transcript
            bestConf = conf
          }
        }
        if (result.isFinal) {
          const piece = best.trim()
          if (piece) {
            finalsRef.current = [...finalsRef.current, piece]
            commitFinals()
          }
        } else {
          interimText += best
        }
      }
      setInterim(interimText.trim())
    }

    rec.onerror = (ev) => {
      const code = ev.error || ''
      // no-speech en continu : on laisse le timer / restart gérer
      if (code === 'not-allowed') {
        setError('Autorisez le micro')
        wantListenRef.current = false
        setListening(false)
        setInterim('')
        return
      }
      if (code === 'aborted') return
      if (code === 'no-speech') {
        // ne coupe pas tout de suite — le silence timer décide
        return
      }
      if (code === 'network') setError('Réseau vocal indisponible')
      else setError('Dictée interrompue — retapez le micro')
      wantListenRef.current = false
      clearSilence()
      setListening(false)
      setInterim('')
    }

    rec.onend = () => {
      // Chrome coupe souvent le flux : on relance tant que l’utilisateur écoute
      if (wantListenRef.current) {
        try {
          rec.start()
          return
        } catch {
          wantListenRef.current = false
        }
      }
      clearSilence()
      setListening(false)
      setInterim('')
    }

    recRef.current = rec
    try {
      rec.start()
      setListening(true)
      armSilence()
    } catch {
      setError('Impossible de démarrer le micro')
      wantListenRef.current = false
      setListening(false)
    }
  }

  const idleClass = iconOnly
    ? 'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-ink hover:bg-mist'
    : 'inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-white px-2 text-[11px] font-semibold text-ink hover:bg-mist'
  const listenClass = iconOnly
    ? 'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white'
    : 'inline-flex h-8 max-w-[14rem] items-center gap-1 rounded-lg bg-rose-600 px-2 text-[11px] font-bold text-white'

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 ${iconOnly ? '' : 'max-w-full'} ${className}`}
    >
      <button
        type="button"
        onClick={() => (listening ? (commitFinals(), stop()) : start())}
        className={listening ? listenClass : idleClass}
        title={
          listening
            ? interim
              ? `Écoute : ${interim}`
              : 'Parlez… corrigez avec « non plutôt… » — tap pour arrêter'
            : title
        }
        aria-label={listening ? 'Arrêter la dictée' : title}
        aria-pressed={listening}
      >
        {listening ? (
          iconOnly ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <>
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              <span className="truncate">{interim ? interim : 'Écoute…'}</span>
            </>
          )
        ) : (
          <>
            <Mic className={iconOnly ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
            {iconOnly ? null : 'Dicter'}
          </>
        )}
      </button>
      {error && !iconOnly ? (
        <span className="max-w-[9rem] truncate text-[10px] text-rose-700" title={error}>
          <MicOff className="mr-0.5 inline h-3 w-3" />
          {error}
        </span>
      ) : null}
    </span>
  )
}
