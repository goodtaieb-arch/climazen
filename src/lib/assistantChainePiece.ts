/**
 * Chaîne commerciale depuis rapport OT :
 * détecte pièces HS / à changer → demande devis fournisseur + devis client → (après accept) commande.
 * L’IA propose ; validation humaine « oui » obligatoire avant écriture.
 */

import type { AppData } from './types'
import { clientDisplayName } from './types'
import {
  formatOtNumero,
  isOtCloture,
  type OrdreTravail,
} from './ordreTravail'
import { todayIsoLocal } from './agenda'

function normalize(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Marge client par défaut si prix fournisseur connu (× coefficient). */
export const COEF_MARGE_CLIENT_DEFAUT = 1.35

export type PieceHsDetectee = {
  designation: string
  quantite: number
  motif: string
  /** Prix fournisseur estimé HT si mentionné dans le texte */
  prixFournisseurHt?: number
}

export type ChainePieceProposal = {
  kind: 'chaine_piece'
  otId: string
  otNumero: string
  clientId: string
  chantierId?: string
  pieces: PieceHsDetectee[]
  fournisseur: string
  /** Demande de devis fournisseur (statut demande_devis) */
  createDemandeFournisseur: boolean
  /** Devis client brouillon lié à l’OT */
  createDevisClient: boolean
  /** Coefficient prix client = prix fourni × coef (si prix connu) */
  coefMarge: number
  summary: string
}

const COMPOSANTS: { re: RegExp; label: string }[] = [
  { re: /\bventil(?:ateur|o)\b|\bventilo\b/i, label: 'Ventilateur' },
  { re: /\bcompresseur\b/i, label: 'Compresseur' },
  { re: /\bcarte\s*(?:electronique|électronique|pcb|puissance)?\b/i, label: 'Carte électronique' },
  { re: /\bfiltre(?:s)?\b/i, label: 'Filtre' },
  { re: /\bvanne\b|\bdetendeur\b|\bdétendeur\b/i, label: 'Vanne / détendeur' },
  { re: /\bcondensateur\b/i, label: 'Condensateur' },
  { re: /\bevaporateur\b|\bévaporateur\b/i, label: 'Évaporateur' },
  { re: /\bcondenseur\b/i, label: 'Condenseur' },
  { re: /\bsondage?\b|\bsonde\b|\bsensor\b/i, label: 'Sonde' },
  { re: /\bventilateur\s+externe|unit[eé]\s+ext/i, label: 'Ventilateur unité extérieure' },
  { re: /\bmoteur\b/i, label: 'Moteur' },
  { re: /\bpompe\b/i, label: 'Pompe' },
  { re: /\bresistance\b|\brésistance\b/i, label: 'Résistance' },
  { re: /\btuyau\b|\bflexible\b|\braccord\b/i, label: 'Raccord / flexible' },
  { re: /\bbouteille\b|\bfiltre\s*d[eé]shydrat/i, label: 'Filtre déshydrateur' },
  { re: /\bpressostat\b/i, label: 'Pressostat' },
]

const SIGNAL_HS =
  /\b(hs|hors\s+service|a\s+changer|a\s+remplacer|changer|remplacer|a\s+commander|commander|defectueux|d[eé]fectueux|bruyant|fait\s+du\s+bruit|fait\s+bruit|gripp[eé]|casse|cass[eé]|fuite|rouille|us[eé]|mort|grille|griller?|ne\s+tourne\s+plus|bloqu[eé])\b/i

export function wantsChainePieceQuery(raw: string): boolean {
  const n = normalize(raw)
  if (!n) return false
  if (
    /\b(piece|pieces)\b/.test(n) &&
    /\b(commander|commande|hs|changer|remplacer|devis|fournisseur|ot|ordre|rapport)\b/.test(n)
  ) {
    return true
  }
  if (/\b(analyse|lis|lire|relis)\b/.test(n) && /\b(rapport|ot|observation|intervention)\b/.test(n)) {
    return true
  }
  if (/\b(chaine|cha[iî]ne)\b/.test(n) && /\b(piece|devis|commande)\b/.test(n)) return true
  if (/\bventilo\b/.test(n) && /\b(bruit|changer|hs)\b/.test(n)) return true
  return false
}

function extractQty(around: string): number {
  const m = around.match(/\b(\d+)\s*(?:x|fois|pcs?|pieces?)?\b/i)
  if (m) {
    const n = Number(m[1])
    if (n >= 1 && n <= 99) return n
  }
  return 1
}

function extractPrix(text: string): number | undefined {
  const m = text.match(/\b(\d+[.,]\d{1,2}|\d+)\s*€/)
  if (!m) return undefined
  const n = Number(String(m[1]).replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/**
 * Détecte les pièces HS / à changer dans le texte libre du rapport OT.
 */
export function detectPiecesHsFromText(raw: string): PieceHsDetectee[] {
  const text = String(raw || '').trim()
  if (!text) return []
  const n = normalize(text)
  if (!SIGNAL_HS.test(text) && !/\ba\s+commander\b/i.test(text)) {
    // Pas de signal clair → rien (évite les faux positifs)
    if (!/\bchanger\b|\bremplacer\b|\bhs\b/i.test(n)) return []
  }

  const out: PieceHsDetectee[] = []
  const seen = new Set<string>()

  for (const { re, label } of COMPOSANTS) {
    const m = text.match(re)
    if (!m) continue
    // Le composant doit être lié à un signal HS dans un voisinage raisonnable
    const idx = m.index ?? 0
    const window = text.slice(Math.max(0, idx - 40), idx + m[0].length + 60)
    if (!SIGNAL_HS.test(window) && !/\ba\s+commander\b/i.test(window)) continue
    const key = normalize(label)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      designation: label,
      quantite: extractQty(window),
      motif: window.replace(/\s+/g, ' ').trim().slice(0, 120),
      prixFournisseurHt: extractPrix(window),
    })
  }

  // Fallback : « à commander : xxx » / « pièce à changer : xxx »
  if (!out.length) {
    const free =
      text.match(
        /(?:a\s+commander|a\s+changer|a\s+remplacer|piece\s+hs|pi[eè]ce\s*[:=])\s*[:\-]?\s*([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9\s\-\/]{2,60})/i,
      ) ||
      text.match(
        /(?:changer|remplacer)\s+(?:le|la|les|un|une)?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9\s\-\/]{2,40})/i,
      )
    if (free?.[1]) {
      const designation = free[1]
        .replace(/\b(sur|equipe|équipe|client|site|pour|afin)\b.*$/i, '')
        .trim()
        .slice(0, 80)
      if (designation.length >= 3) {
        out.push({
          designation: designation.replace(/^\w/, (c) => c.toUpperCase()),
          quantite: 1,
          motif: free[0].slice(0, 120),
        })
      }
    }
  }

  return out
}

