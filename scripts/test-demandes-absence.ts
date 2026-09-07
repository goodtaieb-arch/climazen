import assert from 'node:assert/strict'
import {
  ABSENCE_TYPE_LABELS,
  absenceConsommeSolde,
  absenceTypeToAgenda,
  blankDemandeAbsence,
  compterJoursCalendaires,
  compterJoursOuvres,
  detectAbsenceTypeFromText,
  parseAbsenceDateRange,
  parseAbsenceType,
  titreDemandeAbsence,
} from '../src/lib/demandesAbsence'
import { parseTerrainIntent } from '../src/lib/assistantTerrainActions'

assert.equal(parseAbsenceType('rtt'), 'rtt')
assert.equal(parseAbsenceType('vacances'), 'vacances')
assert.equal(absenceTypeToAgenda('formation'), 'formation')
assert.equal(absenceTypeToAgenda('sans_solde'), 'conge')
assert.equal(absenceConsommeSolde('conge'), 'conges')
assert.equal(absenceConsommeSolde('rtt'), 'rtt')
assert.equal(absenceConsommeSolde('maladie'), null)

assert.equal(compterJoursCalendaires('2026-08-10', '2026-08-12'), 3)
assert.equal(compterJoursOuvres('2026-08-10', '2026-08-14'), 5) // lun–ven
assert.equal(compterJoursOuvres('2026-08-15', '2026-08-16'), 0) // sam–dim

const range = parseAbsenceDateRange('pose mes congés du 10/08/2026 au 20/08/2026')
assert.ok(range)
assert.equal(range!.debut, '2026-08-10')
assert.equal(range!.fin, '2026-08-20')

assert.equal(detectAbsenceTypeFromText('je prends un RTT demain'), 'rtt')
assert.equal(detectAbsenceTypeFromText('vacances été'), 'vacances')

const blank = blankDemandeAbsence({
  technicienUserId: 'u1',
  technicienName: 'Alice',
  dateDebut: '2026-08-10',
  dateFin: '2026-08-12',
  type: 'rtt',
})
assert.equal(blank.statut, 'brouillon')
assert.equal(blank.joursDemandes, 3)
assert.ok(titreDemandeAbsence(blank).includes(ABSENCE_TYPE_LABELS.rtt))

const pending = parseTerrainIntent(
  'Pose mes congés du 10/08/2026 au 20/08/2026',
)
assert.ok(pending)
assert.equal(pending!.kind, 'demande_absence')
if (pending!.kind === 'demande_absence') {
  assert.equal(pending.dateDebut, '2026-08-10')
  assert.equal(pending.dateFin, '2026-08-20')
  assert.equal(pending.type, 'conge')
}

console.log('test-demandes-absence: ok')
