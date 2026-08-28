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
