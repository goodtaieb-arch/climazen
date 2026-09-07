import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import { openAddressInGps } from '../lib/mapsNav'
import { isOtCloture } from '../lib/ordreTravail'
import {
  SPEECH_COMMAND_SILENCE_MS,
  VOICE_WAKE_AUTO_KEY,
  applySpeechCorrections,
  appendSpeechChunk,
  cancelSpeech,
  getSpeechRecognitionCtor,
  isSpeechSupported,
  isTtsSupported,
  parseVoiceCommand,
  speakFr,
  textForVoiceReply,
  type SpeechRecognitionLike,
} from '../lib/speech'
import {
  AIDE_POINTAGE_VOIX,
  choisirOtPourDeplacement,
  isWakePhrase,
  otIdDepuisDernierPointage,
  parlerMesInterventions,
  parlerPointageConfirme,
  parseHandsFreeIntent,
  stripWakePhrase,
} from '../lib/voiceHandsFree'
import {
  POINTAGE_ACTION_LABELS,
  actionAutorisee,
  actionsSuivantes,
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
import { canUseChatbot, resolveAiTier } from '../lib/aiAccess'
import { APP_IS_BETA } from '../lib/buildStamp'

const VOICE_ACTIVATION_HINT_MS = 10_000
const WAKE_LISTEN_WINDOW_MS = 5000

/**
 * Main libre terrain — micro simple.
 * Appui micro → « Je vous écoute » → ordre → exécution → réécoute.
 * 5 s de silence sans parole → coupe (comme un second appui micro).
 * « Dis Lola » (veille) = même effet qu’un appui micro.
 */
export function VoiceCommandsFab() {
  const navigate = useNavigate()
  const { data, addPointageEvent, upsertOrdreTravail, appEdition } = useStore()
  const { user } = useAuth()
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [wakeHint, setWakeHint] = useState(false)
  const [hint, setHint] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const [needsActivation, setNeedsActivation] = useState(false)
  const [supported] = useState(() => isSpeechSupported())
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const wakeRecRef = useRef<SpeechRecognitionLike | null>(null)
  const listeningRef = useRef(false)
  const wantListenRef = useRef(false)
  const wakeWantRef = useRef(false)
  const speakingRef = useRef(false)
  const bufferRef = useRef('')
  const interimRef = useRef('')
  const pendingLeftoverRef = useRef('')
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wakeStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wakeActivationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activationHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dataRef = useRef(data)
  dataRef.current = data
  const aiOkRef = useRef(false)
  aiOkRef.current = canUseChatbot(
    resolveAiTier({ appEdition, aiPlan: data.aiPlan, isBeta: APP_IS_BETA }),
  )

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

  const clearWakeStop = () => {
    if (wakeStopTimerRef.current) {
      clearTimeout(wakeStopTimerRef.current)
      wakeStopTimerRef.current = null
    }
  }

  const clearWakeActivation = () => {
    if (wakeActivationTimerRef.current) {
      clearTimeout(wakeActivationTimerRef.current)
      wakeActivationTimerRef.current = null
    }
  }

  const clearActivationHint = () => {
    if (activationHintTimerRef.current) {
      clearTimeout(activationHintTimerRef.current)
      activationHintTimerRef.current = null
    }
  }

  const persistWake = (on: boolean) => {
    try {
      if (on) localStorage.setItem(VOICE_WAKE_AUTO_KEY, '1')
      else localStorage.removeItem(VOICE_WAKE_AUTO_KEY)
    } catch {
      /* ignore */
    }
  }

  const stopWake = () => {
    wakeWantRef.current = false
    clearWakeStop()
    clearWakeActivation()
    setWakeHint(false)
    try {
      wakeRecRef.current?.abort()
    } catch {
      /* ignore */
    }
    wakeRecRef.current = null
  }

  useEffect(() => {
    return () => {
      wantListenRef.current = false
      wakeWantRef.current = false
      clearSilence()
      clearWakeStop()
      clearWakeActivation()
      clearActivationHint()
      cancelSpeech()
      try {
        recRef.current?.abort()
      } catch {
        /* ignore */
      }
      try {
        wakeRecRef.current?.abort()
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
    speakFr(textForVoiceReply(text), {
      onEnd: () => {
        speakingRef.current = false
        setSpeaking(false)
        if (wantListenRef.current) {
          try {
            recRef.current?.start()
            emitState(true)
            setHint('Je vous écoute…')
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
      const next = actionsSuivantes(last)
        .slice(0, 4)
        .map((a) => POINTAGE_ACTION_LABELS[a])
        .join(', ')
      const lastLabel = last
        ? POINTAGE_ACTION_LABELS[last.action] || normaliserAction(last.action)
        : 'rien'
      replyAndResume(
        `Impossible après ${lastLabel}. Dis plutôt : ${next || 'trajet début ou déplacement'}.`,
      )
      return
    }

    let otId: string | undefined
    let chantierId: string | undefined
    const canonWanted = normaliserAction(action)
    const needsOt =
      (action === 'deplacement' && (cible === 'ot' || !cible)) ||
      canonWanted === 'intervention_en_cours' ||
      action === 'fin_intervention' ||
      canonWanted === 'pause' ||
      canonWanted === 'pause_repas'
    if (needsOt) {
      const fromLast = otIdDepuisDernierPointage(events, { userId: user.id, date: today }, last)
      const preferLast =
        fromLast &&
        (canonWanted === 'intervention_en_cours' ||
          action === 'fin_intervention' ||
          canonWanted === 'pause' ||
          canonWanted === 'pause_repas')
      const otPrefer = preferLast
        ? (d.ordresTravail || []).find((o) => o.id === fromLast.otId)
        : undefined
      const ot = otPrefer && !isOtCloture(otPrefer.statut)
        ? otPrefer
        : choisirOtPourDeplacement(d, user.id, today)
      if (
        !ot &&
        (canonWanted === 'intervention_en_cours' ||
          action === 'fin_intervention' ||
          (action === 'deplacement' && (cible === 'ot' || !cible)))
      ) {
        replyAndResume('Aucune intervention ouverte ne t’est affectée.')
        return
      }
      if (ot) {
        otId = ot.id
        chantierId = ot.chantierId || fromLast?.chantierId
      }
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
        chantierId: otForEvent ? chantierId : undefined,
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
      replyAndResume(parlerPointageConfirme(action, cibleFinal))
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
      stop({ disarmWake: true })
      speakFr('D’accord, j’arrête d’écouter.')
      return
    }
    if (intent.kind === 'aide_pointage') {
      replyAndResume(AIDE_POINTAGE_VOIX)
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

    // Phrase libre → Lola IA seulement si activée ; sinon message court (évite micro bloqué)
    if (!aiOkRef.current) {
      replyAndResume(
        'Je n’ai pas compris l’ordre. Dis par exemple : déplacement, en cours, pause, ou fin d’intervention.',
      )
      return
    }
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

  const stop = (opts?: { disarmWake?: boolean }) => {
    wantListenRef.current = false
    clearSilence()
    cancelSpeech()
    speakingRef.current = false
    setSpeaking(false)
    bufferRef.current = ''
    interimRef.current = ''
    pendingLeftoverRef.current = ''
    try {
      recRef.current?.abort()
    } catch {
      /* ignore */
    }
    emitState(false)
    if (opts?.disarmWake) {
      persistWake(false)
      stopWake()
    } else {
      // Arrêt réel : ne pas relancer un second micro de veille en boucle.
      persistWake(true)
      stopWake()
    }
  }

  const finishBuffer = () => {
    const raw = (bufferRef.current || interimRef.current).trim()
    bufferRef.current = ''
    interimRef.current = ''
    if (raw) {
      runTranscript(raw)
      return
    }
    // 5 s de silence sans ordre → comme un second appui sur le micro
    if (wantListenRef.current && !speakingRef.current) {
      stop()
      setHint('Micro coupé — retouchez le micro pour réessayer')
    }
  }

  const armSilence = () => {
    clearSilence()
    silenceTimerRef.current = setTimeout(() => {
      finishBuffer()
    }, SPEECH_COMMAND_SILENCE_MS)
  }

  /** Veille : n’écoute que « dis Lola » → même effet qu’un appui micro. */
  const startWake = () => {
    if (!supported || wantListenRef.current || speakingRef.current) return
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) return
    stopWake()
    const rec = new Ctor()
    rec.lang = 'fr-FR'
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 2
    wakeWantRef.current = true
    setWakeHint(true)
    setHint('Dis « Lola » — écoute pendant 5 secondes')
    let activatingCommand = false

    const finishWakeActivation = () => {
      if (!activatingCommand) return
      activatingCommand = false
      clearWakeActivation()
      wakeRecRef.current = null
      // L’ancien SpeechRecognition est maintenant terminé : le nouveau peut
      // prendre le micro sans provoquer InvalidStateError / audio-capture.
      wakeActivationTimerRef.current = setTimeout(() => {
        wakeActivationTimerRef.current = null
        if (!wantListenRef.current) start()
      }, 0)
    }

    const onHeard = (raw: string) => {
      if (!wakeWantRef.current || wantListenRef.current) return
      const text = applySpeechCorrections(raw)
      if (!isWakePhrase(text)) return
      const leftover = stripWakePhrase(text)
      pendingLeftoverRef.current = leftover
      activatingCommand = true
      wakeWantRef.current = false
      clearWakeStop()
      setWakeHint(false)
      setHint('Lola entendue — activation du micro…')
      // abort() est asynchrone dans Chrome. Attendre onend avant start()
      // évite que les deux instances de reconnaissance se disputent le micro.
      clearWakeActivation()
      wakeActivationTimerRef.current = setTimeout(finishWakeActivation, 600)
      try {
        rec.abort()
      } catch {
        finishWakeActivation()
      }
    }

    rec.onresult = (ev) => {
      if (!wakeWantRef.current || wantListenRef.current || speakingRef.current) return
      let interim = ''
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const result = ev.results[i]
        const piece = result?.[0]?.transcript || ''
        if (result?.isFinal) {
          onHeard(piece)
          return
        }
        interim += piece
      }
      if (interim.trim() && isWakePhrase(interim)) {
        onHeard(interim)
      }
    }
    rec.onerror = (ev) => {
      const code = ev.error || ''
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        wakeWantRef.current = false
        setWakeHint(false)
        persistWake(false)
        setNeedsActivation(true)
        setHint('Micro bloqué — autorisez-le dans les réglages du navigateur')
        return
      }
      if (code === 'audio-capture') {
        wakeWantRef.current = false
        setWakeHint(false)
        setNeedsActivation(true)
        setHint('Aucun micro détecté — vérifiez le micro du téléphone')
        return
      }
      if (code === 'aborted' || code === 'no-speech') return
    }
    rec.onend = () => {
      if (activatingCommand) {
        finishWakeActivation()
        return
      }
      if (!wakeWantRef.current || wantListenRef.current) return
      stopWake()
      setHint('')
    }
    wakeRecRef.current = rec
    try {
      rec.start()
      persistWake(true)
      clearActivationHint()
      setNeedsActivation(false)
      clearWakeStop()
      wakeStopTimerRef.current = setTimeout(() => {
        wakeStopTimerRef.current = null
        if (!wakeWantRef.current || wantListenRef.current) return
        stopWake()
        setHint('')
      }, WAKE_LISTEN_WINDOW_MS)
    } catch {
      wakeWantRef.current = false
      setWakeHint(false)
      setNeedsActivation(true)
      setHint('Touchez « Activer Dis Lola » pour autoriser le micro')
    }
  }

  const start = () => {
    if (!supported) {
      setHint('Vocal indisponible sur ce navigateur')
      return
    }
    stopWake()
    persistWake(true)
    setHint('')
    setShowHelp(false)
    setWakeHint(false)
    bufferRef.current = ''
    interimRef.current = ''
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
          bufferRef.current = appendSpeechChunk(bufferRef.current, piece)
          interimRef.current = ''
          setHint(applySpeechCorrections(bufferRef.current) || 'Écoute…')
        } else {
          interim += piece
        }
      }
      if (interim.trim()) {
        interimRef.current = interim.trim()
        setHint(`${applySpeechCorrections(bufferRef.current)} ${interim}`.trim())
      }
    }
    rec.onerror = (ev) => {
      const code = ev.error || ''
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setHint('Micro bloqué — autorisez-le dans les réglages du navigateur')
        wantListenRef.current = false
        emitState(false)
        persistWake(false)
        setNeedsActivation(true)
        return
      }
      if (code === 'aborted' || code === 'no-speech') return
      setHint('Commande interrompue')
      wantListenRef.current = false
      clearSilence()
      emitState(false)
    }
    rec.onend = () => {
      if (!wantListenRef.current) {
        clearSilence()
        emitState(false)
        return
      }
      if (speakingRef.current) return
      if ((bufferRef.current || interimRef.current).trim()) {
        if (!silenceTimerRef.current) finishBuffer()
        return
      }
      try {
        rec.start()
      } catch {
        try {
          start()
        } catch {
          wantListenRef.current = false
          emitState(false)
        }
      }
    }
    recRef.current = rec
    try {
      rec.start()
      emitState(true)
      clearActivationHint()
      setNeedsActivation(false)
      setHint(
        isTtsSupported() ? 'Comment je peux vous aider ?' : 'Main libre (voix orale indisponible)',
      )
      speakingRef.current = true
      setSpeaking(true)
      speakFr('Comment je peux vous aider ?', {
        onEnd: () => {
          speakingRef.current = false
          setSpeaking(false)
          if (!wantListenRef.current) return
          const leftover = pendingLeftoverRef.current.trim()
          pendingLeftoverRef.current = ''
          if (leftover) {
            runTranscript(leftover)
            return
          }
          setHint('Je vous écoute…')
          try {
            rec.start()
          } catch {
            /* déjà en écoute */
          }
          armSilence()
        },
      })
    } catch {
      setHint('Micro indisponible')
      wantListenRef.current = false
      emitState(false)
      setNeedsActivation(true)
    }
  }

  useEffect(() => {
    const onToggle = () => {
      if (listeningRef.current || speakingRef.current || wantListenRef.current) {
        if ((bufferRef.current || interimRef.current).trim() && !speakingRef.current) {
          finishBuffer()
        } else {
          stop({ disarmWake: false })
          setHint('Micro coupé — retouchez le micro pour réessayer')
          setShowHelp(false)
        }
      } else {
        stopWake()
        start()
      }
    }
    const onHelp = () => {
      setShowHelp(true)
      setHint('Main libre — micro ou « dis Lola »')
    }
    const onResume = () => {
      speakingRef.current = false
      setSpeaking(false)
      if (wantListenRef.current) {
        try {
          recRef.current?.start()
          emitState(true)
          setHint('Je vous écoute…')
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

  // Au chargement : veille automatique si le micro est déjà autorisé.
  // Sinon le navigateur exige un geste utilisateur : afficher l’activation 10 s.
  useEffect(() => {
    if (!supported || !user?.id) return
    let cancelled = false

    const showActivation = (message: string) => {
      if (cancelled) return
      setNeedsActivation(true)
      setHint(message)
      clearActivationHint()
      activationHintTimerRef.current = setTimeout(() => {
        activationHintTimerRef.current = null
        setNeedsActivation(false)
        setHint((current) => (current === message ? '' : current))
      }, VOICE_ACTIVATION_HINT_MS)
    }

    const tryWake = async () => {
      let prefer = false
      try {
        prefer = localStorage.getItem(VOICE_WAKE_AUTO_KEY) === '1'
      } catch {
        prefer = false
      }

      let permission: PermissionState | 'unknown' = 'unknown'
      if (navigator.permissions?.query) {
        try {
          const result = await navigator.permissions.query({
            name: 'microphone' as PermissionName,
          })
          permission = result.state
        } catch {
          permission = 'unknown'
        }
      }

      if (cancelled || wantListenRef.current) return
      if (permission === 'granted' || (permission === 'unknown' && prefer)) {
        startWake()
        return
      }
      showActivation(
        permission === 'denied'
          ? 'Micro bloqué — autorisez climazen.fr dans les réglages du navigateur'
          : 'Touchez une fois pour activer « Dis Lola »',
      )
    }
    void tryWake()
    return () => {
      cancelled = true
      clearActivationHint()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported, user?.id])

  if (!supported && !hint && !showHelp && !wakeHint && !needsActivation) return null
  if (!listening && !speaking && !hint && !showHelp && !wakeHint && !needsActivation) return null

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
            ) : wakeHint ? (
              <span className="inline-flex items-center gap-1.5 text-teal-800">
                <span className="min-w-0">{hint || 'Dis « Lola » pour le micro'}</span>
              </span>
            ) : (
              hint || 'Main libre :'
            )}
          </p>
          {needsActivation && !listening && !speaking && !wakeHint ? (
            <button
              type="button"
              className="shrink-0 rounded-lg bg-[#0f766e] px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-[#115e59]"
              onClick={() => {
                clearActivationHint()
                setNeedsActivation(false)
                startWake()
              }}
            >
              Activer Dis Lola
            </button>
          ) : null}
          <button
            type="button"
            className="shrink-0 rounded p-0.5 text-muted hover:bg-mist"
            aria-label="Fermer"
            onClick={() => {
              stop({ disarmWake: true })
              setHint('')
              setShowHelp(false)
              setNeedsActivation(false)
              clearActivationHint()
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {showHelp && (
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted">
            <li>Touche micro → « Je vous écoute » → donne l’ordre</li>
            <li>Au démarrage, « Dis Lola » écoute pendant 5 s</li>
            <li>Silence 5 s sans parole → micro coupé tout seul</li>
            <li>« Mets-moi en déplacement vers le site »</li>
            <li>« Je suis arrivé » / « en cours »</li>
            <li>« Pause » / « Arrête la pause »</li>
            <li>« Fin d’intervention » · « Fournisseur » · « Bureau »</li>
            <li>« Quelles interventions m’ont été affectées ? »</li>
            <li>« Stop » ou retouche micro pour couper</li>
          </ul>
        )}
      </div>
    </div>
  )
}
