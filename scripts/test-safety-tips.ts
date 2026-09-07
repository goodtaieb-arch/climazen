import assert from 'node:assert/strict'
import {
  SAFETY_TIPS,
  inferSafetyContexts,
  isoWeekKey,
  pickSafetyTip,
} from '../src/lib/safetyTips'
import type { OrdreTravail } from '../src/lib/ordreTravail'
import type { Site } from '../src/lib/types'

assert.ok(SAFETY_TIPS.length >= 20)
assert.ok(SAFETY_TIPS.some((t) => t.id === 'dep-bouteilles-gaz'))
assert.ok(SAFETY_TIPS.some((t) => t.id === 'brasage-chalumeau'))
assert.ok(SAFETY_TIPS.some((t) => t.id === 'gen-eau-ete'))
assert.ok(SAFETY_TIPS.every((t) => t.text && t.speak && t.contexts.length))

assert.deepEqual(
  inferSafetyContexts({ lastAction: 'deplacement' }).sort(),
  ['deplacement'],
)
assert.ok(inferSafetyContexts({ lastAction: 'intervention_en_cours' }).includes('arrivee'))

const chaufOt = {
  action: 'Entretien chaudière chaufferie',
  docsRequis: ['fiche_chaufferie'],
  secteur: 'tech_cvc',
} as unknown as OrdreTravail
assert.ok(inferSafetyContexts({ lastAction: 'intervention_en_cours', ot: chaufOt }).includes('chaufferie'))

const elecOt = {
  action: 'SAT tableau électrique',
  secteur: 'electricien',
} as unknown as OrdreTravail
assert.ok(inferSafetyContexts({ lastAction: 'intervention_en_cours', ot: elecOt }).includes('electricite'))

const toitSite = { nom: 'Toiture immeuble A', equipements: [] } as unknown as Site
assert.ok(
  inferSafetyContexts({
    lastAction: 'intervention_en_cours',
    site: toitSite,
    ot: { action: 'Contrôle CTA toiture' } as OrdreTravail,
  }).includes('toiture'),
)

const tipDep = pickSafetyTip({
  lastAction: 'deplacement',
  dryRun: true,
  weekVehiculeAlreadyShown: true,
})
assert.ok(tipDep.contexts.includes('deplacement') || tipDep.contexts.includes('general'))

const tipVeh = pickSafetyTip({
  lastAction: 'sortie_domicile',
  dryRun: true,
  weekVehiculeAlreadyShown: false,
})
assert.ok(
  tipVeh.contexts.includes('vehicule_hebdo') || tipVeh.contexts.includes('deplacement'),
  tipVeh.id,
)

assert.ok(/^\d{4}-W\d{2}$/.test(isoWeekKey(new Date('2026-09-07T12:00:00Z'))))

console.log(`OK safety-tips (${SAFETY_TIPS.length} messages)`)