export function otReportBlob(ot: OrdreTravail): string {
  return [ot.rapportAction, ot.observations, ot.action, ot.rapportSousTraitant]
    .filter(Boolean)
    .join('\n')
}

export function findOtForChaine(
  data: AppData,
  raw: string,
): OrdreTravail | null {
  const ots = data.ordresTravail || []
  if (!ots.length) return null

  // N° OT explicite
  const num =
    String(raw || '').match(/\bot\s*[-#:]?\s*(\d{6,})\b/i)?.[1] ||
    String(raw || '').match(/\b(\d{8})\b/)?.[1]
  if (num) {
    const hit = ots.find(
      (o) =>
        String(o.numero || '').includes(num) ||
        formatOtNumero(o.numero).replace(/\s/g, '').includes(num),
    )
    if (hit) return hit
  }

  // OT avec signal pièce HS dans le rapport (priorité non clôturés récents)
  const scored = ots
    .map((o) => {
      const blob = otReportBlob(o)
      const pieces = detectPiecesHsFromText(blob)
      let score = pieces.length * 50
      if (!isOtCloture(o.statut)) score += 10
      if (o.statut === 'en_attente_piece') score += 20
      const date = String(o.date || '').slice(0, 10)
      if (date && date >= todayIsoLocal().slice(0, 7)) score += 5
      return { o, score, pieces }
    })
    .filter((x) => x.score > 0 && x.pieces.length > 0)
    .sort((a, b) => b.score - a.score)

  return scored[0]?.o || null
}

export function buildChainePieceProposal(
  data: AppData,
  raw: string,
  opts?: { otId?: string; fournisseur?: string },
): { ok: true; action: ChainePieceProposal } | { ok: false; message: string } {
  const ot =
    (opts?.otId && (data.ordresTravail || []).find((o) => o.id === opts.otId)) ||
    findOtForChaine(data, raw)

  if (!ot) {
    return {
      ok: false,
      message: [
        `Aucune intervention avec pièce HS / à commander trouvée dans les rapports.`,
        `Indiquez le n° (ex. « analyse INT26090401 » ou « OT26090401 ») ou notez dans Observations : « Ventilo fait bruit — à changer ».`,
      ].join('\n'),
    }
  }

  if (!ot.clientId) {
    return {
      ok: false,
      message: `L’${formatOtNumero(ot.numero)} n’a pas de client — liez le client avant la chaîne devis/commande.`,
    }
  }

  const pieces = detectPiecesHsFromText(otReportBlob(ot))
  if (!pieces.length) {
    return {
      ok: false,
      message: [
        `${formatOtNumero(ot.numero)} : pas de pièce HS détectée dans le rapport.`,
        `Ajoutez dans Observations / Rapport une phrase du type : « Ventilateur bruyant à remplacer » ou « Compresseur HS à commander ».`,
      ].join('\n'),
    }
  }

  const client = data.clients?.find((c) => c.id === ot.clientId)
  const site = data.chantiers?.find((s) => s.id === ot.chantierId)
  const fournisseur =
    (opts?.fournisseur || '').trim() ||
    String(raw || '').match(/fournisseur\s+([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9\s\-&.]{1,40})/i)?.[1]?.trim() ||
    'Fournisseur pièces'

  const coef = COEF_MARGE_CLIENT_DEFAUT
  const lines = [
    `Je propose la chaîne commerciale pour ${formatOtNumero(ot.numero)} :`,
    client ? `• Client : ${clientDisplayName(client)}` : null,
    site ? `• Site : ${site.nom}` : null,
    ``,
    `Pièces détectées dans le rapport :`,
    ...pieces.map(
      (p) =>
        `• ${p.designation} ×${p.quantite}${
          p.prixFournisseurHt != null ? ` · ~${p.prixFournisseurHt} € HT fourni.` : ''
        } — ${p.motif}`,
    ),
    ``,
    `Actions (après votre « oui ») :`,
    `1) Demande de devis fournisseur « ${fournisseur} » (liée à l’intervention)`,
    `2) Devis client brouillon (pièce + marge ×${coef}) pour acceptation`,
    `3) Quand le client accepte le devis → passez en commande fournisseur (bouton / assistant)`,
    ``,
    `Répondez « oui » pour créer la demande + le devis brouillon, ou « non » pour annuler.`,
  ].filter((x) => x !== null) as string[]

  return {
    ok: true,
    action: {
      kind: 'chaine_piece',
      otId: ot.id,
      otNumero: ot.numero,
      clientId: ot.clientId,
      chantierId: ot.chantierId,
      pieces,
      fournisseur,
      createDemandeFournisseur: true,
      createDevisClient: true,
      coefMarge: coef,
      summary: lines.join('\n'),
    },
  }
}

/** Scan rapide : OTs ouverts avec signal pièce (pour snapshot IA). */
export function summarizeOtsAvecPiecesHs(data: AppData, max = 8): string {
  const hits = (data.ordresTravail || [])
    .filter((o) => !isOtCloture(o.statut) || o.statut === 'en_attente_piece')
    .map((o) => ({ o, pieces: detectPiecesHsFromText(otReportBlob(o)) }))
    .filter((x) => x.pieces.length > 0)
    .slice(0, max)
  if (!hits.length) return ''
  const lines = [
    '— Interventions avec pièces HS / à commander (détectés dans rapports) —',
    ...hits.map(
      (h) =>
        `• ${formatOtNumero(h.o.numero)} : ${h.pieces.map((p) => p.designation).join(', ')}`,
    ),
  ]
  return lines.join('\n')
}
