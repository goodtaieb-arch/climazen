/**
 * QR du bâtiment ClimaZEN — sticker local technique / accueil.
 * Payload : URL /app/scan-equip?site=… (ou forme courte CZ-SITE|…).
 * Distinct du QR équipement (CZ-EQ) : le scan ouvre le parc du site, pas une machine.
 */

import type { AppData, Client, Site } from './types'
import { clientDisplayName } from './types'
import { allEquipements } from './cerfaBatch'

export type SiteQrHit = {
  site: Site
  client?: Client
}

/** URL à encoder dans le QR (fonctionne aussi hors app via navigateur). */
export function buildSiteQrPayload(
  siteId: string,
  origin: string = typeof window !== 'undefined' ? window.location.origin : 'https://climazen.fr',
): string {
  const base = (origin || 'https://climazen.fr').replace(/\/$/, '')
  return `${base}/app/scan-equip?site=${encodeURIComponent(siteId)}`
}

/** Forme courte (fallback / anciens collants). */
export function buildSiteQrShort(siteId: string): string {
  return `CZ-SITE|${siteId}`
}

/**
 * Extrait l’id site depuis un scan QR / URL / texte.
 * Ne consomme pas un QR équipement (eq= / CZ-EQ) — même UUID possible ailleurs.
 */
export function parseSiteQrPayload(raw: string): string | null {
  const value = (raw || '').trim()
  if (!value) return null

  try {
    if (/^https?:\/\//i.test(value) || value.startsWith('/')) {
      const url = value.startsWith('http')
        ? new URL(value)
        : new URL(value, 'https://climazen.fr')
      // Équipement prioritaire si les deux params sont présents
      const eq = url.searchParams.get('eq') || url.searchParams.get('equipement')
      if (eq?.trim()) return null
      const site = url.searchParams.get('site') || url.searchParams.get('chantier')
      if (site?.trim()) return site.trim()
      const path = url.pathname
      const m = path.match(/\/(?:scan-site|site|chantier)\/([^/?#]+)/i)
      if (m?.[1]) return decodeURIComponent(m[1])
    }
  } catch {
    /* ignore */
  }

  // CZ-SITE|uuid  /  CZ-CH|uuid  /  climazen:site:uuid
  const short = value.match(
    /(?:^|\b)(?:CZ-SITE[|:]|CZ-CH[|:]|climazen:site:|climazen:\/\/site\/)([A-Za-z0-9\-_]{8,})/i,
  )
  if (short?.[1]) return short[1].trim()

  return null
}

export function findSiteById(data: AppData, siteId: string): SiteQrHit | null {
  const id = (siteId || '').trim()
  if (!id) return null
  const site = (data.chantiers || []).find((c) => c.id === id)
  if (!site) return null
  const client = data.clients.find((c) => c.id === site.clientId)
  return { site, client }
}

export function siteQrPrintLines(hit: SiteQrHit): {
  title: string
  lines: string[]
} {
  const { site, client } = hit
  const title = (site.nom || '').trim() || 'Site'
  const lines = [
    client ? clientDisplayName(client) : '',
    [site.adresse, site.codePostal, site.ville].filter(Boolean).join(' '),
    'QR du bâtiment',
  ].filter(Boolean)
  return { title, lines }
}

export function siteEquipementCount(hit: SiteQrHit): number {
  return allEquipements(hit.site).length
}
