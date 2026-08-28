import assert from 'node:assert/strict'
import { groupOutillagesByType } from '../src/lib/outillage'
import { OUTILLAGE_CATALOG } from '../src/lib/outillageCatalog'
import { mergeTeamMembers } from '../src/lib/teamMembers'
import type { Outillage } from '../src/lib/types'

const items: Outillage[] = [
  {
    id: '1',
    type: 'detecteur_fuite',
    identification: 'det 123',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: '2',
    type: 'detecteur_fuite',
    identification: 'des 124',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: '3',
    type: 'epi_securite',
    identification: 'app-1',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
]
const groups = groupOutillagesByType(items)
assert.equal(groups.length, 2)
assert.equal(groups[0]?.type, 'detecteur_fuite')
assert.equal(groups[0]?.items.length, 2)
assert.equal(groups[1]?.type, 'epi_securite')
assert.equal(Boolean(OUTILLAGE_CATALOG.detecteur_fuite.needsControleDate), true)
assert.equal(Boolean(OUTILLAGE_CATALOG.pompe_vide.needsControleDate), false)
assert.equal(Boolean(OUTILLAGE_CATALOG.epi_securite.needsControleDate), false)

const team = mergeTeamMembers({
  user: {
    id: 'owner',
    email: 'a@x.fr',
    username: 'a@x.fr',
    fullName: 'taieb',
    createdAt: '',
    organizationId: 'org',
    role: 'owner',
    active: true,
  },
  remote: [
    {
      id: 't1',
      email: 't1@x.fr',
      username: 't1@x.fr',
      fullName: 'Tech 1',
      createdAt: '',
      organizationId: 'org',
      role: 'operateur',
      active: true,
    },
    {
      id: 't2',
      email: 't2@x.fr',
      username: 't2@x.fr',
      fullName: 'Tech 2',
      createdAt: '',
      organizationId: 'org',
      role: 'operateur',
      active: false,
    },
    {
      id: 't3',
      email: 't3@x.fr',
      username: 't3@x.fr',
      fullName: 'Tech 3',
      createdAt: '',
      organizationId: 'org',
      role: 'operateur',
      active: true,
    },
  ],
  orgId: 'org',
})
assert.equal(team.length, 4)
assert.ok(team.some((m) => m.id === 't2' && m.active === false))

const retired = mergeTeamMembers({
  remote: team,
  retiredIds: ['t2'],
  orgId: 'org',
})
assert.equal(retired.length, 3)
assert.equal(retired.some((m) => m.id === 't2'), false)

console.log('test-outillage: ok')
