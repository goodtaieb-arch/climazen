import assert from 'node:assert/strict'
import {
  corrigerArriveeSite,
  gpsPointageValide,
  parseHeureCorriger,
  wantsCorrigerPointageArrivee,
  isoArriveePourCorrection,
} from '../src/lib/pointageCorrection'
import { hmVersIsoLocal, type PointageEvent } from '../src/lib/pointage'

assert.equal(wantsCorrigerPointageArrivee('j’ai oublié de pointer en cours'), true)
assert.equal(wantsCorrigerPointageArrivee('corrige le pointage arrivée 10h15'), true)
assert.equal(wantsCorrigerPointageArrivee('crée une INT pour Dupont'), false)
assert.equal(parseHeureCorriger('arrivé à 10h15'), '10:15')
assert.equal(parseHeureCorriger('à 9h'), '09:00')

assert.equal(gpsPointageValide(undefined), false)
assert.equal(gpsPointageValide({ lat: 48.8, lng: 2.3, capturedAt: '2026-09-05T10:20:00.000Z' }), true)

const geo = { lat: 48.87, lng: 2.33, capturedAt: '2026-09-05T08:40:00.000Z' }
const dep: PointageEvent = {
  id: 'e1',
  userId: 'tech-1',
  userName: 'Karim',
  action: 'deplacement',
  at: '2026-09-05T08:00:00',
  date: '2026-09-05',
  otId: 'ot-1',
  cible: 'ot',
  createdAt: '2026-09-05T08:00:00',
}

const insert = corrigerArriveeSite({
  events: [dep],
  userId: 'tech-1',
  userName: 'Karim',
  otId: 'ot-1',
  arriveeAt: hmVersIsoLocal('2026-09-05', '08:25'),
  now: '2026-09-05T09:00:00.000Z',
  geo,
  geoRequired: true,
  corrigePar: 'ia',
})
assert.equal(insert.ok, true)
if (insert.ok) {
  assert.equal(insert.mode, 'insert')
  assert.equal(insert.insert?.action, 'intervention_en_cours')
  assert.equal(insert.insert?.at, '2026-09-05T08:25:00')
  assert.equal(insert.insert?.corrigePar, 'ia')
  assert.equal(insert.insert?.geo?.lat, geo.lat)
}

const iaSansGps = corrigerArriveeSite({
  events: [dep],
  userId: 'tech-1',
  userName: 'Karim',
  otId: 'ot-1',
  arriveeAt: hmVersIsoLocal('2026-09-05', '08:25'),
  now: '2026-09-05T09:00:00.000Z',
  geoRequired: true,
  corrigePar: 'ia',
})
assert.equal(iaSansGps.ok, false)

const bureauSansGps = corrigerArriveeSite({
  events: [dep],
  userId: 'tech-1',
  userName: 'Karim',
  otId: 'ot-1',
  arriveeAt: hmVersIsoLocal('2026-09-05', '08:25'),
  now: '2026-09-05T09:00:00.000Z',
  geoRequired: false,
  corrigePar: 'bureau',
})
assert.equal(bureauSansGps.ok, true)

const late: PointageEvent = {
  id: 'e2',
  userId: 'tech-1',
  userName: 'Karim',
  action: 'intervention_en_cours',
  at: '2026-09-05T09:50:00',
  date: '2026-09-05',
  otId: 'ot-1',
  createdAt: '2026-09-05T09:50:00',
}
const backdate = corrigerArriveeSite({
  events: [dep, late],
  userId: 'tech-1',
  userName: 'Karim',
  otId: 'ot-1',
  arriveeAt: hmVersIsoLocal('2026-09-05', '08:25'),
  now: '2026-09-05T10:00:00.000Z',
  geo,
  geoRequired: true,
  corrigePar: 'ia',
})
assert.equal(backdate.ok, true)
if (backdate.ok) {
  assert.equal(backdate.mode, 'update')
  assert.equal(backdate.update?.id, 'e2')
  assert.equal(backdate.update?.patch.at, '2026-09-05T08:25:00')
}

const tropTot = corrigerArriveeSite({
  events: [dep],
  userId: 'tech-1',
  userName: 'Karim',
  otId: 'ot-1',
  arriveeAt: hmVersIsoLocal('2026-09-05', '07:00'),
  now: '2026-09-05T09:00:00.000Z',
  geoRequired: false,
  corrigePar: 'bureau',
})
assert.equal(tropTot.ok, false)

assert.equal(
  isoArriveePourCorrection({ date: '2026-09-05', heure: '10:15' }),
  '2026-09-05T10:15:00',
)
assert.equal(
  isoArriveePourCorrection({ date: '2026-09-05', geo }),
  geo.capturedAt,
)

console.log('test-pointage-correction: ok')
