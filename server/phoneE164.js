/**
 * Normalisation numéros E.164 (France par défaut).
 */

export function normalizeInboundE164(raw, defaultCountry = 'FR') {
  let s = String(raw || '').trim().replace(/[\s().-]/g, '')
  if (!s) return ''

  if (s.startsWith('00')) s = `+${s.slice(2)}`
  if (!s.startsWith('+')) {
    if (defaultCountry === 'FR' && s.startsWith('0')) {
      s = `+33${s.slice(1)}`
    } else {
      s = `+${s}`
    }
  }

  if (!/^\+\d{8,15}$/.test(s)) return ''
  return s
}

/** Compare deux numéros après normalisation. */
export function phonesMatch(a, b) {
  const na = normalizeInboundE164(a)
  const nb = normalizeInboundE164(b)
  return Boolean(na && nb && na === nb)
}
