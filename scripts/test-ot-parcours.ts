import assert from 'node:assert/strict'
import { blankOrdreTravail, inferParcoursStep } from '../src/lib/ordreTravail'
import {
  docsEffectifsRequis,
  docsManquantsPourCloture,
  estBureauQuiPreparePourUnTech,
  estTechIntervenant,
  motifClotureOt,
  rapportOtSuffit,
  rapportSousTraitantOk,
  REGISTRE_SECURITE_AVERTISSEMENT,
  inferParcoursStepPourRole,
  parseDocsOtRequis,
  roleParcoursOt,
  techDoitRemplirCerfa,
  toggleDocOtRequis,
  otEstMaintenancePreparee,
} from '../src/lib/otParcours'

const owner = { isOwner: true, peutVoirIdentitesRh: true }
const bureau = { isOwner: false, peutVoirIdentitesRh: true }
const terrain = { isOwner: false, peutVoirIdentitesRh: false }

assert.equal(otEstMaintenancePreparee('maintenance'), true)
assert.equal(otEstMaintenancePreparee('entretien'), true)
assert.equal(otEstMaintenancePreparee('controle_etancheite'), true)
assert.equal(otEstMaintenancePreparee('depanage'), false)
assert.equal(otEstMaintenancePreparee('installation'), false)

assert.equal(estTechIntervenant({ technicienUserId: 'tech-1' }, 'tech-1'), true)
assert.equal(estTechIntervenant({ technicienUserId: 'tech-1' }, 'bureau-1'), false)
assert.equal(estTechIntervenant({ technicienUserId: undefined }, 'tech-1'), false)

// Auto-entrepreneur / gérant qui s’affecte : pas « bureau qui prépare »
assert.equal(
  estBureauQuiPreparePourUnTech(owner, { technicienUserId: 'owner-1' }, 'owner-1'),
  false,
)
// Grande entreprise : secrétariat prépare pour un tech
assert.equal(
  estBureauQuiPreparePourUnTech(bureau, { technicienUserId: 'tech-1' }, 'sec-1'),
  true,
)
// Tech astreinte
assert.equal(
  estBureauQuiPreparePourUnTech(terrain, { technicienUserId: 'tech-1' }, 'tech-1'),
  false,
)

assert.equal(
  roleParcoursOt(bureau, { technicienUserId: 'tech-1', typeOt: 'depanage' }, 'sec-1'),
  'bureau_depanage',
)
assert.equal(
  roleParcoursOt(bureau, { technicienUserId: 'tech-1', typeOt: 'maintenance' }, 'sec-1'),
  'bureau_maintenance',
)
assert.equal(
  roleParcoursOt(owner, { technicienUserId: 'owner-1', typeOt: 'depanage' }, 'owner-1'),
  'intervenant',
)
assert.equal(
  roleParcoursOt(terrain, { technicienUserId: 'tech-1', typeOt: 'depanage' }, 'tech-1'),
  'intervenant',
)

assert.deepEqual(parseDocsOtRequis(['fiche_clim', 'hacker', 'cerfa']), ['cerfa', 'fiche_clim'])
assert.deepEqual(toggleDocOtRequis(['fiche_clim'], 'fiche_clim'), [])
assert.deepEqual(toggleDocOtRequis([], 'fiche_clim'), ['fiche_clim'])

assert.equal(techDoitRemplirCerfa({ hasFluide: true }), true)
assert.equal(techDoitRemplirCerfa({ hasFluide: true, toucheGaz: false }), false)
assert.equal(techDoitRemplirCerfa({ hasFluide: false, toucheGaz: true }), true)
assert.equal(techDoitRemplirCerfa({ hasFluide: false }), false)

assert.deepEqual(
  docsEffectifsRequis({ docsRequis: ['fiche_clim'], hasFluide: true }),
  ['cerfa', 'fiche_clim'],
)
assert.deepEqual(
  docsEffectifsRequis({ docsRequis: ['fiche_clim'], hasFluide: true, toucheGaz: false }),
  ['fiche_clim'],
)

assert.deepEqual(
  docsManquantsPourCloture({
    docsRequis: ['fiche_clim'],
    hasFluide: true,
    remplis: { cerfa: true, fiche_clim: false },
  }),
  ['fiche_clim'],
)
assert.deepEqual(
  docsManquantsPourCloture({
    docsRequis: ['fiche_clim'],
    hasFluide: true,
    remplis: { cerfa: true, fiche_clim: true },
  }),
  [],
)

const otDepanage = {
  ...blankOrdreTravail(),
  action: 'Fuite chambre froide',
  clientId: 'c1',
  chantierId: 's1',
  equipementId: 'e1',
  typeOt: 'depanage' as const,
  parcoursStep: 'docs' as const,
}
assert.equal(inferParcoursStep(otDepanage), 'docs')
assert.equal(inferParcoursStepPourRole(otDepanage, 'bureau_depanage'), 'equipement')
assert.equal(inferParcoursStepPourRole(otDepanage, 'intervenant'), 'docs')
assert.equal(inferParcoursStepPourRole(otDepanage, 'bureau_maintenance'), 'docs')

assert.equal(rapportOtSuffit([]), true)
assert.equal(rapportOtSuffit(['fiche_clim']), false)
assert.equal(rapportOtSuffit(['cerfa']), true)
assert.equal(rapportSousTraitantOk({ rapportSousTraitant: 'PDF reçu' }), true)
assert.equal(rapportSousTraitantOk({ rapportAction: '' }), false)
assert.ok(REGISTRE_SECURITE_AVERTISSEMENT.includes('registre de sécurité'))

assert.equal(
  motifClotureOt(terrain, { technicienUserId: 'tech-1' }, 'tech-1'),
  'tech',
)
assert.equal(
  motifClotureOt(bureau, { technicienUserId: 'tech-1' }, 'sec-1'),
  'interdit',
)
assert.equal(
  motifClotureOt(
    bureau,
    { technicienUserId: 'tech-1', maintenanceParSousTraitant: true },
    'sec-1',
  ),
  'bureau_sous_traitant',
)
assert.equal(
  motifClotureOt(
    bureau,
    {
      technicienUserId: 'tech-1',
      maintenanceParSousTraitant: true,
      techAccompagneSousTraitant: true,
    },
    'sec-1',
  ),
  'interdit',
)
assert.equal(
  motifClotureOt(
    terrain,
    {
      technicienUserId: 'tech-1',
      maintenanceParSousTraitant: true,
      techAccompagneSousTraitant: true,
    },
    'tech-1',
  ),
  'tech',
)
assert.deepEqual(
  docsManquantsPourCloture({
    docsRequis: ['fiche_clim'],
    hasFluide: false,
    remplis: {},
    rapportSousTraitantSuffit: true,
  }),
  [],
)

console.log('test-ot-parcours: ok')
