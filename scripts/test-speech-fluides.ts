/**
 * Tests — correction fluides dictés (iPhone).
 * Run: npx tsx scripts/test-speech-fluides.ts
 */
import assert from 'node:assert/strict'
import { applySpeechCorrections, normalizeSpeechFluides } from '../src/lib/speech'

assert.equal(normalizeSpeechFluides('R. 4 110'), 'R-410A')
assert.equal(normalizeSpeechFluides('R 4 110'), 'R-410A')
assert.equal(normalizeSpeechFluides('charge R.4110A sur le site'), 'charge R-410A sur le site')
assert.equal(normalizeSpeechFluides('fluide R410a'), 'fluide R-410A')
assert.equal(normalizeSpeechFluides('erre quatre cent dix a'), 'R-410A')
assert.equal(normalizeSpeechFluides('bouteille R 32'), 'bouteille R-32')
assert.equal(normalizeSpeechFluides('R.32'), 'R-32')

assert.ok(applySpeechCorrections('ajoute bouteille R. 4 110').includes('R-410A'))
assert.ok(applySpeechCorrections('R 4 110 pour le CERFA').includes('R-410A'))

console.log('ok — speech fluides')
