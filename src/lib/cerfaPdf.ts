import { PDFDocument, StandardFonts, PDFName, PDFBool, rgb } from 'pdf-lib'
import type { CerfaDraft, Client, Chantier, NatureIntervention } from './types'
import { cerfaSeuilFamille } from './fluides'

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

function setText(form: ReturnType<PDFDocument['getForm']>, name: string, value: string | number | undefined | null) {
  if (value === undefined || value === null || value === '') return
  try {
    const field = form.getTextField(name)
    try {
      if (String(value).includes('\n')) field.enableMultiline()
    } catch {
      // ignore
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

  // [3] Équipement
  setText(
    form,
    'Equipement_ID',
    [
      chantier.nom,
      `${chantier.adresse}, ${chantier.codePostal} ${chantier.ville}`,
      `${chantier.equipementType} ${chantier.equipementMarque} ${chantier.equipementModele}`.trim(),
      chantier.equipementNumeroSerie ? `N° série ${chantier.equipementNumeroSerie}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  )
  setText(form, 'Equipement_Fluide', draft.fluideType || chantier.fluideType)
  setText(form, 'Equipement_Charge', String(draft.quantiteTotaleKg || chantier.chargeNominaleKg || ''))
  setText(form, 'Equipement_teqCO2', draft.teqCO2 ?? chantier.teqCO2)

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
  )
  const ctrl = parseDateParts(
    draft.detecteurControleDate || draft.operateur.detecteurControleDate || '',
  )
  setText(form, 'Controle_Jour', ctrl.jour)
  setText(form, 'Controle_Mois', ctrl.mois)
  setText(form, 'Controle_Annee', ctrl.annee)

  // [6] Détection permanente
  try {
    form.getRadioGroup('Bouton_Oui').select(draft.detectionPermanente ? '1' : '2')
  } catch {
    // ignore
  }

  // [8]/[9] périodicité
  const per = (draft.periodiciteControle || '12 mois').toLowerCase()
  if (!draft.detectionPermanente) {
    check(form, 'Case_Sans_12m', per.includes('12') || per.includes('annuel'))
    check(form, 'Case_Sans_6m', per.includes('6') && !per.includes('12'))
    check(form, 'Case_Sans_3m', per.includes('3') && !per.includes('30'))
  } else {
    check(form, 'Case_Avec_24m', per.includes('24'))
    check(form, 'Case_Avec_12m', per.includes('12') || per.includes('annuel'))
    check(form, 'Case_Avec_6m', per.includes('6') && !per.includes('12') && !per.includes('24'))
  }

  // Seuils fluide (cases HFC / HFO / HCFC selon catalogue GWP)
  const charge = Number(draft.quantiteTotaleKg || chantier.chargeNominaleKg || 0)
  const fluideCode = draft.fluideType || chantier.fluideType || ''
  const seuil = cerfaSeuilFamille(fluideCode)
  if (seuil === 'HFO') {
    check(form, 'Case_HFO_1', charge >= 1 && charge < 10)
    check(form, 'Case_HFO_10', charge >= 10 && charge < 100)
    check(form, 'Case_HFO_100', charge >= 100)
  } else if (seuil === 'HCFC') {
    check(form, 'Case_HCFC_2', charge >= 2 && charge < 30)
    check(form, 'Case_HCFC_30', charge >= 30 && charge < 300)
    check(form, 'Case_HCFC_300', charge >= 300)
  } else if (seuil === 'HFC') {
    // HFC : cases à partir de 5 kg — si charge < 5, rien de coché (conforme)
    check(form, 'Case_HFC_5', charge >= 5 && charge < 50)
    check(form, 'Case_HFC_50', charge >= 50 && charge < 500)
    check(form, 'Case_HFC_500', charge >= 500)
  }

  // [10] Fuites
  check(form, 'Case_Fuite_Oui', draft.fuiteConstatee)
  check(form, 'Case_Fuite_Non', !draft.fuiteConstatee)
  if (draft.fuiteConstatee) {
    setText(form, 'Fuite_Loca_1', draft.fuiteDescription || '')
    check(form, 'Case_Rep_Fuite1_realisee', !!draft.fuiteReparee)
    check(form, 'Case_Rep_Fuite1_AFaire', draft.fuiteReparee === false)
    if (draft.fuiteLocalisation2) {
      setText(form, 'Fuite_Loca_2', draft.fuiteLocalisation2)
      check(form, 'Case_Rep_Fuite2_realisee', !!draft.fuite2Reparee)
      check(form, 'Case_Rep_Fuite2_AFaire', draft.fuite2Reparee === false)
    }
    if (draft.fuiteLocalisation3) {
      setText(form, 'Fuite_Loca_3', draft.fuiteLocalisation3)
      check(form, 'Case_Rep_Fuite3_realisee', !!draft.fuite3Reparee)
      check(form, 'Case_Rep_Fuite3_AFaire', draft.fuite3Reparee === false)
    }
  }

  // [11] Manipulation
  let qa = 0
  let qb = 0
  let qc = 0
  let qd = 0
  let contenant = ''
  let bsff = ''
  for (const m of draft.manipulations) {
    if (m.type === 'vierge') qa += m.quantiteKg || 0
    else if (m.type === 'regenere') qb += m.quantiteKg || 0
    else if (m.type === 'recuperation') qc += m.quantiteKg || 0
    else if (m.type === 'transfert') qd += m.quantiteKg || 0
    if (m.numeroContenant) contenant = m.numeroContenant
    if (m.bsffReference) bsff = m.bsffReference
  }
  const total = qa + qb + qc + qd
  if (qa) setText(form, '11_QA', qa)
  if (qb) setText(form, '11_QB', qb)
  if (qc) {
    setText(form, '11_QC', qc)
    setText(form, '11_QDE', qc)
  }
  if (qd) setText(form, '11_QD', qd)
  if (total) setText(form, '11_Quantite', total)
  setText(form, '11_Denom', draft.fluideType || chantier.fluideType)
  if (contenant) setText(form, '11_Contenant_ID', contenant)
  if (bsff) setText(form, '11_BSFF', bsff)

  // [12] UN
  const code = (draft.codeUn || '').toUpperCase()
  if (code.includes('1078')) check(form, 'Case_12_UN1078', true)
  else if (code.includes('3161')) check(form, 'Case_12_UN3161', true)
  else if (code.includes('3163') || code.includes('160504')) {
    check(form, 'Case_12_Autre160504', true)
    setText(form, 'Autre-FF-inflammable', `${draft.codeUn} ${draft.denominationAdr || ''}`.trim())
  } else if (code) {
    check(form, 'Case_12_Autre140601', true)
    setText(form, 'Autre-FF-NON-inflammable', `${draft.codeUn} ${draft.denominationAdr || ''}`.trim())
  }

  // [13] [14]
  setText(form, '13_Instal', draft.installationDestination)
  setText(form, '14_Observations', draft.observations || '')

  // Signatures — noms / qualités / dates (case « Date et signature »)
  const opNom =
    draft.signatureOperateur ||
    draft.operateur.signataireNom ||
    draft.operateur.raisonSociale
  const opQual =
    draft.signatureOperateurQualite || draft.operateur.signataireQualite || 'Opérateur attesté'
  const detNom = draft.signatureDetenteur || client.nomContact || client.raisonSociale
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
  try {
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
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

  // Signature manuscrite DANS la case « Date et signature », à droite de la date
  const page = pdfDoc.getPages()[0]
  const opImg = draft.signatureOperateurImage || draft.operateur.signatureImage
  const detImg = draft.signatureDetenteurImage

  const fieldRect = (name: string) => {
    try {
      const widgets = form.getTextField(name).acroField.getWidgets()
      return widgets[0]?.getRectangle() || null
    } catch {
      return null
    }
  }

  const drawSigInDateBox = async (dataUrl: string | undefined, fieldName: string) => {
    if (!dataUrl?.startsWith('data:image')) return
    const rect = fieldRect(fieldName)
    if (!rect) return
    try {
      const b64 = dataUrl.split(',')[1]
      if (!b64) return
      const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
      const png = await pdfDoc.embedPng(raw)

      // Partie droite de la case Date et signature (laisser la date à gauche)
      const pad = 3
      const dateSlot = Math.min(58, rect.width * 0.32)
      const sigW = rect.width - dateSlot - pad * 2
      const sigH = Math.max(rect.height + 14, 32)
      const sigX = rect.x + dateSlot + pad
      const sigY = rect.y - 2

      // Fond blanc sur la zone signature (droite de la case)
      page.drawRectangle({
        x: sigX - 1,
        y: sigY - 1,
        width: sigW + 2,
        height: sigH + 2,
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
