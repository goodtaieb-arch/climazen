/**
 * Copie Excel de secours — toutes les données métier (sans PDF, sans jetons, sans CNI).
 * Si le site disparaît, on reconstitue une société comme une migration.
 */

import * as XLSX from 'xlsx'
import type { AppData } from './types'
import { clientDisplayName } from './types'
import { COPIE_SECOURS_RELPATH, putDocumentExterne } from './documentArchive'
import type { OperateurDocsStockage } from './docStockage'
import { formatOtNumero, isOtCloture } from './ordreTravail'

export const COPIE_SECOURS_SHEETS = [
  'Societe',
  'Clients',
  'Sites',
  'Equipements',
  'Equipe',
  'Interventions',
  'CERFA',
  'StockFluides',
  'Pieces',
  'Contrats',
  'Devis',
  'Commandes',
  'ArchiveDocs',
] as const

function cell(v: unknown): string | number {
  if (v == null || v === '') return ''
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'boolean') return v ? 'oui' : 'non'
  return String(v)
}

export function buildCopieSecoursWorkbook(data: AppData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  const op = data.operateur || ({} as AppData['operateur'])
  const clientsById = new Map((data.clients || []).map((c) => [c.id, c]))
  const sitesById = new Map((data.chantiers || []).map((s) => [s.id, s]))

  const societe = [
    {
      raison_sociale: cell(op.raisonSociale),
      siret: cell(op.siret),
      attestation: cell(op.attestationNumero),
      adresse: cell(op.adresse),
      telephone: cell(op.telephone),
      email: cell(op.email),
      edition: cell(data.appEdition),
      coffre_nas: op.serveurPriveDocsUrl ? 'configure' : '',
      note:
        'PDF hors site (NAS). Pas de jeton, pas de signatures, pas de CNI. Régénérer via import / saisie.',
    },
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(societe), 'Societe')

  const clients = (data.clients || []).map((c) => ({
    id: c.id,
    type: cell(c.typeClient || 'entreprise'),
    raison_sociale: cell(clientDisplayName(c)),
    nom: cell(c.nom),
    prenom: cell(c.prenom),
    contact: cell(c.nomContact),
    adresse: cell(c.adresse),
    code_postal: cell(c.codePostal),
    ville: cell(c.ville),
    telephone: cell(c.telephone),
    email: cell(c.email),
    siret: cell(c.siret),
    agence: cell(c.agenceCode),
    notes: cell(c.notes),
    created_at: cell(c.createdAt),
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clients), 'Clients')

  const sites = (data.chantiers || []).map((s) => {
    const client = clientsById.get(s.clientId)
    return {
      id: s.id,
      client_id: s.clientId,
      client: cell(client ? clientDisplayName(client) : ''),
      nom: cell(s.nom),
      adresse: cell(s.adresse),
      code_postal: cell(s.codePostal),
      ville: cell(s.ville),
      statut: cell(s.statut),
      mode_gestion: cell(s.modeGestion),
      type_travaux: cell(s.typeTravaux),
      fluide: cell(s.fluideType),
      charge_kg: cell(s.chargeNominaleKg),
      created_at: cell(s.createdAt),
    }
  })
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sites), 'Sites')

  const equipements: Record<string, unknown>[] = []
  for (const s of data.chantiers || []) {
    const client = clientsById.get(s.clientId)
    const eqs = s.equipements?.length
      ? s.equipements
      : [
          {
            id: `${s.id}-eq`,
            nom: s.nom,
            type: s.equipementType,
            marque: s.equipementMarque,
            modele: s.equipementModele,
            numeroSerie: s.equipementNumeroSerie,
            fluideType: s.fluideType,
            chargeNominaleKg: s.chargeNominaleKg,
            detectionPermanente: s.detectionPermanente,
          },
        ]
    for (const e of eqs) {
      equipements.push({
        site_id: s.id,
        site: cell(s.nom),
        client: cell(client ? clientDisplayName(client) : ''),
        equipement_id: e.id,
        nom: cell(e.nom),
        type: cell(e.type),
        marque: cell(e.marque),
        modele: cell(e.modele),
        serie: cell(e.numeroSerie),
        fluide: cell(e.fluideType),
        charge_kg: cell(e.chargeNominaleKg),
        detection_permanente: cell(e.detectionPermanente),
      })
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(equipements), 'Equipements')

  const equipe = (data.personnelDossiers || []).map((d) => ({
    user_id: d.userId,
    nom: cell(d.userName),
    poste: cell(d.poste),
    telephone: cell(d.telephone),
    agence: cell(d.agenceCode),
    froid: cell(d.toucheFroid),
    elec: cell(d.toucheElectricite),
    conduit: cell(d.conduitVehicule),
    notes: cell(d.notes),
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(equipe), 'Equipe')

  const ints = (data.ordresTravail || []).map((o) => {
    const client = o.clientId ? clientsById.get(o.clientId) : undefined
    const site = o.chantierId ? sitesById.get(o.chantierId) : undefined
    return {
      id: o.id,
      numero: formatOtNumero(o.numero),
      date: cell(o.date),
      type: cell(o.typeOt),
      action: cell(o.action),
      statut: cell(o.statut),
      cloture: isOtCloture(o.statut) ? 'oui' : '',
      client: cell(client ? clientDisplayName(client) : ''),
      site: cell(site?.nom),
      technicien: cell(o.technicien),
      rapport: cell(o.rapportAction),
    }
  })
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ints), 'Interventions')

  const cerfa = (data.interventions || []).map((i) => {
    const client = clientsById.get(i.clientId)
    const site = sitesById.get(i.chantierId)
    return {
      id: i.id,
      numero: cell(i.numeroIntervention),
      date: cell(i.dateIntervention),
      client: cell(client ? clientDisplayName(client) : ''),
      site: cell(site?.nom),
      fluide: cell(i.fluideType),
      kg: cell(i.quantiteTotaleKg),
      natures: (i.natures || []).join(', '),
      pdf_fichier: cell(i.cerfaPdfFileName),
    }
  })
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cerfa), 'CERFA')

  const stock = (data.stock || []).map((s) => ({
    id: s.id,
    fluide: cell(s.fluide),
    type: cell(s.contenantType),
    numero: cell(s.numeroContenant),
    kg: cell(s.quantiteKg),
    surnom: cell(s.surnom),
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stock), 'StockFluides')

  const pieces = (data.piecesDetachees || []).map((p) => ({
    id: p.id,
    reference: cell(p.reference),
    designation: cell(p.designation),
    quantite: cell(p.quantite),
    unite: cell(p.unite),
    emplacement: cell(p.emplacement),
    marque: cell(p.marque),
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pieces), 'Pieces')

  const contrats = (data.contratsMaintenance || []).map((c) => {
    const client = clientsById.get(c.clientId)
    return {
      id: c.id,
      numero: cell(c.numero),
      titre: cell(c.titre),
      client: cell(client ? clientDisplayName(client) : ''),
      statut: cell(c.statut),
      debut: cell(c.dateDebut),
      fin: cell(c.dateFin),
      visites: cell(c.visitesParAn),
    }
  })
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(contrats), 'Contrats')

  const devis = (data.devis || []).map((d) => {
    const client = clientsById.get(d.clientId)
    return {
      id: d.id,
      numero: cell(d.numero),
      client: cell(client ? clientDisplayName(client) : ''),
      statut: cell(d.statut),
      libelle: cell(d.libelle),
      ht: cell(d.montantHt),
    }
  })
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(devis), 'Devis')

  const commandes = (data.commandesFournisseur || []).map((c) => ({
    id: c.id,
    numero: cell(c.numero),
    fournisseur: cell(c.fournisseur),
    statut: cell(c.statut),
    destination: cell(c.destination),
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(commandes), 'Commandes')

  const archives = (data.documentsArchives || []).map((a) => ({
    id: a.id,
    type: cell(a.kind),
    fichier: cell(a.fileName),
    chemin_nas: cell(a.relPath),
    intervention_id: cell(a.interventionId),
    devis_id: cell(a.devisId),
    commande_id: cell(a.commandeId),
    archive_at: cell(a.archivedAt || a.createdAt),
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(archives), 'ArchiveDocs')

  return wb
}

export function buildCopieSecoursExcelBlob(data: AppData): Blob {
  const wb = buildCopieSecoursWorkbook(data)
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

export function copieSecoursSheetNames(data: AppData): string[] {
  return buildCopieSecoursWorkbook(data).SheetNames
}

export async function mettreAJourCopieSecours(opts: {
  data: AppData
  operateur?: OperateurDocsStockage | null
}): Promise<{ ok: boolean; message: string; blob: Blob }> {
  const blob = buildCopieSecoursExcelBlob(opts.data)
  const put = await putDocumentExterne({
    operateur: opts.operateur || opts.data.operateur,
    relPath: COPIE_SECOURS_RELPATH,
    blob,
  })
  return {
    ok: put.ok,
    message: put.ok
      ? `Copie Excel à jour hors site (${COPIE_SECOURS_RELPATH}).`
      : put.message,
    blob,
  }
}
