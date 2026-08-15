/** Saisie décimale FR : accepte virgule ou point. */

export function sanitizeDecimalTyping(raw: string): string {
  let seenSep = false
  let out = ''
  for (const ch of raw) {
    if (ch >= '0' && ch <= '9') {
      out += ch
      continue
    }
    if ((ch === ',' || ch === '.') && !seenSep) {
      seenSep = true
      out += ch
    }
  }
  return out
}

/** Parse "2,2" / "2.2" → number. Retourne null si incomplet / invalide. */
export function parseDecimalFr(raw: string): number | null {
  const t = String(raw).trim().replace(/\s/g, '').replace(',', '.')
  if (t === '' || t === '-' || t === '.') return null
  // "2," / "2." en cours de saisie → 2
  const normalized = t.endsWith('.') ? t.slice(0, -1) : t
  if (normalized === '' || normalized === '-') return null
  const withLeading =
    normalized.startsWith('.') ? `0${normalized}` : normalized
  if (!/^-?\d+(\.\d+)?$/.test(withLeading)) return null
  const n = Number(withLeading)
  return Number.isFinite(n) ? n : null
}

export function formatDecimalFr(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return ''
  return formatKg(n).replace('.', ',')
}

/** Arrondi kg stable (évite 2.2999999999999997). */
export function roundKg(n: number, decimals = 3): number {
  if (!Number.isFinite(n)) return 0
  const f = 10 ** decimals
  return Math.round((n + Number.EPSILON) * f) / f
}

/** Texte kg pour CERFA / affichage — pas de queue flottante. */
export function formatKg(n: number | null | undefined, decimals = 3): string {
  if (n == null || !Number.isFinite(n)) return ''
  const r = roundKg(n, decimals)
  if (Math.abs(r) < 1e-12) return '0'
  return parseFloat(r.toFixed(decimals)).toString()
}

/** Lettre bouteille générique : 0→A, 1→B, 2→C… */
export function bottleLetter(index: number): string {
  return String.fromCharCode(65 + (Math.max(0, index) % 26))
}

/**
 * Lettre CERFA [11] selon le sens :
 * - charge (sortie) → A, B, C…
 * - récupération (entrée) → D, E…
 */
export function bottleLetterCerfa(
  indexAmongSide: number,
  side: 'charge' | 'recup',
): string {
  const base = side === 'charge' ? 0 : 3
  return String.fromCharCode(65 + base + (Math.max(0, indexAmongSide) % 23))
}
