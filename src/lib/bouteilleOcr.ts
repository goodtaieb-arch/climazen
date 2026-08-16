import { createWorker } from 'tesseract.js'
import { adrInfoForFluide, findFluide, FLUIDES, normalizeFluideCode } from './fluides'

/** Champs extraits d’une étiquette / d’un QR bouteille. */
export type BouteilleScanFields = {
  numeroContenant?: string
  fluide?: string
  codeUn?: string
  denominationAdr?: string
  capaciteMaxKg?: number
  tareKg?: number
  pressionEpreuveBar?: number
  dateReepreuvage?: string
  quantiteKg?: number
  bsffReference?: string
  rawText?: string
  source?: 'ocr' | 'barcode' | 'qr'
}

function normalizeOcr(text: string) {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/[|]/g, 'I')
    .replace(/\r/g, '\n')
}

function findFluideInText(text: string): string | undefined {
  const compact = text.replace(/\s+/g, ' ')
  const re = /\bR[\s\-]?(\d{2,4}[A-Za-z]{0,3})\b/gi
  let best: string | undefined
  let m: RegExpExecArray | null
  while ((m = re.exec(compact))) {
    const code = normalizeFluideCode(`R-${m[1]}`)
    const hit = findFluide(code) || FLUIDES.find((f) => normalizeFluideCode(f.code) === code)
    if (hit) return hit.code
    if (!best) best = `R-${m[1].toUpperCase()}`
  }
  return best
}

function findUnCode(text: string): string | undefined {
  const patterns = [
    /\bUN[\s\-]?(\d{3,4})\b/i,
    /\bN[°ºo]?\s*ONU[\s\-]?(\d{3,4})\b/i,
    /\bONU[\s\-]?(\d{3,4})\b/i,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]) return m[1]
  }
  return undefined
}

function parseKgNear(text: string, labels: RegExp): number | undefined {
  const re = new RegExp(
    `${labels.source}[^\\d]{0,24}(\\d+[.,]\\d+|\\d+)\\s*(?:kg|kgs)?`,
    'i',
  )
  const m = text.match(re)
  if (!m?.[1]) return undefined
  const n = Number(String(m[1]).replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0 || n >= 500) return undefined
  return Math.round(n * 1000) / 1000
}

function findCapaciteKg(text: string): number | undefined {
  return (
    parseKgNear(text, /(?:capacit[eé]\s*(?:max(?:imale)?)?|cap\.?\s*max|water\s*capacity|volume|contenu\s*max)/i) ||
    parseKgNear(text, /(?:net\s*content|charge\s*max|fill(?:ing)?\s*mass)/i)
  )
}

function findTareKg(text: string): number | undefined {
  return parseKgNear(text, /(?:tare|masse\s*(?:à\s*)?vide|empty\s*weight|poids\s*vide)/i)
}

function findPressionBar(text: string): number | undefined {
  const patterns = [
    /(?:ph|p\.?\s*h\.?|pression\s*(?:d[’']?)?épreuve|test\s*pressure|working\s*pressure)[^\d]{0,20}(\d+[.,]?\d*)\s*(?:bar|b)?/i,
    /\b(\d{2,3})\s*bar\b/i,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (!m?.[1]) continue
    const n = Number(String(m[1]).replace(',', '.'))
    if (Number.isFinite(n) && n >= 10 && n <= 300) return Math.round(n)
  }
  return undefined
}

function findDateReepreuve(text: string): string | undefined {
  const patterns = [
    /(?:r[eé][eé]?preuve|re[\s\-]?test|next\s*test|date\s*(?:de\s*)?(?:contr[oô]le|test)|p[eé]riodique)[^\d]{0,20}(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})/i,
    /(?:r[eé][eé]?preuve|re[\s\-]?test)[^\d]{0,20}(\d{2})[./\-](\d{4})/i,
    /\b(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})\b/,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (!m) continue
    if (m[3]) {
      let y = Number(m[3])
      if (y < 100) y += 2000
      const d = Number(m[1])
      const mo = Number(m[2])
      if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y >= 2000 && y <= 2100) {
        return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      }
    } else if (m[2] && !m[3]) {
      // MM/YYYY
      const mo = Number(m[1])
      let y = Number(m[2])
      if (y < 100) y += 2000
      if (mo >= 1 && mo <= 12 && y >= 2000 && y <= 2100) {
        return `${y}-${String(mo).padStart(2, '0')}-01`
      }
    }
  }
  return undefined
}

function findBottleSerial(text: string): string | undefined {
  const bot = text.match(/\b(BOT[\-_]?[A-Z0-9\-]{3,})\b/i)
  if (bot?.[1]) return bot[1].toUpperCase()

  const patterns = [
    /(?:n[°ºo]?\.?\s*(?:de\s*)?(?:s[eé]rie|contenant|bouteille)|serial\s*(?:n[°ºo]?|no\.?|number)|s\/n|sn|cylinder\s*(?:id|no))[\s:.\-]*([A-Z0-9][A-Z0-9\-\/]{3,})/i,
    /\b(?:CYL|BT|FG)[\-_]?([A-Z0-9\-]{4,})\b/i,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (!m?.[1]) continue
    const raw = m[1].trim()
    if (/^R[\-]?\d/i.test(raw)) continue
    if (/^UN\d/i.test(raw)) continue
    return raw
  }
  return undefined
}

