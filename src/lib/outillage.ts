import type { AppData, Outillage } from './types'
import {
  OUTILLAGE_CATALOG,
  OUTILLAGE_OBLIGATOIRE_IDS,
  outillageTypeLabel,
  type OutillageTypeId,
} from './outillageCatalog'
import { isDetecteurControleExpire } from './types'

export function outillagesForUser(data: AppData, userId?: string | null): Outillage[] {
  const list = data.outillages || []
  if (!userId) return list
  return list.filter((o) => o.assigneeUserId === userId)
}

export function outillageForUserByType(
  data: AppData,
  userId: string | undefined,
  type: OutillageTypeId,
): Outillage | undefined {
  const list = data.outillages || []
  if (userId) {
    const mine = list.find((o) => o.type === type && o.assigneeUserId === userId)
    if (mine) return mine
  }
  return list.find((o) => o.type === type)
}

export function outillageLabel(o: Outillage) {
  const type = outillageTypeLabel(o.type)
  const id = o.identification.trim()
  const marque = [o.marque, o.modele].filter(Boolean).join(' ')
  const detail = marque ? `${id} — ${marque}` : id
  return `${type} · ${detail}`
}

/** Checklist des 5 outils obligatoires pour un technicien. */
export function checklistOutillageObligatoire(data: AppData, userId?: string | null) {
  return OUTILLAGE_OBLIGATOIRE_IDS.map((typeId) => {
    const def = OUTILLAGE_CATALOG[typeId]
    const item = userId ? outillageForUserByType(data, userId, typeId) : undefined
    const anyInParc = (data.outillages || []).some((o) => o.type === typeId)
    const controleExpire =
      item?.controleDate && def.needsControleDate
        ? isDetecteurControleExpire(item.controleDate)
        : false
    return {
      typeId,
      label: def.label,
      ok: Boolean(item?.identification?.trim()),
      anyInParc,
      item,
      controleExpire,
      needsControleDate: Boolean(def.needsControleDate),
    }
  })
}

export function missingOutillageObligatoire(data: AppData, userId?: string | null) {
  return checklistOutillageObligatoire(data, userId).filter((x) => !x.ok)
}
