/** Tombstones — empêche la sync de ressusciter une entité supprimée. */

export type DeletedEntityIds = {
  clients?: string[]
  chantiers?: string[]
  /** Bouteilles de stock supprimées */
  stock?: string[]
  /** Mouvements stock orphelins (optionnel) */
  stockMouvements?: string[]
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
  remote: {
    clients?: { id: string }[]
    chantiers?: { id: string }[]
    stock?: { id: string }[]
    stockMouvements?: { id: string }[]
  },
): DeletedEntityIds {
  const remoteClients = new Set((remote.clients || []).map((c) => c.id))
  const remoteSites = new Set((remote.chantiers || []).map((c) => c.id))
  const remoteStock = new Set((remote.stock || []).map((s) => s.id))
  const remoteMvts = new Set((remote.stockMouvements || []).map((m) => m.id))
  return {
    clients: (deleted?.clients || []).filter((id) => remoteClients.has(id)),
    chantiers: (deleted?.chantiers || []).filter((id) => remoteSites.has(id)),
    stock: (deleted?.stock || []).filter((id) => remoteStock.has(id)),
    stockMouvements: (deleted?.stockMouvements || []).filter((id) => remoteMvts.has(id)),
  }
}

export function withDeletedIds(
  current: DeletedEntityIds | undefined,
  patch: DeletedEntityIds,
): DeletedEntityIds {
  return {
    clients: mergeIdLists(current?.clients, patch.clients),
    chantiers: mergeIdLists(current?.chantiers, patch.chantiers),
    stock: mergeIdLists(current?.stock, patch.stock),
    stockMouvements: mergeIdLists(current?.stockMouvements, patch.stockMouvements),
  }
}
