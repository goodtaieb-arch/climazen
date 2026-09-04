/**
 * Historique GMAO d’un équipement ou d’un site — OT, CERFA, fiches, pièces.
 */

import { PIECE_MOUVEMENT_KIND_LABELS } from './piecesDetachees'
import { STATUT_OT_LABELS, TYPE_OT_LABELS, isOtCloture, type OrdreTravail } from './ordreTravail'
import type { AppData, CerfaDraft, Equipement, Site } from './types'

export type HistoriqueKind =
  | 'ot'
  | 'cerfa'
  | 'fiche_clim'
  | 'fiche_chaufferie'
  | 'fiche_cta_vmc'
  | 'piece'

export type HistoriqueEntree = {
  id: string
  kind: HistoriqueKind
  date: string
  titre: string
  detail?: string
  statut?: string
  otId?: string
  otNumero?: string
}

const KIND_LABELS: Record<HistoriqueKind, string> = {
  ot: 'Intervention',
  cerfa: 'CERFA / intervention',
  fiche_clim: 'Fiche maintenance clim',
  fiche_chaufferie: 'Fiche chaufferie',
  fiche_cta_vmc: 'Fiche CTA / VMC',
  piece: 'Pièce consommée',
}

export function labelHistoriqueKind(kind: HistoriqueKind): string {
  return KIND_LABELS[kind] || kind
}

function otConcerneEquipement(ot: OrdreTravail, equipementId: string): boolean {
  return (
    ot.equipementId === equipementId ||
    (ot.equipementIds || []).includes(equipementId)
  )
}

function cerfaConcerneEquipement(c: CerfaDraft, siteId: string, equipementId: string): boolean {
  if (c.chantierId !== siteId) return false
  return c.equipementId === equipementId
}

export function historiqueEquipement(
  data: AppData,
  siteId: string,
  equipementId: string,
): HistoriqueEntree[] {
  const out: HistoriqueEntree[] = []
  const eq = (data.chantiers || [])
    .find((s) => s.id === siteId)
    ?.equipements?.find((e) => e.id === equipementId)

  for (const ot of data.ordresTravail || []) {
    if (ot.chantierId !== siteId || !otConcerneEquipement(ot, equipementId)) continue
    out.push({
      id: `ot-${ot.id}`,
      kind: 'ot',
      date: ot.date || ot.updatedAt,
      titre: `${ot.numero} — ${TYPE_OT_LABELS[ot.typeOt] || ot.typeOt}`,
      detail: ot.rapportAction?.trim() || ot.action?.trim(),
      statut: STATUT_OT_LABELS[ot.statut] || ot.statut,
      otId: ot.id,
      otNumero: ot.numero,
    })
  }

  for (const c of data.interventions || []) {
    if (!cerfaConcerneEquipement(c, siteId, equipementId)) continue
    out.push({
      id: `cerfa-${c.id}`,
      kind: 'cerfa',
      date: c.dateIntervention || c.updatedAt,
      titre: c.numeroIntervention || c.cerfaPdfFileName || 'CERFA',
      detail: c.natures?.join(', '),
      otId: c.ordreTravailId,
    })
  }

  for (const f of data.fichesMaintenanceClim || []) {
    if (f.chantierId !== siteId || f.equipementId !== equipementId) continue
    out.push({
      id: `clim-${f.id}`,
      kind: 'fiche_clim',
      date: f.date || f.updatedAt,
      titre: 'Maintenance clim / PAC',
      detail: f.resultat || undefined,
    })
  }

  for (const f of data.fichesMaintenanceChaufferie || []) {
    if (f.chantierId !== siteId || f.equipementId !== equipementId) continue
    out.push({
      id: `ch-${f.id}`,
      kind: 'fiche_chaufferie',
      date: f.date || f.updatedAt,
      titre: `Chaufferie · ${f.periode || 'visite'}`,
    })
  }

  for (const f of data.fichesMaintenanceCtaVmc || []) {
    if (f.chantierId !== siteId || f.equipementId !== equipementId) continue
    out.push({
      id: `cta-${f.id}`,
      kind: 'fiche_cta_vmc',
      date: f.date || f.updatedAt,
      titre: `CTA/VMC · ${f.periode || 'visite'}`,
    })
  }

  const pieceIds = new Set(
    (data.piecesDetachees || []).map((p) => p.id),
  )
  for (const m of data.piecesMouvements || []) {
    if (!m.otId) continue
    const ot = (data.ordresTravail || []).find((o) => o.id === m.otId)
    if (!ot || ot.chantierId !== siteId || !otConcerneEquipement(ot, equipementId)) continue
    if (!pieceIds.has(m.pieceId)) continue
    const piece = data.piecesDetachees!.find((p) => p.id === m.pieceId)!
    out.push({
      id: `pm-${m.id}`,
      kind: 'piece',
      date: m.createdAt,
      titre: piece.reference || piece.designation,
      detail: `${PIECE_MOUVEMENT_KIND_LABELS[m.kind]} · ${m.quantite} ${piece.unite}`,
      otId: m.otId,
      otNumero: m.otNumero,
    })
  }

  void eq
  return out.sort((a, b) => b.date.localeCompare(a.date))
}

