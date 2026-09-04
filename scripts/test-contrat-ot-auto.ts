import assert from 'node:assert/strict'
import {
  MODELES_CONTRAT,
  createContratFromModele,
  resolveFamilleContrat,
  resolveSecteurContrat,
  resolveVisitesParAn,
  type ContratMaintenance,
} from '../src/lib/contratMaintenance'
import {
  NIVEAU_VISITE_LABELS,
  alertesOtContratFinMois,
  buildOtDraftsDepuisContrats,
  dateDerniereInterventionPourOt,
  dateVisiteEffective,
  decalerVisiteContrat,
  docsRequisPourFamille,
  joursRestantsDansMois,
  labelMoisSlot,
  infoMoisGenerationOt,
  isMoisGenerationEnRetard,
  mergeOtsDepuisContrats,
  moisCyclePourFrequence,
  niveauVisitePourMoisCycle,
  periodiciteDepuisVisites,
  pruneOtsContratHorsFenetre,
  slotKeyFromContratOtKey,
  slotKeyMoisEnCours,
  visitesDepuisContrat,
} from '../src/lib/contratOtAuto'
import {
  docsRequisPourEquipement,
  inferCategorieFicheEquipement,
} from '../src/lib/equipementFiche'

assert.equal(niveauVisitePourMoisCycle(1), 'mensuel')
assert.equal(niveauVisitePourMoisCycle(2), 'mensuel')
assert.equal(niveauVisitePourMoisCycle(3), 'trimestriel')
assert.equal(niveauVisitePourMoisCycle(6), 'semestriel')
assert.equal(niveauVisitePourMoisCycle(9), 'trimestriel')
assert.equal(niveauVisitePourMoisCycle(12), 'annuel')
assert.equal(NIVEAU_VISITE_LABELS.semestriel, 'Semestrielle')

