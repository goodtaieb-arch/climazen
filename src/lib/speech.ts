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
    0: { transcript: string }
  }>
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

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
        /\bqr\s+equip/.test(s),
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
      label: 'Ordres de travail',
      path: '/app/ot',
      test: (s) =>
        /\b(ordres? de travail|liste ot|\bot\b)\b/.test(s) && !/\b(creer|nouveau|nouvelle)\b/.test(s),
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
