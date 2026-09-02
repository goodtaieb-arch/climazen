/**
 * Sync automatique contrat signé → OT préventifs + rappels agenda.
 */

import { v4 as uuid } from 'uuid'
import type { AppData } from './types'
import { buildOtDraftsDepuisContrats, mergeOtsDepuisContrats } from './contratOtAuto'
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
  const existing = next.ordresTravail || []
  const { toAdd } = mergeOtsDepuisContrats(existing, drafts)
  if (toAdd.length > 0) {
    const now = new Date().toISOString()
    const grown = [...existing]
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
  const list = [...(next.agendaEvents || [])]
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
