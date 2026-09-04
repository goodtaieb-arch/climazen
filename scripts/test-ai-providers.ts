/**
 * Tests légers — façade multi-fournisseurs (sans appel réseau).
 * Run: npx tsx scripts/test-ai-providers.ts
 */
import assert from 'node:assert/strict'
import {
  normalizeAiProvider,
  AI_PROVIDER_DEFAULT_MODELS,
  providerErrorHint,
} from '../server/lib/aiProviders.js'
import {
  parseOpenaiKey,
  parseAnthropicKey,
  parseGeminiKey,
  maskApiKey,
} from '../server/lib/orgOpenaiKey.js'

assert.equal(normalizeAiProvider('claude'), 'anthropic')
assert.equal(normalizeAiProvider('google'), 'gemini')
assert.equal(normalizeAiProvider('openai'), 'openai')
assert.equal(normalizeAiProvider(''), 'openai')

assert.ok(AI_PROVIDER_DEFAULT_MODELS.anthropic().includes('claude'))
assert.ok(AI_PROVIDER_DEFAULT_MODELS.gemini().includes('gemini'))

assert.equal(parseOpenaiKey('sk-proj-abcdefghijklmnopqrstuvwxyz').ok, true)
assert.equal(parseOpenaiKey('bad').ok, false)
assert.equal(parseAnthropicKey('sk-ant-abcdefghijklmnopqrstuvwxyz').ok, true)
assert.equal(parseAnthropicKey('sk-proj-abc').ok, false)
assert.equal(parseGeminiKey('AIzaSyDummyKeyForTests1234567890').ok, true)

assert.ok(maskApiKey('sk-ant-abcdefghijklmnop', 'anthropic').includes('sk-ant'))
assert.ok(providerErrorHint('anthropic', 401).includes('Anthropic') || providerErrorHint('anthropic', 401).includes('Claude'))

console.log('ok — ai providers')
