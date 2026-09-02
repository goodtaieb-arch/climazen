/**
 * Tests stock pièces détachées GMAO — mouvements et accès magasinier / bureau.
 */
import assert from 'node:assert/strict'
import {
  appliquerMouvementPiece,
  blankPiece,
  peutGererPiecesDetachees,
  pieceStockBas,
  receptionCommandeEnStock,
  resumeStockPieces,
} from '../src/lib/piecesDetachees'
import type { CommandeFournisseur } from '../src/lib/chaineCommerciale'

function testMouvements() {
  const now = '2026-01-01T12:00:00.000Z'
  const base = {
    ...blankPiece(),
    id: 'p1',
    reference: 'FILTRE-01',
    designation: 'Filtre plissé',
    quantite: 5,
    createdAt: now,
    updatedAt: now,
  }

  const entree = appliquerMouvementPiece({
    piece: base,
    kind: 'entree_achat',
    quantite: 3,
    now,
  })
  assert.equal(entree.piece.quantite, 8)
  assert.equal(entree.mouvement.sens, 'entree')

  const sortie = appliquerMouvementPiece({
    piece: entree.piece,
    kind: 'sortie_ot',
    quantite: 2,
    otId: 'ot1',
    otNumero: 'OT20260001',
    now,
  })
  assert.equal(sortie.piece.quantite, 6)

  const inv = appliquerMouvementPiece({
    piece: sortie.piece,
    kind: 'inventaire',
    quantite: 10,
    now,
  })
  assert.equal(inv.piece.quantite, 10)

  let threw = false
  try {
    appliquerMouvementPiece({
      piece: { ...inv.piece, quantite: 1 },
      kind: 'sortie_manuelle',
      quantite: 5,
      now,
    })
  } catch {
    threw = true
  }
  assert.equal(threw, true)
}

function testReceptionCommande() {
  const cmd: CommandeFournisseur = {
    id: 'cf1',
    numero: 'CF20260001',
    fournisseur: 'PartsCo',
    statut: 'commandee',
    libelle: 'Compresseur scroll',
    referencePiece: 'COMP-220',
    quantite: 2,
    unite: 'u',
    prixUnitaireHt: 450,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
  const r1 = receptionCommandeEnStock({ pieces: [], commande: cmd })
  assert.equal(r1.created, true)
  assert.equal(r1.piece.quantite, 2)
  assert.equal(r1.piece.reference, 'COMP-220')

  const r2 = receptionCommandeEnStock({
    pieces: [r1.piece],
    commande: { ...cmd, id: 'cf2', numero: 'CF20260002', quantite: 1 },
  })
  assert.equal(r2.created, false)
  assert.equal(r2.piece.quantite, 3)
}

function testAcces() {
  assert.equal(
    peutGererPiecesDetachees({ isOwner: true, userId: 'u1' }),
    true,
  )
  assert.equal(
    peutGererPiecesDetachees({
      isOwner: false,
      userId: 'mag1',
      magasinierUserId: 'mag1',
    }),
    true,
  )
  assert.equal(
    peutGererPiecesDetachees({
      isOwner: false,
      userId: 'tech1',
      magasinierUserId: 'mag1',
      poste: 'magasinier',
    }),
    true,
  )
  assert.equal(
    peutGererPiecesDetachees({
      isOwner: false,
      userId: 'tech1',
      magasinierUserId: 'mag1',
    }),
    false,
  )
  assert.equal(
    peutGererPiecesDetachees({
      isOwner: false,
      userId: 'sec1',
      poste: 'secretaire',
    }),
    true,
  )
}

function testAlertes() {
  const p = {
    ...blankPiece(),
    id: 'x',
    reference: 'A',
    designation: 'B',
    quantite: 2,
    seuilAlerte: 3,
    emplacement: 'atelier' as const,
    unite: 'u',
    createdAt: '',
    updatedAt: '',
  }
  assert.equal(pieceStockBas(p), true)
  const kpi = resumeStockPieces([p])
  assert.equal(kpi.alertes, 1)
}

testMouvements()
testReceptionCommande()
testAcces()
testAlertes()
console.log('test-pieces-detachees: OK')
