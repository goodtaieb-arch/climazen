/**
 * Actions terrain Assistant IA — détecteur, bouteille, fiche maintenance.
 * Confirmation « oui » puis création ; le technicien valide ensuite.
 */

import type { AppData, ContenantType, DetecteurManuel, StockItem } from './types'
import { blankFicheMaintenanceClim } from './ficheMaintenanceClim'
import { clientDisplayName } from './types'
import { allEquipements } from './cerfaBatch'

function normalize(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** « 15/03/26 » / « 15/03/2026 » / « 2026-03-15 » → YYYY-MM-DD */
export function parseFrDate(raw: string): string | null {
  const t = (raw || '').trim()
  if (!t) return null
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const fr = t.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})$/)
  if (!fr) return null
  let y = Number(fr[3])
  if (y < 100) y += 2000
  const m = String(Number(fr[2])).padStart(2, '0')
  const d = String(Number(fr[1])).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export type TerrainActionKind = 'detecteur' | 'bouteille' | 'fiche_maintenance'

export type PendingTerrainAction =
  | {
      kind: 'detecteur'
      identification: string
      controleDate: string
      summary: string
    }
  | {
      kind: 'bouteille'
      numeroContenant: string
      fluide: string
      contenantType: ContenantType
      quantiteKg: number
      capaciteMaxKg?: number
      surnom?: string
      summary: string
    }
  | {
      kind: 'fiche_maintenance'
      clientQuery: string
      siteQuery: string
      equipQuery: string
      summary: string
    }

