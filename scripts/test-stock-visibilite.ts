import assert from 'node:assert/strict'
import type { StockItem } from '../src/lib/types'
import type { PersonnelDossier } from '../src/lib/rhDocuments'
import {
  agenceOfBouteille,
  filtreStockFluidesPourViewer,
  kgStockFluides,
  resumeStockFluides,
  stockFluidesParEmplacement,
} from '../src/lib/stockVisibilite'

const dossiers: PersonnelDossier[] = [
  {
    userId: 'tech-a',
    agenceCode: '06',
  } as PersonnelDossier,
  {
    userId: 'tech-b',
    agenceCode: '13',
  } as PersonnelDossier,
]

const stock: StockItem[] = [
  {
    id: '1',
    fluide: 'R-32',
    contenantType: 'vierge',
    numeroContenant: 'A1',
    quantiteKg: 10,
    emplacement: 'atelier',
    agenceCode: '06',
    updatedAt: '',
  },
  {
    id: '2',
    fluide: 'R-410A',
    contenantType: 'vierge',
    numeroContenant: 'V1',
    quantiteKg: 5,
    emplacement: 'vehicule',
    assigneeUserId: 'tech-a',
    assigneeName: 'Alice',
    updatedAt: '',
  },
  {
    id: '3',
    fluide: 'R-32',
    contenantType: 'recuperation',
    numeroContenant: 'V2',
    quantiteKg: 3,
    emplacement: 'vehicule',
    assigneeUserId: 'tech-b',
    assigneeName: 'Bob',
    updatedAt: '',
  },
  {
    id: '4',
    fluide: 'R-32',
    contenantType: 'vierge',
    numeroContenant: 'AT13',
    quantiteKg: 8,
    emplacement: 'atelier',
    agenceCode: '13',
    updatedAt: '',
  },
]

assert.equal(agenceOfBouteille(stock[1], dossiers), '06')
assert.equal(agenceOfBouteille(stock[2], dossiers), '13')
assert.equal(agenceOfBouteille(stock[0], dossiers), '06')

const terrainA = filtreStockFluidesPourViewer({
  stock,
  mode: 'terrain',
  userId: 'tech-a',
  dossiers,
})
assert.equal(terrainA.length, 1)
assert.equal(terrainA[0].id, '2')

const terrainB = filtreStockFluidesPourViewer({
  stock,
  mode: 'terrain',
  userId: 'tech-b',
  dossiers,
})
assert.equal(terrainB.length, 1)
assert.equal(terrainB[0].id, '3')

const bureauAll = filtreStockFluidesPourViewer({
  stock,
  mode: 'bureau',
  dossiers,
})
assert.equal(bureauAll.length, 4)

const bureauTechA = filtreStockFluidesPourViewer({
  stock,
  mode: 'bureau',
  techId: 'tech-a',
  dossiers,
})
assert.equal(bureauTechA.length, 1)
assert.equal(bureauTechA[0].id, '2')

const bureauAg06 = filtreStockFluidesPourViewer({
  stock,
  mode: 'bureau',
  agenceCodes: ['06'],
  dossiers,
})
assert.deepEqual(
  bureauAg06.map((s) => s.id).sort(),
  ['1', '2'],
)

const par = stockFluidesParEmplacement(stock)
assert.equal(par.atelier.length, 2)
assert.equal(par.vehiculesParTech.length, 2)
assert.equal(kgStockFluides(par.atelier), 18)

const resume = resumeStockFluides(stock, dossiers)
assert.equal(resume.atelierKg, 18)
assert.equal(resume.vehiculesKg, 8)
assert.equal(resume.totalKg, 26)
assert.ok(resume.parAgence.some((a) => a.agenceCode === '06' && a.totalKg === 15))
assert.ok(resume.parAgence.some((a) => a.agenceCode === '13' && a.totalKg === 11))

console.log('test-stock-visibilite: ok')
