/**
 * Mémoire des pièces souvent commandées (magasin) + catalogue de base consommables.
 */

import type { CommandeFournisseur } from './chaineCommerciale'
import type { PieceCategorie, PieceDetachee } from './piecesDetachees'
import { pieceLabel } from './piecesDetachees'

export type PieceFrequenteSeed = {
  reference: string
  designation: string
  categorie: PieceCategorie
  unite: string
  seuilAlerte?: number
  /** Fournisseur type (indicatif). */
  fournisseur?: string
}

/** Catalogue de base — EPI / brasure / hygiène chantier CVC. */
export const PIECES_FREQUENTES_SEED: PieceFrequenteSeed[] = [
  {
    reference: 'EPI-GANT-NIT',
    designation: 'Gants nitrile (boîte)',
    categorie: 'outillage',
    unite: 'boîte',
    seuilAlerte: 2,
  },
  {
    reference: 'EPI-GANT-CUIR',
    designation: 'Gants cuir / manutention',
    categorie: 'outillage',
    unite: 'paire',
    seuilAlerte: 4,
  },
  {
    reference: 'BRAS-BAG-CUIVRE',
    designation: 'Baguettes de brasure cuivre-phosphore',
    categorie: 'consommable',
    unite: 'kg',
    seuilAlerte: 1,
  },
  {
    reference: 'BRAS-BAG-ARGENT',
    designation: 'Baguettes de brasure argent',
    categorie: 'consommable',
    unite: 'kg',
    seuilAlerte: 1,
  },
  {
    reference: 'HYG-DESINF',
    designation: 'Produit désinfectant surfaces / clim',
    categorie: 'consommable',
    unite: 'L',
    seuilAlerte: 2,
  },
  {
    reference: 'HYG-LINGETTE',
    designation: 'Lingettes techniques désinfectantes',
    categorie: 'consommable',
    unite: 'boîte',
    seuilAlerte: 2,
  },
  {
    reference: 'HYG-SPRAY-CLIM',
    designation: 'Spray nettoyage / désodorisant clim',
    categorie: 'consommable',
    unite: 'u',
    seuilAlerte: 3,
  },
  {
    reference: 'CONS-RUBAN-ISO',
    designation: 'Ruban isolant électrique',
    categorie: 'consommable',
    unite: 'u',
    seuilAlerte: 5,
  },
  {
    reference: 'CONS-COLLIER',
    designation: 'Colliers nylon (sachet)',
    categorie: 'consommable',
    unite: 'sachet',
    seuilAlerte: 3,
  },
  {
    reference: 'CONS-GRAISSE-SIL',
    designation: 'Graisse silicone',
    categorie: 'consommable',
    unite: 'u',
    seuilAlerte: 2,
  },
  {
    reference: 'CONS-TEFLON',
    designation: 'Ruban téflon / PTFE',
    categorie: 'consommable',
    unite: 'u',
    seuilAlerte: 5,
  },
  {
    reference: 'CONS-NETTOY-SERP',
    designation: 'Nettoyant serpentin / batterie',
    categorie: 'consommable',
    unite: 'L',
    seuilAlerte: 2,
  },
]

export type PieceMemoireItem = {
  key: string
  reference: string
  designation: string
  categorie?: PieceCategorie
  unite?: string
  seuilAlerte?: number
  fournisseur?: string
  /** Nombre de commandes / demandes historiques. */
  foisCommandee: number
  favori: boolean
  pieceId?: string
  quantiteStock?: number
  fromSeed: boolean
}

function normRef(r?: string): string {
  return (r || '').trim().toUpperCase()
}

function keyOf(ref: string, designation: string): string {
  const r = normRef(ref)
  if (r) return `ref:${r}`
  return `des:${(designation || '').trim().toLowerCase()}`
}

