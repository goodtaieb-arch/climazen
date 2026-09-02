import assert from 'node:assert/strict'
import { compareOtPrioritePlanning, prioriteTypeOt } from '../src/lib/ordreTravail'

assert.equal(prioriteTypeOt('depanage'), 0)
assert.equal(prioriteTypeOt('installation'), 1)
assert.equal(prioriteTypeOt('maintenance'), 2)
assert.equal(prioriteTypeOt('entretien'), 2)
assert.ok(prioriteTypeOt('depanage') < prioriteTypeOt('installation'))
assert.ok(prioriteTypeOt('installation') < prioriteTypeOt('maintenance'))

const sorted = [
  { typeOt: 'maintenance', numero: '3' },
  { typeOt: 'depanage', numero: '1' },
  { typeOt: 'installation', numero: '2' },
].sort(compareOtPrioritePlanning)
assert.deepEqual(
  sorted.map((x) => x.numero),
  ['1', '2', '3'],
)

console.log('test-ot-priorite-planning: ok')
