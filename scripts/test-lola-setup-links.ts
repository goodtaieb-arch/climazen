import assert from 'node:assert/strict'
import { LOLA_SETUP_LINKS, LOLA_WEBHOOK_URL } from '../src/lib/lolaSetupLinks'

for (const [id, link] of Object.entries(LOLA_SETUP_LINKS)) {
  assert.ok(link.href.startsWith('https://'), id)
  assert.ok(link.label.length > 4, id)
}

assert.equal(LOLA_WEBHOOK_URL, 'https://climazen.fr/api/telephony-inbound')
assert.ok(LOLA_SETUP_LINKS.openaiKeys.href.includes('api-keys'))
assert.ok(LOLA_SETUP_LINKS.twilioBuyNumber.href.includes('phone-numbers'))

console.log('test-lola-setup-links: ok')
