/**
 * Tests — dédup / collapse des répétitions STT (Chrome continuous).
 * Run: npx tsx scripts/test-speech-dedupe.ts
 */
import assert from 'node:assert/strict'
import {
  appendSpeechChunk,
  applySpeechCorrections,
  collapseSpeechRepetitions,
  mergeSpeechFinals,
} from '../src/lib/speech'

assert.equal(collapseSpeechRepetitions('donc donc donc'), 'donc')
assert.equal(
  collapseSpeechRepetitions(
    'donc faites-moi la commande donc faites-moi la commande donc faites-moi la commande',
  ),
  'donc faites-moi la commande',
)
assert.equal(
  collapseSpeechRepetitions(
    'donc donc donc faites-moi donc faites-moi la donc faites-moi la commande donc faites-moi la commande pour responsable donc faites-moi la commande pour responsable',
  ).includes('donc faites-moi la commande pour responsable'),
  true,
)
assert.ok(
  !/donc faites-moi la commande pour responsable donc faites-moi/.test(
    collapseSpeechRepetitions(
      'donc faites-moi la commande pour responsable donc faites-moi la commande pour responsable donc faites-moi la commande pour responsable',
    ),
  ),
)

assert.equal(appendSpeechChunk('', 'faites-moi la commande'), 'faites-moi la commande')
assert.equal(
  appendSpeechChunk('faites-moi la commande', 'faites-moi la commande'),
  'faites-moi la commande',
)
assert.equal(
  appendSpeechChunk('faites-moi', 'faites-moi la commande'),
  'faites-moi la commande',
)
assert.equal(
  appendSpeechChunk('donc faites-moi la', 'faites-moi la commande'),
  'donc faites-moi la commande',
)

const cleaned = applySpeechCorrections(
  'donc donc faites-moi la commande donc faites-moi la commande pour responsable pour responsable',
)
assert.ok(cleaned.toLowerCase().includes('commande'))
assert.ok(cleaned.split(/\s+/).length < 20)

assert.equal(
  mergeSpeechFinals([
    'faites-moi la commande',
    'faites-moi la commande',
    'faites-moi la commande pour responsable',
  ]),
  'faites-moi la commande pour responsable',
)

console.log('test-speech-dedupe: ok')
