import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import { openAddressInGps } from '../lib/mapsNav'
import { isOtCloture } from '../lib/ordreTravail'
import {
  SPEECH_COMMAND_SILENCE_MS,
  applySpeechCorrections,
  cancelSpeech,
  getSpeechRecognitionCtor,
  isSpeechSupported,
  isTtsSupported,
  parseVoiceCommand,
  speakFr,
  type SpeechRecognitionLike,
} from '../lib/speech'
import {
  choisirOtPourDeplacement,
  parlerMesInterventions,
  parlerPointageConfirme,
  parseHandsFreeIntent,
} from '../lib/voiceHandsFree'
import { pickSafetyTip } from '../lib/safetyTips'
import {
  POINTAGE_ACTION_LABELS,
  actionAutorisee,
  arrondirDate,
  capturerGeoPonctuel,
  datePointageLocale,
  dernierPointage,
  normaliserAction,
  parsePointageEvents,
  parsePointageRegles,
  pointageEstActif,
  statutOtDepuisAction,
  type PointageAction,
  type PointageCible,
} from '../lib/pointage'
import { resetAlarmePauseRepas } from '../lib/pauseRepasAlarme'

/**
 * Main libre terrain — micro en-tête.
 * Écoute → intents (mes INT, pointage) ou Lola → réponse orale → réécoute.
 */
