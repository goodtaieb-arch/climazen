/**
 * Intelligence A→Z — catalogue + parsing devis/commande/pièce + validation gate.
 */
import assert from 'node:assert/strict'
import {
  AI_ACTION_DOMAINS,
  AI_HUMAN_GATE,
  catalogSummaryForUi,
  isForbiddenClaim,
} from '../src/lib/aiActionCatalog'
import { extractCommercialActionFromReply } from '../src/lib/assistantActions'
import { parseTerrainIntent } from '../src/lib/assistantTerrainActions'

assert.ok(AI_ACTION_DOMAINS.length >= 9)
assert.ok(AI_HUMAN_GATE.includes('VALIDATION HUMAINE'))
assert.ok(catalogSummaryForUi().includes('Devis'))

assert.equal(isForbiddenClaim('C’est fait, j’ai créé l’OT.'), true)
assert.equal(isForbiddenClaim('Je propose un devis. Répondez oui pour créer.'), false)

const devis = parseTerrainIntent('crée un devis pour Dupont site Atelier')
assert.equal(devis?.kind, 'devis')
if (devis?.kind === 'devis') {
  assert.ok(devis.clientQuery.toLowerCase().includes('dupont'))
  assert.match(devis.summary, /oui/i)
}

const commande = parseTerrainIntent('commande 2 pièces filtre M5 chez Daikin')
assert.equal(commande?.kind, 'commande')
if (commande?.kind === 'commande') {
  assert.ok(commande.quantite >= 1)
}

const piece = parseTerrainIntent('ajoute pièce FILTRE-M5 filtre plissé stock magasin atelier')
assert.equal(piece?.kind, 'piece')

const fromJson = extractCommercialActionFromReply(`Voici la proposition.
\`\`\`json
{"action":"propose_create_devis","clientQuery":"Martin","siteQuery":"Usine","libelle":"Devis clim","montantHt":1200}
\`\`\`
`)
assert.equal(fromJson?.kind, 'devis')
if (fromJson?.kind === 'devis') {
  assert.equal(fromJson.clientQuery, 'Martin')
  assert.equal(fromJson.montantHt, 1200)
}

const cmdJson = extractCommercialActionFromReply(
  `{"action":"propose_create_commande","fournisseur":"Daikin","libelle":"Compresseur","quantite":1}`,
)
assert.equal(cmdJson?.kind, 'commande')

const pieceJson = extractCommercialActionFromReply(
  `{"action":"propose_create_piece","reference":"F1","designation":"Filtre","quantite":5,"emplacement":"vehicule"}`,
)
assert.equal(pieceJson?.kind, 'piece')
if (pieceJson?.kind === 'piece') {
  assert.equal(pieceJson.emplacement, 'vehicule')
}

console.log('ok test-ai-az-validation')
