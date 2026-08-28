import type { AppData, MaterielLigne, Outillage, Voiture } from './types'
import { outillageLabel } from './outillage'
import { outillageTypeLabel } from './outillageCatalog'
import { voitureLabel } from './voitures'

export function receptionPreserved<T extends { assigneeUserId?: string; receptionAt?: string; receptionParUserId?: string }>(
  existing: T | undefined,
  nextAssigneeId: string | undefined,
): Pick<T, 'receptionAt' | 'receptionParUserId'> {
  if (!nextAssigneeId) return { receptionAt: undefined, receptionParUserId: undefined }
  if (existing?.assigneeUserId === nextAssigneeId && existing.receptionAt) {
    return {
      receptionAt: existing.receptionAt,
      receptionParUserId: existing.receptionParUserId,
    }
  }
  return { receptionAt: undefined, receptionParUserId: undefined }
}

export function voitureLigne(v: Voiture): MaterielLigne {
  return {
    kind: 'voiture',
    itemId: v.id,
    famille: 'Véhicule',
    label: voitureLabel(v).replace(/\s*→.*$/, ''),
  }
}

export function outillageLigne(o: Outillage): MaterielLigne {
  return {
    kind: 'outillage',
    itemId: o.id,
    famille: outillageTypeLabel(o.type),
    label: outillageLabel(o),
  }
}

/** Tout le matériel société attribué à cet opérateur, groupé par famille. */
export function materielConfiePourUser(data: AppData, userId?: string | null): MaterielLigne[] {
  if (!userId) return []
  const voitures = (data.voitures || []).filter((v) => v.assigneeUserId === userId).map(voitureLigne)
  const outils = (data.outillages || []).filter((o) => o.assigneeUserId === userId).map(outillageLigne)
  return [...voitures, ...outils]
}

export function materielEnAttenteReception(data: AppData, userId?: string | null): MaterielLigne[] {
  if (!userId) return []
  const voitures = (data.voitures || [])
    .filter((v) => v.assigneeUserId === userId && !v.receptionAt)
    .map(voitureLigne)
  const outils = (data.outillages || [])
    .filter((o) => o.assigneeUserId === userId && !o.receptionAt)
    .map(outillageLigne)
  return [...voitures, ...outils]
}

export function grouperMaterielParFamille(lignes: MaterielLigne[]) {
  const map = new Map<string, MaterielLigne[]>()
  for (const l of lignes) {
    const arr = map.get(l.famille) || []
    arr.push(l)
    map.set(l.famille, arr)
  }
  return [...map.entries()].map(([famille, items]) => ({ famille, items }))
}
