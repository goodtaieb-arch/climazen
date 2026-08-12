/** Adresse pour GPS (Waze, Google Maps, Apple Plans…). */

export type AddressParts = {
  adresse?: string
  codePostal?: string
  ville?: string
}

export function formatAddressQuery(parts: AddressParts): string {
  return [parts.adresse, parts.codePostal, parts.ville].filter(Boolean).join(' ').trim()
}

/**
 * Ouvre l’adresse dans une app GPS.
 * Android : chooser (Waze, Google Maps…).
 * iOS : Apple Plans (partage possible vers Waze).
 * Desktop : Google Maps web.
 */
export function openAddressInGps(parts: AddressParts | string): boolean {
  const q = (typeof parts === 'string' ? parts : formatAddressQuery(parts)).trim()
  if (!q) return false
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  if (/Android/i.test(ua)) {
    window.location.href = `geo:0,0?q=${encodeURIComponent(q)}`
    return true
  }
  if (/iPhone|iPad|iPod/i.test(ua)) {
    window.open(`https://maps.apple.com/?q=${encodeURIComponent(q)}`, '_blank', 'noopener,noreferrer')
    return true
  }
  window.open(
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`,
    '_blank',
    'noopener,noreferrer',
  )
  return true
}
