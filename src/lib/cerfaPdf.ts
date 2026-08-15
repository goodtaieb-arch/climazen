import { PDFDocument, StandardFonts, PDFName, PDFBool, rgb } from 'pdf-lib'
import type { CerfaDraft, Client, Chantier, NatureIntervention } from './types'
import { sensMouvementPourContenant } from './types'
import { controlesPeriodiquesInfo, isFluideAdrInflammable } from './fluides'
import { formatKg, roundKg } from './decimal'
import { findEquipement } from './migrate'

/**
 * Remplit le CERFA officiel 15497*04 (forme inchangée) puis aplatit les champs
 * pour que les valeurs soient visibles dans tous les lecteurs PDF.
 */

const TEMPLATE_URL = '/cerfa/cerfa_15497_04.pdf'

const NATURE_TO_CHECKBOX: Partial<Record<NatureIntervention, string>> = {
  assemblage: 'Case_Assemblage',
  mise_en_service: 'Case_MiseService',
  modification: 'Case_Modif',
  entretien_reparation: 'Case_Maintenance',
  controle_etancheite_periodique: 'Case_CtrlPerio',
  controle_etancheite_non_periodique: 'Case_CtrlNonPerio',
  demantelement: 'Case_Demantel',
  recuperation: 'Case_Autre',
  charge: 'Case_Autre',
  autre: 'Case_Autre',
}

function setText(
  form: ReturnType<PDFDocument['getForm']>,
  name: string,
  value: string | number | undefined | null,
  opts?: { fontSize?: number },
) {
  if (value === undefined || value === null || value === '') return
  try {
    const field = form.getTextField(name)
    try {
      if (String(value).includes('\n')) field.enableMultiline()
    } catch {
      // ignore
    }
    if (opts?.fontSize != null) {
      try {
        field.setFontSize(opts.fontSize)
      } catch {
        // ignore
      }
    }
    field.setText(String(value))
  } catch {
    // ignore
  }
}

function check(form: ReturnType<PDFDocument['getForm']>, name: string, on: boolean) {
  try {
    if (on) form.getCheckBox(name).check()
    else form.getCheckBox(name).uncheck()
  } catch {
    // ignore
  }
}

function parseDateParts(isoDate: string) {
  const [y, m, d] = (isoDate || '').split('-')
  return { jour: d || '', mois: m || '', annee: y || '' }
}

function formatDateFr(isoDate: string) {
  const { jour, mois, annee } = parseDateParts(isoDate)
  if (!jour || !mois || !annee) return isoDate || ''
  return `${jour}/${mois}/${annee}`
}