export function VoiceCommandsFab() {
  const navigate = useNavigate()
  const { data, addPointageEvent, upsertOrdreTravail } = useStore()
  const { user } = useAuth()
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [hint, setHint] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const [supported] = useState(() => isSpeechSupported())
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const listeningRef = useRef(false)
  const wantListenRef = useRef(false)
  const speakingRef = useRef(false)
  const bufferRef = useRef('')
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dataRef = useRef(data)
  dataRef.current = data

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
      cancelSpeech()
      try {
        recRef.current?.abort()
      } catch {
        /* ignore */
      }
    }
  }, [])

  const pauseRec = () => {
    clearSilence()
    try {
      recRef.current?.stop()
    } catch {
      /* ignore */
    }
  }

  const replyAndResume = (text: string, alsoHint?: string) => {
    setHint(alsoHint || text.slice(0, 80))
    speakingRef.current = true
    setSpeaking(true)
    pauseRec()
    speakFr(text, {
      onEnd: () => {
        speakingRef.current = false
        setSpeaking(false)
        if (wantListenRef.current) {
          // Relance gérée par onend du recognition + start()
          try {
            recRef.current?.start()
            emitState(true)
            setHint('Je t’écoute…')
            armSilence()
          } catch {
            start()
          }
        }
      },
    })
  }

  const openAide = () => {
    window.dispatchEvent(new CustomEvent('climazen:open-aide'))
  }

  const openGps = () => {
    const sites = [...(dataRef.current.chantiers || [])].reverse()
    const withAddr = sites.find((s) => s.adresse || s.ville || s.codePostal)
    if (!withAddr) {
      replyAndResume('Aucun site avec adresse. Ouvre Sites.', 'Aucun site avec adresse')
      navigate('/app/chantiers')
      return
    }
    const ok = openAddressInGps({
      adresse: withAddr.adresse,
      codePostal: withAddr.codePostal,
      ville: withAddr.ville,
    })
    replyAndResume(
      ok ? `GPS ouvert pour ${withAddr.nom || withAddr.ville || 'le site'}.` : 'Adresse GPS invalide.',
    )
  }

  const punchVoice = async (action: PointageAction, cible?: PointageCible) => {
    const d = dataRef.current
    if (!user?.id) {
      replyAndResume('Connecte-toi pour pointer.')
      return
    }
    const regles = parsePointageRegles(d.pointageRegles)
    if (!pointageEstActif(regles)) {
      replyAndResume('La pointeuse est coupée par le bureau.')
      return
    }
    const today = datePointageLocale()
    const events = parsePointageEvents(d.pointageEvents)
    const last = dernierPointage(events, { userId: user.id, date: today })
    if (!actionAutorisee(last, action)) {
      replyAndResume(
        `Impossible après ${last ? POINTAGE_ACTION_LABELS[last.action] : 'rien'}.`,
      )
      return
    }

    let otId: string | undefined
    let chantierId: string | undefined
    const needsOt =
      (action === 'deplacement' && (cible === 'ot' || !cible)) ||
      action === 'intervention_en_cours' ||
      action === 'fin_intervention'
    if (needsOt) {
      const ot = choisirOtPourDeplacement(d, user.id, today)
      if (!ot) {
        replyAndResume('Aucune intervention ouverte ne t’est affectée.')
        return
      }
      otId = ot.id
      chantierId = ot.chantierId
    }

    try {
      const geoRes = await capturerGeoPonctuel()
      const at = arrondirDate(new Date(), regles.arrondiMinutes).toISOString()
      const canon = normaliserAction(action)
      const cibleFinal =
        cible ||
        (action === 'fournisseur'
          ? 'fournisseur'
          : action === 'bureau'
            ? 'bureau'
            : action === 'deplacement'
              ? 'ot'
              : undefined)
      const otForEvent =
        canon === 'sortie_domicile' || canon === 'retour_domicile' || cibleFinal === 'hors_ot'
          ? undefined
          : otId
      addPointageEvent({
        userId: user.id,
        userName: user.fullName || user.email || 'Technicien',
        action,
        at,
        date: today,
        geo: geoRes.ok ? geoRes.geo : undefined,
        geoRefused: !geoRes.ok && geoRes.refused,
        geoError: geoRes.ok ? undefined : geoRes.message,
        otId: otForEvent,
        chantierId,
        cible: cibleFinal,
      })
      const nextStatut = statutOtDepuisAction(action, cibleFinal)
      if (nextStatut && otId) {
        const ot = (d.ordresTravail || []).find((o) => o.id === otId)
        if (ot && !isOtCloture(ot.statut) && ot.statut !== nextStatut) {
          upsertOrdreTravail({ ...ot, statut: nextStatut })
        }
      }
      if (canon === 'intervention_en_cours') resetAlarmePauseRepas()
      const confirm = parlerPointageConfirme(action, cibleFinal)
      const tip = pickSafetyTip({
        lastAction: action,
        ot: otId ? (d.ordresTravail || []).find((o) => o.id === otId) || null : null,
        site: chantierId
          ? d.chantiers.find((c) => c.id === chantierId) || null
          : null,
      })
      replyAndResume(`${confirm} ${tip.speak}`)
    } catch {
      replyAndResume('Pointage impossible pour le moment.')
    }
  }

  const runTranscript = (raw: string) => {
    const cleaned = applySpeechCorrections(raw)
    if (!cleaned.trim()) {
      if (wantListenRef.current) armSilence()
      return
    }

    const intent = parseHandsFreeIntent(cleaned)
    if (intent.kind === 'stop') {
      setHint('Écoute arrêtée')
      stop()
      speakFr('D’accord, j’arrête d’écouter.')
      return
    }
    if (intent.kind === 'mes_int') {
      replyAndResume(parlerMesInterventions(dataRef.current, user?.id))
      return
    }
    if (intent.kind === 'pointage') {
      void punchVoice(intent.action, intent.cible)
      return
    }

    const cmd = parseVoiceCommand(cleaned)
    if (cmd) {
      if (cmd.id === 'aide') {
        openAide()
        replyAndResume('J’ouvre Lola.')
        return
      }
      if (cmd.id === 'gps') {
        openGps()
        return
      }
      if (cmd.path) navigate(cmd.path)
      replyAndResume(`OK. ${cmd.label}.`)
      return
    }

    // Phrase libre → Lola (réponse orale)
    setHint(`Lola : « ${cleaned.slice(0, 40)}… »`)
    speakingRef.current = true
    setSpeaking(true)
    pauseRec()
    window.dispatchEvent(
      new CustomEvent('climazen:aide-voice', {
        detail: { text: cleaned, speak: true },
      }),
    )
  }

  const stop = () => {
    wantListenRef.current = false
    clearSilence()
    cancelSpeech()
    speakingRef.current = false
    setSpeaking(false)
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
    else if (wantListenRef.current && !speakingRef.current) armSilence()
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
      if (!wantListenRef.current || speakingRef.current) return
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
      if (wantListenRef.current && !speakingRef.current) {
        try {
          rec.start()
          return
        } catch {
          wantListenRef.current = false
        }
      }
      if (!wantListenRef.current) {
        clearSilence()
        emitState(false)
      }
    }
    recRef.current = rec
    try {
      rec.start()
      emitState(true)
      setHint(
        isTtsSupported()
          ? 'Main libre — réponses à voix haute'
          : 'Main libre — réponses à l’écran (voix orale indisponible)',
      )
      speakingRef.current = true
      setSpeaking(true)
      speakFr(
        'Main libre activée. Demande tes interventions, ou dis mets-moi en déplacement vers le site.',
        {
          onEnd: () => {
            speakingRef.current = false
            setSpeaking(false)
            if (wantListenRef.current) {
              setHint('Je t’écoute…')
              try {
                rec.start()
              } catch {
                /* déjà en écoute */
              }
              armSilence()
            }
          },
        },
      )
    } catch {
      setHint('Micro indisponible')
      wantListenRef.current = false
      emitState(false)
    }
  }

  useEffect(() => {
    const onToggle = () => {
      if (listeningRef.current || speakingRef.current) {
        if (bufferRef.current.trim() && !speakingRef.current) finishBuffer()
        else stop()
      } else start()
    }
    const onHelp = () => {
      setShowHelp(true)
      setHint('Main libre Lola')
    }
    const onResume = () => {
      speakingRef.current = false
      setSpeaking(false)
      if (wantListenRef.current) {
        try {
          recRef.current?.start()
          emitState(true)
          setHint('Je t’écoute…')
          armSilence()
        } catch {
          start()
        }
      }
    }
    const onSpoke = (e: Event) => {
      const detail = (e as CustomEvent<{ text?: string }>).detail
      if (detail?.text) setHint(detail.text.slice(0, 80))
    }
    window.addEventListener('climazen:toggle-voice', onToggle)
    window.addEventListener('climazen:voice-help', onHelp)
    window.addEventListener('climazen:voice-resume', onResume)
    window.addEventListener('climazen:voice-spoke', onSpoke)
    return () => {
      window.removeEventListener('climazen:toggle-voice', onToggle)
      window.removeEventListener('climazen:voice-help', onHelp)
      window.removeEventListener('climazen:voice-resume', onResume)
      window.removeEventListener('climazen:voice-spoke', onSpoke)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported, user?.id])

  if (!supported && !hint && !showHelp) return null
  if (!listening && !speaking && !hint && !showHelp) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[3.75rem] z-30 flex justify-center px-3 md:top-16">
      <div className="pointer-events-auto max-w-[22rem] rounded-2xl border border-line bg-white/95 px-3 py-2 text-[11px] text-slate shadow-lg backdrop-blur">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium leading-snug">
            {listening || speaking ? (
              <span
                className={`inline-flex items-center gap-1.5 ${speaking ? 'text-sky-800' : 'text-rose-700'}`}
              >
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                <span className="min-w-0">
                  {speaking ? 'Lola parle… ' : ''}
                  {hint || (speaking ? '' : 'Écoute…')}
                </span>
              </span>
            ) : (
              hint || 'Main libre :'
            )}
          </p>
          <button
            type="button"
            className="shrink-0 rounded p-0.5 text-muted hover:bg-mist"
            aria-label="Fermer"
            onClick={() => {
              stop()
              setHint('')
              setShowHelp(false)
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {showHelp && (
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted">
            <li>« Quelles interventions m’ont été affectées ? »</li>
            <li>« Mets-moi en déplacement vers le site »</li>
            <li>« Déplacement vers le fournisseur »</li>
            <li>« Je suis arrivé » / « Pause repas »</li>
            <li>Autres questions → Lola répond à voix haute</li>
            <li>« Stop » pour couper l’écoute</li>
            <li>Après un pointage : rappel sécurité lu à voix haute</li>
          </ul>
        )}
      </div>
    </div>
  )
}
