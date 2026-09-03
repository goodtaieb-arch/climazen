import assert from 'node:assert/strict'
import {
  extractTechnicalMentions,
  extractCorrectionPair,
  normalizeTechnicalText,
  anonymizeForLearning,
} from '../server/lib/aiVocabularyCore.js'

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

const anon = anonymizeForLearning(
  'Mr Dupont tél 06 12 34 56 78 mail jean.dupont@exemple.fr 12 rue de la Paix 06000 Nice SIRET 123 456 789 00012 clim R-32 monobloc',
)
assert.ok(!anon.includes('Dupont'), anon)
assert.ok(!anon.includes('06 12 34 56 78'), anon)
assert.ok(!anon.includes('jean.dupont'), anon)
assert.ok(!anon.includes('123 456 789 00012'), anon)
assert.ok(anon.includes('[tel]') || anon.includes('[email]') || anon.includes('[client]'), anon)
assert.ok(!anon.includes('@exemple'), anon)

console.log('ok test-ai-vocabulary-core')