assert.deepEqual(moisCyclePourFrequence(12), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
assert.deepEqual(moisCyclePourFrequence(4), [3, 6, 9, 12])
assert.deepEqual(moisCyclePourFrequence(2), [6, 12])
assert.deepEqual(moisCyclePourFrequence(1), [12])
assert.equal(periodiciteDepuisVisites(12), 'mensuelle')
assert.equal(periodiciteDepuisVisites(2), 'semestrielle')

assert.deepEqual(docsRequisPourFamille('chaufferie'), ['fiche_chaufferie'])
assert.deepEqual(docsRequisPourFamille('clim'), ['fiche_clim'])
assert.deepEqual(docsRequisPourFamille('cta'), ['fiche_cta_vmc'])
assert.deepEqual(docsRequisPourFamille('etancheite'), ['cerfa'])

const chaufferie = MODELES_CONTRAT.find((m) => m.id === 'chaufferie_12')
assert.ok(chaufferie)
assert.equal(chaufferie.visitesParAn, 12)
assert.equal(chaufferie.famille, 'chaufferie')
assert.equal(chaufferie.secteur, 'tech_cvc')

const clim = MODELES_CONTRAT.find((m) => m.id === 'annuelle_clim')
assert.ok(clim)
assert.equal(clim.visitesParAn, 2)
assert.equal(clim.famille, 'clim')

const cta = MODELES_CONTRAT.find((m) => m.id === 'cta_4')
assert.ok(cta)
assert.equal(cta.visitesParAn, 4)

const sites = [
  { id: 's1', clientId: 'c1', nom: 'Siège', agenceCode: '75' },
  { id: 's2', clientId: 'c1', nom: 'Annexe', agenceCode: '92' },
]

function contrat(partial: Partial<ContratMaintenance> & Pick<ContratMaintenance, 'id'>): ContratMaintenance {
  return {
    numero: 'CM20260001',
    modeleId: 'chaufferie_12',
    titre: 'Chaufferie',
    clientId: 'c1',
    chantierIds: ['s1'],
    periodicite: 'mensuelle',
    famille: 'chaufferie',
    visitesParAn: 12,
    secteur: 'tech_cvc',
    genererOtAuto: true,
    dateDebut: '2026-01-15',
    dateFin: '2027-01-15',
    dureeLabel: '1 an',
    prixLabel: 'à convenir',
    prestations: [],
    corps: '',
    statut: 'signe',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  }
}

const chauffVisites = visitesDepuisContrat(contrat({ id: 'cm1' }), sites, {
  today: '2026-01-20',
  horizonMonths: 14,
  pastMonths: 1,
})
assert.equal(chauffVisites.length, 12, 'chaufferie 12 visites sur 1 an / 1 site')
assert.equal(chauffVisites[0].date, '2026-01-15')
assert.equal(chauffVisites[0].niveau, 'mensuel')
assert.equal(chauffVisites[2].niveau, 'trimestriel')
assert.equal(chauffVisites[5].date, '2026-06-15')
assert.equal(chauffVisites[5].niveau, 'semestriel')
assert.equal(chauffVisites[11].date, '2026-12-15')
assert.equal(chauffVisites[11].niveau, 'annuel')
assert.ok(chauffVisites.every((v) => v.contratOtKey.startsWith('cm-ot:cm1:s1:')))

/** Défaut = mois par mois : pas toute l’année. */
const chauffMoisParMois = visitesDepuisContrat(contrat({ id: 'cm1' }), sites, {
  today: '2026-03-10',
})
assert.ok(
  chauffMoisParMois.length <= 3,
  `mois par mois : attendu ≤3, reçu ${chauffMoisParMois.length}`,
)
assert.ok(
  chauffMoisParMois.every((v) => v.date >= '2026-02-10' && v.date < '2026-04-10'),
  'fenêtre past=1 / horizon=1 autour de mars',
)
assert.equal(
  chauffMoisParMois.find((v) => v.date.startsWith('2026-03'))?.niveau,
  'trimestriel',
  'mars = trimestrielle dans le registre',
)

const climVisites = visitesDepuisContrat(
  contrat({
    id: 'cm2',
    modeleId: 'annuelle_clim',
    famille: 'clim',
    visitesParAn: 2,
    periodicite: 'semestrielle',
    titre: 'Clim',
  }),
  sites,
  { today: '2026-01-20', horizonMonths: 14, pastMonths: 1 },
)
assert.equal(climVisites.length, 2)
assert.equal(climVisites[0].date, '2026-06-15')
assert.equal(climVisites[0].niveau, 'semestriel')
assert.equal(climVisites[1].date, '2026-12-15')
assert.equal(climVisites[1].niveau, 'annuel')

const ctaVisites = visitesDepuisContrat(
  contrat({
    id: 'cm3',
    modeleId: 'cta_4',
    famille: 'cta',
    visitesParAn: 4,
    periodicite: 'trimestrielle',
    titre: 'CTA',
  }),
  sites,
  { today: '2026-01-20', horizonMonths: 14, pastMonths: 1 },
)
assert.equal(ctaVisites.length, 4)
assert.deepEqual(
  ctaVisites.map((v) => v.niveau),
  ['trimestriel', 'semestriel', 'trimestriel', 'annuel'],
)

const multiSites = visitesDepuisContrat(
  contrat({ id: 'cm4', chantierIds: [] }),
  sites,
  { today: '2026-01-20', horizonMonths: 14, pastMonths: 1 },
)
assert.equal(multiSites.length, 24, 'tous les sites du client si chantierIds vide')

const drafts = buildOtDraftsDepuisContrats({
  contrats: [
    contrat({ id: 'cm1' }),
    contrat({
      id: 'cm-off',
      genererOtAuto: false,
    }),
    contrat({
      id: 'cm-draft',
      statut: 'brouillon',
    }),
  ],
  sites,
  today: '2026-01-20',
  horizonMonths: 14,
  pastMonths: 1,
})
assert.equal(drafts.length, 12)
assert.equal(drafts[0].secteur, 'tech_cvc')
assert.equal(drafts[0].statut, 'pret_a_planifier')
assert.deepEqual(drafts[0].docsRequis, ['fiche_chaufferie'])
assert.equal(drafts[5].visiteNiveau, 'semestriel')
assert.match(drafts[5].action, /semestrielle/i)
assert.equal(drafts[0].dureeMinutes, 120)
assert.equal(drafts[5].dureeMinutes, 240)

const draftsMois = buildOtDraftsDepuisContrats({
  contrats: [contrat({ id: 'cm1' })],
  sites,
  today: '2026-01-20',
})
assert.ok(draftsMois.length < 12, 'génération défaut = mois par mois, pas 12 OT')
assert.ok(draftsMois.length >= 1)

const { toAdd, skipped } = mergeOtsDepuisContrats(
  [{ contratOtKey: drafts[0].contratOtKey, date: '2026-02-01' }],
  drafts,
)
assert.equal(skipped, 1)
assert.equal(toAdd.length, 11, 'créneau déjà présent (date déplacée) → pas de doublon')

assert.equal(
  resolveVisitesParAn({
    modeleId: 'annuelle_clim',
    periodicite: 'annuelle',
  }),
  1,
  'anciens contrats annuels clim → 1 visite, pas 2 surprises',
)
assert.equal(
  resolveVisitesParAn({
    modeleId: 'annuelle_clim',
    periodicite: 'semestrielle',
    visitesParAn: 2,
  }),
  2,
)
assert.equal(resolveFamilleContrat({ modeleId: 'cta_4' }), 'cta')
assert.equal(resolveSecteurContrat({ modeleId: 'controle_etancheite' }), 'tech_frigoriste')
assert.equal(resolveSecteurContrat({ modeleId: 'chaufferie_12', secteur: 'plombier' }), 'plombier')

const created = createContratFromModele(
  'cta_4',
  {
    clientId: 'c1',
    chantierIds: ['s1'],
    operateur: { raisonSociale: 'ClimaZEN' },
    client: { raisonSociale: 'Client' },
    sites: [{ nom: 'Siège' }],
  },
  [],
)
assert.equal(created.famille, 'cta')
assert.equal(created.visitesParAn, 4)
assert.equal(created.secteur, 'tech_cvc')
assert.equal(created.genererOtAuto, true)

assert.equal(inferCategorieFicheEquipement({ type: 'Chaudière P3', nom: '' }), 'chaufferie')
assert.equal(inferCategorieFicheEquipement({ type: 'CTA toiture', nom: '' }), 'cta_vmc')
assert.equal(inferCategorieFicheEquipement({ type: 'Split bureau', nom: 'Clim R32' }), 'clim')
assert.equal(inferCategorieFicheEquipement({ type: 'VMC sanitaires', nom: '' }), 'cta_vmc')
assert.equal(inferCategorieFicheEquipement({ type: 'Tableau électrique', nom: '' }), 'aucune')
assert.deepEqual(docsRequisPourEquipement({ type: 'Chaudière', nom: '' }), ['fiche_chaufferie'])
assert.deepEqual(docsRequisPourEquipement({ type: 'Tableau', nom: '' }), [])

const eqSites = [
  {
    id: 's1',
    clientId: 'c1',
    nom: 'Siège',
    equipements: [
      {
        id: 'eq-ch',
        nom: 'Chaudière P3',
        type: 'Chaudière',
        marque: '',
        modele: '',
        numeroSerie: '',
        fluideType: '',
        chargeNominaleKg: 0,
        detectionPermanente: false,
      },
      {
        id: 'eq-tab',
        nom: 'TGBT',
        type: 'Tableau électrique',
        marque: '',
        modele: '',
        numeroSerie: '',
        fluideType: '',
        chargeNominaleKg: 0,
        detectionPermanente: false,
      },
    ],
  },
]

const visitesEq = visitesDepuisContrat(
  contrat({
    id: 'cm-eq',
    chantierIds: ['s1'],
    visitesParAn: 2,
    periodicite: 'semestrielle',
    lignesEquipements: [
      { siteId: 's1', equipementId: 'eq-ch', visitesParAn: 12 },
      { siteId: 's1', equipementId: 'eq-tab', visitesParAn: 2, sousTraitant: true },
    ],
  }),
  eqSites,
  { today: '2026-01-20', horizonMonths: 14, pastMonths: 1 },
)
assert.equal(visitesEq.filter((v) => v.equipementId === 'eq-ch').length, 12)
assert.equal(visitesEq.filter((v) => v.equipementId === 'eq-tab').length, 2)
assert.ok(visitesEq.some((v) => v.equipementId === 'eq-tab' && v.sousTraitant))
assert.ok(visitesEq.every((v) => v.contratOtKey === `cm-ot:cm-eq:s1:${v.slotKey}`))
assert.ok(
  visitesEq
    .filter((v) => v.equipementId)
    .every((v) => v.contratOtKeyEquipement?.includes(v.equipementId || '')),
)

const draftsEq = buildOtDraftsDepuisContrats({
  contrats: [
    contrat({
      id: 'cm-eq',
      chantierIds: ['s1'],
      visitesParAn: 2,
      periodicite: 'semestrielle',
      lignesEquipements: [
        { siteId: 's1', equipementId: 'eq-ch', visitesParAn: 1 },
        { siteId: 's1', equipementId: 'eq-tab', visitesParAn: 1, sousTraitant: true },
      ],
    }),
  ],
  sites: eqSites,
  today: '2026-01-20',
  horizonMonths: 14,
  pastMonths: 1,
})
assert.equal(draftsEq.length, 1, '1 OT regroupé pour 2 équipements même site / créneau')
assert.deepEqual(draftsEq[0].equipementIds?.slice().sort(), ['eq-ch', 'eq-tab'])
assert.ok(draftsEq[0].docsRequis.includes('fiche_chaufferie'))
assert.equal(draftsEq[0].maintenanceParSousTraitant, true)
assert.equal(draftsEq[0].origineOt, 'maintenance_contrat', 'mixte ST / interne')
assert.match(draftsEq[0].action, /2 équipements/i)
assert.equal(draftsEq[0].contratOtKey, 'cm-ot:cm-eq:s1:2026-12')

const draftsAllSt = buildOtDraftsDepuisContrats({
  contrats: [
    contrat({
      id: 'cm-st',
      chantierIds: ['s1'],
      lignesEquipements: [
        { siteId: 's1', equipementId: 'eq-ch', visitesParAn: 1, sousTraitant: true },
        { siteId: 's1', equipementId: 'eq-tab', visitesParAn: 1, sousTraitant: true },
      ],
    }),
  ],
  sites: eqSites,
  today: '2026-01-20',
  horizonMonths: 14,
  pastMonths: 1,
})
assert.equal(draftsAllSt[0].origineOt, 'sous_traitance', 'tous sous-traités → ST')

const { toAdd: addAfterSplit, skipped: skipAfterSplit } = mergeOtsDepuisContrats(
  [
    { contratOtKey: 'cm-ot:cm-eq:s1:eq-ch:2026-12' },
    { contratOtKey: 'cm-ot:cm-eq:s1:eq-tab:2026-12' },
  ],
  draftsEq,
)
assert.equal(addAfterSplit.length, 0, 'OT scindés couvrent le créneau site → pas de doublon')
assert.equal(skipAfterSplit, 1)

assert.equal(joursRestantsDansMois('2026-09-24'), 6)
assert.equal(joursRestantsDansMois('2026-09-30'), 0)
assert.equal(alertesOtContratFinMois([], { today: '2026-09-10' }).length, 0)

const alertes = alertesOtContratFinMois(
  [
    {
      id: 'o1',
      numero: '26092401',
      date: '2026-09-15',
      statut: 'pret_a_planifier',
      contratOtKey: 'cm-ot:c:s:2026-09',
      action: 'Maintenance mensuelle',
      visiteNiveau: 'mensuel',
    },
    {
      id: 'o2',
      numero: '26101501',
      date: '2026-10-15',
      statut: 'pret_a_planifier',
      contratOtKey: 'cm-ot:c:s:2026-10',
      action: 'Maintenance mensuelle',
    },
    {
      id: 'o3',
      numero: '26090101',
      date: '2026-09-01',
      statut: 'signe',
      contratOtKey: 'cm-ot:c:s:2026-09-done',
      action: 'faite',
    },
  ],
  { today: '2026-09-24', joursAvantFin: 7 },
)
assert.equal(alertes.length, 1)
assert.equal(alertes[0].otId, 'o1')
assert.equal(alertes[0].joursRestants, 6)
assert.equal(alertes[0].slotKey, '2026-09')

const pruned = pruneOtsContratHorsFenetre(
  [
    {
      id: 'keep',
      numero: '1',
      date: '2026-09-15',
      statut: 'pret_a_planifier',
      contratOtKey: 'cm-ot:c:s:2026-09',
    },
    {
      id: 'drop',
      numero: '2',
      date: '2027-03-15',
      statut: 'pret_a_planifier',
      contratOtKey: 'cm-ot:c:s:2027-03',
    },
  ] as Parameters<typeof pruneOtsContratHorsFenetre>[0],
  { today: '2026-09-02', horizonMonths: 1, pastMonths: 1 },
)
assert.equal(pruned.kept.map((o) => o.id).join(','), 'keep')
assert.equal(pruned.removed.map((o) => o.id).join(','), 'drop')

const over = decalerVisiteContrat(
  { dateDebut: '2026-01-15', dateFin: '2027-01-15', visiteDateOverrides: {} },
  { siteId: 's1', slotKey: '2026-03', dateActuelle: '2026-03-15', deltaMonths: -1 },
)
assert.equal(over['s1:2026-03'], '2026-02-15')
assert.equal(
  dateVisiteEffective({ visiteDateOverrides: over }, 's1', '2026-03', '2026-03-15'),
  '2026-02-15',
)
const avanceAnnuel = decalerVisiteContrat(
  { dateDebut: '2026-01-15', dateFin: '2027-01-15', visiteDateOverrides: over },
  { siteId: 's1', slotKey: '2026-12', dateActuelle: '2026-12-15', nouvelleDate: '2026-11-01' },
)
assert.equal(avanceAnnuel['s1:2026-12'], '2026-11-01')

const avecOverride = visitesDepuisContrat(
  contrat({
    id: 'cm-dec',
    visiteDateOverrides: { 's1:2026-03': '2026-02-20' },
  }),
  sites,
  { today: '2026-02-10', horizonMonths: 2, pastMonths: 0 },
)
assert.ok(
  avecOverride.some((v) => v.slotKey === '2026-03' && v.date === '2026-02-20'),
  'visite trimestrielle avancée visible dans la fenêtre',
)

assert.equal(
  dateDerniereInterventionPourOt(
    {
      id: 'ot-oct',
      date: '2026-10-02',
      chantierId: 's1',
      contratId: 'c1',
      contratOtKey: 'cm-ot:c1:s1:2026-10',
      typeOt: 'maintenance',
      statut: 'pret_a_planifier',
    },
    {
      derniereMaintenanceSite: '2026-09-27',
      ordresTravail: [
        {
          id: 'ot-sep',
          date: '2026-09-27',
          chantierId: 's1',
          contratId: 'c1',
          contratOtKey: 'cm-ot:c1:s1:2026-09',
          typeOt: 'maintenance',
          statut: 'termine',
          heure: '09:00',
        },
      ],
    },
  ),
  '2026-09-27',
)

assert.equal(slotKeyFromContratOtKey('cm-ot:c1:s1:2026-09'), '2026-09')
assert.equal(labelMoisSlot('2026-09'), 'Septembre 2026')
assert.equal(labelMoisSlot('2026-08'), 'Août 2026')
assert.equal(slotKeyMoisEnCours(new Date(2026, 8, 4, 12, 0, 0)), '2026-09')
assert.equal(isMoisGenerationEnRetard('2026-08', new Date(2026, 8, 4, 12, 0, 0)), true)
assert.equal(isMoisGenerationEnRetard('2026-09', new Date(2026, 8, 4, 12, 0, 0)), false)
const infoRetard = infoMoisGenerationOt(
  { contratOtKey: 'cm-ot:c1:s1:2026-08' },
  new Date(2026, 8, 4, 12, 0, 0),
)
assert.equal(infoRetard?.mois, 'Août 2026')
assert.equal(infoRetard?.retard, true)
assert.equal(infoRetard?.label, 'Août 2026 · retard')

console.log('ok test-contrat-ot-auto')
