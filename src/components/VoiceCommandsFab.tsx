import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import { openAddressInGps } from '../lib/mapsNav'
import { isOtCloture } from '../lib/ordreTravail'
import {
  SPEECH_COMMAND_FAST_MS,
  SPEECH_COMMAND_SILENCE_MS,
  SPEECH_RESTART_DELAY_MS,
  VOICE_WAKE_AUTO_KEY,
  applySpeechCorrections,
  appendSpeechChunk,
  cancelSpeech,
  getSpeechRecognitionCtor,
  isSpeechSupported,
  isTtsSupported,
  parseVoiceCommand,
  speakFr,
  type SpeechRecognitionLike,
} from '../lib/speech'
import {
  AIDE_POINTAGE_VOIX,
  choisirOtPourDeplacement,
  isDirectHandsFreeCommand,
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

type VoiceMode = 'off' | 'wake' | 'active'

/** Coupe la veille si aucune activation « Lola » pendant ce délai. */
const WAKE_IDLE_STOP_MS = 60_000
/** Si Lola IA ne répond pas, relâche le micro. */
const AIDE_VOICE_TIMEOUT_MS = 12_000
/** En écoute active : silence vide → coupe le micro (plus de boucle infinie). */
const ACTIVE_IDLE_STOP_MS = 8_000

const LOLA_IA_OFF_ORAL =
  'Lola n’est pas activée sur ce compte. Tu peux pointer à la voix : déplacement, en cours, pause, fin d’intervention. Dis stop pour couper le micro.'

/**
 * Main libre terrain — micro en-tête.
 * Bouton micro → écoute active immédiate (commandes).
 * Veille « dis Lola » après une réponse, ou auto si déjà armée.
 */
export function VoiceCommandsFab() {
  const navigate = useNavigate()
  const { data, addPointageEvent, upsertOrdreTravail, appEdition } = useStore()
  const { user } = useAuth()
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [hint, setHint] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const [supported] = useState(() => isSpeechSupported())
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const modeRef = useRef<VoiceMode>('off')
  const listeningRef = useRef(false)
  const speakingRef = useRef(false)
  const bufferRef = useRef('')
  const interimRef = useRef('')
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wakeIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dataRef = useRef(data)
  dataRef.current = data
  const aiTierRef = useRef(resolveAiTier({ appEdition, aiPlan: data.aiPlan, isBeta: APP_IS_BETA }))
  aiTierRef.current = resolveAiTier({ appEdition, aiPlan: data.aiPlan, isBeta: APP_IS_BETA })

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

  const clearRestart = () => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current)
      restartTimerRef.current = null
    }
  }

  const clearWakeIdle = () => {
    if (wakeIdleTimerRef.current) {
      clearTimeout(wakeIdleTimerRef.current)
      wakeIdleTimerRef.current = null
    }
  }

  const clearActiveIdle = () => {
    if (activeIdleTimerRef.current) {
      clearTimeout(activeIdleTimerRef.current)
      activeIdleTimerRef.current = null
    }
  }

  const clearAideTimeout = () => {
    if (aideTimeoutRef.current) {
      clearTimeout(aideTimeoutRef.current)
      aideTimeoutRef.current = null
    }
  }

  const clearAllTimers = () => {
    clearSilence()
    clearRestart()
    clearWakeIdle()
    clearActiveIdle()
    clearAideTimeout()
  }

  const armWakeIdle = () => {
    clearWakeIdle()
    if (modeRef.current !== 'wake') return
    wakeIdleTimerRef.current = setTimeout(() => {
      wakeIdleTimerRef.current = null
      if (modeRef.current !== 'wake') return
      hardStop('Veille coupée — retouche le micro')
    }, WAKE_IDLE_STOP_MS)
  }

  const armActiveIdle = () => {
    clearActiveIdle()
    if (modeRef.current !== 'active') return
    activeIdleTimerRef.current = setTimeout(() => {
      activeIdleTimerRef.current = null
      if (modeRef.current !== 'active' || speakingRef.current) return
      // Pas de parole utile → coupe (évite micro qui tourne sans fin)
      if (!(bufferRef.current.trim() || interimRef.current.trim())) {
        hardStop('Écoute terminée')
      }
    }, ACTIVE_IDLE_STOP_MS)
  }

  const persistWakeAuto = (on: boolean) => {
    try {
      if (on) localStorage.setItem(VOICE_WAKE_AUTO_KEY, '1')
      else localStorage.removeItem(VOICE_WAKE_AUTO_KEY)
    } catch {
      /* ignore */
    }
  }

  const hardStop = (msg?: string) => {
    modeRef.current = 'off'
    persistWakeAuto(false)
    clearAllTimers()
    cancelSpeech()
    speakingRef.current = false
    setSpeaking(false)
    bufferRef.current = ''
    interimRef.current = ''
    try {
      recRef.current?.abort()
    } catch {
      /* ignore */
    }
    emitState(false)
    if (msg) setHint(msg)
  }

  useEffect(() => {
    return () => {
      modeRef.current = 'off'
      clearAllTimers()
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
    clearRestart()
    clearActiveIdle()
    try {
      recRef.current?.stop()
    } catch {
      /* ignore */
    }
  }

  const scheduleRecStart = (why: 'resume' | 'restart') => {
    if (modeRef.current === 'off' || speakingRef.current) return
    clearRestart()
    // Veille : plus long entre deux start() → moins de bips micro Chrome
    const delay =
      why === 'restart'
        ? modeRef.current === 'wake'
          ? Math.max(SPEECH_RESTART_DELAY_MS, 2800)
          : SPEECH_RESTART_DELAY_MS
        : 80
    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null
      if (modeRef.current === 'off' || speakingRef.current) return
      try {
        recRef.current?.start()
        emitState(true)
        if (modeRef.current === 'wake') {
          setHint('Veille — dis « Lola »')
        } else {
          setHint('Je vous écoute…')
          armSilence()
          armActiveIdle()
        }
      } catch {
        // Déjà en écoute, ou session morte → recreate
        beginRecognition(modeRef.current === 'active' ? 'active' : 'wake', { greet: false })
      }
    }, delay)
  }

  const enterWake = (opts?: { hint?: string }) => {
    modeRef.current = 'wake'
    persistWakeAuto(true)
    bufferRef.current = ''
    interimRef.current = ''
    clearSilence()
    clearActiveIdle()
    clearAideTimeout()
    setHint(opts?.hint || 'Veille — dis « Lola »')
    armWakeIdle()
    scheduleRecStart('resume')
  }

  const enterActive = (opts?: { greet?: boolean; leftover?: string }) => {
    modeRef.current = 'active'
    persistWakeAuto(true)
    bufferRef.current = ''
    interimRef.current = ''
    clearWakeIdle()
    clearAideTimeout()
    if (opts?.leftover?.trim()) {
      runTranscript(opts.leftover)
      return
    }
    if (opts?.greet !== false) {
      setHint('Je vous écoute…')
      speakingRef.current = true
      setSpeaking(true)
      pauseRec()
      speakFr('Je vous écoute.', {
        onEnd: () => {
          speakingRef.current = false
          setSpeaking(false)
          if (modeRef.current !== 'active') return
          setHint('Je vous écoute…')
          scheduleRecStart('resume')
        },
      })
      return
    }
    setHint('Je vous écoute…')
    scheduleRecStart('resume')
  }

  /** Réponse orale puis retour veille (évite écoute active infinie + bips). */
  const replyAndResume = (text: string, alsoHint?: string) => {
    clearAideTimeout()
    setHint(alsoHint || text.slice(0, 80))
    speakingRef.current = true
    setSpeaking(true)
    pauseRec()
    speakFr(text, {
      onEnd: () => {
        speakingRef.current = false
        setSpeaking(false)
        if (modeRef.current === 'off') return
        enterWake({ hint: 'Veille — dis « Lola »' })
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
      if (!ot && (canonWanted === 'intervention_en_cours' || action === 'fin_intervention' || (action === 'deplacement' && (cible === 'ot' || !cible)))) {
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
      if (modeRef.current === 'active') enterWake()
      else if (modeRef.current === 'wake') armSilence()
      return
    }

    const intent = parseHandsFreeIntent(cleaned)
    if (intent.kind === 'stop') {
      setHint('Écoute arrêtée')
      stop()
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

    // Phrase libre → Lola IA (si activée), sinon message oral clair
    if (!canUseChatbot(aiTierRef.current)) {
      replyAndResume(LOLA_IA_OFF_ORAL)
      return
    }
    setHint(`Lola : « ${cleaned.slice(0, 40)}… »`)
    speakingRef.current = true
    setSpeaking(true)
    pauseRec()
    clearAideTimeout()
    aideTimeoutRef.current = setTimeout(() => {
      aideTimeoutRef.current = null
      if (modeRef.current === 'off' || !speakingRef.current) return
      replyAndResume(
        'Pas de réponse de Lola. Dis stop pour couper, ou dis Lola pour réessayer.',
      )
    }, AIDE_VOICE_TIMEOUT_MS)
    window.dispatchEvent(
      new CustomEvent('climazen:aide-voice', {
        detail: { text: cleaned, speak: true },
      }),
    )
  }

  const stop = () => {
    hardStop()
  }

  const finishBuffer = () => {
    const raw = (bufferRef.current || interimRef.current).trim()
    bufferRef.current = ''
    interimRef.current = ''
    const mode = modeRef.current
    if (!raw) {
      // Silence sans parole en actif → coupe le micro (demande utilisateur)
      if (mode === 'active') hardStop('Écoute terminée')
      return
    }

    if (mode === 'wake') {
      if (isWakePhrase(raw)) {
        const leftover = stripWakePhrase(raw)
        enterActive({ greet: !leftover, leftover: leftover || undefined })
        return
      }
      // Micro en veille mais ordre terrain clair → exécuter quand même
      if (isDirectHandsFreeCommand(raw)) {
        modeRef.current = 'active'
        clearWakeIdle()
        runTranscript(raw)
        return
      }
      setHint('Veille — dis « Lola »')
      armWakeIdle()
      return
    }

    // Mode actif
    const withoutWake = isWakePhrase(raw) ? stripWakePhrase(raw) : raw
    if (!withoutWake) {
      setHint('Je vous écoute…')
      armSilence()
      armActiveIdle()
      return
    }
    runTranscript(withoutWake)
  }

  const armSilence = (ms = SPEECH_COMMAND_SILENCE_MS) => {
    clearSilence()
    if (modeRef.current === 'wake') return
    silenceTimerRef.current = setTimeout(() => {
      finishBuffer()
    }, ms)
  }

  const beginRecognition = (mode: 'wake' | 'active', opts?: { greet?: boolean }) => {
    if (!supported) {
      setHint('Vocal indisponible sur ce navigateur')
      return
    }
    setHint('')
    setShowHelp(false)
    bufferRef.current = ''
    interimRef.current = ''
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) return
    clearRestart()
    clearSilence()
    clearActiveIdle()
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
    modeRef.current = mode
    persistWakeAuto(true)

    rec.onresult = (ev) => {
      if (modeRef.current === 'off' || speakingRef.current) return
      let interim = ''
      let gotFinal = false
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const result = ev.results[i]
        const piece = result?.[0]?.transcript || ''
        if (result?.isFinal) {
          gotFinal = true
          bufferRef.current = appendSpeechChunk(bufferRef.current, piece)
          interimRef.current = ''
          const preview = applySpeechCorrections(bufferRef.current)
          if (modeRef.current === 'wake') {
            setHint(preview ? `Veille : « ${preview.slice(0, 36)} »` : 'Veille — dis « Lola »')
            armWakeIdle()
            if (isWakePhrase(preview) && !stripWakePhrase(preview)) {
              clearSilence()
              finishBuffer()
              return
            }
            if (isWakePhrase(preview) && stripWakePhrase(preview)) {
              clearSilence()
              silenceTimerRef.current = setTimeout(() => finishBuffer(), SPEECH_COMMAND_FAST_MS)
              return
            }
            // Ordre terrain sans « Lola » pendant la veille → exécuter
            if (isDirectHandsFreeCommand(preview)) {
              clearSilence()
              silenceTimerRef.current = setTimeout(() => finishBuffer(), SPEECH_COMMAND_FAST_MS)
            }
          } else {
            setHint(preview || 'Écoute…')
            clearActiveIdle()
            const fast =
              isDirectHandsFreeCommand(preview) || Boolean(parseVoiceCommand(preview))
            armSilence(fast ? SPEECH_COMMAND_FAST_MS : SPEECH_COMMAND_SILENCE_MS)
            armActiveIdle()
          }
        } else {
          interim += piece
        }
      }
      if (interim.trim()) {
        interimRef.current = interim.trim()
        const base = applySpeechCorrections(bufferRef.current)
        const shown = `${base} ${interim}`.trim()
        setHint(
          modeRef.current === 'wake'
            ? `Veille : « ${shown.slice(0, 36)} »`
            : shown,
        )
        if (modeRef.current === 'active') {
          // Relance le silence même sur interim (sinon texte affiché jamais exécuté)
          if (!gotFinal) {
            armSilence(SPEECH_COMMAND_SILENCE_MS)
            armActiveIdle()
          }
        } else if (modeRef.current === 'wake') {
          armWakeIdle()
          const maybe = applySpeechCorrections(`${bufferRef.current} ${interim}`.trim())
          if (isWakePhrase(maybe) || isDirectHandsFreeCommand(maybe)) {
            clearSilence()
            silenceTimerRef.current = setTimeout(() => finishBuffer(), SPEECH_COMMAND_SILENCE_MS)
          }
        }
      }
    }
    rec.onerror = (ev) => {
      const code = ev.error || ''
      if (code === 'not-allowed') {
        hardStop('Autorisez le micro')
        return
      }
      if (code === 'aborted' || code === 'no-speech') return
      hardStop('Commande interrompue')
    }
    rec.onend = () => {
      if (modeRef.current === 'off' || speakingRef.current) {
        if (modeRef.current === 'off') {
          clearAllTimers()
          emitState(false)
        }
        return
      }
      // Flush si du texte est en attente et qu’aucun timer silence ne va le traiter
      if ((bufferRef.current || interimRef.current).trim()) {
        if (silenceTimerRef.current) return
        finishBuffer()
        return
      }
      scheduleRecStart('restart')
    }
    recRef.current = rec
    try {
      rec.start()
      emitState(true)
      if (mode === 'wake') {
        setHint('Veille — dis « Lola »')
        armWakeIdle()
      } else if (opts?.greet !== false) {
        setHint(
          isTtsSupported()
            ? 'Je vous écoute…'
            : 'Main libre (voix orale indisponible)',
        )
        speakingRef.current = true
        setSpeaking(true)
        speakFr('Je vous écoute.', {
          onEnd: () => {
            speakingRef.current = false
            setSpeaking(false)
            if (modeRef.current === 'active') {
              setHint('Je vous écoute…')
              scheduleRecStart('resume')
            }
          },
        })
      } else {
        setHint('Je vous écoute…')
        armSilence()
        armActiveIdle()
      }
    } catch {
      hardStop('Micro indisponible')
    }
  }

  useEffect(() => {
    const onToggle = () => {
      if (modeRef.current !== 'off' || speakingRef.current) {
        if (bufferRef.current.trim() || interimRef.current.trim()) {
          if (!speakingRef.current) finishBuffer()
          else {
            hardStop()
            setHint('')
            setShowHelp(false)
          }
        } else {
          hardStop()
          setHint('')
          setShowHelp(false)
        }
      } else {
        // Bouton micro → écoute ACTIVE tout de suite (plus de veille bloquante)
        beginRecognition('active', { greet: true })
      }
    }
    const onHelp = () => {
      setShowHelp(true)
      setHint('Main libre Lola')
    }
    const onResume = () => {
      clearAideTimeout()
      speakingRef.current = false
      setSpeaking(false)
      if (modeRef.current === 'off') return
      enterWake({ hint: 'Veille — dis « Lola »' })
    }
    const onSpoke = (e: Event) => {
      clearAideTimeout()
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

  // Auto-veille si le micro est déjà autorisé + préférence « wake auto »
  useEffect(() => {
    if (!supported || !user?.id) return
    let cancelled = false
    const tryAuto = async () => {
      let prefer = false
      try {
        prefer = localStorage.getItem(VOICE_WAKE_AUTO_KEY) === '1'
      } catch {
        prefer = false
      }
      if (!prefer || cancelled) return
      let granted = false
      try {
        const perm = await navigator.permissions?.query({
          name: 'microphone' as PermissionName,
        })
        granted = perm?.state === 'granted'
      } catch {
        granted = true
      }
      if (!granted || cancelled || modeRef.current !== 'off') return
      beginRecognition('wake')
    }
    void tryAuto()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported, user?.id])

  if (!supported && !hint && !showHelp) return null
  if (!listening && !speaking && !hint && !showHelp) return null

  const mode = modeRef.current
  const wakeBanner = mode === 'wake' && (listening || Boolean(hint))

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[3.75rem] z-30 flex justify-center px-3 md:top-16">
      <div className="pointer-events-auto max-w-[22rem] rounded-2xl border border-line bg-white/95 px-3 py-2 text-[11px] text-slate shadow-lg backdrop-blur">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium leading-snug">
            {listening || speaking ? (
              <span
                className={`inline-flex items-center gap-1.5 ${
                  speaking ? 'text-sky-800' : wakeBanner ? 'text-teal-800' : 'text-rose-700'
                }`}
              >
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                <span className="min-w-0">
                  {speaking ? 'Lola parle… ' : ''}
                  {hint || (speaking ? '' : wakeBanner ? 'Veille — dis « Lola »' : 'Écoute…')}
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
              hardStop()
              setHint('')
              setShowHelp(false)
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {showHelp && (
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted">
            <li>Touche micro → « Je vous écoute » puis donne l’ordre</li>
            <li>« Dis Lola » en veille pour réactiver sans retoucher</li>
            <li>Silence ~8 s sans parole → micro coupé tout seul</li>
            <li>« Quelles interventions m’ont été affectées ? »</li>
            <li>« Mets-moi en déplacement vers le site »</li>
            <li>« Mets-moi en cours d’intervention » / « Je suis arrivé »</li>
            <li>« Pause » / « Pause repas » — puis « Arrête la pause »</li>
            <li>« Fin d’intervention » · « Fournisseur » · « Bureau »</li>
            <li>« Trajet début » · « Trajet fin » · « Fin de journée »</li>
            <li>« Stop » pour couper</li>
          </ul>
        )}
      </div>
    </div>
  )
}
