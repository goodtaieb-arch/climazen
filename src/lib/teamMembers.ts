import type { UserAccount } from './auth'

/** Fusionne comptes Équipe + dossiers + attributions — comme la page Équipe. */
export function mergeTeamMembers(opts: {
  user?: Pick<
    UserAccount,
    'id' | 'email' | 'username' | 'fullName' | 'createdAt' | 'organizationId' | 'role' | 'active'
  > | null
  remote?: UserAccount[]
  dossiers?: Array<{ userId?: string; userName?: string }>
  extraAssignees?: Array<{ id?: string; name?: string }>
  retiredIds?: string[]
  orgId?: string
}): UserAccount[] {
  const retired = new Set(opts.retiredIds || [])
  const orgId = opts.orgId || ''
  const map = new Map<string, UserAccount>()

  const add = (m: {
    id?: string
    email?: string
    username?: string
    fullName?: string
    createdAt?: string
    organizationId?: string
    role?: UserAccount['role']
    active?: boolean
  }) => {
    const id = String(m.id || '').trim()
    if (!id || retired.has(id)) return
    const prev = map.get(id)
    map.set(id, {
      id,
      email: m.email || prev?.email || '',
      username: m.username || prev?.username || m.email || prev?.email || '',
      fullName: (m.fullName || prev?.fullName || '').trim() || 'Technicien',
      createdAt: m.createdAt || prev?.createdAt || '',
      organizationId: m.organizationId || prev?.organizationId || orgId,
      role: m.role || prev?.role || 'operateur',
      // Un compte déjà listé comme actif (Équipe / dossier) reste visible même si
      // une source plus tardive omet `active`.
      active: m.active ?? prev?.active ?? true,
    })
  }

  if (opts.user) add(opts.user)
  for (const d of opts.dossiers || []) {
    add({ id: d.userId, fullName: d.userName, role: 'operateur', active: true })
  }
  for (const a of opts.extraAssignees || []) {
    add({ id: a.id, fullName: a.name, role: 'operateur', active: true })
  }
  for (const m of opts.remote || []) add(m)

  return [...map.values()].sort((a, b) => {
    if (a.role !== b.role) return a.role === 'owner' ? -1 : 1
    return (a.fullName || a.email).localeCompare(b.fullName || b.email, 'fr')
  })
}

/** Tous les IDs tech déjà connus dans le parc / OT / dossiers (complète listTeam). */
export function extraAssigneesFromData(data: {
  outillages?: Array<{ assigneeUserId?: string; assigneeName?: string }>
  voitures?: Array<{ assigneeUserId?: string; assigneeName?: string }>
  detecteurs?: Array<{ assigneeUserId?: string; assigneeName?: string }>
  ordresTravail?: Array<{ technicienUserId?: string; technicien?: string }>
}): Array<{ id?: string; name?: string }> {
  const out: Array<{ id?: string; name?: string }> = []
  for (const o of data.outillages || []) {
    if (o.assigneeUserId) out.push({ id: o.assigneeUserId, name: o.assigneeName })
  }
  for (const v of data.voitures || []) {
    if (v.assigneeUserId) out.push({ id: v.assigneeUserId, name: v.assigneeName })
  }
  for (const d of data.detecteurs || []) {
    if (d.assigneeUserId) out.push({ id: d.assigneeUserId, name: d.assigneeName })
  }
  for (const ot of data.ordresTravail || []) {
    if (ot.technicienUserId) out.push({ id: ot.technicienUserId, name: ot.technicien })
  }
  return out
}
