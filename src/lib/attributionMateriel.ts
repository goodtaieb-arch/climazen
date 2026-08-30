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

export function operateursEnAttenteReception(data: AppData) {
  const map = new Map<string, { userId: string; name: string; n: number }>()
  const add = (userId?: string, name?: string) => {
    if (!userId) return
    const cur = map.get(userId) || { userId, name: name || 'Opérateur', n: 0 }
    if (name?.trim()) cur.name = name.trim()
    cur.n += 1
    map.set(userId, cur)
  }
  for (const v of data.voitures || []) {
    if (v.assigneeUserId && !v.receptionAt) add(v.assigneeUserId, v.assigneeName)
  }
  for (const o of data.outillages || []) {
    if (o.assigneeUserId && !o.receptionAt) add(o.assigneeUserId, o.assigneeName)
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}

export function grouperMaterielParFamille(lignes: MaterielLigne[]) {
  const map = new Map<string, MaterielLigne[]>()
  for (const l of lignes) {
    const arr = map.get(l.famille) || []
    arr.push(l)
    map.set(l.famille, arr)
  }
  const priorite = ['Véhicule', 'Téléphone professionnel']
  return [...map.entries()]
    .map(([famille, items]) => ({ famille, items }))
    .sort((a, b) => {
      const ia = priorite.indexOf(a.famille)
      const ib = priorite.indexOf(b.famille)
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
      return a.famille.localeCompare(b.famille, 'fr')
    })
}
