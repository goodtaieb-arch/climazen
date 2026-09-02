import assert from 'node:assert/strict'
import {
  extractTechnicalMentions,
  extractCorrectionPair,
  normalizeTechnicalText,
} from '../api/lib/aiVocabularyCore.js'

const mentions = extractTechnicalMentions(
  'Panne clim monobloc R 32 au RDC — contrôle étanchéité et CERFA pour client Dupont',
)
assert.ok(mentions.some((m) => m.canonical === 'R-32'))
assert.ok(mentions.some((m) => m.canonical === 'monobloc'))
assert.ok(
  mentions.some(
    (m) => m.canonical === "contrôle d'étanchéité" || m.canonical === 'CERFA 15497',
  ),
)

assert.equal(normalizeTechnicalText('R 410 A sur PAC'), 'R-410A sur PAC')

const pair = extractCorrectionPair(
  'charge fluide R 134',
  'non plutôt R-32 pour la PAC',
)
assert.ok(pair)
assert.ok(pair?.canonical === 'R-32' || pair?.canonical === 'PAC')

console.log('ok test-ai-vocabulary-core')
