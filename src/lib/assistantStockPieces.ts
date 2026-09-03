/**
 * Lola / assistant — consultation stock pièces + veille « préviens-moi à l’arrivée ».
 */

import type { AppData } from './types'
import type { CommandeFournisseur } from './chaineCommerciale'
import { STATUT_COMMANDE_FOURNISSEUR_LABELS } from './chaineCommerciale'
import type { PieceDetachee } from './piecesDetachees'
import { PIECE_EMPLACEMENT_LABELS } from './piecesDetachees'

export type PieceVeilleStatut = 'active' | 'notifiee' | 'annulee'

/** Alerte demandée par un tech (téléphone / assistant) : prévenir à l’arrivée. */
export type PieceVeille = {
  id: string
  /** Texte cherché : « filtre M5 », « compresseur »… */
  query: string
  pieceId?: string
  commandeId?: string
  demandeurUserId?: string
  demandeurName?: string
  statut: PieceVeilleStatut
  createdAt: string
  notifiedAt?: string
  notes?: string
}

function normalize(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function scoreMatch(hay: string, needle: string): number {
  const h = normalize(hay)
  const n = normalize(needle)
  if (!h || !n) return 0
  if (h === n) return 100
  if (h.includes(n)) return 80
  const parts = n.split(/\s+/).filter((p) => p.length >= 2)
  if (!parts.length) return 0
  const hits = parts.filter((p) => h.includes(p)).length
  return Math.round((hits / parts.length) * 60)
}

/** Extrait la désignation pièce depuis la phrase. */
export function extractPieceQuery(raw: string): string {
  const t = String(raw || '').trim()
  const patterns = [
    /(?:filtre|compresseur|ventilateur|vanne|contacteur|piece|pi[eè]ce|ref(?:erence)?)\s+([A-Za-zÀ-ÿ0-9'’\-\/\s]{2,50}?)(?:\s+en\s+stock|\s+est|\s+a\s+t|\s+arrive|\s+arriv|\s+\?|$)/i,
    /(?:combien|stock)\s+(?:de\s+|d['’])?([A-Za-zÀ-ÿ0-9'’\-\/\s]{2,50}?)(?:\s+en\s+stock|\s+\?|$)/i,
    /(?:previen|pr[eé]vien|alerte|dis[- ]?moi|notif)\w*.*?(?:quand|si|d[eè]s)\s+(?:le\s+|la\s+|l['’])?([A-Za-zÀ-ÿ0-9'’\-\/\s]{2,50}?)(?:\s+arrive|\s+arriv|\s+\?|$)/i,
    /(?:arrive|arriv[eé]e?)\s+(?:le\s+|la\s+|l['’]|du\s+|de\s+)?([A-Za-zÀ-ÿ0-9'’\-\/\s]{2,50}?)(?:\s+\?|$)/i,
  ]
  for (const re of patterns) {
    const m = t.match(re)
    if (m?.[1]) {
      const q = m[1].replace(/\s+/g, ' ').trim()
      if (q.length >= 2) return q
    }
  }
  // Fallback : garder les mots utiles hors verbes courants
  const n = normalize(t)
    .replace(
      /\b(combien|de|des|du|la|le|les|en|a|as|est|il|elle|on|stock|magasin|atelier|piece|pieces|filtre|arrive|arrivee|arriver|previen|previent|prevenir|moi|quand|si|tel|une|un|ot|pour|question|sais|savoir|dis|dit)\b/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim()
  return n.slice(0, 60)
}

export function wantsStockPieceQuery(raw: string): boolean {
  const n = normalize(raw)
  if (!n) return false
  if (wantsStockPieceVeille(raw)) return false
  const ask =
    /\b(combien|reste|y a|ya t|as[- ]tu|avez|stock|magasin|disponible|dispo)\b/.test(n) ||
    /\b(est[- ]ce que|est ce que|deja|d[eé]j[aà])\b.*\b(arriv|re[cç]u|en stock)\b/.test(n) ||
    /\b(arriv|re[cç]u|livr)\w*\b/.test(n)
  if (!ask) return false
  return (
    /\b(piece|pieces|filtre|compresseur|ventilateur|vanne|contacteur|ref|reference|m5|m6|m7|commande)\b/.test(
      n,
    ) || /\bstock\b/.test(n)
  )
}

export function wantsStockPieceVeille(raw: string): boolean {
  const n = normalize(raw)
  if (!n) return false
  const veille =
    /\b(previen|prevenir|alerte|dis moi|dit moi|notif|previens|pr[eé]viens)\w*\b/.test(n) ||
    /\bquand\b.*\b(arriv|re[cç]u|livr)\w*\b/.test(n) ||
    /\b(d[eè]s|des) (que|qu)\b.*\b(arriv|re[cç]u)\w*\b/.test(n)
  if (!veille) return false
  return (
    /\b(piece|pieces|filtre|compresseur|ventilateur|vanne|contacteur|ref|commande|m5|m6|m7|stock)\b/.test(
      n,
    ) || Boolean(extractPieceQuery(raw))
  )
}

export function findPiecesMatching(
  pieces: PieceDetachee[] | undefined,
  query: string,
  limit = 5,
): { piece: PieceDetachee; score: number }[] {
  const q = extractPieceQuery(query) || query
  if (!normalize(q)) return []
  return (pieces || [])
    .map((p) => ({
      piece: p,
      score: Math.max(
        scoreMatch(p.designation, q),
        scoreMatch(p.reference, q),
        scoreMatch(`${p.reference} ${p.designation}`, q),
        scoreMatch(p.marque || '', q),
      ),
    }))
    .filter((x) => x.score >= 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export function findCommandesMatching(
  commandes: CommandeFournisseur[] | undefined,
  query: string,
  limit = 5,
): { commande: CommandeFournisseur; score: number }[] {
  const q = extractPieceQuery(query) || query
  if (!normalize(q)) return []
  return (commandes || [])
    .filter((c) => c.statut !== 'annulee')
    .map((c) => ({
      commande: c,
      score: Math.max(
        scoreMatch(c.libelle, q),
        scoreMatch(c.referencePiece || '', q),
        scoreMatch(c.fournisseur || '', q),
      ),
    }))
    .filter((x) => x.score >= 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/** Réponse lecture seule : stock + commandes (arrivée ou non). */
export function answerStockPieceQuery(data: AppData, raw: string): string {
  const q = extractPieceQuery(raw) || raw.trim()
  const pieces = findPiecesMatching(data.piecesDetachees, q)
  const cmds = findCommandesMatching(data.commandesFournisseur, q)

  if (!pieces.length && !cmds.length) {
    return [
      `Je ne trouve pas « ${q} » dans le stock pièces ni dans les commandes fournisseur.`,
      ``,
      `Comment je marche :`,
      `• Je lis le stock magasin (/app/stock-pieces) et les commandes (/app/commandes)`,
      `• Dites « préviens-moi quand le filtre M5 arrive » → j’enregistre une veille pour le bureau`,
      `• Pour ajouter une pièce : « ajoute pièce filtre M5 stock atelier » (puis « oui »)`,
    ].join('\n')
  }

  const lines: string[] = [`Stock / arrivée pour « ${q} » :`, ``]

  if (pieces.length) {
    lines.push(`En magasin :`)
    for (const { piece: p } of pieces) {
      const emp = PIECE_EMPLACEMENT_LABELS[p.emplacement] || p.emplacement
      const qte = Number(p.quantite) || 0
      lines.push(
        `• ${p.designation || p.reference} (${p.reference || '—'}) → ${qte} ${p.unite || 'u'} · ${emp}${
          qte > 0 ? ' · disponible' : ' · rupture'
        }`,
      )
    }
    lines.push('')
  }

  if (cmds.length) {
    lines.push(`Commandes fournisseur :`)
    for (const { commande: c } of cmds) {
      const st = STATUT_COMMANDE_FOURNISSEUR_LABELS[c.statut] || c.statut
      const arrived = c.statut === 'recue'
      lines.push(
        `• ${c.numero} — ${c.libelle}${c.referencePiece ? ` [${c.referencePiece}]` : ''} → ${st}${
          arrived && c.recueAt ? ` le ${c.recueAt.slice(0, 10)}` : ''
        }${arrived ? ' · déjà arrivée' : ' · pas encore reçue'}`,
      )
    }
    lines.push('')
  }

  lines.push(
    `Astuce : « préviens-moi quand ${q} arrive » → veille Accueil pour le bureau / responsable.`,
  )
  return lines.join('\n')
}

export function blankPieceVeille(opts: {
  query: string
  pieceId?: string
  commandeId?: string
  demandeurUserId?: string
  demandeurName?: string
}): Omit<PieceVeille, 'id'> {
  const now = new Date().toISOString()
  return {
    query: opts.query.trim(),
    pieceId: opts.pieceId,
    commandeId: opts.commandeId,
    demandeurUserId: opts.demandeurUserId,
    demandeurName: opts.demandeurName,
    statut: 'active',
    createdAt: now,
  }
}

export function summarizePieceVeilleProposal(opts: {
  query: string
  pieceHit?: PieceDetachee
  commandeHit?: CommandeFournisseur
  demandeurName?: string
}): string {
  const who = opts.demandeurName ? ` pour ${opts.demandeurName}` : ''
  const lines = [
    `Je propose une veille stock${who} :`,
    `• Pièce / recherche : ${opts.query}`,
  ]
  if (opts.pieceHit) {
    lines.push(
      `• Déjà en magasin : ${opts.pieceHit.designation} → ${opts.pieceHit.quantite} ${opts.pieceHit.unite || 'u'}`,
    )
  }
  if (opts.commandeHit) {
    lines.push(
      `• Commande liée : ${opts.commandeHit.numero} (${STATUT_COMMANDE_FOURNISSEUR_LABELS[opts.commandeHit.statut]})`,
    )
  }
  lines.push(
    `À la réception (commande « reçue »), Accueil sera notifié.`,
    ``,
    `Répondez « oui » pour enregistrer la veille, ou « non » pour annuler.`,
  )
  return lines.join('\n')
}

/** Veilles actives qui matchent une pièce / commande reçue. */
export function veillesANotifier(
  veilles: PieceVeille[] | undefined,
  opts: { piece?: PieceDetachee; commande?: CommandeFournisseur },
): PieceVeille[] {
  const active = (veilles || []).filter((v) => v.statut === 'active')
  if (!active.length) return []
  const out: PieceVeille[] = []
  for (const v of active) {
    if (opts.commande && (v.commandeId === opts.commande.id || scoreMatch(opts.commande.libelle, v.query) >= 50 || scoreMatch(opts.commande.referencePiece || '', v.query) >= 50)) {
      out.push(v)
      continue
    }
    if (
      opts.piece &&
      (v.pieceId === opts.piece.id ||
        scoreMatch(opts.piece.designation, v.query) >= 50 ||
        scoreMatch(opts.piece.reference, v.query) >= 50)
    ) {
      out.push(v)
    }
  }
  return out
}

/** Bloc contexte pour OpenAI / Lola (stock + commandes ouvertes). */
export function buildStockPiecesCatalog(data: AppData, max = 25): string {
  const pieces = (data.piecesDetachees || []).slice(0, max)
  const cmds = (data.commandesFournisseur || [])
    .filter((c) => c.statut === 'commandee' || c.statut === 'demande_devis' || c.statut === 'brouillon')
    .slice(0, max)
  const lines = [
    'Stock pièces détachées (lecture) :',
    ...(pieces.length
      ? pieces.map(
          (p) =>
            `• ${p.designation} [${p.reference || '—'}] = ${p.quantite} ${p.unite || 'u'} (${PIECE_EMPLACEMENT_LABELS[p.emplacement] || p.emplacement})`,
        )
      : ['• (aucune pièce en magasin)']),
    'Commandes fournisseur en cours :',
    ...(cmds.length
      ? cmds.map(
          (c) =>
            `• ${c.numero} ${c.libelle}${c.referencePiece ? ` [${c.referencePiece}]` : ''} — ${STATUT_COMMANDE_FOURNISSEUR_LABELS[c.statut]}`,
        )
      : ['• (aucune commande ouverte)']),
  ]
  return lines.join('\n')
}