/** Agrège commandes + favoris catalogue + seed pour la mémoire magasin. */
export function buildMemoirePieces(opts: {
  pieces?: PieceDetachee[]
  commandes?: CommandeFournisseur[]
  limit?: number
}): PieceMemoireItem[] {
  const limit = opts.limit ?? 24
  const map = new Map<string, PieceMemoireItem>()

  for (const seed of PIECES_FREQUENTES_SEED) {
    const key = keyOf(seed.reference, seed.designation)
    map.set(key, {
      key,
      reference: seed.reference,
      designation: seed.designation,
      categorie: seed.categorie,
      unite: seed.unite,
      seuilAlerte: seed.seuilAlerte,
      fournisseur: seed.fournisseur,
      foisCommandee: 0,
      favori: false,
      fromSeed: true,
    })
  }

  for (const p of opts.pieces || []) {
    const key = keyOf(p.reference, p.designation)
    const prev = map.get(key)
    map.set(key, {
      key,
      reference: (p.reference || prev?.reference || '').trim(),
      designation: (p.designation || prev?.designation || '').trim() || pieceLabel(p),
      categorie: p.categorie || prev?.categorie,
      unite: p.unite || prev?.unite,
      seuilAlerte: p.seuilAlerte ?? prev?.seuilAlerte,
      fournisseur: p.fournisseur || prev?.fournisseur,
      foisCommandee: prev?.foisCommandee || 0,
      favori: Boolean(p.favori),
      pieceId: p.id,
      quantiteStock: Number(p.quantite) || 0,
      fromSeed: false,
    })
  }

  for (const c of opts.commandes || []) {
    if (c.statut === 'annulee') continue
    const ref = (c.referencePiece || '').trim()
    const des = (c.libelle || '').trim()
    if (!ref && !des) continue
    const key = keyOf(ref, des)
    const prev = map.get(key)
    map.set(key, {
      key,
      reference: ref || prev?.reference || '',
      designation: des || prev?.designation || ref,
      categorie: (c.categorie as PieceCategorie | undefined) || prev?.categorie,
      unite: c.unite || prev?.unite,
      seuilAlerte: c.seuilAlerte ?? prev?.seuilAlerte,
      fournisseur: c.fournisseur || prev?.fournisseur,
      foisCommandee: (prev?.foisCommandee || 0) + 1,
      favori: Boolean(prev?.favori),
      pieceId: prev?.pieceId,
      quantiteStock: prev?.quantiteStock,
      fromSeed: Boolean(prev?.fromSeed) && !prev?.pieceId,
    })
  }

  const all = [...map.values()]
  all.sort((a, b) => {
    if (a.favori !== b.favori) return a.favori ? -1 : 1
    if (b.foisCommandee !== a.foisCommandee) return b.foisCommandee - a.foisCommandee
    if (Boolean(a.pieceId) !== Boolean(b.pieceId)) return a.pieceId ? -1 : 1
    return a.designation.localeCompare(b.designation, 'fr')
  })

  // Toujours garder les favoris + seed utiles + top commandés
  const favoris = all.filter((x) => x.favori)
  const commanded = all.filter((x) => x.foisCommandee > 0 && !x.favori)
  const seeds = all.filter((x) => x.fromSeed && !x.favori && x.foisCommandee === 0)
  const rest = all.filter(
    (x) => !x.favori && x.foisCommandee === 0 && !x.fromSeed,
  )
  const out: PieceMemoireItem[] = []
  const seen = new Set<string>()
  for (const list of [favoris, commanded, seeds, rest]) {
    for (const item of list) {
      if (seen.has(item.key)) continue
      seen.add(item.key)
      out.push(item)
      if (out.length >= limit) return out
    }
  }
  return out
}

/** Query string pour ouvrir une demande de devis / commande stock. */
export function queryDemandeDevisStock(item: {
  reference?: string
  designation?: string
  quantite?: number
  unite?: string
  categorie?: string
  fournisseur?: string
  seuilAlerte?: number
  pieceId?: string
}): string {
  const qs = new URLSearchParams()
  qs.set('new', '1')
  qs.set('dest', 'stock')
  qs.set('statut', 'demande_devis')
  if (item.designation) qs.set('libelle', item.designation)
  if (item.reference) qs.set('ref', item.reference)
  if (item.quantite && item.quantite > 0) qs.set('qte', String(item.quantite))
  if (item.unite) qs.set('unite', item.unite)
  if (item.categorie) qs.set('cat', item.categorie)
  if (item.fournisseur) qs.set('fournisseur', item.fournisseur)
  if (item.seuilAlerte != null) qs.set('seuil', String(item.seuilAlerte))
  if (item.pieceId) qs.set('piece', item.pieceId)
  return `/app/commandes?${qs.toString()}`
}
