import assert from 'node:assert/strict'
import {
  wantsCarnetContactQuery,
  answerCarnetContactQuery,
  findContactsCarnet,
  mailPresetsPourContact,
  mailtoHrefContact,
  telHrefContact,
  buildCarnetContactsCatalog,
  type ContactCarnet,
} from '../src/lib/carnetContacts'
import { AI_HOW_I_WORK } from '../src/lib/aiActionCatalog'

assert.ok(AI_HOW_I_WORK.includes('Carnet contacts'))

assert.equal(wantsCarnetContactQuery('contact Daikin'), true)
assert.equal(wantsCarnetContactQuery('téléphone sous-traitant'), true)
assert.equal(wantsCarnetContactQuery('mail centre de formation'), true)
assert.equal(wantsCarnetContactQuery('crée un OT dépannage'), false)

const list: ContactCarnet[] = [
  {
    id: '1',
    type: 'fournisseur',
    nom: 'Daikin France',
    telephone: '01 46 87 00 00',
    email: 'pieces@daikin.example',
    specialite: 'pièces',
    favori: true,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: '2',
    type: 'sous_traitant',
    nom: 'Froid Express',
    telephone: '06 12 34 56 78',
    email: 'contact@froid.example',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: '3',
    type: 'centre_formation',
    nom: 'AFPA Froid',
    telephone: '04 72 00 00 00',
    email: 'formation@afpa.example',
    createdAt: '',
    updatedAt: '',
  },
]

const hits = findContactsCarnet(list, 'Daikin', { limit: 5 })
assert.equal(hits.length, 1)
assert.equal(hits[0].nom, 'Daikin France')

const reply = answerCarnetContactQuery(list, 'contact Daikin')
assert.ok(reply.includes('Daikin'))
assert.ok(reply.includes('01 46 87 00 00'))

const st = answerCarnetContactQuery(list, 'téléphone sous-traitant')
assert.ok(st.includes('Froid Express'))

assert.ok(telHrefContact('06 12 34 56 78')?.startsWith('tel:'))
assert.ok(mailtoHrefContact('a@b.fr')?.startsWith('mailto:'))

const presets = mailPresetsPourContact({ type: 'fournisseur', nom: 'Daikin' })
assert.ok(presets.some((p) => p.id === 'devis'))
assert.ok(presets.some((p) => p.id === 'commande'))

const catalog = buildCarnetContactsCatalog(list, 10)
assert.ok(catalog.includes('Daikin France'))
assert.ok(catalog.includes('AFPA'))

const empty = answerCarnetContactQuery([], 'contact Mitsubishi')
assert.ok(/aucun contact|carnet/i.test(empty))

console.log('test-carnet-contacts: ok')
