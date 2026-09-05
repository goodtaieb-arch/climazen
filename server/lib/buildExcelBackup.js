/**
 * Copie Excel de secours (serveur) — pas de jetons, pas de CNI, pas de signatures.
 */

import * as XLSX from 'xlsx'

function cell(v) {
  if (v == null || v === '') return ''
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'boolean') return v ? 'oui' : 'non'
  return String(v)
}

export function buildExcelBackupBuffer(payload) {
  const data = payload && typeof payload === 'object' ? payload : {}
  const op = data.operateur || {}
  const wb = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      {
        raison_sociale: cell(op.raisonSociale),
        siret: cell(op.siret),
        attestation: cell(op.attestationNumero),
        adresse: cell(op.adresse),
        telephone: cell(op.telephone),
        email: cell(op.email),
        edition: cell(data.appEdition),
        coffre: op.coffreActif ? 'actif' : '',
        note: 'PDF hors site. Pas de jeton, pas de signatures, pas de CNI.',
      },
    ]),
    'Societe',
  )

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      (data.clients || []).map((c) => ({
        id: c.id,
        nom: cell(c.nom || c.raisonSociale),
        siret: cell(c.siret),
        telephone: cell(c.telephone),
        email: cell(c.email),
      })),
    ),
    'Clients',
  )

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      (data.chantiers || []).map((s) => ({
        id: s.id,
        nom: cell(s.nom),
        clientId: cell(s.clientId),
        adresse: cell(s.adresse),
      })),
    ),
    'Sites',
  )

  const equipements = []
  for (const s of data.chantiers || []) {
    for (const e of s.equipements || []) {
      equipements.push({
        siteId: s.id,
        id: e.id,
        nom: cell(e.nom || e.designation),
        fluide: cell(e.fluide || e.typeFluide),
      })
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(equipements), 'Equipements')

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      (data.personnelDossiers || []).map((p) => ({
        userId: cell(p.userId),
        nom: cell(p.userName),
        poste: cell(p.poste),
      })),
    ),
    'Equipe',
  )

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      (data.interventions || []).map((i) => ({
        id: i.id,
        numero: cell(i.numeroIntervention),
        date: cell(i.date),
        clientId: cell(i.clientId),
        siteId: cell(i.chantierId || i.siteId),
      })),
    ),
    'Interventions',
  )

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      (data.interventions || []).map((i) => ({
        id: i.id,
        numero: cell(i.numeroIntervention),
        fluide: cell(i.fluide),
      })),
    ),
    'CERFA',
  )

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      (data.stock || []).map((s) => ({
        id: s.id,
        fluide: cell(s.fluide || s.typeFluide),
        quantiteKg: cell(s.quantiteKg),
      })),
    ),
    'StockFluides',
  )

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      (data.piecesDetachees || []).map((p) => ({
        id: p.id,
        ref: cell(p.reference),
        nom: cell(p.nom || p.designation),
        qte: cell(p.quantite),
      })),
    ),
    'Pieces',
  )

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      (data.contratsMaintenance || []).map((c) => ({
        id: c.id,
        clientId: cell(c.clientId),
        siteId: cell(c.siteId || c.chantierId),
      })),
    ),
    'Contrats',
  )

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      (data.devis || []).map((d) => ({
        id: d.id,
        numero: cell(d.numero),
        clientId: cell(d.clientId),
        total: cell(d.totalTtc || d.totalHT),
      })),
    ),
    'Devis',
  )

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      (data.commandesFournisseur || []).map((c) => ({
        id: c.id,
        numero: cell(c.numero),
        fournisseur: cell(c.fournisseur),
      })),
    ),
    'Commandes',
  )

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      (data.documentsArchives || []).map((a) => ({
        id: a.id,
        kind: cell(a.kind),
        fileName: cell(a.fileName),
        relPath: cell(a.relPath),
        archive_at: cell(a.archivedAt || a.createdAt),
      })),
    ),
    'ArchiveDocs',
  )

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}
