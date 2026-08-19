/** Tombstones — empêche la sync de ressusciter un client/site supprimé. */

export type DeletedEntityIds = {
  clients?: string[]
  chantiers?: string[]
}

export function mergeIdLists(...lists: (string[] | undefined)[]): string[] {
  const out = new Set<string>()
  for (const list of lists) {
    for (const id of list || []) {
      if (id) out.add(id)
    }
  }
  return [...out]
}

export function applyTombstones<T extends { id: string }>(
  items: T[] | undefined,
  deleted?: string[],
): T[] {
  const list = items || []
  if (!deleted?.length) return list
  const ban = new Set(deleted)
  return list.filter((item) => !ban.has(item.id))
}

/** Garde seulement les tombstones encore utiles (l’entité existe encore côté cloud). */
export function pruneTombstones(
  deleted: DeletedEntityIds | undefined,
  remote: { clients?: { id: string }[]; chantiers?: { id: string }[] },
): DeletedEntityIds {
  const remoteClients = new Set((remote.clients || []).map((c) => c.id))
  const remoteSites = new Set((remote.chantiers || []).map((c) => c.id))
  return {
    clients: (deleted?.clients || []).filter((id) => remoteClients.has(id)),
    chantiers: (deleted?.chantiers || []).filter((id) => remoteSites.has(id)),
  }
}

export function withDeletedIds(
  current: DeletedEntityIds | undefined,
  patch: DeletedEntityIds,
): DeletedEntityIds {
  return {
    clients: mergeIdLists(current?.clients, patch.clients),
    chantiers: mergeIdLists(current?.chantiers, patch.chantiers),
  }
}
