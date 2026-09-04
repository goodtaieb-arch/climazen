import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { openAddressInGps } from '../lib/mapsNav'
import {
  SPEECH_COMMAND_SILENCE_MS,
  applySpeechCorrections,
  getSpeechRecognitionCtor,
  isSpeechSupported,
  parseVoiceCommand,
  type SpeechRecognitionLike,
} from '../lib/speech'

/**
 * Commandes vocales terrain — déclenchées depuis l’en-tête (pas de FAB bas).
 * Écoute continue + silence ~2,8 s (laisse le temps de reformuler).
 */
export function VoiceCommandsFab() {
  const navigate = useNavigate()
  const { data } = useStore()
  const [listening, setListening] = useState(false)
  const [hint, setHint] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const [supported] = useState(() => isSpeechSupported())
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const listeningRef = useRef(false)
  const wantListenRef = useRef(false)
  const bufferRef = useRef('')
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const emitState = (on: boolean) => {
    listeningRef.current = on
    setListening(on)
    window.dispatchEvent(new CustomEvent('climazen:voice-state', { detail: { listening: on } }))
  }

  const clearSilence = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
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
    }
  }, [])

  const openAide = () => {
    window.dispatchEvent(new CustomEvent('climazen:open-aide'))
  }

  const openGps = () => {
    const sites = [...(data.chantiers || [])].reverse()
    const withAddr = sites.find((s) => s.adresse || s.ville || s.codePostal)
    if (!withAddr) {
      setHint('Aucun site avec adresse — ouvrez Sites')
      navigate('/app/chantiers')
      return
    }
    const ok = openAddressInGps({
      adresse: withAddr.adresse,
      codePostal: withAddr.codePostal,
      ville: withAddr.ville,
    })
    setHint(ok ? `GPS : ${withAddr.nom || withAddr.ville || 'site'}` : 'Adresse GPS invalide')
  }

  const runTranscript = (raw: string) => {
    const cleaned = applySpeechCorrections(raw)
    const cmd = parseVoiceCommand(cleaned)
    if (!cmd) {
      setHint(`Non compris : « ${cleaned.slice(0, 48) || raw.slice(0, 48)} »`)
      setShowHelp(true)
      return
    }
    setHint(cmd.label)
    if (cmd.id === 'aide') {
      openAide()
      return
    }
    if (cmd.id === 'gps') {
      openGps()
      return
    }
    if (cmd.path) {
      navigate(cmd.path)
    }
  }

  const stop = () => {
    wantListenRef.current = false
    clearSilence()
    try {
      recRef.current?.stop()
    } catch {
      /* ignore */
    }
    emitState(false)
  }

  const finishBuffer = () => {
    const raw = bufferRef.current.trim()
    bufferRef.current = ''
    if (raw) runTranscript(raw)
    stop()
  }

  const armSilence = () => {
    clearSilence()
    silenceTimerRef.current = setTimeout(() => {
      finishBuffer()
    }, SPEECH_COMMAND_SILENCE_MS)
  }

  const start = () => {
    if (!supported) {
      setHint('Vocal indisponible sur ce navigateur')
      return
    }
    setHint('')
    setShowHelp(false)
    bufferRef.current = ''
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) return
    try {
      recRef.current?.abort()
    } catch {
      /* ignore */
    }
    const rec = new Ctor()
    rec.lang = 'fr-FR'
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 3
    wantListenRef.current = true

    rec.onresult = (ev) => {
      if (!wantListenRef.current) return
      armSilence()
      let interim = ''
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const result = ev.results[i]
        const piece = result?.[0]?.transcript || ''
        if (result?.isFinal) {
          bufferRef.current = `${bufferRef.current} ${piece}`.trim()
          setHint(applySpeechCorrections(bufferRef.current) || 'Écoute…')
        } else {
          interim += piece
        }
      }
      if (interim.trim()) {
        setHint(`${applySpeechCorrections(bufferRef.current)} ${interim}`.trim())
      }
    }
    rec.onerror = (ev) => {
      const code = ev.error || ''
      if (code === 'not-allowed') {
        setHint('Autorisez le micro')
        wantListenRef.current = false
        emitState(false)
        return
      }
      if (code === 'aborted' || code === 'no-speech') return
      setHint('Commande interrompue')
      wantListenRef.current = false
      clearSilence()
      emitState(false)
    }
    rec.onend = () => {
      if (wantListenRef.current) {
        try {
          rec.start()
          return
        } catch {
          wantListenRef.current = false
        }
      }
      clearSilence()
      emitState(false)
    }
    recRef.current = rec
    try {
      rec.start()
      emitState(true)
      setHint('Dites : stock, INT, appel, scan équipement… (corrigez avec « non plutôt »)')
      armSilence()
    } catch {
      setHint('Micro indisponible')
      wantListenRef.current = false
      emitState(false)
    }
  }

  useEffect(() => {
    const onToggle = () => {
      if (listeningRef.current) {
        if (bufferRef.current.trim()) finishBuffer()
        else stop()
      } else start()
    }
    const onHelp = () => {
      setShowHelp(true)
      setHint('Commandes vocales')
    }
    window.addEventListener('climazen:toggle-voice', onToggle)
    window.addEventListener('climazen:voice-help', onHelp)
    return () => {
      window.removeEventListener('climazen:toggle-voice', onToggle)
      window.removeEventListener('climazen:voice-help', onHelp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.chantiers, supported])

  if (!supported && !hint && !showHelp) return null

  if (!listening && !hint && !showHelp) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[3.75rem] z-30 flex justify-center px-3 md:top-16">
      <div className="pointer-events-auto max-w-[22rem] rounded-2xl border border-line bg-white/95 px-3 py-2 text-[11px] text-slate shadow-lg backdrop-blur">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium leading-snug">
            {listening ? (
              <span className="inline-flex items-center gap-1.5 text-rose-700">
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                <span className="min-w-0">{hint || 'Écoute…'}</span>
              </span>
            ) : (
              hint || 'Commandes :'
            )}
          </p>
          <button
            type="button"
            className="shrink-0 rounded p-0.5 text-muted hover:bg-mist"
            aria-label="Fermer"
            onClick={() => {
              if (listening) stop()
              setHint('')
              setShowHelp(false)
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {showHelp && (
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted">
            <li>stock / fluides</li>
            <li>appel / INT</li>
            <li>scan équipement</li>
            <li>scan bouteille</li>
            <li>GPS / Waze</li>
            <li>CERFA / sites / aide</li>
            <li>« non plutôt… » pour corriger</li>
          </ul>
        )}
      </div>
    </div>
  )
}
