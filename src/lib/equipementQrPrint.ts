import QRCode from 'qrcode'
import type { EquipQrHit } from '../lib/equipementQr'
import { buildEquipQrPayload, equipQrPrintLines } from '../lib/equipementQr'
import { buildSiteQrPayload, siteQrPrintLines, type SiteQrHit } from '../lib/siteQr'

const LS_FORMAT_KEY = 'climazen.qrPrintFormat'

export async function qrDataUrl(payload: string, size = 280): Promise<string> {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: size,
    color: { dark: '#071820', light: '#ffffff' },
  })
}

/** Carte d’étiquette QR (équipement ou bâtiment) — aperçu + impression. */
export type QrPrintCard = {
  id: string
  /** Texte encodé dans le QR (URL scan). */
  payload: string
  imgDataUrl: string
  title: string
  lines: string[]
}

export type EquipQrCard = QrPrintCard & {
  hit: EquipQrHit
}

/** Prépare les cartes QR (image + contenu écrit) pour aperçu ou impression. */
export async function buildEquipQrCards(
  hits: EquipQrHit[],
  opts?: { origin?: string },
): Promise<EquipQrCard[]> {
  const origin =
    opts?.origin ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://climazen.fr')
  const cards: EquipQrCard[] = []
  for (const hit of hits) {
    const payload = buildEquipQrPayload(hit.equip.id, origin)
    const imgDataUrl = await qrDataUrl(payload, 320)
    const { title, lines } = equipQrPrintLines(hit)
    cards.push({ id: hit.equip.id, hit, payload, imgDataUrl, title, lines })
  }
  return cards
}

/** Une étiquette « QR du bâtiment » (local technique / accueil). */
export async function buildSiteQrCards(
  hits: SiteQrHit[],
  opts?: { origin?: string },
): Promise<QrPrintCard[]> {
  const origin =
    opts?.origin ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://climazen.fr')
  const cards: QrPrintCard[] = []
  for (const hit of hits) {
    const payload = buildSiteQrPayload(hit.site.id, origin)
    const imgDataUrl = await qrDataUrl(payload, 320)
    const { title, lines } = siteQrPrintLines(hit)
    cards.push({ id: `site:${hit.site.id}`, payload, imgDataUrl, title, lines })
  }
  return cards
}

export type QrPrintLayout = 'sheet' | 'label'

export type QrPrintFormat = {
  id: string
  /** Libellé affiché */
  label: string
  /** Groupe UI */
  group: 'Feuille' | 'Brother' | 'Dymo' | 'Zebra / thermique' | 'Générique'
  layout: QrPrintLayout
  /** Largeur page mm (étiquette) */
  widthMm?: number
  /** Hauteur page mm (étiquette) */
  heightMm?: number
  /** Colonnes (feuille) */
  cols?: number
  /** Afficher l’URL sous le QR (utile A4) */
  showPayload?: boolean
  /** Taille QR mm */
  qrMm?: number
}

/** Formats couvrant les imprimantes les plus courantes. */
export const QR_PRINT_FORMATS: QrPrintFormat[] = [
  {
    id: 'a4-2',
    label: 'Feuille A4 — 2 colonnes (laser / inkjet)',
    group: 'Feuille',
    layout: 'sheet',
    cols: 2,
    showPayload: true,
    qrMm: 35,
  },
  {
    id: 'a4-1',
    label: 'Feuille A4 — 1 grande étiquette / page',
    group: 'Feuille',
    layout: 'sheet',
    cols: 1,
    showPayload: true,
    qrMm: 55,
  },
  {
    id: 'brother-62x100',
    label: 'Brother QL — rouleau 62 mm (DK-22205…)',
    group: 'Brother',
    layout: 'label',
    widthMm: 62,
    heightMm: 100,
    qrMm: 42,
  },
  {
    id: 'brother-62x29',
    label: 'Brother QL — 62 × 29 mm (adresse)',
    group: 'Brother',
    layout: 'label',
    widthMm: 62,
    heightMm: 29,
    qrMm: 18,
  },
  {
    id: 'brother-29x90',
    label: 'Brother QL — 29 × 90 mm (étroit)',
    group: 'Brother',
    layout: 'label',
    widthMm: 29,
    heightMm: 90,
    qrMm: 20,
  },
  {
    id: 'brother-38x90',
    label: 'Brother QL — 38 × 90 mm',
    group: 'Brother',
    layout: 'label',
    widthMm: 38,
    heightMm: 90,
    qrMm: 26,
  },
  {
    id: 'dymo-89x36',
    label: 'Dymo LabelWriter — 89 × 36 mm (99012)',
    group: 'Dymo',
    layout: 'label',
    widthMm: 89,
    heightMm: 36,
    qrMm: 24,
  },
  {
    id: 'dymo-54x101',
    label: 'Dymo LabelWriter — 54 × 101 mm (99014)',
    group: 'Dymo',
    layout: 'label',
    widthMm: 54,
    heightMm: 101,
    qrMm: 38,
  },
  {
    id: 'dymo-57x32',
    label: 'Dymo LabelWriter — 57 × 32 mm',
    group: 'Dymo',
    layout: 'label',
    widthMm: 57,
    heightMm: 32,
    qrMm: 20,
  },
  {
    id: 'zebra-50x30',
    label: 'Zebra / thermique — 50 × 30 mm',
    group: 'Zebra / thermique',
    layout: 'label',
    widthMm: 50,
    heightMm: 30,
    qrMm: 18,
  },
  {
    id: 'zebra-100x50',
    label: 'Zebra / thermique — 100 × 50 mm',
    group: 'Zebra / thermique',
    layout: 'label',
    widthMm: 100,
    heightMm: 50,
    qrMm: 32,
  },
  {
    id: 'zebra-58x40',
    label: 'Zebra / ticket 58 mm — 58 × 40 mm',
    group: 'Zebra / thermique',
    layout: 'label',
    widthMm: 58,
    heightMm: 40,
    qrMm: 24,
  },
  {
    id: 'gen-50x50',
    label: 'Carré 50 × 50 mm (sticker QR)',
    group: 'Générique',
    layout: 'label',
    widthMm: 50,
    heightMm: 50,
    qrMm: 28,
  },
  {
    id: 'gen-60x40',
    label: 'Générique 60 × 40 mm',
    group: 'Générique',
    layout: 'label',
    widthMm: 60,
    heightMm: 40,
    qrMm: 24,
  },
  {
    id: 'gen-70x50',
    label: 'Générique 70 × 50 mm (extérieur)',
    group: 'Générique',
    layout: 'label',
    widthMm: 70,
    heightMm: 50,
    qrMm: 30,
  },
]