function findBsff(text: string): string | undefined {
  const m = text.match(/\b(?:BSFF|BSD|trackd[eé]chets?)[\s:.\-]*([A-Z0-9\-]{5,})\b/i)
  return m?.[1]?.trim()
}

function enrichFromFluide(fields: BouteilleScanFields): BouteilleScanFields {
  if (!fields.fluide) return fields
  const adr = adrInfoForFluide(fields.fluide)
  if (!adr) return fields
  return {
    ...fields,
    codeUn: fields.codeUn || adr.codeUn,
    denominationAdr: fields.denominationAdr || adr.denominationAdr,
  }
}

/** Parse texte OCR / QR libre → champs stock bouteille. */
export function parseBouteilleLabelText(raw: string): BouteilleScanFields {
  const text = normalizeOcr(raw)
  const fluide = findFluideInText(text)
  const fields: BouteilleScanFields = {
    fluide,
    numeroContenant: findBottleSerial(text),
    codeUn: findUnCode(text),
    capaciteMaxKg: findCapaciteKg(text),
    tareKg: findTareKg(text),
    pressionEpreuveBar: findPressionBar(text),
    dateReepreuvage: findDateReepreuve(text),
    bsffReference: findBsff(text),
    rawText: text,
    source: 'ocr',
  }
  return enrichFromFluide(fields)
}

/**
 * Interprète un code-barres / QR scanné.
 * - JSON { fluide, numero, ... }
 * - GS1 (AI 21 = serial, 10 = lot)
 * - Texte libre / clé=valeur
 * - Sinon : numéro de contenant brut
 */
export function parseBarcodePayload(raw: string): BouteilleScanFields {
  const value = (raw || '').trim()
  if (!value) return { source: 'barcode' }

  // JSON QR
  if (value.startsWith('{') && value.endsWith('}')) {
    try {
      const j = JSON.parse(value) as Record<string, unknown>
      const fluideRaw = String(j.fluide || j.refrigerant || j.gas || '').trim()
      const fluide = fluideRaw ? normalizeFluideCode(fluideRaw) || fluideRaw : undefined
      return enrichFromFluide({
        numeroContenant: String(
          j.numeroContenant || j.serial || j.numero || j.id || j.sn || '',
        ).trim() || undefined,
        fluide: fluide || undefined,
        codeUn: String(j.codeUn || j.un || j.onu || '').replace(/\D/g, '') || undefined,
        capaciteMaxKg: Number(j.capaciteMaxKg || j.capacite || j.capacity) || undefined,
        tareKg: Number(j.tareKg || j.tare) || undefined,
        pressionEpreuveBar: Number(j.pressionEpreuveBar || j.ph || j.pression) || undefined,
        dateReepreuvage: String(j.dateReepreuvage || j.retest || '').trim() || undefined,
        quantiteKg: Number(j.quantiteKg || j.quantite || j.net) || undefined,
        bsffReference: String(j.bsff || j.bsffReference || '').trim() || undefined,
        rawText: value,
        source: 'qr',
      })
    } catch {
      /* fall through */
    }
  }

  // key=value / key:value séparés
  if (/[=:]/.test(value) && /(?:fluide|R-|serial|numero|un)/i.test(value)) {
    const fromKv = parseBouteilleLabelText(value.replace(/[;&|]/g, '\n'))
    if (bouteilleScanHasData(fromKv)) {
      return { ...fromKv, source: 'qr', rawText: value }
    }
  }

  // GS1 : (21) serial, (10) batch — forms with or without parentheses
  const gs1Serial =
    value.match(/\(21\)([^\(\)]{4,})/)?.[1] ||
    value.match(/(?:^|\D)21([A-Z0-9\-]{4,30})(?:\D|$)/i)?.[1]
  const gs1Batch =
    value.match(/\(10\)([^\(\)]{2,})/)?.[1] ||
    value.match(/(?:^|\D)10([A-Z0-9\-]{2,20})(?:\D|$)/i)?.[1]

  const embedded = parseBouteilleLabelText(value)
  if (gs1Serial || bouteilleScanHasData(embedded)) {
    return enrichFromFluide({
      ...embedded,
      numeroContenant:
        gs1Serial?.trim() ||
        embedded.numeroContenant ||
        (!embedded.fluide ? value : undefined),
      rawText: value,
      source: value.includes('http') ? 'qr' : 'barcode',
      bsffReference:
        embedded.bsffReference ||
        (gs1Batch && /BSFF|BSD/i.test(value) ? gs1Batch : undefined),
    })
  }

  // URL QR → last path segment as serial if plausible
  if (/^https?:\/\//i.test(value)) {
    try {
      const u = new URL(value)
      const last = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '')
      const qSerial = u.searchParams.get('serial') || u.searchParams.get('sn') || u.searchParams.get('id')
      const fluideQ = u.searchParams.get('fluide') || u.searchParams.get('gas')
      return enrichFromFluide({
        numeroContenant: (qSerial || last || '').trim() || value,
        fluide: fluideQ ? normalizeFluideCode(fluideQ) || fluideQ : findFluideInText(value),
        rawText: value,
        source: 'qr',
      })
    } catch {
      /* fall through */
    }
  }

  // Contient un fluide dans le code → parse label, sinon numéro brut
  if (findFluideInText(value) || findUnCode(value)) {
    return { ...parseBouteilleLabelText(value), source: 'barcode', rawText: value }
  }

  return {
    numeroContenant: value.slice(0, 80),
    rawText: value,
    source: 'barcode',
  }
}

