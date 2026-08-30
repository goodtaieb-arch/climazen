import type { VoitureMarqueCarrosserie, VoitureMarqueType, VoitureZoneId } from './types'

/** ViewBox du schéma constat (avant en haut). */
export const CONSTAT_VB = { w: 240, h: 420 }

export const VOITURE_MARQUE_LABELS: Record<VoitureMarqueType, string> = {
  rayure: 'Rayure',
  bosse: 'Bosse / choc',
}

export const VOITURE_ZONES: {
  id: VoitureZoneId
  label: string
  short: string
  x: number
  y: number
  w: number
  h: number
}[] = [
  { id: 'parechoc_av', label: 'Pare-chocs avant', short: 'AV', x: 72, y: 28, w: 96, h: 26 },
  { id: 'capot', label: 'Capot', short: 'Capot', x: 70, y: 54, w: 100, h: 52 },
  { id: 'parebrise', label: 'Pare-brise', short: 'P-b', x: 76, y: 106, w: 88, h: 36 },
  { id: 'toit', label: 'Toit', short: 'Toit', x: 74, y: 142, w: 92, h: 118 },
  { id: 'hayon', label: 'Hayon / coffre', short: 'Hayon', x: 72, y: 260, w: 96, h: 58 },
  { id: 'parechoc_ar', label: 'Pare-chocs arrière', short: 'AR', x: 72, y: 318, w: 96, h: 26 },
  { id: 'aile_av_g', label: 'Aile avant gauche', short: 'Aile G', x: 46, y: 58, w: 26, h: 52 },
  { id: 'porte_av_g', label: 'Porte avant gauche', short: 'Porte G', x: 46, y: 110, w: 28, h: 70 },
  { id: 'porte_ar_g', label: 'Porte / latéral arrière gauche', short: 'Lat. G', x: 46, y: 180, w: 28, h: 78 },
  { id: 'aile_ar_g', label: 'Aile arrière gauche', short: 'Aile G AR', x: 46, y: 258, w: 26, h: 58 },
  { id: 'aile_av_d', label: 'Aile avant droite', short: 'Aile D', x: 168, y: 58, w: 26, h: 52 },
  { id: 'porte_av_d', label: 'Porte avant droite', short: 'Porte D', x: 166, y: 110, w: 28, h: 70 },
  { id: 'porte_ar_d', label: 'Porte / latéral arrière droit', short: 'Lat. D', x: 166, y: 180, w: 28, h: 78 },
  { id: 'aile_ar_d', label: 'Aile arrière droite', short: 'Aile D AR', x: 168, y: 258, w: 26, h: 58 },
]

const ZONE_IDS = new Set(VOITURE_ZONES.map((z) => z.id))

export function isVoitureZoneId(v: unknown): v is VoitureZoneId {
  return typeof v === 'string' && ZONE_IDS.has(v as VoitureZoneId)
}

export function isVoitureMarqueType(v: unknown): v is VoitureMarqueType {
  return v === 'rayure' || v === 'bosse'
}

export function voitureZoneLabel(id: VoitureZoneId) {
  return VOITURE_ZONES.find((z) => z.id === id)?.label || id
}

export function sanitizeMarquesCarrosserie(raw: unknown): VoitureMarqueCarrosserie[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<VoitureZoneId>()
  const out: VoitureMarqueCarrosserie[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const zone = (row as VoitureMarqueCarrosserie).zone
    const type = (row as VoitureMarqueCarrosserie).type
    if (!isVoitureZoneId(zone) || !isVoitureMarqueType(type) || seen.has(zone)) continue
    seen.add(zone)
    out.push({ zone, type })
  }
  return out
}

/** Vide → rayure → bosse → vide (comme cocher / décocher sur le constat). */
export function cycleMarqueZone(
  marques: VoitureMarqueCarrosserie[] | undefined,
  zone: VoitureZoneId,
): VoitureMarqueCarrosserie[] {
  const list = marques || []
  const cur = list.find((m) => m.zone === zone)
  const rest = list.filter((m) => m.zone !== zone)
  if (!cur) return [...rest, { zone, type: 'rayure' }]
  if (cur.type === 'rayure') return [...rest, { zone, type: 'bosse' }]
  return rest
}

export function resumeMarquesCarrosserie(marques: VoitureMarqueCarrosserie[] | undefined) {
  const list = marques || []
  const nR = list.filter((m) => m.type === 'rayure').length
  const nB = list.filter((m) => m.type === 'bosse').length
  const bits: string[] = []
  if (nB) bits.push(`${nB} bosse${nB > 1 ? 's' : ''}`)
  if (nR) bits.push(`${nR} rayure${nR > 1 ? 's' : ''}`)
  return bits.join(', ')
}
