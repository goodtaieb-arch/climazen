import assert from 'node:assert/strict'
import {
  mergeBouteilleScanIntoForm,
  parseBarcodePayload,
  parseBouteilleLabelText,
  summarizeBouteilleScan,
} from '../src/lib/bouteilleOcr'

const label = parseBouteilleLabelText(`
  Refrigerant R-32
  UN 3252
  N° série : BOT-32-4890
  Capacité max 12,5 kg
  Tare 10 kg
  PH 48 bar
  Réépreuve 15/06/2027
`)
assert.equal(label.fluide, 'R-32')
assert.equal(label.numeroContenant, 'BOT-32-4890')
assert.equal(label.codeUn, '3252')
assert.equal(label.capaciteMaxKg, 12.5)
assert.equal(label.tareKg, 10)
assert.equal(label.pressionEpreuveBar, 48)
assert.equal(label.dateReepreuvage, '2027-06-15')

const barcode = parseBarcodePayload('BOT-99-1001')
assert.equal(barcode.numeroContenant, 'BOT-99-1001')

const qrJson = parseBarcodePayload(
  JSON.stringify({ fluide: 'R-410A', serial: 'CYL410-22', capaciteMaxKg: 11.3 }),
)
assert.equal(qrJson.fluide, 'R-410A')
assert.equal(qrJson.numeroContenant, 'CYL410-22')
assert.ok(qrJson.codeUn)

const form = mergeBouteilleScanIntoForm(
  {
    fluide: 'R-32',
    numeroContenant: '',
    codeUn: '',
    denominationAdr: '',
    capaciteMaxKg: 12.5,
    tareKg: 10,
    pressionEpreuveBar: 48,
    dateReepreuvage: '',
    quantiteKg: 0,
    bsffReference: '',
  },
  label,
)
assert.equal(form.numeroContenant, 'BOT-32-4890')
assert.equal(form.fluide, 'R-32')
assert.ok(summarizeBouteilleScan(label).includes('BOT-32-4890'))

console.log('OK bouteille OCR / barcode parse')
