import QRCode from 'qrcode'
import type { EquipQrHit } from '../lib/equipementQr'
import { buildEquipQrPayload, equipQrPrintLines } from '../lib/equipementQr'

export async function qrDataUrl(payload: string, size = 280): Promise<string> {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: size,
    color: { dark: '#071820', light: '#ffffff' },
  })
}

export type EquipQrCard = {
  hit: EquipQrHit
  /** Texte encodé dans le QR (URL scan). */
  payload: string
  imgDataUrl: string
  title: string
  lines: string[]
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
    cards.push({ hit, payload, imgDataUrl, title, lines })
  }
  return cards
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

/** Imprime des étiquettes équipements (QR) — sans fenêtre pop-up. */
export async function printEquipementLabels(
  hits: EquipQrHit[],
  opts?: {
    origin?: string
    companyName?: string
    /** a4 = grille feuille ; rouleau = 1 étiquette / page (imprimante rouleau) */
    format?: 'a4' | 'rouleau'
  },
): Promise<void> {
  if (!hits.length) return
  const company = opts?.companyName || 'ClimaZEN'
  const format = opts?.format || 'a4'
  const prepared = await buildEquipQrCards(hits, { origin: opts?.origin })

  const cards = prepared.map(
    (c) => `
      <article class="label">
        <div class="brand">${escapeHtml(company)}</div>
        <img src="${c.imgDataUrl}" alt="QR" width="${format === 'rouleau' ? 160 : 140}" height="${format === 'rouleau' ? 160 : 140}" />
        <h1>${escapeHtml(c.title)}</h1>
        <p class="meta">${c.lines.map(escapeHtml).join('<br/>')}</p>
        ${format === 'a4' ? `<p class="payload">${escapeHtml(c.payload)}</p>` : ''}
        <p class="hint">Scanner avec ClimaZEN</p>
      </article>
    `,
  )

  const html =
    format === 'rouleau'
      ? buildRouleauHtml(cards)
      : buildA4Html(cards)

  await printHtmlViaIframe(html)
}

function buildA4Html(cards: string[]): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Étiquettes QR équipements — ClimaZEN</title>
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
      grid-template-columns: repeat(2, 1fr);
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
      min-height: 72mm;
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
    h1 {
      font-size: 14px;
      margin: 0 0 4px;
      line-height: 1.2;
    }
    .meta {
      font-size: 11px;
      color: #12303a;
      margin: 0;
      line-height: 1.35;
    }
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

/** 1 QR = 1 page — format proche rouleau 62 mm (Brother QL / Dymo). */
function buildRouleauHtml(cards: string[]): string {
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
  <title>Étiquettes rouleau QR — ClimaZEN</title>
  <style>
    /* Largeur type rouleau 62 mm ; hauteur ≈ 1 étiquette */
    @page {
      size: 62mm 100mm;
      margin: 2mm;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 62mm;
      font-family: "Segoe UI", system-ui, sans-serif;
      color: #071820;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      width: 58mm;
      min-height: 90mm;
      padding: 2mm;
      margin: 0 auto;
    }
    .page.break {
      page-break-after: always;
      break-after: page;
    }
    .label {
      border: none;
      padding: 0;
      text-align: center;
    }
    .brand {
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #1aa896;
      margin-bottom: 4px;
    }
    img { display: block; margin: 0 auto 6px; width: 42mm; height: 42mm; }
    h1 {
      font-size: 12px;
      margin: 0 0 3px;
      line-height: 1.15;
    }
    .meta {
      font-size: 9px;
      color: #12303a;
      margin: 0;
      line-height: 1.3;
    }
    .hint {
      margin: 6px 0 0;
      font-size: 8px;
      color: #5a7880;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 700;
    }
  </style>
</head>
<body>
  ${pages}
</body>
</html>`
}

function escapeHtml(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

