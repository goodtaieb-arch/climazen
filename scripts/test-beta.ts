import assert from 'node:assert/strict'
import { APP_IS_BETA, APP_VERSION } from '../src/lib/buildStamp'

assert.equal(APP_IS_BETA, true)
assert.equal(APP_VERSION, 'v157')
console.log('ok test-beta')
