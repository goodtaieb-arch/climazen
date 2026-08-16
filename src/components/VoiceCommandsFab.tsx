import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Mic, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { openAddressInGps } from '../lib/mapsNav'
import {
  getSpeechRecognitionCtor,
  isSpeechSupported,
  parseVoiceCommand,
  type SpeechRecognitionLike,
} from '../lib/speech'

/**
 * FAB gauche : commandes vocales terrain
 * (stock, OT, appel, scan, GPS, CERFA, sites, aide).
 */
export function VoiceCommandsFab() {
  const navigate = useNavigate()
  const { data } = useStore()
  const [listening, setListening] = useState(false)
  const [hint, setHint] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const recRef = useRef<SpeechRecognitionLike | null>(null)

  useEffect(() => {
    return () => {
      try {
        recRef.current?.abort()
      } catch {
        /* ignore */
      }
    }
  }, [])

  if (!isSpeechSupported()) return null

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
    setListening(false)
  }

  const start = () => {
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
      setListening(false)
    }
    rec.onend = () => setListening(false)
    recRef.current = rec
    try {
      rec.start()
      setListening(true)
      setHint('Dites : stock, OT, appel, scan, GPS…')
    } catch {
      setHint('Micro indisponible')
      setListening(false)
    }
  }

  const style = {
    bottom: 'calc(4.75rem + env(safe-area-inset-bottom, 0px))',
    left: 'max(1rem, env(safe-area-inset-left, 0px))',
  } as const

  return (
    <div className="pointer-events-none fixed z-30 md:hidden" style={style}>
      <div className="pointer-events-auto flex flex-col items-start gap-2">
        {(hint || showHelp) && (
          <div className="max-w-[14rem] rounded-2xl border border-line bg-white/95 px-3 py-2 text-[11px] text-slate shadow-lg backdrop-blur">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium leading-snug">{hint || 'Commandes :'}</p>
              <button
                type="button"
                className="shrink-0 rounded p-0.5 text-muted hover:bg-mist"
                aria-label="Fermer"
                onClick={() => {
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
                <li>scan bouteille</li>
                <li>GPS / Waze</li>
                <li>CERFA / sites / aide</li>
              </ul>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => (listening ? stop() : start())}
          onContextMenu={(e) => {
            e.preventDefault()
            setShowHelp(true)
            setHint('Commandes vocales')
          }}
          className={
            listening
              ? 'inline-flex h-12 w-12 items-center justify-center rounded-full bg-rose-600 text-white shadow-[0_8px_24px_rgba(225,29,72,0.45)]'
              : 'inline-flex h-12 w-12 items-center justify-center rounded-full border border-line bg-white text-[#0f766e] shadow-[0_8px_24px_rgba(15,23,42,0.12)]'
          }
          aria-label={listening ? 'Arrêter la commande vocale' : 'Commande vocale'}
          aria-pressed={listening}
          title="Maintenir / appuyer : commande vocale (appui long : aide)"
        >
          {listening ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mic className="h-5 w-5" />}
        </button>
      </div>
    </div>
  )
}
