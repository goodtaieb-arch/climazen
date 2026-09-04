import assert from 'node:assert/strict'
import {
  infoJourNonOuvre,
  isJourFerieIso,
  isJourNonOuvreIso,
  joursFeriesFrance,
  nomJourFerie,
  paquesIso,
} from '../src/lib/joursFeries'
import { isWeekendIso } from '../src/lib/agenda'

assert.equal(paquesIso(2024), '2024-03-31')
assert.equal(paquesIso(2025), '2025-04-20')
assert.equal(paquesIso(2026), '2026-04-05')
assert.equal(paquesIso(2027), '2027-03-28')

const f2026 = joursFeriesFrance(2026)
assert.equal(f2026.length, 11)
assert.equal(nomJourFerie('2026-01-01'), 'Jour de l’an')
assert.equal(nomJourFerie('2026-04-06'), 'Lundi de Pâques')
assert.equal(nomJourFerie('2026-05-01'), 'Fête du travail')
assert.equal(nomJourFerie('2026-05-08'), 'Victoire 1945')
assert.equal(nomJourFerie('2026-05-14'), 'Ascension')
assert.equal(nomJourFerie('2026-05-25'), 'Lundi de Pentecôte')
assert.equal(nomJourFerie('2026-07-14'), 'Fête nationale')
assert.equal(nomJourFerie('2026-08-15'), 'Assomption')
assert.equal(nomJourFerie('2026-11-01'), 'Toussaint')
assert.equal(nomJourFerie('2026-11-11'), 'Armistice')
assert.equal(nomJourFerie('2026-12-25'), 'Noël')
assert.equal(nomJourFerie('2026-09-04'), null)

assert.equal(isJourFerieIso('2026-05-01'), true)
assert.equal(isWeekendIso('2026-05-01'), false)
assert.equal(isJourNonOuvreIso('2026-05-01'), true)
assert.equal(isJourNonOuvreIso('2026-09-05'), true) // samedi
assert.equal(isJourNonOuvreIso('2026-09-06'), true) // dimanche
assert.equal(isJourNonOuvreIso('2026-09-04'), false) // vendredi ouvré

const pentecote = infoJourNonOuvre('2026-05-25')
assert.equal(pentecote.nonOuvre, true)
assert.equal(pentecote.ferie, true)
assert.equal(pentecote.badge, 'Férié')
assert.ok(pentecote.hint?.includes('Lundi de Pentecôte'))

const samedi = infoJourNonOuvre('2026-09-05')
assert.equal(samedi.badge, 'Week-end')
assert.equal(samedi.ferie, false)

const toussaintDimanche = infoJourNonOuvre('2026-11-01')
assert.equal(toussaintDimanche.weekend, true)
assert.equal(toussaintDimanche.ferie, true)
assert.equal(toussaintDimanche.badge, 'Férié')
assert.ok(toussaintDimanche.hint?.includes('week-end'))

console.log('ok test-jours-feries')