export function getQrPrintFormat(id: string): QrPrintFormat {
  return QR_PRINT_FORMATS.find((f) => f.id === id) || QR_PRINT_FORMATS[0]
}

/** Alias anciens ids → nouveaux. */
function normalizeFormatId(raw?: string): string {
  if (!raw) return 'a4-2'
  if (raw === 'a4') return 'a4-2'
  if (raw === 'rouleau') return 'brother-62x100'
  if (QR_PRINT_FORMATS.some((f) => f.id === raw)) return raw
  return 'a4-2'
}

export function loadSavedQrPrintFormatId(): string {
  try {
    return normalizeFormatId(localStorage.getItem(LS_FORMAT_KEY) || undefined)
  } catch {
    return 'a4-2'
  }
}

export function saveQrPrintFormatId(id: string): void {
  try {
    localStorage.setItem(LS_FORMAT_KEY, normalizeFormatId(id))
  } catch {
    /* ignore */
  }
}

/**
 * Impression sans pop-up (iframe cachée) — évite le blocage navigateur.
 */
function printHtmlViaIframe(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('title', 'Impression étiquettes QR ClimaZEN')
    iframe.setAttribute('aria-hidden', 'true')
    Object.assign(iframe.style, {
      position: 'fixed',
      right: '0',
      bottom: '0',
      width: '0',
      height: '0',
      border: '0',
      opacity: '0',
      pointerEvents: 'none',
    })
    document.body.appendChild(iframe)

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    let cleaned = false

    const cleanup = () => {
      if (cleaned) return
      cleaned = true
      try {
        URL.revokeObjectURL(url)
      } catch {
        /* ignore */
      }
      try {
        iframe.remove()
      } catch {
        /* ignore */
      }
    }

    const fail = (msg: string) => {
      cleanup()
      reject(new Error(msg))
    }

    iframe.onload = () => {
      const win = iframe.contentWindow
      if (!win) {
        fail('Impossible d’ouvrir l’aperçu d’impression.')
        return
      }

      const doc = win.document
      const waitImages = Promise.all(
        Array.from(doc.images).map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((res) => {
                img.onload = () => res()
                img.onerror = () => res()
              }),
        ),
      )

      void waitImages
        .then(
          () =>
            new Promise<void>((res) => {
              window.setTimeout(() => res(), 150)
            }),
        )
        .then(() => {
          const onAfter = () => {
            win.removeEventListener('afterprint', onAfter)
            cleanup()
            resolve()
          }
          win.addEventListener('afterprint', onAfter)
          window.setTimeout(() => {
            cleanup()
            resolve()
          }, 60_000)

          try {
            win.focus()
            win.print()
          } catch {
            fail('Impression impossible sur cet appareil.')
          }
        })
        .catch(() => fail('Impression impossible sur cet appareil.'))
    }

    iframe.onerror = () => fail('Impression impossible sur cet appareil.')
    iframe.src = url
  })
}

