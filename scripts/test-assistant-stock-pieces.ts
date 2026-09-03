import assert from 'node:assert/strict'
import {
  wantsStockPieceQuery,
  wantsStockPieceVeille,
  extractPieceQuery,
  answerStockPieceQuery,
  findPiecesMatching,
  veillesANotifier,
  type PieceVeille,
} from '../src/lib/assistantStockPieces'
import { AI_HOW_I_WORK } from '../src/lib/aiActionCatalog'
import type { AppData } from '../src/lib/types'
import { emptyData } from '../src/lib/storage'

assert.ok(AI_HOW_I_WORK.includes('PROPOSE'))
assert.ok(AI_HOW_I_WORK.includes('stock'))

assert.equal(wantsStockPieceQuery('combien de filtre M5 en a en stock'), true)
assert.equal(wantsStockPieceQuery('le filtre M5 est arrive ?'), true)
assert.equal(wantsStockPieceQuery('crée un OT dépannage'), false)
assert.equal(wantsStockPieceVeille('previens moi quand le filtre M5 arrive'), true)
assert.equal(wantsStockPieceVeille('préviens-moi si le compresseur arrive'), true)
assert.equal(wantsStockPieceVeille('combien de filtre M5'), false)

assert.ok(extractPieceQuery('combien de filtre M5 en stock').toLowerCase().includes('m5'))

const data = {
  ...emptyData(),
  piecesDetachees: [
    {
      id: 'p1',
      reference: 'FILTRE-M5',
      designation: 'Filtre plissé M5',
      quantite: 12,
      unite: 'u',
      emplacement: 'atelier' as const,
      createdAt: '',
      updatedAt: '',
    },
  ],
  commandesFournisseur: [
    {
      id: 'c1',
      numero: 'CF2026001',
      fournisseur: 'Daikin',
      statut: 'commandee' as const,
      libelle: 'Compresseur scroll',
      referencePiece: 'COMP-01',
      createdAt: '',
      updatedAt: '',
    },
  ],
} as AppData

const reply = answerStockPieceQuery(data, 'combien de filtre M5')
assert.ok(reply.includes('12'))
assert.ok(/disponible|magasin/i.test(reply))

const cmdReply = answerStockPieceQuery(data, 'le compresseur est arrive')
assert.ok(/pas encore|command/i.test(cmdReply))

assert.equal(findPiecesMatching(data.piecesDetachees, 'filtre M5').length, 1)

const veilles: PieceVeille[] = [
  {
    id: 'v1',
    query: 'filtre M5',
    statut: 'active',
    createdAt: '',
    demandeurName: 'Julie',
  },
]
const hits = veillesANotifier(veilles, { piece: data.piecesDetachees![0] })
assert.equal(hits.length, 1)
assert.equal(hits[0].demandeurName, 'Julie')

console.log('test-assistant-stock-pieces: ok')
