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
import {
  docsFichesPourEquipements,
  inferCategorieFicheEquipement,
} from '../src/lib/equipementFiche'

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
assert.equal(
  estTechIntervenant({ technicienUserIds: ['tech-1', 'tech-2'] }, 'tech-2'),
  true,
)
assert.equal(
  roleParcoursOt(
    terrain,
    { technicienUserIds: ['tech-1', 'tech-2'], typeOt: 'depanage' },
    'tech-2',
  ),
  'intervenant',
)

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

assert.equal(techDoitRemplirCerfa({ hasFluide: true }), false)
assert.equal(techDoitRemplirCerfa({ hasFluide: true, toucheGaz: false }), false)
assert.equal(techDoitRemplirCerfa({ hasFluide: false, toucheGaz: true }), true)
assert.equal(techDoitRemplirCerfa({ hasFluide: false }), false)

assert.deepEqual(
  docsEffectifsRequis({ docsRequis: ['fiche_clim'], hasFluide: true }),
  ['fiche_clim'],
)
assert.deepEqual(
  docsEffectifsRequis({ docsRequis: ['fiche_clim'], hasFluide: true, toucheGaz: true }),
  ['cerfa', 'fiche_clim'],
)
assert.deepEqual(
  docsEffectifsRequis({
    docsRequis: ['cerfa', 'fiche_clim'],
    hasFluide: true,
  }),
  ['fiche_clim'],
)
assert.deepEqual(
  docsEffectifsRequis({
    docsRequis: [],
    docsAuto: ['fiche_chaufferie', 'cerfa'],
    hasFluide: true,
  }),
  ['fiche_chaufferie'],
)
assert.deepEqual(
  docsEffectifsRequis({
    docsRequis: [],
    docsAuto: ['fiche_chaufferie'],
    hasFluide: false,
  }),
  ['fiche_chaufferie'],
)
assert.deepEqual(
  docsEffectifsRequis({
    docsRequis: ['fiche_clim'],
    docsAuto: ['fiche_chaufferie'],
    hasFluide: false,
  }),
  ['fiche_clim'],
)
assert.equal(rapportOtSuffit([], ['fiche_chaufferie']), false)
assert.equal(rapportOtSuffit(['cerfa'], []), true)

assert.equal(inferCategorieFicheEquipement({ type: 'Chaudière gaz', nom: 'P2' }), 'chaufferie')
assert.deepEqual(docsFichesPourEquipements([{ type: 'Chaudière gaz', nom: 'P2' }]), [
  'fiche_chaufferie',
])
assert.deepEqual(docsFichesPourEquipements([{ type: 'Split', nom: 'Clim bureau' }]), ['fiche_clim'])
assert.deepEqual(
  docsFichesPourEquipements([
    { type: 'Chaudière', nom: 'Chaufferie' },
    { type: 'CTA', nom: 'Toiture' },
  ]),
  ['fiche_chaufferie', 'fiche_cta_vmc'],
)
assert.deepEqual(docsFichesPourEquipements([{ type: 'Contrôle étanchéité', nom: 'F-gas' }]), [])

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

// Équipement optionnel — signalement sans machine connue
{
  const base = {
    ...blankOrdreTravail(),
    id: 'ot-x',
    createdAt: '2026-09-07T10:00:00.000Z',
    updatedAt: '2026-09-07T10:00:00.000Z',
    action: 'Plus de froid magasin',
    clientId: 'c1',
    chantierId: 's1',
  }
  assert.equal(inferParcoursStep(base), 'equipement')
  assert.equal(
    inferParcoursStep({ ...base, equipementADeterminer: true, parcoursStep: 'docs' }),
    'docs',
  )
  assert.equal(
    inferParcoursStepPourRole(
      { ...base, equipementADeterminer: true, parcoursStep: 'docs' },
      'intervenant',
    ),
    'docs',
  )
  assert.equal(
    inferParcoursStepPourRole(
      { ...base, equipementADeterminer: true },
      'bureau_depanage',
    ),
    'equipement',
  )
}

console.log('test-ot-parcours: ok')
