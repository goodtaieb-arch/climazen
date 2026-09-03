import assert from 'node:assert/strict'
import {
  applyGmaoImport,
  previewGmaoImport,
  type GmaoImportRow,
} from '../src/lib/gmaoImport'
import type { AppData, Client, Site } from '../src/lib/types'
import { emptyData } from '../src/lib/storage'

const rows: GmaoImportRow[] = [
  {
    client_raison_sociale: 'Dupont Clim',
    client_type: 'entreprise',
    client_ville: 'Nice',
    site_nom: 'Atelier',
    site_ville: 'Nice',
    equipement_nom: 'Split RDC',
    equipement_marque: 'Daikin',
    fluide: 'R-32',
    charge_kg: '1,2',
  },
  {
    client_raison_sociale: 'Dupont Clim',
    site_nom: 'Atelier',
    equipement_nom: 'PAC toit',
    fluide: 'R-410A',
    charge_kg: '2',
  },
  {
    client_raison_sociale: 'Martin',
    client_type: 'particulier',
    client_nom: 'Martin',
    client_prenom: 'Albert',
    site_nom: 'Maison',
    equipement_type: 'clim',
  },
]

const preview = previewGmaoImport(rows)
assert.equal(preview.clients, 2)
assert.equal(preview.sites, 2)
assert.equal(preview.equipements, 3)
assert.equal(preview.errors.length, 0)

const data: AppData = emptyData()
const clients: Client[] = []
const sites: Site[] = []

const result = applyGmaoImport(rows, data, {
  upsertClient: (c) => {
    const id = c.id || crypto.randomUUID()
    const next = { ...c, id, createdAt: new Date().toISOString() } as Client
    const i = clients.findIndex((x) => x.id === id)
    if (i >= 0) clients[i] = next
    else clients.push(next)
    return id
  },
  upsertChantier: (c) => {
    const id = c.id || crypto.randomUUID()
    const next = { ...c, id, createdAt: new Date().toISOString() } as Site
    const i = sites.findIndex((x) => x.id === id)
    if (i >= 0) sites[i] = next
    else sites.push(next)
    return id
  },
})

assert.equal(result.clientsCreated, 2)
assert.equal(sites.length, 2)
assert.equal(sites[0].equipements?.length, 2)
assert.equal(sites[0].equipements?.[0].fluideType, 'R-32')
assert.equal(sites[0].equipements?.[0].chargeNominaleKg, 1.2)

console.log('ok test-gmao-import')
