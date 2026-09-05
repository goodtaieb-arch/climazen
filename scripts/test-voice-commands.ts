import assert from 'node:assert/strict'
import { parseVoiceCommand } from '../src/lib/speech'

const cases: Array<[string, string | null]> = [
  ['ouvre le stock', 'stock'],
  ['scanner la bouteille', 'scan'],
  ['qr du batiment', 'scan_equip'],
  ['qr site', 'scan_equip'],
  ['nouvel appel', 'appel'],
  ['créer un OT', 'appel'],
  ['ordres de travail', 'ot'],
  ['ouvre le GPS', 'gps'],
  ['Waze', 'gps'],
  ['CERFA', 'cerfa'],
  ['sites', 'sites'],
  ['aide', 'aide'],
  ['accueil', 'accueil'],
  ['ouvre la pointeuse', 'pointage'],
  ['temps de travail', 'pointage'],
  ['entrées de temps hors INT', 'temps_hors_int'],
  ['hors int', 'temps_hors_int'],
  ['bonjour le chat', null],
]

for (const [input, expected] of cases) {
  const got = parseVoiceCommand(input)
  assert.equal(got?.id ?? null, expected, `« ${input} » → ${got?.id ?? null}, attendu ${expected}`)
}

console.log(`OK ${cases.length} commandes vocales`)
