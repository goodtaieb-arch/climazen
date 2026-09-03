import assert from 'node:assert/strict'
import { formatHeure } from '../src/lib/agenda'
import {
  extractAgendaTechQuery,
  parseAgendaHeure,
  parseTerrainIntent,
} from '../src/lib/assistantTerrainActions'
import { emptyData } from '../src/lib/storage'

assert.equal(formatHeure('09:30'), '09:30')
assert.equal(formatHeure('9:30'), '09:30')
assert.equal(formatHeure('09h30'), '09:30')
assert.equal(formatHeure('9h30'), '09:30')
assert.equal(formatHeure('9h'), '09:00')
assert.equal(formatHeure(''), '')
assert.equal(formatHeure('abc'), '')

assert.equal(parseAgendaHeure('à 9h30'), '09:30')
assert.equal(parseAgendaHeure('demain 14h'), '14:00')

assert.ok(/am[eé]lie/i.test(extractAgendaTechQuery('planifie une visite pour Amélie demain à 9h30')))
assert.ok(/am[eé]lie/i.test(extractAgendaTechQuery('RDV tech Amélie Durand le 15/10 à 9h30')))
assert.ok(!/\sà\s*$/i.test(extractAgendaTechQuery('planifie une visite pour Amélie demain à 9h30')))

const intent = parseTerrainIntent('planifie une visite pour Amélie demain à 9h30')
assert.equal(intent?.kind, 'agenda')
if (intent?.kind === 'agenda') {
  assert.equal(intent.heure, '09:30')
  assert.ok(/am[eé]lie/i.test(intent.techQuery || ''), `techQuery=${intent.techQuery}`)
  assert.ok(!intent.clientQuery || !/am[eé]lie/i.test(intent.clientQuery))
  assert.ok(!/pour Amélie/i.test(intent.siteQuery || ''))
}

// Smoke : empty data exécutable
assert.ok(emptyData())

console.log('test-agenda-tech-heure: ok')