export function parseTerrainIntent(text: string): PendingTerrainAction | null {
  const raw = (text || '').trim()
  const n = normalize(raw)
  if (!raw) return null

  // Détecteur
  if (/detecteur|detecteur de fuite|detecteur fuite/.test(n)) {
    const idMatch =
      raw.match(
        /(?:nom|n[°o]|numero|numéro|ref|réf\.?|identification)\s*[:=]?\s*([A-Za-z0-9][A-Za-z0-9\s\-_/]{1,40})/i,
      ) ||
      raw.match(
        /detecteur(?:\s+de\s+fuite)?\s+(?:nom\s+)?([A-Za-z0-9][A-Za-z0-9\s\-_/]{1,40}?)(?:\s*,|\s+valid|\s+date|\s*$)/i,
      )
    let identification = (idMatch?.[1] || '').trim().replace(/\s+/g, ' ')
    // Enlever « validité… » collé
    identification = identification.replace(/\s*(validit[eé]|date).*$/i, '').trim()
    if (!identification || identification.length < 2) {
      // ex. « détecteur 3 XXXX3 »
      const loose = raw.match(/detecteur(?:\s+de\s+fuite)?\s+(.+)/i)
      if (loose?.[1]) {
        identification = loose[1]
          .replace(/\s*(validit[eé]|date|,).*$/i, '')
          .replace(/^(nom|avec)\s+/i, '')
          .trim()
      }
    }
    const dateRaw =
      raw.match(/(?:validit[eé]|date|controle|contrôle)\s*[:=]?\s*([0-9./\-]{6,10})/i)?.[1] ||
      raw.match(/\b(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4})\b/)?.[1] ||
      ''
    const controleDate = parseFrDate(dateRaw) || ''
    if (!identification) return null
    return {
      kind: 'detecteur',
      identification,
      controleDate,
      summary: [
        `Je peux ajouter le détecteur de fuite :`,
        `• Identification : ${identification}`,
        controleDate ? `• Date de validité / contrôle : ${controleDate}` : `• Date : à compléter`,
        ``,
        `Répondez « oui » pour créer, ou « non » pour annuler.`,
      ].join('\n'),
    }
  }

  // Bouteille / stock
  if (
    /\bbouteille\b|\bstock\b|remplir\s+(la\s+)?bouteille|ajoute\s+(une\s+)?bouteille|creer\s+(une\s+)?bouteille|cr[eé]e\s+(une\s+)?bouteille/.test(
      n,
    )
  ) {
    const fluide =
      raw.match(/\b(R-?\d{2,4}[A-Za-z]?)\b/i)?.[1]?.toUpperCase().replace(/^R/, 'R-').replace(/R--/, 'R-') ||
      ''
    const fluideNorm = fluide.replace(/^R-?/, 'R-')
    let contenantType: ContenantType = 'transfert'
    if (/recup|récup|dechet|déchet/.test(n)) contenantType = 'recuperation'
    else if (/vierge|neuve/.test(n)) contenantType = 'vierge'
    else if (/recycl/.test(n)) contenantType = 'recycle'
    else if (/regen|régén/.test(n)) contenantType = 'regenere'
    else if (/service|transfert/.test(n)) contenantType = 'transfert'

    const numero =
      raw.match(
        /(?:n[°o]|numero|numéro|serie|série|contenant)\s*[:=]?\s*([A-Za-z0-9][A-Za-z0-9\-_/]{1,30})/i,
      )?.[1] ||
      raw.match(/\b([A-Z]{2,}[-_]?\d{2,}[A-Za-z0-9\-_]*)\b/)?.[1] ||
      `BOT-${Date.now().toString(36).slice(-6).toUpperCase()}`

    const kgMatch = raw.match(/(\d+(?:[.,]\d+)?)\s*kg/i)
    const quantiteKg = kgMatch ? Number(kgMatch[1].replace(',', '.')) : 0
    const capMatch = raw.match(/(?:capacite|capacité)\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i)
    const capaciteMaxKg = capMatch ? Number(capMatch[1].replace(',', '.')) : undefined
    const surnom = raw.match(/(?:surnom|libelle|libellé)\s*[:=]?\s*([A-Za-z0-9][A-Za-z0-9\s\-_]{1,40})/i)?.[1]

    return {
      kind: 'bouteille',
      numeroContenant: numero.trim(),
      fluide: fluideNorm === 'R-' ? '' : fluideNorm,
      contenantType,
      quantiteKg,
      capaciteMaxKg,
      surnom: surnom?.trim(),
      summary: [
        `Je peux ajouter une bouteille au stock :`,
        `• N° contenant : ${numero.trim()}`,
        `• Type : ${contenantType}`,
        fluideNorm && fluideNorm !== 'R-' ? `• Fluide : ${fluideNorm}` : `• Fluide : à préciser`,
        `• Quantité : ${quantiteKg} kg`,
        capaciteMaxKg != null ? `• Capacité max : ${capaciteMaxKg} kg` : null,
        ``,
        `Répondez « oui » pour créer, ou « non » pour annuler.`,
      ]
        .filter(Boolean)
        .join('\n'),
    }
  }

  // Fiche maintenance
  if (/fiche\s+maintenance|fiche\s+clim|checklist\s+maint/.test(n)) {
    const clientQuery =
      raw.match(/(?:mr|m\.|monsieur|mme|madame|client|pour)\s+([A-Za-zÀ-ÿ0-9'’\-]+)/i)?.[1] || ''
    const siteQuery =
      raw.match(/site\s+(?:de\s+|du\s+)?(.+?)(?:\s+pour\b|\s+equip|\s+fiche|\s*$)/i)?.[1]?.trim() ||
      ''
    const equipQuery =
      raw.match(/equipement\s+(.+?)(?:\s*$)/i)?.[1]?.trim() ||
      raw.match(/(clim(?:atisation)?\s+\w+)/i)?.[1]?.trim() ||
      ''
    return {
      kind: 'fiche_maintenance',
      clientQuery,
      siteQuery,
      equipQuery,
      summary: [
        `Je peux créer une fiche maintenance clim :`,
        clientQuery ? `• Client : ${clientQuery}` : `• Client : (à préciser ou premier du parc)`,
        siteQuery ? `• Site : ${siteQuery}` : `• Site : (à préciser)`,
        equipQuery ? `• Équipement : ${equipQuery}` : `• Équipement : optionnel`,
        ``,
        `Répondez « oui » pour créer, ou « non » pour annuler.`,
      ].join('\n'),
    }
  }

  return null
}

export type TerrainDeps = {
  data: AppData
  userId?: string
  userName?: string
  upsertDetecteur: (
    d: Omit<DetecteurManuel, 'id' | 'updatedAt'> & { id?: string },
  ) => Promise<string>
  upsertStock: (s: Omit<StockItem, 'id' | 'updatedAt'> & { id?: string }) => string
  upsertFicheMaintenanceClim: (
    f: Omit<import('./ficheMaintenanceClim').FicheMaintenanceClim, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string
    },
  ) => string
}

export async function executeTerrainAction(
  action: PendingTerrainAction,
  deps: TerrainDeps,
): Promise<{ message: string; navigateTo: string }> {
  if (action.kind === 'detecteur') {
    await deps.upsertDetecteur({
      identification: action.identification,
      controleDate: action.controleDate,
      assigneeUserId: deps.userId,
      assigneeName: deps.userName,
    })
    return {
      message: `Détecteur « ${action.identification} » ajouté${
        action.controleDate ? ` (validité ${action.controleDate})` : ''
      }. Vérifiez-le dans Entreprise / Profil.`,
      navigateTo: '/app/operateur',
    }
  }

  if (action.kind === 'bouteille') {
    const id = deps.upsertStock({
      fluide: action.fluide,
      contenantType: action.contenantType,
      numeroContenant: action.numeroContenant,
      surnom: action.surnom,
      quantiteKg: action.quantiteKg,
      quantiteInitialeKg: action.quantiteKg,
      capaciteMaxKg: action.capaciteMaxKg,
      emplacement: 'vehicule',
    })
    return {
      message: `Bouteille ${action.numeroContenant} ajoutée au stock. Complétez fluide / kg si besoin.`,
      navigateTo: `/app/stock?highlight=${encodeURIComponent(id)}`,
    }
  }

  // fiche
  const clients = deps.data.clients || []
  const sites = deps.data.chantiers || []
  const qClient = normalize(action.clientQuery)
  const client =
    clients.find((c) => normalize(clientDisplayName(c)).includes(qClient) && qClient) ||
    clients[0]
  const qSite = normalize(action.siteQuery)
  const siteList = client ? sites.filter((s) => s.clientId === client.id) : sites
  const site =
    siteList.find((s) => normalize(s.nom).includes(qSite) && qSite) || siteList[0]
  const eqs = site ? allEquipements(site) : []
  const qEq = normalize(action.equipQuery)
  const equip =
    eqs.find((e) => normalize(e.nom || e.type).includes(qEq) && qEq) || eqs[0]

  const base = blankFicheMaintenanceClim()
  const ficheId = deps.upsertFicheMaintenanceClim({
    ...base,
    date: new Date().toISOString().slice(0, 10),
    technicien: deps.userName || '',
    clientId: client?.id || '',
    chantierId: site?.id || '',
    equipementId: equip?.id,
    clientNom: client ? clientDisplayName(client) : '',
    adresse: site ? [site.adresse, site.codePostal, site.ville].filter(Boolean).join(', ') : '',
    marqueModele: equip
      ? [equip.marque, equip.modele].filter(Boolean).join(' / ') || equip.nom || equip.type
      : '',
    numeroSerie: equip?.numeroSerie || '',
    fluide: equip?.fluideType || '',
    quantiteFluideKg: equip?.chargeNominaleKg || null,
  })

  return {
    message: `Fiche maintenance créée${site ? ` — ${site.nom}` : ''}. Complétez la checklist puis signez.`,
    navigateTo: `/app/fiche-maintenance-clim?id=${encodeURIComponent(ficheId)}`,
  }
}
