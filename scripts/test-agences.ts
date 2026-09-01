import assert from 'node:assert/strict'
import {
  agenceDepuisCodePostal,
  agenceEffective,
  agencesDuMembre,
  labelAgence,
  matchAgenceFilter,
  parseAgenceCode,
  parseAgencesCouvertes,
} from '../src/lib/agences'

assert.equal(parseAgenceCode('75'), '75')
assert.equal(parseAgenceCode('6'), '06')
assert.equal(parseAgenceCode('06'), '06')
assert.equal(parseAgenceCode('13'), '13')
assert.equal(parseAgenceCode('99'), undefined)
assert.equal(labelAgence('75'), '75 · Paris')
assert.ok(labelAgence('06').includes('Alpes-Maritimes'))
assert.ok(labelAgence('13').includes('Bouches-du-Rhône'))

assert.equal(agenceDepuisCodePostal('75001'), '75')
assert.equal(agenceDepuisCodePostal('06000'), '06')
assert.equal(agenceDepuisCodePostal('13001'), '13')
assert.equal(agenceDepuisCodePostal('20000'), '2A')
assert.equal(agenceDepuisCodePostal('20200'), '2B')
assert.equal(agenceDepuisCodePostal('97400'), '974')

assert.equal(
  agenceEffective({ codePostal: '06000' }),
  '06',
)
assert.equal(
  agenceEffective({ agenceCode: '75', codePostal: '06000' }),
  '75',
)

assert.deepEqual(parseAgencesCouvertes(['06', '13', '06', 'xx']), ['06', '13'])
assert.deepEqual(parseAgencesCouvertes('06'), [])
assert.deepEqual(
  agencesDuMembre({ agenceCode: '06', agencesCouvertes: ['13', '83'] }),
  ['13', '83'],
)
assert.deepEqual(agencesDuMembre({ agenceCode: '6' }), ['06'])
assert.deepEqual(agencesDuMembre({}), [])
assert.equal(matchAgenceFilter('06', []), true)
assert.equal(matchAgenceFilter('06', ['06', '13']), true)
assert.equal(matchAgenceFilter('75', ['06', '13']), false)
assert.equal(matchAgenceFilter(undefined, ['06']), false)

console.log('test-agences: ok')
