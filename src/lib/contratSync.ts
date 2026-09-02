/**
 * Sync automatique contrat signé → OT préventifs + rappels agenda.
 * OT générés mois par mois (pas toute l’année).
 */

import { v4 as uuid } from 'uuid'
import type { AppData } from './types'
import {
  buildOtDraftsDepuisContrats,
  mergeOtsDepuisContrats,
  pruneOtsContratHorsFenetre,
} from './contratOtAuto'
import { buildAutoAgendaEvents, type AgendaEvent } from './agenda'
import { nextNumeroOt } from './ordreTravail'
import type { ContratMaintenance } from './contratMaintenance'

export function applyContratSigneSync(data: AppData, contrat?: ContratMaintenance): AppData {
  let next = data
  if (contrat?.statut === 'signe' && contrat.clientId) {
    const coverAll = !contrat.chantierIds || contrat.chantierIds.length === 0
    next = {
      ...next,
      chantiers: next.chantiers.map((s) => {
        if (s.clientId !== contrat.clientId) return s
        if (!coverAll && !contrat.chantierIds!.includes(s.id)) return s
        return { ...s, modeGestion: 'contrat' as const }
      }),
    }
  }

  const drafts = buildOtDraftsDepuisContrats({
    contrats: next.contratsMaintenance || [],
    sites: next.chantiers,
  })
  const { kept, removed: _removed } = pruneOtsContratHorsFenetre(next.ordresTravail || [])
  const { toAdd } = mergeOtsDepuisContrats(kept, drafts)
  if (toAdd.length > 0 || kept.length !== (next.ordresTravail || []).length) {
    const now = new Date().toISOString()
    const grown = [...kept]
    for (const draft of toAdd) {
      const numero = nextNumeroOt({ ...next, ordresTravail: grown })
      grown.push({
        ...draft,
        id: uuid(),
        numero,
        createdAt: now,
        updatedAt: now,
      })
    }
    next = { ...next, ordresTravail: grown }
  }

  const generated = buildAutoAgendaEvents({
    contrats: next.contratsMaintenance || [],
    sites: next.chantiers,
  })
  const validAutoKeys = new Set(generated.map((g) => g.autoKey).filter(Boolean) as string[])
  let list = [...(next.agendaEvents || [])].filter((e) => {
    const key = (e.autoKey || '').trim()
    if (!key.startsWith('contrat:')) return true
    if (validAutoKeys.has(key)) return true
    return e.statut !== 'a_faire' && e.statut !== 'contacte'
  })
  const byKey = new Map(list.filter((e) => e.autoKey).map((e) => [e.autoKey!, e]))
  const now = new Date().toISOString()
  for (const g of generated) {
    const key = g.autoKey!
    const existingEv = byKey.get(key)
    if (existingEv) {
      const idx = list.findIndex((x) => x.id === existingEv.id)
      if (idx >= 0) {
        list[idx] = {
          ...existingEv,
          title: g.title,
          date: g.date,
          dateRappel: g.dateRappel,
          notes: g.notes,
          type: g.type,
          clientId: g.clientId,
          chantierId: g.chantierId,
          contratId: g.contratId,
          updatedAt: now,
        }
      }
    } else {
      const ev: AgendaEvent = {
        ...g,
        id: uuid(),
        createdAt: now,
        updatedAt: now,
      }
      list.push(ev)
      byKey.set(key, ev)
    }
  }

  return { ...next, agendaEvents: list }
}

export function contratVientDetreSigne(
  prev?: ContratMaintenance,
  next?: ContratMaintenance,
): boolean {
  return next?.statut === 'signe' && prev?.statut !== 'signe'
}
