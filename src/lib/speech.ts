/**
 * Reconnaissance vocale navigateur (Web Speech API) — dictée + commandes terrain.
 * Chrome / Android PWA : bon support. Safari iOS : souvent indisponible.
 */

export type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null
  onerror: ((ev: { error?: string }) => void) | null
  onend: (() => void) | null
}

export type SpeechRecognitionEventLike = {
  resultIndex: number
  results: ArrayLike<{
    isFinal: boolean
    length?: number
    0: { transcript: string; confidence?: number }
  }>
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

/** Silence avant d’arrêter la dictée (ms) — laisse le temps de reformuler. */
export const SPEECH_SILENCE_MS = 4800

/** Silence pour valider une commande / couper le micro (ms). */
export const SPEECH_COMMAND_SILENCE_MS = 2000

/** Pref : après un 1er micro, écouter « dis Lola » = appui micro. */
export const VOICE_WAKE_AUTO_KEY = 'climazen.voiceWakeAuto'

export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export function isSpeechSupported(): boolean {
  return Boolean(getSpeechRecognitionCtor())
}

export function normalizeSpeechText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanupSpeechFillers(raw: string): string {
  return (raw || '')
    .replace(/\s+/g, ' ')
    .replace(/\b(euh+|hum+|heu+|bah|ben)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim()
}

/**
 * Fusionne un nouveau morceau STT dans le buffer sans empiler les doublons.
 * Chrome (continuous + restart) renvoie souvent la phrase complète à nouveau
 * ou une version qui étend l’interim déjà finalisé.
 */
export function appendSpeechChunk(buffer: string, piece: string): string {
  const b = (buffer || '').replace(/\s+/g, ' ').trim()
  const p = (piece || '').replace(/\s+/g, ' ').trim()
  if (!p) return b
  if (!b) return p

  const nb = normalizeSpeechText(b)
  const np = normalizeSpeechText(p)
  if (!np) return b
  if (nb === np) return b
  // Nouveau résultat = phrase entière qui contient déjà le buffer
  if (np.startsWith(nb) && np.length >= nb.length) return p
  // Même fin déjà enregistrée
  if (nb.endsWith(np)) return b
  // Chevauchement : fin du buffer == début du morceau (même découpage que normalize)
  const bWords = nb.split(' ').filter(Boolean)
  const pWords = np.split(' ').filter(Boolean)
  const maxOverlap = Math.min(bWords.length, pWords.length)
  for (let k = maxOverlap; k >= 2; k--) {
    const end = bWords.slice(-k).join(' ')
    const start = pWords.slice(0, k).join(' ')
    if (end === start) {
      const restWords = pWords.slice(k)
      if (restWords.length === 0) return b
      return `${b} ${restWords.join(' ')}`.trim()
    }
  }
  // Le morceau est un préfixe / sous-partie déjà dans le buffer
  if (nb.includes(` ${np} `) || nb.endsWith(` ${np}`) || nb.startsWith(`${np} `)) {
    if (pWords.length >= 3) return b
  }
  return `${b} ${p}`.trim()
}

/**
 * Enlève les mots / groupes répétés en boucle (dictée qui bégaye).
 * Ex. « donc donc faites-moi la commande faites-moi la commande » → une fois.
 */
export function collapseSpeechRepetitions(raw: string): string {
  let text = (raw || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''

  // Mots consécutifs identiques (donc donc donc)
  text = text.replace(/\b([A-Za-zÀ-ÿ0-9'’-]+)(?:\s+\1\b)+/gi, '$1')

  const words = text.split(/\s+/).filter(Boolean)
  if (words.length < 4) return text

  // N-grammes répétés (du plus long au plus court)
  const maxN = Math.min(12, Math.floor(words.length / 2))
  let out = words
  for (let n = maxN; n >= 2; n--) {
    const next: string[] = []
    let i = 0
    while (i < out.length) {
      if (i + 2 * n <= out.length) {
        const a = out.slice(i, i + n).map((w) => normalizeSpeechText(w)).join(' ')
        const b = out.slice(i + n, i + 2 * n).map((w) => normalizeSpeechText(w)).join(' ')
        if (a && a === b) {
          next.push(...out.slice(i, i + n))
          i += 2 * n
          // Avaler d’éventuelles répétitions supplémentaires du même bloc
          while (i + n <= out.length) {
            const c = out.slice(i, i + n).map((w) => normalizeSpeechText(w)).join(' ')
            if (c !== a) break
            i += n
          }
          continue
        }
      }
      next.push(out[i])
      i += 1
    }
    out = next
  }

  return out.join(' ').replace(/\s+/g, ' ').trim()
}

/**
 * Corrige les fluides mal dictés (iPhone / Safari découpe souvent R-410A → « R. 4 110 »).
 * À appliquer après chaque dictée — pas un problème micro, c’est la reconnaissance.
 */
export function normalizeSpeechFluides(raw: string): string {
  let t = String(raw || '')
  if (!t.trim()) return t

  // Formes orales FR fréquentes
  const spoken: Array<[RegExp, string]> = [
    [/\b(?:erre|air|r)\s+trente[- ]?deux\b/gi, 'R-32'],
    [/\b(?:erre|air|r)\s+quatre[- ]?cent[- ]?dix\s*[aA]?\b/gi, 'R-410A'],
    [/\b(?:erre|air|r)\s+quatre[- ]?cent[- ]?sept\s*[cC]?\b/gi, 'R-407C'],
    [/\b(?:erre|air|r)\s+cent[- ]?trente[- ]?quatre\s*[aA]?\b/gi, 'R-134a'],
    [/\b(?:erre|air|r)\s+quatre[- ]?cent[- ]?cinquante\s*[aA]?\b/gi, 'R-450A'],
    [/\b(?:erre|air|r)\s+quatre[- ]?cent[- ]?cinquante[- ]?quatre\s*[bB]?\b/gi, 'R-454B'],
    [/\b(?:erre|air|r)\s+quatre[- ]?cent[- ]?quarante[- ]?huit\s*[aA]?\b/gi, 'R-448A'],
    [/\b(?:erre|air|r)\s+quatre[- ]?cent[- ]?cinquante[- ]?deux\s*[aA]?\b/gi, 'R-452A'],
  ]
  for (const [re, rep] of spoken) t = t.replace(re, rep)

  // Dictée iOS : points / espaces entre R et chiffres (« R. 4 110 », « R 4 10 A »)
  const dotted: Array<[RegExp, string]> = [
    // R. 4 110 / R 4110 / R.4110A → R-410A
    [/\b[Rr]\s*[.\u2026]?\s*4\s*1\s*1\s*0\s*[aA]?\b/g, 'R-410A'],
    [/\b[Rr]\s*[.\u2026]?\s*4110\s*[aA]?\b/g, 'R-410A'],
    [/\b[Rr]\s*[.\u2026]?\s*4\s*10\s*[aA]\b/g, 'R-410A'],
    [/\b[Rr]\s*[.\u2026]?\s*410\s*[aA]\b/g, 'R-410A'],
    [/\b[Rr]\s*[.\u2026]?\s*410\b/g, 'R-410A'],
    // R-32
    [/\b[Rr]\s*[.\u2026]?\s*3\s*2\b/g, 'R-32'],
    [/\b[Rr]\s*[.\u2026]?\s*32\b/g, 'R-32'],
    // R-134a
    [/\b[Rr]\s*[.\u2026]?\s*1\s*3\s*4\s*[aA]\b/g, 'R-134a'],
    [/\b[Rr]\s*[.\u2026]?\s*134\s*[aA]\b/g, 'R-134a'],
    // R-407C
    [/\b[Rr]\s*[.\u2026]?\s*4\s*0\s*7\s*[cC]?\b/g, 'R-407C'],
    [/\b[Rr]\s*[.\u2026]?\s*407\s*[cC]\b/g, 'R-407C'],
    // R-448A / R-449A / R-452A / R-454B
    [/\b[Rr]\s*[.\u2026]?\s*448\s*[aA]\b/g, 'R-448A'],
    [/\b[Rr]\s*[.\u2026]?\s*449\s*[aA]\b/g, 'R-449A'],
    [/\b[Rr]\s*[.\u2026]?\s*452\s*[aA]\b/g, 'R-452A'],
    [/\b[Rr]\s*[.\u2026]?\s*454\s*[bB]\b/g, 'R-454B'],
    // R410A collé sans tiret
    [/\bR410\s*[aA]\b/g, 'R-410A'],
    [/\bR32\b/g, 'R-32'],
    [/\bR134\s*[aA]\b/g, 'R-134a'],
  ]
  for (const [re, rep] of dotted) t = t.replace(re, rep)

  return t.replace(/\s+/g, ' ').trim()
}

/**
 * Comprend les corrections à la voix :
 * « non plutôt… », « je veux dire… », « en fait… », « pardon… », « correction… »
 * → garde le sens corrigé au lieu d’empiler l’erreur.
 */
export function applySpeechCorrections(raw: string): string {
  let text = collapseSpeechRepetitions(cleanupSpeechFillers(raw))
  if (!text) return ''

  const finish = (s: string) =>
    normalizeSpeechFluides(collapseSpeechRepetitions(cleanupSpeechFillers(s)))

  // Recommencer / effacer
  const restart = text.match(
    /(?:^|\s)(?:recommence(?:r)?|efface(?:r)?(?:\s+tout)?|annule(?:r)?(?:\s+tout)?|recommen[cç]ons)\s*[:,.]?\s*(.*)$/i,
  )
  if (restart) {
    return finish(restart[1] || '')
  }

  const markerRe =
    /(?:^|\s)(?:non[, ]+(?:plut[oô]t|en fait)|plut[oô]t|je veux dire|en fait|pardon|correction|remplace(?:r)?(?:\s+par)?)\s*[:,.]?\s+/gi

  let lastMatch: RegExpExecArray | null = null
  let m: RegExpExecArray | null
  const re = new RegExp(markerRe.source, 'gi')
  while ((m = re.exec(text)) !== null) {
    lastMatch = m
  }
  if (!lastMatch) return finish(text)

  const after = text.slice(lastMatch.index + lastMatch[0].length).trim()
  const before = text.slice(0, lastMatch.index).trim()
  if (!after) return finish(before)

  // Garder le début d’action (« ajoute détecteur ») + la correction
  const lead = before.match(
    /^((?:ajoute[rz]?|cr[eé]e[rz]?|creer|cree|planifie|programme|agenda)\b(?:\s+(?:un|une|le|la|les|des|du|de|d)\b)?(?:\s+[A-Za-zÀ-ÿ0-9'’-]+)?)/i,
  )
  if (lead?.[1]) {
    return finish(`${lead[1]} ${after}`)
  }

  // Sinon : enlever la fin erronée (derniers mots)
  const words = before.split(/\s+/).filter(Boolean)
  let kept = ''
  if (words.length > 2) {
    const drop = Math.min(5, Math.max(2, Math.ceil(words.length / 3)))
    kept = words.slice(0, -drop).join(' ')
  }
  // Couper à la dernière ponctuation seulement si elle raccourcit vraiment
  const clause = before.replace(/[,;:—–\-]+\s*[^,;:—–\-]+$/, '').trim()
  if (clause && clause.length < before.length && clause.length >= kept.length) {
    kept = clause
  }

  return finish([kept, after].filter(Boolean).join(' '))
}

/**
 * Fusionne les morceaux finaux d’une dictée continue + corrections.
 */
export function mergeSpeechFinals(chunks: string[]): string {
  let merged = ''
  for (const chunk of chunks) {
    merged = appendSpeechChunk(merged, chunk)
  }
  return applySpeechCorrections(merged)
}

export type VoiceCommandId =
  | 'stock'
  | 'ot'
  | 'appel'
  | 'cerfa'
  | 'sites'
  | 'accueil'
  | 'scan'
  | 'scan_equip'
  | 'gps'
  | 'aide'
  | 'pointage'
  | 'temps_hors_int'

export type ParsedVoiceCommand = {
  id: VoiceCommandId
  label: string
  path?: string
}

/** Interprète une phrase courte en commande terrain. */
export function parseVoiceCommand(raw: string): ParsedVoiceCommand | null {
  const t = normalizeSpeechText(raw)
  if (!t) return null

  const rules: Array<{ id: VoiceCommandId; label: string; path?: string; test: (s: string) => boolean }> = [
    {
      id: 'temps_hors_int',
      label: 'Entrées de temps hors INT',
      path: '/app/temps-hors-int',
      test: (s) =>
        /\bhors\s+int\b/.test(s) ||
        /\bentr[eé]es?\s+de\s+temps\b/.test(s) ||
        /\btemps\s+hors\b/.test(s),
    },
    {
      id: 'scan_equip',
      label: 'Scanner un équipement',
      path: '/app/scan-equip?camera=1',
      test: (s) =>
        (/\b(scan|scanner|qr)\b/.test(s) && /\bequip/.test(s)) ||
        /\betiquette\b/.test(s) ||
        /\bqr\s+equip/.test(s) ||
        /\bqr\s+(du\s+)?(batiment|site|immeuble)\b/.test(s),
    },
    {
      id: 'scan',
      label: 'Scanner une bouteille',
      path: '/app/stock?scan=1',
      test: (s) =>
        (/\b(scan|scanner|code barre|code barres|barcode|qr)\b/.test(s) &&
          !/\bequip/.test(s)) ||
        (/\bbouteille\b/.test(s) && /\b(scan|lire|photo)\b/.test(s)),
    },
    {
      id: 'gps',
      label: 'Ouvrir le GPS',
      test: (s) =>
        /\b(gps|waze|navigation|itineraire|maps|plans)\b/.test(s) ||
        /\bouvre?\b.*\b(carte|maps)\b/.test(s),
    },
    {
      id: 'appel',
      label: 'Nouvel appel / intervention',
      path: '/app/appel',
      test: (s) =>
        /\b(appel|panne|urgence)\b/.test(s) ||
        (/\b(creer|nouveau|nouvelle)\b/.test(s) &&
          /\b(ot|int|di|ordre|intervention)\b/.test(s)),
    },
    {
      id: 'ot',
      label: 'Interventions',
      path: '/app/ot',
      test: (s) =>
        /\b(ordres? de travail|demandes? d['’ ]?intervention|liste (?:ot|int)|interventions?|\bot\b|\bint\b|\bdi\b)\b/.test(
          s,
        ) && !/\b(creer|nouveau|nouvelle)\b/.test(s),
    },
    {
      id: 'stock',
      label: 'Stock fluides',
      path: '/app/stock',
      test: (s) => /\b(stock|fluides?|bouteilles?)\b/.test(s),
    },
    {
      id: 'cerfa',
      label: 'CERFA',
      path: '/app/interventions',
      test: (s) => /\b(cerfa|fiches?(?:\s+cerfa)?)\b/.test(s),
    },
    {
      id: 'sites',
      label: 'Sites / parc',
      path: '/app/chantiers',
      test: (s) => /\b(sites?|chantiers?|parc|clients?)\b/.test(s),
    },
    {
      id: 'pointage',
      label: 'Pointeuse',
      path: '/app/pointage',
      test: (s) =>
        /\b(pointeuse|pointage|pointer)\b/.test(s) ||
        /\btemps de travail\b/.test(s),
    },
    {
      id: 'accueil',
      label: 'Accueil',
      path: '/app',
      test: (s) => /\b(accueil|home|tableau de bord|dashboard)\b/.test(s),
    },
    {
      id: 'aide',
      label: 'Aide IA',
      test: (s) => /\b(aide|assistant|gemini|help)\b/.test(s),
    },
  ]

  for (const rule of rules) {
    if (rule.test(t)) {
      return { id: rule.id, label: rule.label, path: rule.path }
    }
  }
  return null
}

export function formatLastSyncLabel(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch {
    return d.toLocaleString('fr-FR')
  }
}

/** Synthèse vocale navigateur (réponses orales main libre). */
export function isTtsSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined'
}

export function cancelSpeech(): void {
  if (!isTtsSupported()) return
  try {
    window.speechSynthesis.cancel()
  } catch {
    /* ignore */
  }
}

function pickFrenchVoice(): SpeechSynthesisVoice | null {
  if (!isTtsSupported()) return null
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find((v) => /^fr[-_]/i.test(v.lang) && /google|thomas|amélie|amelie|denise|hortense/i.test(v.name)) ||
    voices.find((v) => /^fr[-_]/i.test(v.lang)) ||
    null
  )
}

/** Nettoie un texte assistant pour lecture orale courte. */
export function textForSpeech(raw: string, maxLen = 420): string {
  let t = String(raw || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#*_>~•]/g, ' ')
    .replace(/^\s*[-–—]\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (t.length > maxLen) t = `${t.slice(0, maxLen - 1).trim()}…`
  return t
}

/**
 * Réponse orale Lola : garde l’information utile sans lire tout le contenu du chat.
 * Une ou deux phrases courtes, avec une limite stricte adaptée au terrain.
 */
export function textForVoiceReply(raw: string, maxLen = 160): string {
  const text = textForSpeech(raw, 800)
  if (!text) return ''

  const sentences = text.match(/[^.!?]+(?:[.!?]+|$)/g) || [text]
  let spoken = ''
  for (const sentence of sentences) {
    const next = `${spoken} ${sentence.trim()}`.trim()
    if (next.length > maxLen && spoken) break
    spoken = next
    if (spoken.split(/\s+/).length >= 8) break
  }

  if (spoken.length <= maxLen) return spoken
  const sliced = spoken.slice(0, maxLen - 1)
  const wordBoundary = sliced.lastIndexOf(' ')
  return `${(wordBoundary >= Math.floor(maxLen * 0.65) ? sliced.slice(0, wordBoundary) : sliced).trim()}…`
}

/**
 * Lit une réponse à voix haute (fr-FR).
 * onEnd est appelé même si TTS indisponible (pour relancer l’écoute).
 */
export function speakFr(
  text: string,
  opts?: { onEnd?: () => void; rate?: number },
): void {
  const spoken = textForSpeech(text)
  cancelSpeech()
  if (!isTtsSupported() || !spoken) {
    opts?.onEnd?.()
    return
  }
  const u = new SpeechSynthesisUtterance(spoken)
  u.lang = 'fr-FR'
  u.rate = opts?.rate ?? 1.05
  const voice = pickFrenchVoice()
  if (voice) u.voice = voice
  let done = false
  const finish = () => {
    if (done) return
    done = true
    opts?.onEnd?.()
  }
  u.onend = finish
  u.onerror = finish
  try {
    window.speechSynthesis.speak(u)
  } catch {
    finish()
  }
}
