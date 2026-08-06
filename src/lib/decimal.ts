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
  return String(n).replace('.', ',')
}
