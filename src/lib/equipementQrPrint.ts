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

/** Ouvre une fenêtre d’impression d’étiquettes équipements. */
export async function printEquipementLabels(
  hits: EquipQrHit[],
  opts?: { origin?: string; companyName?: string },
): Promise<void> {
  if (!hits.length) return
  const origin = opts?.origin || window.location.origin
  const company = opts?.companyName || 'ClimaZEN'

  const cards: string[] = []
  for (const hit of hits) {
    const payload = buildEquipQrPayload(hit.equip.id, origin)
    const img = await qrDataUrl(payload, 320)
    const { title, lines } = equipQrPrintLines(hit)
    cards.push(`
      <article class="label">
        <div class="brand">${escapeHtml(company)}</div>
        <img src="${img}" alt="QR" width="140" height="140" />
        <h1>${escapeHtml(title)}</h1>
        <p class="meta">${lines.map(escapeHtml).join('<br/>')}</p>
        <p class="hint">Scanner avec ClimaZEN</p>
      </article>
    `)
  }

  const html = `<!DOCTYPE html>
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
    h2.sheet-title {
      font-size: 14px;
      margin: 0 0 12px;
      color: #5a7880;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10mm;
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
    .hint {
      margin: 8px 0 0;
      font-size: 9px;
      color: #5a7880;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 700;
    }
    @media print {
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <p class="no-print" style="padding:12px;font-size:13px">
    ${hits.length} étiquette${hits.length > 1 ? 's' : ''} — utilisez Imprimer → format étiquette / A4.
    <button onclick="window.print()" style="margin-left:8px;padding:8px 14px;font-weight:700;cursor:pointer">
      Imprimer
    </button>
  </p>
  <h2 class="sheet-title no-print">Aperçu impression</h2>
  <div class="grid">${cards.join('')}</div>
  <script>window.onload = function () { setTimeout(function () { window.print(); }, 250); };</script>
</body>
</html>`

  const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700')
  if (!w) {
    throw new Error('Autorisez les pop-ups pour imprimer les étiquettes.')
  }
  w.document.open()
  w.document.write(html)
  w.document.close()
}

function escapeHtml(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
