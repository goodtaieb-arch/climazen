import { createWorker } from 'tesseract.js'
import { FLUIDES, findFluide, normalizeFluideCode } from './fluides'

export type PlaqueFields = {
  equipementType?: string
  equipementMarque?: string
  equipementModele?: string
  equipementNumeroSerie?: string
  fluideType?: string
  chargeNominaleKg?: number
  rawText?: string
}

const MARQUES = [
  'Daikin',
  'Carrier',
  'Mitsubishi',
  'Toshiba',
  'Panasonic',
  'Samsung',
  'LG',
  'Fujitsu',
  'Hitachi',
  'York',
  'Trane',
  'Lennox',
  'Ciatesa',
  'Airwell',
  'Atlantic',
  'Saunier Duval',
  'Vaillant',
  'Viessmann',
  'Bosch',
  'Climaveneta',
  'Aermec',
  'Gree',
  'Midea',
  'Haier',
  'Hisense',
  'Zanotti',
  'Bitzer',
  'Copeland',
  'Emerson',
  'Danfoss',
  'Frascold',
  'Tecumseh',
  'Carell',
  'Carel',
]

function normalizeOcr(text: string) {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/[|]/g, 'I')
    .replace(/\r/g, '\n')
}

function findMarque(text: string): string | undefined {
  const upper = text.toUpperCase()
  for (const m of MARQUES) {
    if (upper.includes(m.toUpperCase())) return m
  }
  return undefined
}

function findFluideInText(text: string): string | undefined {
  const compact = text.replace(/\s+/g, ' ')
  // R-410A, R410A, R 32, R-1234yf…
  const re = /\bR[\s\-]?(\d{2,4}[A-Za-z]?)\b/gi
  let best: string | undefined
  let m: RegExpExecArray | null
  while ((m = re.exec(compact))) {
    const code = normalizeFluideCode(`R-${m[1]}`)
    const hit = findFluide(code) || FLUIDES.find((f) => normalizeFluideCode(f.code) === code)
    if (hit) {
      best = hit.code
      break
    }
    // keep first plausible even if not in catalogue
    if (!best) best = `R-${m[1].toUpperCase()}`
  }
  return best
}

function findChargeKg(text: string): number | undefined {
  const patterns = [
    /(?:charge|refrigerant\s*charge|qte|quantit[eé]|fill|filling)[^\d]{0,20}(\d+[.,]\d+|\d+)\s*(?:kg|kgs)?/i,
    /(\d+[.,]\d+|\d+)\s*kg(?:s)?\b/i,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (!m?.[1]) continue
    const n = Number(String(m[1]).replace(',', '.'))
    if (Number.isFinite(n) && n > 0 && n < 500) return Math.round(n * 1000) / 1000
  }
  return undefined
}

function findSerial(text: string): string | undefined {
  const patterns = [
    /(?:n[°ºo]?\.?\s*s[eé]rie|serial\s*(?:n[°ºo]?|no\.?|number)|s\/n|sn)[\s:.\-]*([A-Z0-9][A-Z0-9\-\/]{4,})/i,
    /\bSN[\s:.\-]*([A-Z0-9][A-Z0-9\-\/]{4,})/i,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]) return m[1].trim()
  }
  return undefined
}

function findModele(text: string, marque?: string): string | undefined {
  const patterns = [
    /(?:mod[eè]le|model|type)[\s:.\-]*([A-Z0-9][A-Z0-9\-\/]{2,})/i,
    /\b([A-Z]{1,4}\d{2,}[A-Z0-9\-]{0,12})\b/,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (!m?.[1]) continue
    const v = m[1].trim()
    if (marque && v.toUpperCase() === marque.toUpperCase()) continue
    if (/^R[\-]?\d/i.test(v)) continue
    return v
  }
  return undefined
}

function findEquipementType(text: string): string | undefined {
  const lower = text.toLowerCase()
  const map: [RegExp, string][] = [
    [/pompe\s*à\s*chaleur|heat\s*pump|\bpac\b/, 'Pompe à chaleur'],
    [/climatisation|air\s*conditioner|\bsplit\b/, 'Climatisation'],
    [/groupe\s*froid|condensing\s*unit/, 'Groupe froid'],
    [/chambre\s*froide/, 'Chambre froide'],
    [/vrf|vrv/, 'VRF / VRV'],
    [/cta|centrale\s*de\s*traitement/, 'CTA'],
  ]
  for (const [re, label] of map) {
    if (re.test(lower)) return label
  }
  return undefined
}

/** Parse le texte OCR d’une plaque signalétique. */
export function parsePlaqueText(raw: string): PlaqueFields {
  const text = normalizeOcr(raw)
  const marque = findMarque(text)
  return {
    equipementType: findEquipementType(text),
    equipementMarque: marque,
    equipementModele: findModele(text, marque),
    equipementNumeroSerie: findSerial(text),
    fluideType: findFluideInText(text),
    chargeNominaleKg: findChargeKg(text),
    rawText: text,
  }
}

/** OCR plaque → champs équipement / fluide. */
export async function readPlaqueFromImage(
  file: Blob,
  onProgress?: (p: number) => void,
): Promise<PlaqueFields> {
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
    return parsePlaqueText(text || '')
  } finally {
    await worker.terminate()
  }
}

export function plaqueHasAnyField(p: PlaqueFields) {
  return Boolean(
    p.equipementType ||
      p.equipementMarque ||
      p.equipementModele ||
      p.equipementNumeroSerie ||
      p.fluideType ||
      (p.chargeNominaleKg != null && p.chargeNominaleKg > 0),
  )
}
