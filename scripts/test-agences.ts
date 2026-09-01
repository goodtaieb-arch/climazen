import assert from 'node:assert/strict'
import {
  agenceDepuisCodePostal,
  agenceEffective,
  labelAgence,
  parseAgenceCode,
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

console.log('test-agences: ok')
