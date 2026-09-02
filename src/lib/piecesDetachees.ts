/**
 * Stock pièces détachées — GMAO ClimaZEN (séparé du stock fluides F-Gas).
 * Géré par le bureau ou par le magasinier désigné (Mon entreprise).
 */

import type { CommandeFournisseur } from './chaineCommerciale'
import { isPosteBureau, parsePostePersonnel, type PostePersonnelId } from './postePersonnel'

export type PieceCategorie =
  | 'filtre'
  | 'compresseur'
  | 'ventilateur'
  | 'electrique'
  | 'hydraulique'
  | 'gaz'
  | 'consommable'
  | 'outillage'
  | 'autre'

export const PIECE_CATEGORIE_LABELS: Record<PieceCategorie, string> = {
  filtre: 'Filtre / filtration',
  compresseur: 'Compresseur / froid',
  ventilateur: 'Ventilation / moteur',
  electrique: 'Électrique',
  hydraulique: 'Hydraulique / plomberie',
  gaz: 'Gaz / détente / vanne',
  consommable: 'Consommable',
  outillage: 'Outillage / EPI',
  autre: 'Autre',
}

export type PieceEmplacement = 'atelier' | 'vehicule' | 'depot'

export const PIECE_EMPLACEMENT_LABELS: Record<PieceEmplacement, string> = {
  atelier: 'Atelier / magasin',
  vehicule: 'Véhicule technicien',
  depot: 'Dépôt / consignation',
}

export type PieceMouvementKind =
  | 'entree_achat'
  | 'reception_commande'
  | 'sortie_ot'
  | 'sortie_manuelle'
  | 'retour'
  | 'inventaire'
  | 'transfert'
  | 'perte'

export const PIECE_MOUVEMENT_KIND_LABELS: Record<PieceMouvementKind, string> = {
  entree_achat: 'Entrée achat',
  reception_commande: 'Réception commande fournisseur',
  sortie_ot: 'Sortie pour OT',
  sortie_manuelle: 'Sortie manuelle',
  retour: 'Retour stock',
  inventaire: 'Inventaire / ajustement',
  transfert: 'Transfert emplacement',
  perte: 'Perte / casse',
}

export type PieceMouvementSens = 'entree' | 'sortie'

export interface PieceDetachee {
  id: string
  /** Référence fabricant / fournisseur */
  reference: string
  designation: string
  categorie?: PieceCategorie
  marque?: string
  fournisseur?: string
  quantite: number
  unite: string
  seuilAlerte?: number
  prixUnitaireHt?: number
  emplacement: PieceEmplacement
  /** Rayon / étagère / casier */
  rayon?: string
  /** Stock véhicule : technicien porteur */
  assigneeUserId?: string
  assigneeName?: string
  codeBarres?: string
  notes?: string
  /** Dernière commande fournisseur liée */
  commandeFournisseurId?: string
  createdAt: string
  updatedAt: string
}

export interface PieceMouvement {
  id: string
  pieceId: string
  sens: PieceMouvementSens
  kind: PieceMouvementKind
  quantite: number
  quantiteApres: number
  otId?: string
  otNumero?: string
  commandeFournisseurId?: string
  commandeNumero?: string
  clientId?: string
  chantierId?: string
  emplacementAvant?: PieceEmplacement
  emplacementApres?: PieceEmplacement
  assigneeUserId?: string
  assigneeName?: string
  motif?: string
  parUserId?: string
  parUserName?: string
  createdAt: string
}

export function parsePieceCategorie(raw: unknown): PieceCategorie | undefined {
  const v = String(raw || '').trim()
  return v in PIECE_CATEGORIE_LABELS ? (v as PieceCategorie) : undefined
}

export function parsePieceEmplacement(raw: unknown): PieceEmplacement {
  const v = String(raw || '').trim()
  if (v === 'vehicule' || v === 'depot') return v
  return 'atelier'
}

export function blankPiece(): Omit<PieceDetachee, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    reference: '',
    designation: '',
    categorie: 'autre',
    marque: '',
    fournisseur: '',
    quantite: 0,
    unite: 'u',
    seuilAlerte: undefined,
    prixUnitaireHt: undefined,
    emplacement: 'atelier',
    rayon: '',
    assigneeUserId: undefined,
    assigneeName: undefined,
    codeBarres: '',
    notes: '',
  }
}

export function pieceLabel(p: Pick<PieceDetachee, 'reference' | 'designation'>): string {
  const ref = (p.reference || '').trim()
  const des = (p.designation || '').trim()
  if (ref && des) return `${ref} — ${des}`
  return ref || des || 'Pièce sans libellé'
}

