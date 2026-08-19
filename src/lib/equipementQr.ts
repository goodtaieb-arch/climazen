/**
 * QR équipements ClimaZEN — étiquettes imprimables + scan terrain.
 * Payload stable : URL /app/scan-equip?eq=… (ou forme courte CZ-EQ|…).
 */

import type { AppData, Client, Equipement, Site } from './types'
import { clientDisplayName } from './types'
import { allEquipements, equipmentLabel } from './cerfaBatch'

export type EquipQrHit = {
  site: Site
  equip: Equipement
  client?: Client
}

/** URL à encoder dans le QR (fonctionne aussi hors app via navigateur). */
export function buildEquipQrPayload(
  equipId: string,
  origin: string = typeof window !== 'undefined' ? window.location.origin : 'https://climazen.fr',
): string {
  const base = (origin || 'https://climazen.fr').replace(/\/$/, '')
  return `${base}/app/scan-equip?eq=${encodeURIComponent(equipId)}`
}

/** Forme courte (fallback / anciens collants). */
export function buildEquipQrShort(equipId: string): string {
  return `CZ-EQ|${equipId}`
}

/** Extrait l’id équipement depuis un scan QR / URL / texte. */
export function parseEquipQrPayload(raw: string): string | null {
  const value = (raw || '').trim()
  if (!value) return null

  // URL …/scan-equip?eq=…
  try {
    if (/^https?:\/\//i.test(value) || value.startsWith('/')) {
      const url = value.startsWith('http')
        ? new URL(value)
        : new URL(value, 'https://climazen.fr')
      const eq = url.searchParams.get('eq') || url.searchParams.get('equipement')
      if (eq?.trim()) return eq.trim()
      const path = url.pathname
      const m = path.match(/\/(?:scan-equip|e|equip)\/([^/?#]+)/i)
      if (m?.[1]) return decodeURIComponent(m[1])
    }
  } catch {
    /* ignore */
  }

  // CZ-EQ|uuid  /  CZ-EQ:uuid  /  climazen:eq:uuid
  const short = value.match(
    /(?:^|\b)(?:CZ-EQ[|:]|climazen:eq:|climazen:\/\/eq\/)([A-Za-z0-9\-_]{8,})/i,
  )
  if (short?.[1]) return short[1].trim()

  // UUID seul (scan collant minimal)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    return value
  }

  return null
}

export function findEquipementById(data: AppData, equipId: string): EquipQrHit | null {
  const id = (equipId || '').trim()
  if (!id) return null
  for (const site of data.chantiers || []) {
    const equip = allEquipements(site).find((e) => e.id === id)
    if (equip) {
      const client = data.clients.find((c) => c.id === site.clientId)
      return { site, equip, client }
    }
  }
  return null
}

export function equipLabelForQr(equip: Equipement): string {
  return (equip.nom || '').trim() || equipmentLabel(equip) || 'Équipement'
}

export function equipQrPrintLines(hit: EquipQrHit): {
  title: string
  lines: string[]
} {
  const { site, equip, client } = hit
  const title = equipLabelForQr(equip)
  const lines = [
    client ? clientDisplayName(client) : '',
    site.nom,
    [site.codePostal, site.ville].filter(Boolean).join(' '),
    equip.numeroSerie ? `SN ${equip.numeroSerie}` : '',
    equip.fluideType || '',
  ].filter(Boolean)
  return { title, lines }
}