/** Historique site entier (tous équipements + OT site sans machine). */
export function historiqueSite(data: AppData, siteId: string): HistoriqueEntree[] {
  const out: HistoriqueEntree[] = []
  const site = (data.chantiers || []).find((s) => s.id === siteId)
  if (!site) return out

  const eqIds = new Set((site.equipements || []).map((e) => e.id))
  for (const eq of site.equipements || []) {
    for (const h of historiqueEquipement(data, siteId, eq.id)) {
      if (!out.some((x) => x.id === h.id)) out.push(h)
    }
  }

  for (const ot of data.ordresTravail || []) {
    if (ot.chantierId !== siteId) continue
    if (ot.equipementId && eqIds.has(ot.equipementId)) continue
    if ((ot.equipementIds || []).some((id) => eqIds.has(id))) continue
    out.push({
      id: `ot-${ot.id}`,
      kind: 'ot',
      date: ot.date || ot.updatedAt,
      titre: `${ot.numero} — ${ot.action?.slice(0, 60) || TYPE_OT_LABELS[ot.typeOt]}`,
      detail: ot.localisationClient || ot.observations,
      statut: STATUT_OT_LABELS[ot.statut] || ot.statut,
      otId: ot.id,
      otNumero: ot.numero,
    })
  }

  return out.sort((a, b) => b.date.localeCompare(a.date))
}

/** Entrées visibles côté portail client (maintenance clôturée). */
export function historiqueSitePortailClient(
  data: AppData,
  siteId: string,
): HistoriqueEntree[] {
  return historiqueSite(data, siteId).filter((h) => {
    if (h.kind !== 'ot') return true
    const ot = (data.ordresTravail || []).find((o) => o.id === h.otId)
    return ot ? isOtCloture(ot.statut) : false
  })
}

export function resumeHistorique(entries: HistoriqueEntree[]): {
  total: number
  otClotures: number
  derniereDate?: string
} {
  const otClotures = entries.filter((e) => e.kind === 'ot').length
  return {
    total: entries.length,
    otClotures,
    derniereDate: entries[0]?.date,
  }
}

export function equipementLabel(e: Pick<Equipement, 'nom' | 'type' | 'marque'>): string {
  return (e.nom || e.type || e.marque || 'Équipement').trim()
}

export function siteLabel(s: Pick<Site, 'nom' | 'ville'>): string {
  const nom = (s.nom || '').trim()
  const ville = (s.ville || '').trim()
  if (nom && ville) return `${nom} · ${ville}`
  return nom || ville || 'Site'
}