export function bouteilleScanHasData(f: BouteilleScanFields): boolean {
  return Boolean(
    f.numeroContenant ||
      f.fluide ||
      f.codeUn ||
      f.capaciteMaxKg ||
      f.tareKg ||
      f.pressionEpreuveBar ||
      f.dateReepreuvage ||
      f.quantiteKg ||
      f.bsffReference,
  )
}

/** OCR photo étiquette bouteille. */
export async function readBouteilleFromImage(
  file: Blob,
  onProgress?: (p: number) => void,
): Promise<BouteilleScanFields> {
  const worker = await createWorker('eng+fra', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') {
        onProgress?.(Math.round(m.progress * 100))
      }
    },
  })
  try {
    const {
      data: { text },
    } = await worker.recognize(file)
    return parseBouteilleLabelText(text || '')
  } finally {
    await worker.terminate()
  }
}

/**
 * Fusionne les champs scannés dans le formulaire stock.
 * Ne remplace pas une valeur déjà saisie sauf si `force`.
 */
export function mergeBouteilleScanIntoForm<
  T extends {
    fluide: string
    numeroContenant: string
    codeUn?: string
    denominationAdr?: string
    capaciteMaxKg?: number
    tareKg?: number
    pressionEpreuveBar?: number
    dateReepreuvage?: string
    quantiteKg?: number
    bsffReference?: string
    conformeA2LA3?: boolean
  },
>(
  form: T,
  scan: BouteilleScanFields,
  opts?: { force?: boolean },
): T {
  const force = opts?.force === true
  const empty = (v: unknown) =>
    v == null || v === '' || (typeof v === 'number' && (!Number.isFinite(v) || v === 0))

  let next: T = { ...form }

  if (scan.numeroContenant && (force || empty(form.numeroContenant))) {
    next = { ...next, numeroContenant: scan.numeroContenant }
  }

  // Fluide : remplir si vide, ou si encore le défaut R-32 sans n° déjà saisi
  if (
    scan.fluide &&
    (force ||
      !form.fluide.trim() ||
      (form.fluide === 'R-32' && !String(form.numeroContenant || '').trim()))
  ) {
    next = { ...next, fluide: scan.fluide }
  }

  if (scan.codeUn && (force || empty(form.codeUn))) {
    next = { ...next, codeUn: scan.codeUn }
  }
  if (scan.denominationAdr && (force || empty(form.denominationAdr))) {
    next = { ...next, denominationAdr: scan.denominationAdr }
  }
  if (scan.capaciteMaxKg && (force || empty(form.capaciteMaxKg))) {
    next = { ...next, capaciteMaxKg: scan.capaciteMaxKg }
  }
  if (scan.tareKg && (force || empty(form.tareKg))) {
    next = { ...next, tareKg: scan.tareKg }
  }
  if (scan.pressionEpreuveBar && (force || empty(form.pressionEpreuveBar))) {
    next = { ...next, pressionEpreuveBar: scan.pressionEpreuveBar }
  }
  if (scan.dateReepreuvage && (force || empty(form.dateReepreuvage))) {
    next = { ...next, dateReepreuvage: scan.dateReepreuvage }
  }
  if (scan.quantiteKg != null && scan.quantiteKg > 0 && (force || empty(form.quantiteKg))) {
    next = { ...next, quantiteKg: scan.quantiteKg }
  }
  if (scan.bsffReference && (force || empty(form.bsffReference))) {
    next = { ...next, bsffReference: scan.bsffReference }
  }

  // Compléter ADR depuis fluide si manquant
  if (next.fluide) {
    const adr = adrInfoForFluide(next.fluide)
    if (adr) {
      if (empty(next.codeUn)) next = { ...next, codeUn: adr.codeUn }
      if (empty(next.denominationAdr)) next = { ...next, denominationAdr: adr.denominationAdr }
    }
  }

  return next
}

export function summarizeBouteilleScan(f: BouteilleScanFields): string {
  const bits: string[] = []
  if (f.numeroContenant) bits.push(`N° ${f.numeroContenant}`)
  if (f.fluide) bits.push(f.fluide)
  if (f.codeUn) bits.push(`UN${f.codeUn}`)
  if (f.capaciteMaxKg) bits.push(`${f.capaciteMaxKg} kg cap.`)
  if (f.tareKg) bits.push(`tare ${f.tareKg} kg`)
  if (f.dateReepreuvage) bits.push(`réép. ${f.dateReepreuvage}`)
  return bits.length ? bits.join(' · ') : 'Aucune donnée lisible'
}