function cardHtml(
  c: QrPrintCard,
  company: string,
  fmt: QrPrintFormat,
): string {
  const qrPx = Math.round(((fmt.qrMm || 35) / 25.4) * 96)
  const compact = (fmt.heightMm || 100) < 40
  return `
    <article class="label">
      <div class="brand">${escapeHtml(company)}</div>
      <img src="${c.imgDataUrl}" alt="QR" width="${qrPx}" height="${qrPx}" />
      <h1>${escapeHtml(c.title)}</h1>
      ${
        compact
          ? `<p class="meta">${escapeHtml(c.lines.slice(0, 2).join(' · '))}</p>`
          : `<p class="meta">${c.lines.map(escapeHtml).join('<br/>')}</p>`
      }
      ${fmt.showPayload ? `<p class="payload">${escapeHtml(c.payload)}</p>` : ''}
      ${compact ? '' : `<p class="hint">Scanner avec ClimaZEN</p>`}
    </article>
  `
}

function buildSheetHtml(cards: string[], fmt: QrPrintFormat): string {
  const cols = fmt.cols === 1 ? 1 : 2
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Étiquettes QR — ClimaZEN</title>
  <style>
    @page { margin: 10mm; size: A4; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", system-ui, sans-serif;
      color: #071820;
      background: #fff;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(${cols}, 1fr);
      gap: 10mm;
      padding: 10mm;
    }
    .label {
      border: 1px solid #c5d9dc;
      border-radius: 8px;
      padding: 10px 12px 12px;
      text-align: center;
      break-inside: avoid;
      page-break-inside: avoid;
      min-height: ${cols === 1 ? '120mm' : '72mm'};
    }
    .brand {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #1aa896;
      margin-bottom: 6px;
    }
    img { display: block; margin: 0 auto 8px; }
    h1 { font-size: ${cols === 1 ? 18 : 14}px; margin: 0 0 4px; line-height: 1.2; }
    .meta { font-size: 11px; color: #12303a; margin: 0; line-height: 1.35; }
    .payload {
      margin: 6px 0 0;
      font-size: 7px;
      line-height: 1.25;
      word-break: break-all;
      color: #5a7880;
    }
    .hint {
      margin: 8px 0 0;
      font-size: 9px;
      color: #5a7880;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <div class="grid">${cards.join('')}</div>
</body>
</html>`
}

function buildLabelHtml(cards: string[], fmt: QrPrintFormat): string {
  const w = fmt.widthMm || 62
  const h = fmt.heightMm || 100
  const margin = Math.min(2, Math.max(1, Math.round(w * 0.03)))
  const innerW = Math.max(10, w - margin * 2)
  const qrMm = Math.min(fmt.qrMm || 30, innerW - 2)
  const compact = h < 40
  const pages = cards
    .map(
      (card, i) =>
        `<section class="page${i < cards.length - 1 ? ' break' : ''}">${card}</section>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Étiquettes QR — ${escapeHtml(fmt.label)}</title>
  <style>
    @page {
      size: ${w}mm ${h}mm;
      margin: ${margin}mm;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: ${w}mm;
      font-family: "Segoe UI", system-ui, sans-serif;
      color: #071820;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      width: ${innerW}mm;
      min-height: ${Math.max(10, h - margin * 2)}mm;
      padding: 0;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .page.break {
      page-break-after: always;
      break-after: page;
    }
    .label {
      border: none;
      padding: 0;
      text-align: center;
      width: 100%;
    }
    .brand {
      font-size: ${compact ? 7 : 9}px;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #1aa896;
      margin-bottom: 2px;
    }
    img {
      display: block;
      margin: 0 auto ${compact ? 2 : 4}px;
      width: ${qrMm}mm;
      height: ${qrMm}mm;
    }
    h1 {
      font-size: ${compact ? 8 : 11}px;
      margin: 0 0 2px;
      line-height: 1.1;
    }
    .meta {
      font-size: ${compact ? 6.5 : 8.5}px;
      color: #12303a;
      margin: 0;
      line-height: 1.2;
    }
    .hint {
      margin: 4px 0 0;
      font-size: 7px;
      color: #5a7880;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-weight: 700;
    }
  </style>
</head>
<body>
  ${pages}
</body>
</html>`
}

export type QrPrintOpts = {
  origin?: string
  companyName?: string
  /** id format (ex. brother-62x100) ou alias a4 / rouleau */
  format?: string
}

/** Imprime des étiquettes QR déjà préparées (équipement ou bâtiment). */
export async function printQrPrintCards(
  prepared: QrPrintCard[],
  opts?: QrPrintOpts,
): Promise<void> {
  if (!prepared.length) return
  const company = opts?.companyName || 'ClimaZEN'
  const formatId = normalizeFormatId(opts?.format)
  const fmt = getQrPrintFormat(formatId)
  saveQrPrintFormatId(formatId)

  const cards = prepared.map((c) => cardHtml(c, company, fmt))
  const html =
    fmt.layout === 'sheet' ? buildSheetHtml(cards, fmt) : buildLabelHtml(cards, fmt)

  await printHtmlViaIframe(html)
}

/** Imprime des étiquettes équipements (QR) — sans fenêtre pop-up. */
export async function printEquipementLabels(
  hits: EquipQrHit[],
  opts?: QrPrintOpts,
): Promise<void> {
  if (!hits.length) return
  const prepared = await buildEquipQrCards(hits, { origin: opts?.origin })
  await printQrPrintCards(prepared, opts)
}

function escapeHtml(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
