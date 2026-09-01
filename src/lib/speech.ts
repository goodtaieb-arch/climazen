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

/** Silence pour une commande courte (micro en-tête). */
export const SPEECH_COMMAND_SILENCE_MS = 2800

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
 * Comprend les corrections à la voix :
 * « non plutôt… », « je veux dire… », « en fait… », « pardon… », « correction… »
 * → garde le sens corrigé au lieu d’empiler l’erreur.
 */
export function applySpeechCorrections(raw: string): string {
  let text = cleanupSpeechFillers(raw)
  if (!text) return ''

  // Recommencer / effacer
  const restart = text.match(
    /(?:^|\s)(?:recommence(?:r)?|efface(?:r)?(?:\s+tout)?|annule(?:r)?(?:\s+tout)?|recommen[cç]ons)\s*[:,.]?\s*(.*)$/i,
  )
  if (restart) {
    return cleanupSpeechFillers(restart[1] || '')
  }

  const markerRe =
    /(?:^|\s)(?:non[, ]+(?:plut[oô]t|en fait)|plut[oô]t|je veux dire|en fait|pardon|correction|remplace(?:r)?(?:\s+par)?)\s*[:,.]?\s+/gi

  let lastMatch: RegExpExecArray | null = null
  let m: RegExpExecArray | null
  const re = new RegExp(markerRe.source, 'gi')
  while ((m = re.exec(text)) !== null) {
    lastMatch = m
  }
  if (!lastMatch) return text

  const after = text.slice(lastMatch.index + lastMatch[0].length).trim()
  const before = text.slice(0, lastMatch.index).trim()
  if (!after) return cleanupSpeechFillers(before)

  // Garder le début d’action (« ajoute détecteur ») + la correction
  const lead = before.match(
    /^((?:ajoute[rz]?|cr[eé]e[rz]?|creer|cree|planifie|programme|agenda)\b(?:\s+(?:un|une|le|la|les|des|du|de|d)\b)?(?:\s+[A-Za-zÀ-ÿ0-9'’-]+)?)/i,
  )
  if (lead?.[1]) {
    return cleanupSpeechFillers(`${lead[1]} ${after}`)
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

  return cleanupSpeechFillers([kept, after].filter(Boolean).join(' '))
}

/**
 * Fusionne les morceaux finaux d’une dictée continue + corrections.
 */
export function mergeSpeechFinals(chunks: string[]): string {
  return applySpeechCorrections(chunks.filter(Boolean).join(' '))
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
      label: 'Nouvel appel / OT',
      path: '/app/appel',
      test: (s) =>
        /\b(appel|panne|urgence)\b/.test(s) ||
        (/\b(creer|nouveau|nouvelle)\b/.test(s) && /\b(ot|ordre)\b/.test(s)),
    },
    {
      id: 'ot',
      label: 'OT / Demandes',
      path: '/app/ot',
      test: (s) =>
        /\b(ordres? de travail|demandes? d['’ ]?intervention|liste ot|\bot\b)\b/.test(s) &&
        !/\b(creer|nouveau|nouvelle)\b/.test(s),
    },
    {
      id: 'stock',
      label: 'Stock fluides',
      path: '/app/stock',
      test: (s) => /\b(stock|fluides?|bouteilles?)\b/.test(s),
    },
    {
      id: 'cerfa',
      label: 'CERFA / interventions',
      path: '/app/interventions',
      test: (s) => /\b(cerfa|intervention|fiche)\b/.test(s),
    },
    {
      id: 'sites',
      label: 'Sites / parc',
      path: '/app/chantiers',
      test: (s) => /\b(sites?|chantiers?|parc|clients?)\b/.test(s),
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
