import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { RapportAnnuelGaz } from './rapportAnnuelGaz'
import { kgDeclare } from './rapportAnnuelGaz'

function fmtDate(iso: string) {
  const d = iso.slice(0, 10)
  const [y, m, day] = d.split('-')
  if (!y || !m || !day) return iso
  return `${day}/${m}/${y}`
}

function fmtKg(n: number) {
  return String(kgDeclare(n))
}

function lastY(doc: jsPDF) {
  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
}

export async function buildRapportAnnuelGazPdf(rapport: RapportAnnuelGaz): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 14
  let y = 16

  const op = rapport.operateur
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('Rapport annuel des mouvements de fluides', margin, y)
  y += 7
  doc.setFontSize(11)
  doc.text(`Année civile ${rapport.year} (du 01/01/${rapport.year} au 31/12/${rapport.year})`, margin, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(80)
  doc.text(
    'Consolidation pour organisme de contrôle / attestation de capacité. Inclut le bilan, les mouvements datés et les justificatifs fournisseurs & déchèteries.',
    margin,
    y,
    { maxWidth: pageW - margin * 2 },
  )
  doc.setTextColor(0)
  y += 10

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Opérateur', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const opLines = [
    op.raisonSociale || '—',
    op.adresse || '',
    `SIRET : ${op.siret || '—'}`,
    `Attestation de capacité n° ${op.attestationNumero || '—'}`,
    op.telephone || op.email ? `${op.telephone || ''}  ${op.email || ''}`.trim() : '',
  ].filter(Boolean)
  for (const line of opLines) {
    doc.text(line, margin, y)
    y += 4.5
  }
  y += 4

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('1. Bilan consolidé par fluide (kg arrondis à l’unité)', margin, y)
  y += 2

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [
      [
        'Fluide',
        'Stock neuf\n01/01',
        'Stock neuf\n31/12',
        'Stock usagé\n01/01',
        'Stock usagé\n31/12',
        'Acheté',
        'Chargé',
        'Récupéré',
        'Détruit',
        'Remis\nfourn.',
      ],
    ],
    body:
      rapport.bilans.length > 0
        ? rapport.bilans.map((b) => [
            b.fluide,
            fmtKg(b.stockNeuf1erJanvier),
            fmtKg(b.stockNeuf31Decembre),
            fmtKg(b.stockUsage1erJanvier),
            fmtKg(b.stockUsage31Decembre),
            fmtKg(b.acheteKg),
            fmtKg(b.chargeKg),
            fmtKg(b.recupereKg),
            fmtKg(b.detruitKg),
            fmtKg(b.remisFournisseurKg),
          ])
        : [['Aucun mouvement ni stock pour cette année', '0', '0', '0', '0', '0', '0', '0', '0', '0']],
    styles: { fontSize: 7, cellPadding: 1.5, halign: 'center' },
    headStyles: { fillColor: [26, 168, 150], textColor: 255, fontStyle: 'bold', halign: 'center' },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
  })

  y = lastY(doc) + 8

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Totaux année', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(
    `Acheté ${fmtKg(rapport.totaux.acheteKg)} kg  ·  Chargé ${fmtKg(rapport.totaux.chargeKg)} kg  ·  Récupéré ${fmtKg(rapport.totaux.recupereKg)} kg  ·  Détruit ${fmtKg(rapport.totaux.detruitKg)} kg  ·  Remis fournisseur ${fmtKg(rapport.totaux.remisFournisseurKg)} kg`,
    margin,
    y,
    { maxWidth: pageW - margin * 2 },
  )
  y += 10

  if (y > 240) {
    doc.addPage()
    y = 16
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('2. Justificatifs fournisseurs & déchèteries', margin, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(80)
  doc.text(
    'Liste des pièces à conserver pour le contrôle : BL / factures d’achat, bons de retour consigne, BSFF et bons de prise en charge en déchèterie / centre agréé.',
    margin,
    y,
    { maxWidth: pageW - margin * 2 },
  )
  doc.setTextColor(0)
  y += 6

  const justifs = rapport.justificatifs || []
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Date', 'Catégorie', 'Organisme', 'N° justificatif', 'Type doc.', 'Fluide', 'Bouteille', 'kg']],
    body:
      justifs.length > 0
        ? justifs.map((j) => [
            fmtDate(j.date),
            j.categorieLabel,
            j.organisme,
            j.reference,
            j.typeDoc,
            j.fluide,
            j.numeroContenant,
            j.quantiteKg.toLocaleString('fr-FR', { maximumFractionDigits: 3 }),
          ])
        : [
            [
              '—',
              'Aucun justificatif enregistré pour cette année',
              'Renseignez les BL fournisseur et BSFF / déchèterie sur les mouvements (achat, destruction, retour).',
              '',
              '',
              '',
              '',
              '',
            ],
          ],
    styles: { fontSize: 7, cellPadding: 1.4 },
    headStyles: { fillColor: [196, 122, 26], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 18 },
      7: { halign: 'right', cellWidth: 12 },
    },
  })

  y = lastY(doc) + 10

  if (y > 240) {
    doc.addPage()
    y = 16
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('3. Détail chronologique des mouvements (dates précises)', margin, y)
  y += 2

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Date', 'Fluide', 'Bouteille', 'Type', 'Sens', 'kg', 'Réf.', 'Tiers / doc.']],
    body:
      rapport.mouvements.length > 0
        ? rapport.mouvements.map((m) => [
            fmtDate(m.date),
            m.fluide,
            m.numeroContenant,
            m.kind,
            m.sens,
            m.quantiteKg.toLocaleString('fr-FR', { maximumFractionDigits: 3 }),
            m.label,
            [m.tiers, m.document].filter(Boolean).join(' · ') || '—',
          ])
        : [['—', 'Aucun mouvement enregistré', '', '', '', '', '', '']],
    styles: { fontSize: 7, cellPadding: 1.4 },
    headStyles: { fillColor: [18, 48, 58], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 18 },
      5: { halign: 'right', cellWidth: 12 },
    },
  })

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(120)
    doc.text(
      `ClimaZEN · Généré le ${fmtDate(rapport.genereAt)} à ${rapport.genereAt.slice(11, 16)} · page ${i}/${pageCount}`,
      margin,
      doc.internal.pageSize.getHeight() - 8,
    )
    doc.setTextColor(0)
  }

  return doc.output('blob')
}

export function rapportAnnuelFilename(year: number) {
  return `rapport-annuel-fluides-${year}.pdf`
}