export async function buildCerfaPdf(opts: {
  draft: CerfaDraft
  client: Client
  chantier: Chantier
  ficheNumero?: string
}): Promise<Blob> {
  const { draft, client, chantier, ficheNumero } = opts

  const res = await fetch(TEMPLATE_URL)
  if (!res.ok) {
    throw new Error('Impossible de charger le CERFA officiel 15497*04.')
  }

  const pdfDoc = await PDFDocument.load(await res.arrayBuffer())
  const form = pdfDoc.getForm()

  // [1] Opérateur
  setText(
    form,
    'Operateur',
    [
      draft.operateur.raisonSociale,
      draft.operateur.adresse,
      draft.operateur.siret ? `SIRET ${draft.operateur.siret}` : '',
      [draft.operateur.telephone, draft.operateur.email].filter(Boolean).join(' · '),
    ]
      .filter(Boolean)
      .join('\n'),
  )
  setText(form, 'Attestation_no', draft.operateur.attestationNumero)
  setText(form, 'Fiche_no', ficheNumero || draft.id.slice(0, 8).toUpperCase())

  // [2] Détenteur
  setText(
    form,
    'Detenteur',
    [
      client.raisonSociale,
      client.nomContact,
      client.adresse,
      `${client.codePostal} ${client.ville}`,
      [client.telephone, client.email].filter(Boolean).join(' · '),
    ]
      .filter(Boolean)
      .join('\n'),
  )

  // [3] Équipement — Identification = nom + n° série (sans libellé « N° série »)
  const equip = findEquipement(chantier, draft.equipementId)
  const equipNom =
    (equip?.nom || equip?.type || chantier.equipementType || chantier.nom || '').trim()
  const serie =
    (equip?.numeroSerie || chantier.equipementNumeroSerie || '').trim()
  setText(
    form,
    'Equipement_ID',
    [equipNom, serie].filter(Boolean).join('\n'),
  )
  setText(form, 'Equipement_Fluide', draft.fluideType || equip?.fluideType || chantier.fluideType)
  {
    const charge = Number(
      draft.quantiteTotaleKg || equip?.chargeNominaleKg || chantier.chargeNominaleKg || 0,
    )
    if (charge) setText(form, 'Equipement_Charge', formatKg(charge))
  }
  {
    const teq = Number(draft.teqCO2 ?? equip?.teqCO2 ?? chantier.teqCO2 ?? 0)
    if (teq) setText(form, 'Equipement_teqCO2', formatKg(teq, 3))
  }

  // [4] Nature
  const autreLabels: string[] = []
  for (const n of draft.natures) {
    const box = NATURE_TO_CHECKBOX[n]
    if (box) check(form, box, true)
    if (n === 'recuperation') autreLabels.push('Récupération de fluide')
    if (n === 'charge') autreLabels.push('Charge de fluide')
    if (n === 'autre') autreLabels.push('Autre manipulation')
  }
  if (autreLabels.length) setText(form, 'Autre', autreLabels.join(' · '))

  // [5] Détecteur — Identification + Contrôlé le (annuel)
  setText(
    form,
    'Detecteur_ID',
    draft.detecteurIdentification || draft.operateur.detecteurIdentification || '',
    { fontSize: 8 },
  )
  const ctrl = parseDateParts(
    draft.detecteurControleDate || draft.operateur.detecteurControleDate || '',
  )
  // Valeur dans le champ + redessin centré plus bas (cases trop basses → texte AcroForm coupé)
  setText(form, 'Controle_Jour', ctrl.jour, { fontSize: 6 })
  setText(form, 'Controle_Mois', ctrl.mois, { fontSize: 6 })
  setText(form, 'Controle_Annee', ctrl.annee, { fontSize: 6 })

  // [6] Détection permanente
  try {
    form.getRadioGroup('Bouton_Oui').select(draft.detectionPermanente ? '1' : '2')
  } catch {
    // ignore
  }

  // [8]/[9] périodicité — uniquement si au-dessus des seuils [7]
  const charge = Number(draft.quantiteTotaleKg || chantier.chargeNominaleKg || 0)
  const fluideCode = draft.fluideType || chantier.fluideType || ''
  const teq = Number(draft.teqCO2 ?? chantier.teqCO2 ?? 0)
  const ctrlPer = controlesPeriodiquesInfo({
    fluideCode,
    chargeKg: charge,
    teqCO2: teq,
    detectionPermanente: !!draft.detectionPermanente,
  })

  if (ctrlPer.obligatoire) {
    const per = (draft.periodiciteControle || ctrlPer.periodeSuggeree || '').toLowerCase()
    if (!draft.detectionPermanente) {
      check(form, 'Case_Sans_12m', per.includes('12') || per.includes('annuel'))
      check(form, 'Case_Sans_6m', /\b6\b/.test(per) && !per.includes('12'))
      check(form, 'Case_Sans_3m', /\b3\b/.test(per) && !per.includes('30'))
    } else {
      check(form, 'Case_Avec_24m', per.includes('24'))
      check(form, 'Case_Avec_12m', per.includes('12') || per.includes('annuel'))
      check(form, 'Case_Avec_6m', /\b6\b/.test(per) && !per.includes('12') && !per.includes('24'))
    }
  }
  // Sous seuil : aucune case [8]/[9] cochée (conforme Cerfa)

  // Seuils fluide [7] — HFC en t eq. CO₂ ; HFO/HCFC en kg
  const seuil = ctrlPer.famille
  if (seuil === 'HFO') {
    check(form, 'Case_HFO_1', charge >= 1 && charge < 10)
    check(form, 'Case_HFO_10', charge >= 10 && charge < 100)
    check(form, 'Case_HFO_100', charge >= 100)
  } else if (seuil === 'HCFC') {
    check(form, 'Case_HCFC_2', charge >= 2 && charge < 30)
    check(form, 'Case_HCFC_30', charge >= 30 && charge < 300)
    check(form, 'Case_HCFC_300', charge >= 300)
  } else if (seuil === 'HFC') {
    check(form, 'Case_HFC_5', teq >= 5 && teq < 50)
    check(form, 'Case_HFC_50', teq >= 50 && teq < 500)
    check(form, 'Case_HFC_500', teq >= 500)
  }

  // [10] Fuites
  check(form, 'Case_Fuite_Oui', draft.fuiteConstatee)
  check(form, 'Case_Fuite_Non', !draft.fuiteConstatee)
  if (draft.fuiteConstatee) {
    setText(form, 'Fuite_Loca_1', draft.fuiteDescription || '')
    if (draft.fuiteReparee === true) check(form, 'Case_Rep_Fuite1_realisee', true)
    if (draft.fuiteReparee === false) check(form, 'Case_Rep_Fuite1_AFaire', true)
    if (draft.fuiteLocalisation2) {
      setText(form, 'Fuite_Loca_2', draft.fuiteLocalisation2)
      if (draft.fuite2Reparee === true) check(form, 'Case_Rep_Fuite2_realisee', true)
      if (draft.fuite2Reparee === false) check(form, 'Case_Rep_Fuite2_AFaire', true)
    }
    if (draft.fuiteLocalisation3) {
      setText(form, 'Fuite_Loca_3', draft.fuiteLocalisation3)
      if (draft.fuite3Reparee === true) check(form, 'Case_Rep_Fuite3_realisee', true)
      if (draft.fuite3Reparee === false) check(form, 'Case_Rep_Fuite3_AFaire', true)
    }
  }

  // [11] Manipulation
  // Gauche = CHARGE (A+B+C) : sorties (vierge / recyclé / régénéré)
  // Droite = RÉCUP (D+E) : entrées (récup. déchet → D, recyclé site → E)
  let qa = 0 // A — fluide vierge (charge)
  let qb = 0 // B — fluide recyclé (charge)
  let qc = 0 // C — fluide régénéré (charge)
  let qd = 0 // D — destiné au traitement (récup)
  let qe = 0 // E — conservé pour réutilisation (récup)
  const partsCharge: string[] = []
  const contenants: string[] = []
  let bsff = ''
  for (const m of draft.manipulations) {
    const q = roundKg(Number(m.quantiteKg) || 0)
    if (!(q > 0)) continue
    const sens =
      m.sens || sensMouvementPourContenant(m.type, m.type === 'recuperation' ? 0 : 1)
    if (m.numeroContenant?.trim()) contenants.push(m.numeroContenant.trim())
    if (m.bsffReference) bsff = m.bsffReference

    if (sens === 'sortie') {
      // Charge / appoint dans l’installation
      partsCharge.push(formatKg(q))
      if (m.type === 'vierge') qa = roundKg(qa + q)
      else if (m.type === 'recycle') qb = roundKg(qb + q)
      else if (m.type === 'regenere') qc = roundKg(qc + q)
      // transfert en sortie : hors cases A/B/C officielles
    } else {
      // Récupération depuis l’installation → bouteille
      if (m.type === 'recuperation') {
        qd = roundKg(qd + q) // déchet → traitement
      } else if (m.type === 'recycle' || m.type === 'regenere') {
        qe = roundKg(qe + q) // conservé pour réutilisation
      }
    }
  }
  const totalCharge = roundKg(qa + qb + qc)
  const totalRecup = roundKg(qd + qe)
  if (partsCharge.length) setText(form, '11_Quantite', partsCharge.join('+'))
  else if (totalCharge) setText(form, '11_Quantite', formatKg(totalCharge))
  if (qa) setText(form, '11_QA', formatKg(qa))
  if (qb) setText(form, '11_QB', formatKg(qb))
  if (qc) setText(form, '11_QC', formatKg(qc))
  if (qd) setText(form, '11_QD', formatKg(qd))
  if (qe) setText(form, '11_QE', formatKg(qe))
  if (totalRecup) setText(form, '11_QDE', formatKg(totalRecup))
  // Dénomination fluide chargé — uniquement s’il y a eu une charge
  if (totalCharge > 0) {
    setText(form, '11_Denom', draft.fluideType || chantier.fluideType)
  }
  if (contenants.length) setText(form, '11_Contenant_ID', contenants.join(' / '))
  if (bsff) setText(form, '11_BSFF', bsff)

  // [12] UN — inflammabilité selon le fluide (pas seulement le code UN)
  // R-410A = A1 / UN 3163 → 14 06 01* non inflammable
  // R-32 = A2L / UN 3252 → 16 05 04* inflammable
  const code = (draft.codeUn || '').toUpperCase()
  const fluideCerfa = draft.fluideType || chantier.fluideType || ''
  const inflammable = isFluideAdrInflammable(fluideCerfa, draft.codeUn)
  const libelleAdr = `${draft.codeUn || ''} ${draft.denominationAdr || ''}`.trim()

  if (!inflammable && code.includes('1078')) {
    check(form, 'Case_12_UN1078', true)
  } else if (inflammable && code.includes('3161')) {
    check(form, 'Case_12_UN3161', true)
  } else if (inflammable && (code || libelleAdr)) {
    check(form, 'Case_12_Autre160504', true)
    setText(form, 'Autre-FF-inflammable', libelleAdr)
  } else if (code || libelleAdr) {
    check(form, 'Case_12_Autre140601', true)
    setText(form, 'Autre-FF-NON-inflammable', libelleAdr)
  }

  // [13] [14]
  setText(form, '13_Instal', draft.installationDestination)
  const obsParts = [
    draft.numeroIntervention?.trim() ? `OT ${draft.numeroIntervention.trim()}` : '',
    draft.observations || '',
  ].filter(Boolean)
  setText(form, '14_Observations', obsParts.join(' — '))

  // Signatures — noms / qualités / dates (case « Date et signature »)
  const opNom = draft.signatureOperateur || ''
  const opQual = draft.signatureOperateurQualite || 'Opérateur attesté'
  const detNom =
    draft.signatureDetenteur?.trim() ||
    client.nomContact?.trim() ||
    ''
  const detQual = draft.signatureDetenteurQualite || 'Détenteur'
  const dateFr = formatDateFr(draft.dateIntervention)

  setText(form, 'Sign_Operateur_Nom', opNom)
  setText(form, 'Sign_Operateur_Qualite', opQual)
  // Date seule à gauche de la case « Date et signature »
  setText(form, 'Sign_Operateur_Date', dateFr)
  setText(form, 'Sign_Detenteur_Nom', detNom)
  setText(form, 'Sign_Detenteur_Qualite', detQual)
  setText(form, 'Sign_Detenteur_Date', dateFr)

  // Mettre à jour les apparences — SANS flatten (sinon le CERFA officiel disparaît)
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  try {
    form.updateFieldAppearances(font)
  } catch {
    // ignore
  }

  // Demander au lecteur PDF d’afficher les valeurs des champs
  try {
    form.acroForm.dict.set(PDFName.of('NeedAppearances'), PDFBool.True)
  } catch {
    // ignore
  }

  const page = pdfDoc.getPages()[0]

  const fieldRect = (name: string) => {
    try {
      const widgets = form.getTextField(name).acroField.getWidgets()
      return widgets[0]?.getRectangle() || null
    } catch {
      return null
    }
  }

  // Cases JJ / MM / AAAA du détecteur : redessiner le texte centré (évite la coupe à moitié)
  const paintTinyField = (name: string, value: string) => {
    if (!value) return
    const rect = fieldRect(name)
    if (!rect || rect.width < 2 || rect.height < 2) return
    const size = Math.min(8, Math.max(5.5, rect.height * 0.7))
    page.drawRectangle({
      x: rect.x + 0.35,
      y: rect.y + 0.35,
      width: rect.width - 0.7,
      height: rect.height - 0.7,
      color: rgb(1, 1, 1),
      borderWidth: 0,
    })
    const tw = font.widthOfTextAtSize(value, size)
    const x = rect.x + Math.max(0.4, (rect.width - tw) / 2)
    const y = rect.y + (rect.height - size) / 2 + size * 0.15
    page.drawText(value, { x, y, size, font, color: rgb(0, 0, 0) })
  }
  paintTinyField('Controle_Jour', ctrl.jour)
  paintTinyField('Controle_Mois', ctrl.mois)
  paintTinyField('Controle_Annee', ctrl.annee)

  // Signature manuscrite DANS la case « Date et signature », à droite de la date
  // Uniquement celle de la fiche (perso opérateur) — pas de fallback société
  const opImg = draft.signatureOperateurImage
  const detImg = draft.signatureDetenteurImage

  const drawSigInDateBox = async (dataUrl: string | undefined, fieldName: string) => {
    if (!dataUrl?.startsWith('data:image')) return
    const rect = fieldRect(fieldName)
    if (!rect) return
    try {
      const b64 = dataUrl.split(',')[1]
      if (!b64) return
      const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
      const png = await pdfDoc.embedPng(raw)

      // Partie droite de la case Date et signature — rester DANS la case (ne pas chevaucher Qualité)
      const pad = 2
      const dateSlot = Math.min(52, rect.width * 0.28)
      const maxW = Math.max(24, rect.width - dateSlot - pad * 2)
      const maxH = Math.max(16, rect.height - pad * 2)

      const aspect = png.width / Math.max(1, png.height)
      let sigW = maxW
      let sigH = sigW / aspect
      if (sigH > maxH) {
        sigH = maxH
        sigW = sigH * aspect
      }

      // Ancré en bas à droite de la case (coord. PDF : y = bas)
      const sigX = rect.x + dateSlot + pad + (maxW - sigW) / 2
      const sigY = rect.y + pad

      page.drawRectangle({
        x: sigX - 0.5,
        y: sigY - 0.5,
        width: sigW + 1,
        height: sigH + 1,
        color: rgb(1, 1, 1),
        borderWidth: 0,
      })

      page.drawImage(png, { x: sigX, y: sigY, width: sigW, height: sigH })
    } catch {
      // ignore
    }
  }

  await drawSigInDateBox(opImg, 'Sign_Operateur_Date')
  await drawSigInDateBox(detImg, 'Sign_Detenteur_Date')

  // Garder le formulaire officiel éditable (72 champs) — jamais form.flatten()
  const bytes = await pdfDoc.save({ updateFieldAppearances: true })
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
}

/** Affiche le PDF dans l’app via une URL blob (sans nouvel onglet cassé). */
export function createPdfObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob)
}

/** @deprecated — préférer PdfViewerModal ; garde un fallback sans noopener */
export function openBlobInTab(blob: Blob) {
  const url = URL.createObjectURL(blob)
  // Sans "noopener" : sinon Safari/Chrome affiche "site can't be reached" sur blob:
  const w = window.open('about:blank', '_blank')
  if (w) {
    w.location.href = url
  } else {
    // popup bloquée → navigation même onglet
    window.location.href = url
  }
  setTimeout(() => URL.revokeObjectURL(url), 120_000)
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
