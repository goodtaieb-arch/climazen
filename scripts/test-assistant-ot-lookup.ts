import assert from 'node:assert/strict'
import {
  extractTechNameQuery,
  resolveRelativeDate,
  scorePersonName,
  matchTechInTeam,
  findOtsForTechOnDate,
  wantsOtDeplacerOuDecaler,
  answerOtLookupOuDeplacer,
  extractDecalerHeures,
  proposeDecalerOt,
} from '../src/lib/assistantOtLookup'
import type { AppData } from '../src/lib/types'
import { emptyData } from '../src/lib/storage'

assert.equal(wantsOtDeplacerOuDecaler('non l\'OT de Karim benali de auauiujourdhui décale la a'), true)

const name = extractTechNameQuery('non l\'OT de Karim benali de auauiujourdhui décale la a')
assert.ok(/karim/i.test(name), `got name=${name}`)
assert.ok(/benali/i.test(name), `got name=${name}`)
assert.ok(!/ben\s*lai/i.test(name), 'must not invent Ben Lai')

assert.equal(resolveRelativeDate('auauiujourdhui'), '2026-09-03'.length === 10 ? resolveRelativeDate('aujourd\'hui') : null)
// relative today should be stable within call
const t1 = resolveRelativeDate('aujourd\'hui')
const t2 = resolveRelativeDate('auauiujourdhui')
assert.equal(t1, t2)

assert.ok(scorePersonName('Karim Benali', 'Karim benali') >= 85)
assert.ok(scorePersonName('Karim Benali', 'Karim Ben Lai') < scorePersonName('Karim Benali', 'Karim benali'))

const team = [
  { id: 'u1', fullName: 'Karim Benali' },
  { id: 'u2', fullName: 'Julie Garnier' },
]
const hits = matchTechInTeam('Karim benali', team)
assert.equal(hits[0]?.member.fullName, 'Karim Benali')
assert.ok(hits[0]!.score >= 70)

const data = {
  ...emptyData(),
  clients: [{ id: 'c1', raisonSociale: 'EHPAD Test', typeClient: 'entreprise', nom: '', prenom: '', nomContact: '', adresse: '', codePostal: '', ville: '', telephone: '', email: '', createdAt: '' }],
  chantiers: [{ id: 's1', clientId: 'c1', nom: 'EHPAD — Bât. B', adresse: '', codePostal: '', ville: '', createdAt: '' }],
  ordresTravail: [
    {
      id: 'ot1',
      numero: '26090225',
      typeOt: 'maintenance',
      statut: 'en_cours',
      date: t1!,
      heure: '07:00',
      action: 'Maintenance mensuelle — VMC double flux',
      technicien: 'Karim Benali',
      technicienUserId: 'u1',
      clientId: 'c1',
      chantierId: 's1',
      createdAt: '',
      updatedAt: '',
    },
  ],
} as unknown as AppData

const ots = findOtsForTechOnDate(data, { techUserId: 'u1', dateIso: t1! })
assert.equal(ots.length, 1)
assert.equal(ots[0].numero, '26090225')

const reply = answerOtLookupOuDeplacer(
  data,
  'non l\'OT de Karim benali de auauiujourdhui décale la a',
  team,
)
assert.ok(reply.includes('Karim Benali'))
assert.ok(!/Ben Lai/i.test(reply))
assert.ok(/OT26090225|26090225/.test(reply))
assert.ok(/Agenda|décal|deplac|croix|oui/i.test(reply))

// Hallucinated name must NOT match better than real
const bad = matchTechInTeam('Karim Ben Lai', team)
assert.ok(bad[0]!.score < hits[0]!.score)

// Décalage 7h → 9h : proposition concrète (pas ouvrir fiche OT)
assert.deepEqual(extractDecalerHeures('décale l’OT de 7h à 9h'), {
  from: '07:00',
  to: '09:00',
})
assert.deepEqual(extractDecalerHeures('de 7h00 a 9h00'), {
  from: '07:00',
  to: '09:00',
})

const prop = proposeDecalerOt(data, 'décale l’OT de 7h à 9h', team)
assert.equal(prop.ok, true)
if (prop.ok) {
  assert.equal(prop.action.kind, 'decaler_ot')
  assert.equal(prop.action.heureFrom, '07:00')
  assert.equal(prop.action.heureTo, '09:00')
  assert.equal(prop.action.otId, 'ot1')
  assert.ok(/oui/i.test(prop.action.summary))
  assert.ok(/pas d['’]ouverture|sans ouvrir|Agenda/i.test(prop.action.summary))
}

const propKarim = proposeDecalerOt(
  data,
  'décale l’OT de Karim Benali de 7h00 à 9h00',
  team,
)
assert.equal(propKarim.ok, true)

console.log('test-assistant-ot-lookup: ok')
