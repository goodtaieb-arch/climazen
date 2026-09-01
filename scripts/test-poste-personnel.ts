import assert from 'node:assert/strict'
import {
  POSTES_PERSONNEL,
  defPostePersonnel,
  isPosteBureau,
  isPosteTerrain,
  labelPostePersonnel,
  ligneNomPoste,
  optionLabelAvecPoste,
  parsePostePersonnel,
  posteCouvreTouteLEquipe,
  postesParFamille,
  secteursOt,
  labelSecteurCourt,
  secteurOtDepuisPoste,
  parseActiviteBureau,
  parseMetiersCouverts,
  secteurCouleurMembre,
} from '../src/lib/postePersonnel'
import { migratePersonnelDossiers } from '../src/lib/rhDocuments'

assert.ok(POSTES_PERSONNEL.length >= 11)
assert.equal(parsePostePersonnel('tech_cvc'), 'tech_cvc')
assert.equal(parsePostePersonnel('electricien'), 'electricien')
assert.equal(parsePostePersonnel('plmbier'), undefined)
assert.equal(parsePostePersonnel('hacker'), undefined)
assert.equal(parsePostePersonnel(''), undefined)
assert.equal(labelPostePersonnel('tech_frigoriste'), 'Tech frigoriste')
assert.equal(labelPostePersonnel('unknown'), '')

assert.equal(isPosteTerrain('plombier'), true)
assert.equal(isPosteBureau('plombier'), false)
assert.equal(isPosteBureau('secretaire'), true)
assert.equal(isPosteBureau('comptable'), true)
assert.equal(isPosteBureau('standard'), true)
assert.equal(posteCouvreTouteLEquipe('responsable'), true)
assert.equal(posteCouvreTouteLEquipe('directeur'), true)
assert.equal(posteCouvreTouteLEquipe('pilote'), true)
assert.equal(posteCouvreTouteLEquipe('secretaire'), false)
assert.equal(posteCouvreTouteLEquipe('tech_cvc'), false)

assert.equal(postesParFamille('terrain').every((p) => p.famille === 'terrain'), true)
assert.equal(postesParFamille('bureau').some((p) => p.couvreTouteLEquipe), true)
assert.equal(defPostePersonnel('tech_multitechnique')?.label, 'Tech multitechnique')
assert.equal(secteursOt().every((p) => p.famille === 'terrain'), true)
assert.equal(labelSecteurCourt('tech_cvc'), 'CVC')
assert.equal(labelSecteurCourt('tech_frigoriste'), 'Frigo')
assert.equal(secteurOtDepuisPoste('tech_cvc'), 'tech_cvc')
assert.equal(secteurOtDepuisPoste('secretaire'), undefined)
assert.equal(parseActiviteBureau('travaux'), 'travaux')
assert.equal(parseActiviteBureau('maintenance'), 'maintenance')
assert.equal(parseActiviteBureau('nope'), undefined)
assert.deepEqual(parseMetiersCouverts(['tech_cvc', 'plombier', 'secretaire']), [
  'tech_cvc',
  'plombier',
])
assert.equal(
  secteurCouleurMembre({ poste: 'responsable', metiersCouverts: ['tech_frigoriste'] }),
  'tech_frigoriste',
)
assert.equal(secteurCouleurMembre({ poste: 'tech_cvc' }), 'tech_cvc')

assert.equal(ligneNomPoste({ nom: 'Jean', poste: 'tech_cvc' }), 'Jean · Tech CVC')
assert.equal(ligneNomPoste({ nom: 'Issam', roleOwner: true }), 'Issam · Gérant')
assert.equal(ligneNomPoste({ nom: 'Jean' }), 'Jean · poste à définir')
assert.ok(optionLabelAvecPoste({ nom: 'Léa', poste: 'responsable' }).includes('toute l’équipe'))
assert.ok(optionLabelAvecPoste({ nom: 'Léa', poste: 'responsable', inactif: true }).includes('inactif'))

const migrated = migratePersonnelDossiers([
  {
    id: 'u1',
    userId: 'u1',
    userName: 'Jean',
    poste: 'tech_cvc',
    toucheFroid: true,
    toucheElectricite: true,
    conduitVehicule: true,
    documents: [],
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'u2',
    userId: 'u2',
    userName: 'Léa',
    poste: 'nimportequoi' as never,
    toucheFroid: true,
    toucheElectricite: true,
    conduitVehicule: true,
    documents: [],
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
])
assert.equal(migrated.find((d) => d.userId === 'u1')?.poste, 'tech_cvc')
assert.equal(migrated.find((d) => d.userId === 'u2')?.poste, undefined)

console.log('test-poste-personnel: ok')
