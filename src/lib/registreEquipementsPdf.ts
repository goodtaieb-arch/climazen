import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { RegistreEquipements } from './registreEquipements'
import { embedCompanyLogo } from './pdfLogo'

function fmtDate(iso: string) {
  const d = (iso || '').slice(0, 10)
  const [y, m, day] = d.split('-')
  if (!y || !m || !day) return iso
  return `${day}/${m}/${y}`
}

/** jsPDF/helvetica n’a pas le glyphe espace fine insécable (U+202F) du séparateur fr-FR. */
function fixNbsp(s: string) {
  return s.replace(/[  ]/g, ' ')
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

export async function buildRegistreEquipementsPdf(registre: RegistreEquipements): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 12
  let y = 14

  const op = registre.operateur
  embedCompanyLogo(doc, op?.logoImage, { x: pageW - 46, y: 8, maxW: 34, maxH: 15 })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('Registre des équipements fluides frigorigènes', margin, y)
  y += 6.5
  doc.setFontSize(10.5)
  doc.text('Parc actif — pièce justificative ISO 14001 (identification, charge, PRG/GWP)', margin, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(80)
  doc.text(
    'Registre de tous les équipements en service contenant du fluide frigorigène, avec leur charge nominale ' +
      'et le pouvoir de réchauffement global (PRG/GWP) du fluide. À rapprocher du bilan annuel fluides ' +
      '(mass-balance achats/récupérations/charges) pour la traçabilité complète des émissions.',
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

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [
      [
        'Client / site',
        'Équipement',
        'Marque / modèle',
        'N° série',
        'Fluide',
        'GWP',
        'Charge\n(kg)',
        'Éq. CO2\n(t eq. CO2)',
        'Détection\npermanente',
        'Contrôle périodique',
      ],
    ],
    body:
      registre.lignes.length > 0
        ? registre.lignes.map((l) => [
            `${l.clientNom}\n${l.siteNom}`,
            l.equipementNom || l.type || '—',
            [l.marque, l.modele].filter(Boolean).join(' ') || '—',
            l.numeroSerie || '—',
            l.fluideType || '—',
            l.gwp != null ? fmtNumber(l.gwp, 2) : '—',
            fmtKg(l.chargeNominaleKg),
            fmtTeq(l.teqCO2),
            l.detectionPermanente ? 'Oui' : 'Non',
            l.controleObligatoire ? (l.controlePeriodicite ?? 'Obligatoire') : 'Non requis',
          ])
        : [['Aucun équipement fluide actif enregistré', '', '', '', '', '', '', '', '', '']],
    styles: { fontSize: 7.2, cellPadding: 1.6, halign: 'center' },
    headStyles: { fillColor: [26, 168, 150], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 6.8 },
    columnStyles: {
      0: { halign: 'left' },
      1: { halign: 'left' },
      // Colonnes numériques courtes forcées sur une ligne — sinon un GWP à 4
      // chiffres ("1 387") passe à la ligne et ressemble visuellement à une
      // fraction ("1" / "387" empilés avec la bordure de cellule entre les deux).
      5: { cellWidth: 16, minCellWidth: 16 },
      6: { cellWidth: 14, minCellWidth: 14 },
      7: { cellWidth: 16, minCellWidth: 16 },
    },
  })

  y = lastY(doc) + 6

  if (y > pageH - 40) {
    doc.addPage()
    y = 16
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.text('Totaux', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(
    `${registre.totaux.nbEquipements} équipement(s) actif(s)  ·  Charge totale ${fmtKg(registre.totaux.chargeTotaleKg)} kg  ·  ` +
      `${fmtTeq(registre.totaux.teqCO2Total)} t eq. CO2  ·  ${registre.totaux.nbControleObligatoire} sous obligation de contrôle périodique`,
    margin,
    y,
    { maxWidth: pageW - margin * 2 },
  )
  y += 9

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(`Entreprise : ${op?.raisonSociale || '—'}  ·  SIRET : ${op?.siret || '—'}`, margin, y)
  y += 5
  doc.text(`Date de génération : ${fmtDate(registre.genereAt)} à ${registre.genereAt.slice(11, 16)}`, margin, y)

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(120)
    doc.text(
      `ClimaZEN · Généré le ${fmtDate(registre.genereAt)} à ${registre.genereAt.slice(11, 16)} · page ${i}/${pageCount}`,
      margin,
      pageH - 8,
    )
    doc.setTextColor(0)
  }

  return doc.output('blob')
}

export function registreEquipementsFilename() {
  const today = new Date().toISOString().slice(0, 10)
  return `registre-equipements-fluides-${today}.pdf`
}