export function pieceStockBas(p: PieceDetachee): boolean {
  const seuil = Number(p.seuilAlerte)
  if (!Number.isFinite(seuil) || seuil <= 0) return false
  return (Number(p.quantite) || 0) <= seuil
}

export function valeurStockPiece(p: PieceDetachee): number {
  const q = Number(p.quantite) || 0
  const pu = Number(p.prixUnitaireHt)
  if (!Number.isFinite(pu) || pu <= 0) return 0
  return q * pu
}

export function resumeStockPieces(pieces: PieceDetachee[] | undefined): {
  totalArticles: number
  alertes: number
  valeurHt: number
} {
  const list = pieces || []
  let alertes = 0
  let valeurHt = 0
  for (const p of list) {
    if (pieceStockBas(p)) alertes += 1
    valeurHt += valeurStockPiece(p)
  }
  return { totalArticles: list.length, alertes, valeurHt }
}

/** Accès édition stock pièces : gérant, magasinier désigné, ou bureau si pas de magasinier. */
export function peutGererPiecesDetachees(opts: {
  isOwner: boolean
  userId?: string
  magasinierUserId?: string
  poste?: unknown
  peutVoirIdentitesRh?: boolean
}): boolean {
  if (opts.isOwner) return true
  const uid = (opts.userId || '').trim()
  if (!uid) return false
  const mag = (opts.magasinierUserId || '').trim()
  if (mag) return uid === mag
  if (opts.peutVoirIdentitesRh) return true
  if (parsePostePersonnel(opts.poste) === 'magasinier') return true
  if (isPosteBureau(opts.poste)) return true
  return false
}

export function labelGestionnairePieces(opts: {
  magasinierUserId?: string
  magasinierName?: string
}): string {
  const mag = (opts.magasinierUserId || '').trim()
  if (mag) {
    return opts.magasinierName?.trim()
      ? `Magasinier : ${opts.magasinierName.trim()}`
      : 'Magasinier désigné'
  }
  return 'Géré par le bureau'
}

