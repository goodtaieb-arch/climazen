/**
 * Tests — détection pièces HS + chaîne devis / commande depuis rapport OT.
 * Run: npx tsx scripts/test-assistant-chaine-piece.ts
 */
import assert from 'node:assert/strict'
import {
  detectPiecesHsFromText,
  wantsChainePieceQuery,
  buildChainePieceProposal,
} from '../src/lib/assistantChainePiece'
import type { AppData } from '../src/lib/types'
import { emptyData } from '../src/lib/storage'

assert.ok(wantsChainePieceQuery('Analyse le rapport OT — pièces à commander'))
assert.ok(wantsChainePieceQuery('Ventilo fait bruit changer sur équipe'))
assert.equal(wantsChainePieceQuery('bonjour'), false)

const pieces = detectPiecesHsFromText(
  'Ventilo fait du bruit — à changer sur l’unité extérieure. Compresseur OK.',
)
assert.ok(pieces.some((p) => /ventil/i.test(p.designation)), JSON.stringify(pieces))
assert.equal(pieces.length >= 1, true)

const hs = detectPiecesHsFromText('Compresseur HS à commander urgence')
assert.ok(hs.some((p) => /compresseur/i.test(p.designation)))

const none = detectPiecesHsFromText('Maintenance OK, rien à signaler')
assert.equal(none.length, 0)

const data = {
  ...emptyData(),
  clients: [
    {
      id: 'c1',
      raisonSociale: 'Client Test',
      typeClient: 'entreprise',
      nom: '',
      prenom: '',
      nomContact: '',
      adresse: '',
      codePostal: '',
      ville: '',
      telephone: '',
      email: '',
      createdAt: '',
    },
  ],
  chantiers: [
    {
      id: 's1',
      clientId: 'c1',
      nom: 'Site A',
      adresse: '',
      codePostal: '',
      ville: '',
      createdAt: '',
    },
  ],
  ordresTravail: [
    {
      id: 'ot1',
      numero: '26090499',
      typeOt: 'depanage',
      statut: 'en_cours',
      date: '2026-09-04',
      action: 'Bruit UE',
      rapportAction: 'Ventilo fait bruit — à changer',
      observations: 'Commander pièce',
      technicien: 'Tech',
      clientId: 'c1',
      chantierId: 's1',
      createdAt: '',
      updatedAt: '',
    },
  ],
} as unknown as AppData

const prop = buildChainePieceProposal(data, 'pièces à commander sur OT')
assert.equal(prop.ok, true)
if (prop.ok) {
  assert.equal(prop.action.kind, 'chaine_piece')
  assert.equal(prop.action.otId, 'ot1')
  assert.ok(prop.action.pieces.length >= 1)
  assert.ok(/oui/i.test(prop.action.summary))
}

console.log('ok — assistant chaine piece')
