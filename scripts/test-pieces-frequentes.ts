import assert from 'node:assert/strict'
import {
  PIECES_FREQUENTES_SEED,
  buildMemoirePieces,
  queryDemandeDevisStock,
} from '../src/lib/piecesFrequentes'
import { STATUT_COMMANDE_FOURNISSEUR_LABELS } from '../src/lib/chaineCommerciale'

assert.ok(PIECES_FREQUENTES_SEED.length >= 8)
assert.ok(PIECES_FREQUENTES_SEED.some((p) => /gant/i.test(p.designation)))
assert.ok(PIECES_FREQUENTES_SEED.some((p) => /brasure/i.test(p.designation)))
assert.ok(PIECES_FREQUENTES_SEED.some((p) => /désinfectant|desinfectant/i.test(p.designation)))

assert.equal(STATUT_COMMANDE_FOURNISSEUR_LABELS.demande_devis, 'Demande de devis')

const mem = buildMemoirePieces({
  pieces: [
    {
      id: 'p1',
      reference: 'EPI-GANT-NIT',
      designation: 'Gants nitrile (boîte)',
      quantite: 1,
      unite: 'boîte',
      emplacement: 'atelier',
      favori: true,
      createdAt: '',
      updatedAt: '',
    },
  ],
  commandes: [
    {
      id: 'c1',
      numero: 'CF1',
      fournisseur: 'X',
      statut: 'commandee',
      libelle: 'Baguettes de brasure cuivre-phosphore',
      referencePiece: 'BRAS-BAG-CUIVRE',
      destination: 'stock',
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'c2',
      numero: 'CF2',
      fournisseur: 'X',
      statut: 'demande_devis',
      libelle: 'Baguettes de brasure cuivre-phosphore',
      referencePiece: 'BRAS-BAG-CUIVRE',
      destination: 'stock',
      createdAt: '',
      updatedAt: '',
    },
  ],
  limit: 20,
})

assert.ok(mem[0].favori)
assert.ok(mem.some((m) => m.reference === 'BRAS-BAG-CUIVRE' && m.foisCommandee === 2))

const url = queryDemandeDevisStock({
  reference: 'EPI-GANT-NIT',
  designation: 'Gants nitrile (boîte)',
  quantite: 3,
})
assert.ok(url.includes('dest=stock'))
assert.ok(url.includes('statut=demande_devis'))
assert.ok(url.includes('ref=EPI-GANT-NIT'))

console.log('test-pieces-frequentes: ok')