export function mouvementsPourPiece(
  mouvements: PieceMouvement[] | undefined,
  pieceId: string,
): PieceMouvement[] {
  return (mouvements || [])
    .filter((m) => m.pieceId === pieceId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function sensPourKind(kind: PieceMouvementKind): PieceMouvementSens {
  if (kind === 'sortie_ot' || kind === 'sortie_manuelle' || kind === 'perte') return 'sortie'
  if (kind === 'retour' || kind === 'entree_achat' || kind === 'reception_commande') return 'entree'
  return 'entree'
}

export type AppliquerMouvementPieceOpts = {
  piece: PieceDetachee
  kind: PieceMouvementKind
  quantite: number
  sens?: PieceMouvementSens
  otId?: string
  otNumero?: string
  commandeFournisseurId?: string
  commandeNumero?: string
  clientId?: string
  chantierId?: string
  emplacementApres?: PieceEmplacement
  assigneeUserId?: string
  assigneeName?: string
  motif?: string
  parUserId?: string
  parUserName?: string
  now?: string
  mouvementId?: string
}

export function appliquerMouvementPiece(opts: AppliquerMouvementPieceOpts): {
  piece: PieceDetachee
  mouvement: PieceMouvement
} {
  const now = opts.now || new Date().toISOString()
  const sens = opts.sens || sensPourKind(opts.kind)
  const q = Math.max(0, Number(opts.quantite) || 0)
  if (q <= 0 && opts.kind !== 'inventaire') {
    throw new Error('Quantité invalide.')
  }

  const avant = Number(opts.piece.quantite) || 0
  let apres = avant
  if (opts.kind === 'inventaire') {
    apres = q
  } else if (sens === 'entree') {
    apres = avant + q
  } else {
    apres = avant - q
    if (apres < -1e-9) {
      throw new Error(`Stock insuffisant (${avant} ${opts.piece.unite} disponible).`)
    }
  }

  const emplacementApres = opts.emplacementApres || opts.piece.emplacement
  const piece: PieceDetachee = {
    ...opts.piece,
    quantite: Math.max(0, apres),
    emplacement: emplacementApres,
    assigneeUserId:
      emplacementApres === 'vehicule'
        ? opts.assigneeUserId || opts.piece.assigneeUserId
        : emplacementApres === 'atelier'
          ? undefined
          : opts.piece.assigneeUserId,
    assigneeName:
      emplacementApres === 'vehicule'
        ? opts.assigneeName || opts.piece.assigneeName
        : emplacementApres === 'atelier'
          ? undefined
          : opts.piece.assigneeName,
    commandeFournisseurId: opts.commandeFournisseurId || opts.piece.commandeFournisseurId,
    updatedAt: now,
  }

  const mouvement: PieceMouvement = {
    id: opts.mouvementId || cryptoRandomId(),
    pieceId: piece.id,
    sens: opts.kind === 'inventaire' ? (apres >= avant ? 'entree' : 'sortie') : sens,
    kind: opts.kind,
    quantite: opts.kind === 'inventaire' ? Math.abs(apres - avant) : q,
    quantiteApres: piece.quantite,
    otId: opts.otId,
    otNumero: opts.otNumero,
    commandeFournisseurId: opts.commandeFournisseurId,
    commandeNumero: opts.commandeNumero,
    clientId: opts.clientId,
    chantierId: opts.chantierId,
    emplacementAvant: opts.piece.emplacement,
    emplacementApres,
    assigneeUserId: piece.assigneeUserId,
    assigneeName: piece.assigneeName,
    motif: opts.motif,
    parUserId: opts.parUserId,
    parUserName: opts.parUserName,
    createdAt: now,
  }

  return { piece, mouvement }
}

function cryptoRandomId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `pm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }
}

/** Trouve une pièce existante par référence (insensible casse). */
export function trouverPieceParReference(
  pieces: PieceDetachee[] | undefined,
  reference: string,
): PieceDetachee | undefined {
  const ref = reference.trim().toLowerCase()
  if (!ref) return undefined
  return (pieces || []).find((p) => (p.reference || '').trim().toLowerCase() === ref)
}

export type ReceptionCommandeResult = {
  piece: PieceDetachee
  mouvement: PieceMouvement
  created: boolean
}

/** Réception commande fournisseur → entrée stock pièces. */
export function receptionCommandeEnStock(opts: {
  pieces: PieceDetachee[]
  commande: CommandeFournisseur
  quantite?: number
  parUserId?: string
  parUserName?: string
  now?: string
  pieceId?: string
}): ReceptionCommandeResult {
  const now = opts.now || new Date().toISOString()
  const ref = (opts.commande.referencePiece || opts.commande.libelle || '').trim()
  if (!ref) throw new Error('Référence ou libellé de pièce manquant sur la commande.')

  const q = Math.max(1, Number(opts.commande.quantite) || Number(opts.quantite) || 1)
  const existing =
    trouverPieceParReference(opts.pieces, opts.commande.referencePiece || '') ||
    trouverPieceParReference(opts.pieces, ref)

  if (existing) {
    const { piece, mouvement } = appliquerMouvementPiece({
      piece: existing,
      kind: 'reception_commande',
      quantite: q,
      commandeFournisseurId: opts.commande.id,
      commandeNumero: opts.commande.numero,
      clientId: opts.commande.clientId,
      chantierId: opts.commande.chantierId,
      motif: `Réception ${opts.commande.numero}`,
      parUserId: opts.parUserId,
      parUserName: opts.parUserName,
      now,
    })
    return {
      piece: {
        ...piece,
        designation: piece.designation || opts.commande.libelle,
        fournisseur: piece.fournisseur || opts.commande.fournisseur,
        prixUnitaireHt: piece.prixUnitaireHt ?? opts.commande.prixUnitaireHt,
        categorie: piece.categorie ?? parsePieceCategorie(opts.commande.categorie),
      },
      mouvement,
      created: false,
    }
  }

  const id = opts.pieceId || cryptoRandomId()
  const base: PieceDetachee = {
    id,
    reference: (opts.commande.referencePiece || ref).trim(),
    designation: opts.commande.libelle.trim() || ref,
    categorie: parsePieceCategorie(opts.commande.categorie) || 'autre',
    marque: opts.commande.marque,
    fournisseur: opts.commande.fournisseur,
    quantite: 0,
    unite: (opts.commande.unite || 'u').trim() || 'u',
    seuilAlerte: opts.commande.seuilAlerte,
    prixUnitaireHt: opts.commande.prixUnitaireHt,
    emplacement: 'atelier',
    rayon: opts.commande.rayonStock,
    commandeFournisseurId: opts.commande.id,
    notes: opts.commande.notes,
    createdAt: now,
    updatedAt: now,
  }

  const { piece, mouvement } = appliquerMouvementPiece({
    piece: base,
    kind: 'reception_commande',
    quantite: q,
    commandeFournisseurId: opts.commande.id,
    commandeNumero: opts.commande.numero,
    clientId: opts.commande.clientId,
    chantierId: opts.commande.chantierId,
    motif: `Réception ${opts.commande.numero}`,
    parUserId: opts.parUserId,
    parUserName: opts.parUserName,
    now,
  })

  return { piece, mouvement, created: true }
}

export function posteMagasinier(): PostePersonnelId {
  return 'magasinier'
}
