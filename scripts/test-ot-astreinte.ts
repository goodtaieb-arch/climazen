import assert from 'node:assert/strict'
import { blankOrdreTravail, otEstAstreinte } from '../src/lib/ordreTravail'

assert.equal(otEstAstreinte(undefined), false)
assert.equal(otEstAstreinte({}), false)
assert.equal(otEstAstreinte({ astreinte: false }), false)
assert.equal(otEstAstreinte({ astreinte: true }), true)
assert.equal(blankOrdreTravail().astreinte, false)

console.log('test-ot-astreinte: ok')
