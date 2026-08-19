import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { openAddressInGps } from '../lib/mapsNav'
import {
  getSpeechRecognitionCtor,
  isSpeechSupported,
  parseVoiceCommand,
  type SpeechRecognitionLike,
} from '../lib/speech'

/**
 * Commandes vocales terrain — déclenchées depuis l’en-tête (pas de FAB bas).
 * Écoute : climazen:toggle-voice / climazen:voice-help
 * Diffuse : climazen:voice-state { listening }
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

  const emitState = (on: boolean) => {
    listeningRef.current = on
    setListening(on)
    window.dispatchEvent(new CustomEvent('climazen:voice-state', { detail: { listening: on } }))
  }

  useEffect(() => {
    return () => {
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
    const cmd = parseVoiceCommand(raw)
    if (!cmd) {
      setHint(`Non compris : « ${raw.slice(0, 48)} »`)
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
    try {
      recRef.current?.stop()
    } catch {
      /* ignore */
    }
    emitState(false)
  }

  const start = () => {
    if (!supported) {
      setHint('Vocal indisponible sur ce navigateur')
      return
    }
    setHint('')
    setShowHelp(false)
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) return
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
      if (transcript) runTranscript(transcript)
    }
    rec.onerror = (ev) => {
      const code = ev.error || ''
      if (code === 'not-allowed') setHint('Autorisez le micro')
      else if (code === 'no-speech') setHint('Parlez après le bip')
      else if (code && code !== 'aborted') setHint('Commande interrompue')
      emitState(false)
    }
    rec.onend = () => emitState(false)
    recRef.current = rec
    try {
      rec.start()
      emitState(true)
      setHint('Dites : stock, OT, appel, scan équipement, GPS…')
    } catch {
      setHint('Micro indisponible')
      emitState(false)
    }
  }

  useEffect(() => {
    const onToggle = () => {
      if (listeningRef.current) stop()
      else start()
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

  // Bannière discrète en haut quand écoute / aide — pas de FAB bas d’écran
  if (!listening && !hint && !showHelp) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[3.75rem] z-30 flex justify-center px-3 md:top-16">
      <div className="pointer-events-auto max-w-[20rem] rounded-2xl border border-line bg-white/95 px-3 py-2 text-[11px] text-slate shadow-lg backdrop-blur">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium leading-snug">
            {listening ? (
              <span className="inline-flex items-center gap-1.5 text-rose-700">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {hint || 'Écoute…'}
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
            <li>appel / OT</li>
            <li>scan équipement</li>
            <li>scan bouteille</li>
            <li>GPS / Waze</li>
            <li>CERFA / sites / aide</li>
          </ul>
        )}
      </div>
    </div>
  )
}
