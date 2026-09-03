import assert from 'node:assert/strict'
import { maskOpenaiKey, parseOpenaiKey } from '../server/lib/orgOpenaiKey.js'

assert.equal(parseOpenaiKey('').ok, false)
assert.equal(parseOpenaiKey('sk-short').ok, false)
assert.equal(parseOpenaiKey('not-a-key-at-all-but-long-enough-xxx').ok, false)

const ok = parseOpenaiKey('sk-proj-abcdefghijklmnopqrstuvwxyz012345')
assert.equal(ok.ok, true)
if (ok.ok) {
  assert.equal(maskOpenaiKey(ok.key), 'sk-…2345')
}

assert.equal(maskOpenaiKey('sk-abcdefghijklmnopqrstuv'), 'sk-…stuv')
assert.equal(maskOpenaiKey('abc'), '')

console.log('test-org-openai-key: ok')
