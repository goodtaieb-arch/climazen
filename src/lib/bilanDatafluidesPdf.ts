import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { BilanDatafluides } from './bilanDatafluides'
import { FILIERE_TRAITEMENT_LABELS } from './bilanDatafluides'
import { embedCompanyLogo } from './pdfLogo'

function fmtDate(iso: string) {
  const d = (iso || '').slice(0, 10)
  const [y, m, day] = d.split('-')
  if (!y || !m || !day) return iso
  return `${day}/${m}/${y}`
}

/** jsPDF/helvetica n’a pas le glyphe espace fine insécable (U+202F) du séparateur fr-FR. */
function fixNbsp(s: string) {
  return s.replace(/[  ]/g, ' ')
}

function fmtNumber(n: number, maximumFractionDigits: number) {
  return fixNbsp((n || 0).toLocaleString('fr-FR', { maximumFractionDigits, minimumFractionDigits: 0 }))
}

function fmtKg(n: number) {
  return fmtNumber(n, 2)
}

function fmtTeq(n: number) {
  return fmtNumber(n, 3)
}

function lastY(doc: jsPDF) {
  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
}

export async function buildBilanDatafluidesPdf(bilan: BilanDatafluides): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 12
  let y = 14

  const op = bilan.operateur
  embedCompanyLogo(doc, op?.logoImage, { x: pageW - 46, y: 8, maxW: 34, maxH: 15 })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('Bilan annuel fluides frigorigènes', margin, y)
  y += 6.5
  doc.setFontSize(10.5)
  doc.text(`Année civile ${bilan.year} — brouillon pour déclaration Datafluides`, margin, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(80)
  doc.text(
    'Datafluides (datafluides.fr, Cemafroid) ne dispose pas d’API publique : ce document est un brouillon / ' +
      'justificatif à recopier vous-même sur le portail officiel avant le 31 janvier, et peut aussi être transmis ' +
      'tel quel à votre organisme de contrôle.',
    margin,
    y,
    { maxWidth: pageW - margin * 2 - (op?.logoImage ? 40 : 0) },
  )
  doc.setTextColor(0)
  y += 9

  if (op?.raisonSociale) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(op.raisonSociale, margin, y)
    doc.setFont('helvetica', 'normal')
    const infos = [
      op.siret ? `SIRET ${op.siret}` : '',
      op.attestationNumero ? `Attestation de capacité n° ${op.attestationNumero}` : '',
    ]
      .filter(Boolean)
      .join('  ·  ')
    if (infos) {
      doc.text(infos, margin + doc.getTextWidth(op.raisonSociale) + 6, y)
    }
    y += 6
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('1. Bilan par fluide (kg)', margin, y)
  y += 2

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [
      [
        'Fluide',
        'GWP',
        'Acheté\n(neuf + régén.)',
        'Chargé /\nmis en service',
        'Récupéré\nsur chantier',
        'Transféré\nrégénération',
        'Transféré\nrecyclage site',
        'Transféré\ndestruction',
        'Stock\nrestant 31/12',
        'Éq. CO2 chargé\n(t eq. CO2)',
        'Éq. CO2 stock\n(t eq. CO2)',
      ],
    ],
    body:
      bilan.lignes.length > 0
        ? bilan.lignes.map((l) => [
            l.fluide,
            l.gwp != null ? fmtNumber(l.gwp, 2) : '—',
            fmtKg(l.acheteKg),
            fmtKg(l.chargeKg),
            fmtKg(l.recupereKg),
            fmtKg(l.transfereRegenerationKg),
            fmtKg(l.transfereRecyclageKg),
            fmtKg(l.transfereDestructionKg),
            fmtKg(l.stockRestantKg),
            fmtTeq(l.teqCO2Charge),
            fmtTeq(l.teqCO2StockRestant),
          ])
        : [['Aucun mouvement ni stock pour cette année', '', '', '', '', '', '', '', '', '', '']],
    styles: { fontSize: 7.2, cellPadding: 1.6, halign: 'center' },
    headStyles: { fillColor: [26, 168, 150], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 6.8 },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
  })

  y = lastY(doc) + 6

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.text('Totaux toutes fluides confondues', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(
    `Acheté ${fmtKg(bilan.totaux.acheteKg)} kg  ·  Chargé ${fmtKg(bilan.totaux.chargeKg)} kg  ·  Récupéré ${fmtKg(bilan.totaux.recupereKg)} kg  ·  ` +
      `Régénération ${fmtKg(bilan.totaux.transfereRegenerationKg)} kg  ·  Recyclage site ${fmtKg(bilan.totaux.transfereRecyclageKg)} kg  ·  ` +
      `Destruction ${fmtKg(bilan.totaux.transfereDestructionKg)} kg  ·  Stock restant ${fmtKg(bilan.totaux.stockRestantKg)} kg`,
    margin,
    y,
    { maxWidth: pageW - margin * 2 },
  )
  y += 5
  doc.text(
    `Éq. CO2 chargé : ${fmtTeq(bilan.totaux.teqCO2Charge)} t eq. CO2  ·  Éq. CO2 stock restant : ${fmtTeq(bilan.totaux.teqCO2StockRestant)} t eq. CO2`,
    margin,
    y,
    { maxWidth: pageW - margin * 2 },
  )
  y += 9

  if (y > pageH - 50) {
    doc.addPage()
    y = 16
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('2. Détail des transferts vers traitement (Réf. BSFF)', margin, y)
  y += 2

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Date', 'Fluide', 'Bouteille', 'Destination', 'kg', 'Réf. BSFF / document', 'Organisme']],
    body:
      bilan.transferts.length > 0
        ? bilan.transferts.map((t) => [
            fmtDate(t.date),
            t.fluide,
            t.numeroContenant,
            FILIERE_TRAITEMENT_LABELS[t.filiere],
            fmtKg(t.quantiteKg),
            t.bsffReference || '—',
            t.organisme,
          ])
        : [['—', 'Aucun transfert vers traitement enregistré pour cette année', '', '', '', '', '']],
    styles: { fontSize: 7.5, cellPadding: 1.6 },
    headStyles: { fillColor: [196, 122, 26], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 20 },
      4: { halign: 'right', cellWidth: 16 },
    },
  })

  y = lastY(doc) + 8

  if (y > pageH - 40) {
    doc.addPage()
    y = 16
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('3. Traçabilité', margin, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)

  const cerfaList = bilan.cerfaNumeros.length > 0 ? bilan.cerfaNumeros.join(', ') : 'Aucun'
  const lines = [
    `Entreprise : ${op?.raisonSociale || '—'}`,
    `SIRET : ${op?.siret || '—'}`,
    `Année déclarée : ${bilan.year}`,
    `Date de génération : ${fmtDate(bilan.genereAt)} à ${bilan.genereAt.slice(11, 16)}`,
  ]
  for (const line of lines) {
    doc.text(line, margin, y)
    y += 5
  }
  doc.setFont('helvetica', 'bold')
  doc.text('N° CERFA inclus dans le calcul :', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  const cerfaTextLines = doc.splitTextToSize(cerfaList, pageW - margin * 2)
  doc.text(cerfaTextLines, margin, y)

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(120)
    doc.text(
      `ClimaZEN · Généré le ${fmtDate(bilan.genereAt)} à ${bilan.genereAt.slice(11, 16)} · page ${i}/${pageCount}`,
      margin,
      pageH - 8,
    )
    doc.setTextColor(0)
  }

  return doc.output('blob')
}

export function bilanDatafluidesFilename(year: number) {
  return `bilan-annuel-fluides-datafluides-${year}.pdf`
}
