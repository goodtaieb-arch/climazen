/**
 * Actions terrain Assistant IA — détecteur, bouteille, fiche maintenance, agenda.
 * Confirmation « oui » puis création ; le technicien valide ensuite.
 */

import type { AgendaEvent, AgendaEventType } from './agenda'
import { AGENDA_TYPE_LABELS, addDaysToIso, todayIsoLocal } from './agenda'
import type { AppData, ContenantType, DetecteurManuel, Equipement, Site, StockItem } from './types'
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

/** aujourd’hui / demain / après-demain / date FR → YYYY-MM-DD */
export function parseAgendaDate(text: string): string | null {
  const n = normalize(text)
  const today = todayIsoLocal()
  if (/\baujourd ?hui\b/.test(n)) return today
  if (/\bapres[\s-]?demain\b/.test(n)) return addDaysToIso(today, 2)
  if (/\bdemain\b/.test(n)) return addDaysToIso(today, 1)
  const fr =
    text.match(/\b(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4})\b/)?.[1] ||
    text.match(/\ble\s+(\d{1,2}[./\-]\d{1,2}(?:[./\-]\d{2,4})?)\b/i)?.[1] ||
    ''
  if (fr) {
    const full = fr.includes('/') || fr.includes('.') || fr.includes('-')
      ? fr.match(/^\d{1,2}[./\-]\d{1,2}$/)
        ? `${fr}/${new Date().getFullYear()}`
        : fr
      : fr
    const parsed = parseFrDate(full)
    if (parsed) return parsed
  }
  // « le 20/08 » déjà couvert ; « le 20 aout » non géré
  return null
}

/** 14h / 14h30 / 14:30 / à 9 h → HH:mm */
export function parseAgendaHeure(text: string): string | undefined {
  const m =
    text.match(/\b(\d{1,2})\s*[h:]\s*(\d{2})\b/i) ||
    text.match(/\b(\d{1,2})\s*h\b/i) ||
    text.match(/\ba\s+(\d{1,2})\s*h(?:\s*(\d{2}))?\b/i)
  if (!m) return undefined
  const h = Math.min(23, Math.max(0, Number(m[1])))
  const min = m[2] != null ? Math.min(59, Math.max(0, Number(m[2]))) : 0
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function detectAgendaType(n: string): AgendaEventType {
  if (/pause\s*(repas|dej|dejeuner)|pause\s*midi/.test(n)) return 'pause_repas'
  if (/\bformation\b/.test(n)) return 'formation'
  if (/rdv\s*garage|controle\s*technique/.test(n)) return 'rdv_garage'
  if (/\bfournisseur\b/.test(n)) return 'fournisseur'
  if (/bureau\s*\/?\s*atelier|\batelier\b/.test(n)) return 'bureau_atelier'
  if (/deplacement\s+hors/.test(n)) return 'deplacement_hors_ot'
  if (/rappel\s+appel|appeler\s+le\s+client|rappel\s+client/.test(n)) return 'rappel_appel'
  if (/controle\s+d?[' ]?etancheite|etancheite/.test(n)) return 'controle_etancheite'
  if (/\bmaintenance\b|\bentretien\b/.test(n)) return 'maintenance'
  if (/\brdv\b|rendez[\s-]?vous|intervention|visite/.test(n)) return 'rdv'
  return 'rdv'
}

export type TerrainActionKind =
  | 'detecteur'
  | 'bouteille'
  | 'fiche_maintenance'
  | 'agenda'
  | 'client'
  | 'equipements'

export type PendingTerrainAction =
  | {
      kind: 'client'
      typeClient: 'particulier' | 'entreprise'
      raisonSociale: string
      nom: string
      prenom: string
      telephone: string
      email: string
      adresse: string
      codePostal: string
      ville: string
      summary: string
    }
  | {
      kind: 'equipements'
      clientQuery: string
      siteQuery: string
      equips: { nom: string; type?: string }[]
      summary: string
    }
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
  | {
      kind: 'agenda'
      title: string
      date: string
      heure?: string
      type: AgendaEventType
      clientQuery: string
      siteQuery: string
      notes?: string
      summary: string
    }

const LOC_LABELS: { re: RegExp; label: string }[] = [
  { re: /\bsalon\b/i, label: 'Salon' },
  { re: /\bchambre(?:\s*\d+)?\b/i, label: 'Chambre' },
  { re: /\bcuisine\b/i, label: 'Cuisine' },
  { re: /\bbureau\b/i, label: 'Bureau' },
  { re: /\bs[eé]jour\b/i, label: 'Séjour' },
  { re: /\bgarage\b/i, label: 'Garage' },
  { re: /\bcave\b/i, label: 'Cave' },
  { re: /\bterrasse\b/i, label: 'Terrasse' },
  { re: /\bcombles?\b/i, label: 'Combles' },
  { re: /\brdc\b|rez[\s-]?de[\s-]?chauss/i, label: 'RDC' },
  { re: /\b[eé]tage\s*(\d+)?\b/i, label: 'Étage' },
]

/** Extrait les pièces / emplacements mentionnés (salon, chambre…). */
export function extractEquipLocations(raw: string): string[] {
  const found: string[] = []
  const seen = new Set<string>()
  for (const { re, label } of LOC_LABELS) {
    const m = raw.match(re)
    if (!m) continue
    let loc = label
    if (/chambre/i.test(m[0]) && /\d/.test(m[0])) {
      loc = m[0].replace(/^\w/, (c) => c.toUpperCase())
    }
    if (/[eé]tage/i.test(m[0])) {
      loc = m[0].replace(/[eé]/i, 'É').replace(/^\w/, (c) => c.toUpperCase())
    }
    const key = normalize(loc)
    if (seen.has(key)) continue
    seen.add(key)
    found.push(loc)
  }
  // Ordre d’apparition dans la phrase
  const ordered: string[] = []
  const lower = raw.toLowerCase()
  for (const loc of found) {
    const idx = lower.indexOf(normalize(loc).slice(0, 4))
    ordered.push(loc)
    void idx
  }
  // Tri par position dans le texte
  return found
    .map((loc) => ({
      loc,
      idx: lower.search(new RegExp(normalize(loc).replace(/[ée]/g, '[eé]'), 'i')),
    }))
    .sort((a, b) => a.idx - b.idx)
    .map((x) => x.loc)
}

function detectEquipBaseName(raw: string, n: string): { nom: string; type: string } {
  if (/clim\s*monobloc|monobloc/.test(n)) {
    return { nom: 'Clim monobloc', type: 'Climatisation' }
  }
  if (/\bsplit\b/.test(n)) return { nom: 'Clim split', type: 'Climatisation' }
  if (/\bpac\b|pompe\s+a\s+chaleur/.test(n)) return { nom: 'PAC', type: 'PAC' }
  if (/climati|clim\b/.test(n)) return { nom: 'Climatisation', type: 'Climatisation' }
  const m = raw.match(
    /(?:equipement|équipement)\s+([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9\s\-_/]{1,40}?)(?:\s+au\s+|\s+dans\s+|\s+pour\s+|\s*$)/i,
  )
  if (m?.[1]) return { nom: m[1].trim(), type: '' }
  return { nom: 'Équipement', type: '' }
}

function parseCreateEquipementsIntent(raw: string, n: string): PendingTerrainAction | null {
  if (/\bot\b|ordre\s+de\s+travail|\bcerfa\b|controle\s+d?[' ]?etancheite/.test(n)) {
    return null
  }

  const locs = extractEquipLocations(raw)
  let base = detectEquipBaseName(raw, n)
  if (base.nom === 'Équipement' && locs.length >= 2) {
    base = { nom: 'Clim monobloc', type: 'Climatisation' }
  }
  const mentionsEquip = /clim|monobloc|split|pac|equipement|climati/.test(n)
  const wantsAdd =
    /(?:ajoute|ajouter|creer|cree|installe|mettre|mets)\s+(?:des?\s+|les?\s+|une?\s+|deux\s+|2\s+)?/.test(
      n,
    ) || /(?:deux|2|plusieurs)\s+(?:clim|equipement|monobloc)/.test(n)
  const multiLoc = locs.length >= 2
  const twoClim = /(?:deux|2)\s+(?:clim|equipement|monobloc)/.test(n)
  const premiereDeuxieme =
    /(?:premier|premiere|1er|1ere|deuxieme|2e|2eme|l[' ]autre)/.test(n) && locs.length >= 1

  if (!mentionsEquip && !multiLoc) return null
  if (!(wantsAdd || multiLoc || twoClim || premiereDeuxieme)) return null
  if (!multiLoc && !twoClim && !(wantsAdd && mentionsEquip && locs.length >= 1)) {
    // Une seule pièce + « ajoute clim » → 1 équipement OK
    if (!(wantsAdd && mentionsEquip && locs.length === 1)) return null
  }

  let locations = locs
  if (locations.length === 0 && twoClim) {
    locations = ['1', '2']
  }
  if (locations.length === 1 && twoClim) {
    locations = [locations[0], '2']
  }

  const equips: { nom: string; type?: string }[] = locations.map((loc) => {
    const suffix = loc === '1' || loc === '2' ? `#${loc}` : loc
    return {
      nom: `${base.nom} — ${suffix}`,
      type: base.type || (/clim|monobloc|split/i.test(base.nom) ? 'Climatisation' : ''),
    }
  })

  if (equips.length === 0) {
    equips.push({
      nom: base.nom,
      type: base.type || 'Climatisation',
    })
  }

  const clientQuery =
    raw.match(
      /(?:chez|pour|client)\s+(?:mr|m\.|monsieur|mme|madame)\s+([A-Za-zÀ-ÿ0-9'’\-]+)/i,
    )?.[1] ||
    raw.match(/(?:mr|m\.|monsieur|mme|madame)\s+([A-Za-zÀ-ÿ0-9'’\-]+)/i)?.[1] ||
    ''
  const siteQuery =
    raw.match(/site\s+(?:de\s+|du\s+)?([A-Za-zÀ-ÿ0-9'’\-\s]{2,40}?)(?:\s+clim|\s+equip|\s*$)/i)?.[1]
      ?.trim() || ''

  return {
    kind: 'equipements',
    clientQuery,
    siteQuery,
    equips,
    summary: [
      `Je peux créer ${equips.length} équipement${equips.length > 1 ? 's' : ''} :`,
      ...equips.map((e, i) => `${i + 1}. ${e.nom}`),
      clientQuery ? `• Client : ${clientQuery}` : `• Client : (site / client du contexte)`,
      siteQuery ? `• Site : ${siteQuery}` : null,
      ``,
      `Rien n’est encore enregistré. Répondez « oui » pour créer les ${equips.length}, ou « non » pour annuler.`,
    ]
      .filter(Boolean)
      .join('\n'),
  }
}

/** Nettoie un e-mail dicté (« good tayeb@gmail.com » → goodtayeb@gmail.com). */
export function normalizeSpokenEmail(raw: string): string {
  let e = (raw || '').trim().toLowerCase()
  e = e.replace(/\s*@\s*/g, '@').replace(/\s*\.\s*/g, '.')
  // Espaces dans la partie locale (avant @)
  const at = e.indexOf('@')
  if (at > 0) {
    e = e.slice(0, at).replace(/\s+/g, '') + e.slice(at).replace(/\s+/g, '')
  } else {
    e = e.replace(/\s+/g, '')
  }
  return e
}

/** Téléphone dicté → chiffres (+ éventuel +33). */
export function normalizeSpokenPhone(raw: string): string {
  let t = (raw || '').trim()
  t = t.replace(/[^\d+]/g, '')
  if (t.startsWith('0033')) t = '+33' + t.slice(4)
  if (t.startsWith('+33') && t.length > 3) {
    const rest = t.slice(3).replace(/^0/, '')
    return '0' + rest
  }
  return t
}

function parseCreateClientIntent(raw: string, n: string): PendingTerrainAction | null {
  const wants =
    /(?:creer|cree|ajouter|ajoute)\s+(un\s+|une\s+)?(nouveau\s+|nouvelle\s+)?client/.test(n) ||
    /nouveau\s+client\b/.test(n) ||
    /enregistre\s+(un\s+)?client/.test(n)
  if (!wants) return null
  // Ne pas voler une demande OT/CERFA
  if (/\bot\b|ordre\s+de\s+travail|\bcerfa\b|intervention|controle\s+d?[' ]?etancheite/.test(n)) {
    return null
  }

  const isParticulier = /(?:mr|m\.|monsieur|mme|madame)\s+/.test(n)
  let prenom = ''
  let nom = ''
  let raisonSociale = ''

  const civ =
    raw.match(
      /(?:mr|m\.|monsieur|mme|madame)\s+([A-Za-zÀ-ÿ'’-]+)(?:\s+([A-Za-zÀ-ÿ'’-]+))?/i,
    ) || null
  if (civ) {
    prenom = (civ[1] || '').trim()
    nom = (civ[2] || '').trim()
    // Si un seul mot après Monsieur, c’est le nom
    if (!nom && prenom) {
      nom = prenom
      prenom = ''
    }
  }

  if (!isParticulier || (!nom && !prenom)) {
    const after =
      raw.match(
        /(?:nouveau\s+)?client\s+(?:entreprise\s+|sarl\s+|sas\s+)?(.+?)(?:\s+num[eé]ro|\s+tel|\s+t[eé]l|\s+mail|\s+e-?mail|\s+adresse|\s*$)/i,
      )?.[1] || ''
    const cleaned = after
      .replace(/^(mr|m\.|monsieur|mme|madame)\s+/i, '')
      .trim()
    if (cleaned) {
      if (isParticulier) {
        const parts = cleaned.split(/\s+/).filter(Boolean)
        if (parts.length >= 2) {
          prenom = parts[0]
          nom = parts.slice(1).join(' ')
        } else {
          nom = cleaned
        }
      } else {
        raisonSociale = cleaned
      }
    }
  }

  if (isParticulier && prenom && !nom) {
    // « Monsieur Albert Dupont » déjà géré ; sinon nom seul
  }

  const telRaw =
    raw.match(
      /(?:num[eé]ro\s+(?:de\s+)?(?:t[eé]l[eé]phone)?|t[eé]l[eé]phone|t[eé]l\.?)\s*[:=]?\s*((?:\+?\d[\d\s.]{7,16}))/i,
    )?.[1] ||
    raw.match(/\b(0\d(?:[\s.]?\d{2}){4})\b/)?.[1] ||
    ''
  const telephone = normalizeSpokenPhone(telRaw)

  const emailRaw =
    raw.match(
      /(?:e-?mail|mail|courriel)\s*[:=]?\s*([A-Za-z0-9._%+\-\s]+@[A-Za-z0-9.\-\s]+\.[A-Za-z]{2,})/i,
    )?.[1] || ''
  const email = normalizeSpokenEmail(emailRaw)

  const addrBlock =
    raw.match(/(?:adresse)\s*[:=]?\s*(.+)$/i)?.[1]?.trim() ||
    raw.match(/\b(\d{1,4}\s*,?\s*rue\s+.+)$/i)?.[1]?.trim() ||
    ''
  let adresse = ''
  let codePostal = ''
  let ville = ''
  if (addrBlock) {
    const cpVille = addrBlock.match(/^(.*?)\s+(\d{5})\s+([A-Za-zÀ-ÿ'’\-\s]+)$/i)
    if (cpVille) {
      adresse = cpVille[1].replace(/,\s*$/, '').trim()
      codePostal = cpVille[2]
      ville = cpVille[3].trim()
    } else {
      adresse = addrBlock
    }
  }

  if (isParticulier) {
    if (!nom && !prenom) return null
    raisonSociale = [prenom, nom].filter(Boolean).join(' ')
  } else if (!raisonSociale.trim()) {
    return null
  }

  const typeClient = isParticulier ? 'particulier' : 'entreprise'
  const label =
    typeClient === 'particulier'
      ? [prenom, nom].filter(Boolean).join(' ')
      : raisonSociale

  return {
    kind: 'client',
    typeClient,
    raisonSociale: typeClient === 'entreprise' ? raisonSociale : raisonSociale || label,
    nom: typeClient === 'particulier' ? nom : '',
    prenom: typeClient === 'particulier' ? prenom : '',
    telephone,
    email,
    adresse,
    codePostal,
    ville,
    summary: [
      `Je peux créer le client :`,
      `• ${typeClient === 'particulier' ? 'Particulier' : 'Entreprise'} : ${label}`,
      telephone ? `• Téléphone : ${telephone}` : `• Téléphone : (non détecté)`,
      email ? `• E-mail : ${email}` : `• E-mail : (non détecté)`,
      adresse || codePostal || ville
        ? `• Adresse : ${[adresse, codePostal, ville].filter(Boolean).join(', ')}`
        : `• Adresse : (à compléter)`,
      ``,
      `Répondez « oui » pour créer, ou « non » pour annuler.`,
    ].join('\n'),
  }
}

export function parseTerrainIntent(text: string): PendingTerrainAction | null {
  const raw = (text || '').trim()
  const n = normalize(raw)
  if (!raw) return null

  // Client (avant les autres : « créer un client » ne doit pas partir en Gemini)
  const clientIntent = parseCreateClientIntent(raw, n)
  if (clientIntent) return clientIntent

  // Plusieurs équipements (salon / chambre…)
  const equipsIntent = parseCreateEquipementsIntent(raw, n)
  if (equipsIntent) return equipsIntent

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

  // Agenda / RDV / rappel
  if (
    /\bagenda\b|\bcalendrier\b|\brdv\b|rendez[\s-]?vous|\bplanifie\b|\bprogramme\b|rappel\s+appel|ajoute\s+(un\s+)?(rdv|rappel|visite)|cree\s+(un\s+)?(rdv|rappel|visite)|cr[eé]e\s+(un\s+)?(rdv|rappel|visite)/.test(
      n,
    )
  ) {
    const type = detectAgendaType(n)
    const date = parseAgendaDate(raw) || todayIsoLocal()
    const heure = parseAgendaHeure(raw)
    const clientQuery =
      raw.match(/(?:mr|m\.|monsieur|mme|madame|client|pour)\s+([A-Za-zÀ-ÿ0-9'’\-]+)/i)?.[1] || ''
    const siteQuery =
      raw
        .match(
          /site\s+(?:de\s+|du\s+)?(.+?)(?:\s+le\s+\d|\s+a\s+\d|\s+demain|\s+aujourd|\s+a\s+\d|\s*$)/i,
        )?.[1]
        ?.trim()
        .replace(/[,.]$/, '') || ''
    const titleFrom =
      raw.match(
        /(?:titre|intitule|intitulé)\s*[:=]?\s*([A-Za-zÀ-ÿ0-9'’\-\s]{2,60})/i,
      )?.[1]?.trim() || ''
    const title =
      titleFrom ||
      [
        AGENDA_TYPE_LABELS[type],
        clientQuery ? `— ${clientQuery}` : null,
        siteQuery ? `(${siteQuery})` : null,
      ]
        .filter(Boolean)
        .join(' ')
    const notes =
      raw.match(/(?:note|notes|commentaire)\s*[:=]?\s*(.+)$/i)?.[1]?.trim() || undefined

    return {
      kind: 'agenda',
      title,
      date,
      heure,
      type,
      clientQuery,
      siteQuery,
      notes,
      summary: [
        `Je peux ajouter à l’agenda :`,
        `• ${title}`,
        `• Type : ${AGENDA_TYPE_LABELS[type]}`,
        `• Date : ${date}${heure ? ` à ${heure}` : ''}`,
        clientQuery ? `• Client : ${clientQuery}` : null,
        siteQuery ? `• Site : ${siteQuery}` : null,
        ``,
        `Répondez « oui » pour créer, ou « non » pour annuler.`,
      ]
        .filter(Boolean)
        .join('\n'),
    }
  }

  return null
}

export type TerrainDeps = {
  data: AppData
  userId?: string
  userName?: string
  upsertClient: (
    c: Omit<import('./types').Client, 'id' | 'createdAt'> & { id?: string },
  ) => string
  upsertChantier: (
    c: Omit<Site, 'id' | 'createdAt'> & { id?: string },
  ) => string
  upsertDetecteur: (
    d: Omit<DetecteurManuel, 'id' | 'updatedAt'> & { id?: string },
  ) => Promise<string>
  upsertStock: (s: Omit<StockItem, 'id' | 'updatedAt'> & { id?: string }) => string
  upsertFicheMaintenanceClim: (
    f: Omit<import('./ficheMaintenanceClim').FicheMaintenanceClim, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string
    },
  ) => string
  upsertAgendaEvent: (
    e: Omit<AgendaEvent, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  ) => string
}

export async function executeTerrainAction(
  action: PendingTerrainAction,
  deps: TerrainDeps,
): Promise<{ message: string; navigateTo: string }> {
  if (action.kind === 'equipements') {
    const clients = deps.data.clients || []
    const sites = deps.data.chantiers || []
    const qClient = normalize(action.clientQuery)
    const client =
      (qClient &&
        clients.find((c) => normalize(clientDisplayName(c)).includes(qClient))) ||
      undefined
    const siteList = client ? sites.filter((s) => s.clientId === client.id) : sites
    const qSite = normalize(action.siteQuery)
    let site =
      (qSite && siteList.find((s) => normalize(s.nom).includes(qSite))) ||
      (siteList.length === 1 ? siteList[0] : undefined) ||
      (client && siteList[0]) ||
      undefined

    if (!site) {
      throw new Error(
        client
          ? `Aucun site pour « ${clientDisplayName(client)} ». Créez d’abord le site, ou précisez le nom du site.`
          : `Précisez le client / site (ex. « chez Mr Dupont, site Maison »).`,
      )
    }

    const existing = allEquipements(site)
    const newEqs: Equipement[] = action.equips.map((e) => ({
      id: crypto.randomUUID(),
      nom: e.nom,
      type: e.type || '',
      marque: '',
      modele: '',
      numeroSerie: '',
      avecFluideFrigorigene: true,
      fluideType: '',
      chargeNominaleKg: 0,
      detectionPermanente: false,
    }))

    deps.upsertChantier({
      ...site,
      id: site.id,
      clientId: site.clientId,
      equipements: [...existing, ...newEqs],
    })

    const list = newEqs.map((e, i) => `${i + 1}. ${e.nom}`).join('\n')
    return {
      message: `${newEqs.length} équipement${newEqs.length > 1 ? 's' : ''} créé${
        newEqs.length > 1 ? 's' : ''
      } sur « ${site.nom} » :\n${list}\n\nComplétez marque / fluide / photos sur chaque fiche.`,
      navigateTo: `/app/sites?id=${encodeURIComponent(site.id)}`,
    }
  }

  if (action.kind === 'client') {
    const id = deps.upsertClient({
      typeClient: action.typeClient,
      raisonSociale:
        action.typeClient === 'particulier'
          ? [action.prenom, action.nom].filter(Boolean).join(' ')
          : action.raisonSociale,
      nom: action.nom,
      prenom: action.prenom,
      nomContact: action.typeClient === 'entreprise' ? action.raisonSociale : '',
      telephone: action.telephone,
      email: action.email,
      adresse: action.adresse,
      codePostal: action.codePostal,
      ville: action.ville,
      createdByUserId: deps.userId,
      createdByName: deps.userName,
    })
    const label =
      action.typeClient === 'particulier'
        ? [action.prenom, action.nom].filter(Boolean).join(' ')
        : action.raisonSociale
    return {
      message: `Client « ${label} » créé. Vérifiez / complétez la fiche si besoin.`,
      navigateTo: `/app/clients?highlight=${encodeURIComponent(id)}`,
    }
  }

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

  if (action.kind === 'agenda') {
    const clients = deps.data.clients || []
    const sites = deps.data.chantiers || []
    const qClient = normalize(action.clientQuery)
    const client =
      (qClient &&
        clients.find((c) => normalize(clientDisplayName(c)).includes(qClient))) ||
      undefined
    const qSite = normalize(action.siteQuery)
    const siteList = client ? sites.filter((s) => s.clientId === client.id) : sites
    const site =
      (qSite && siteList.find((s) => normalize(s.nom).includes(qSite))) || undefined

    const id = deps.upsertAgendaEvent({
      title: action.title,
      date: action.date,
      dateRappel: action.date,
      heure: action.heure,
      type: action.type,
      clientId: client?.id,
      chantierId: site?.id,
      notes: action.notes,
      statut: 'a_faire',
    })

    const when = action.heure ? `${action.date} à ${action.heure}` : action.date
    return {
      message: `Agenda : « ${action.title} » ajouté pour le ${when}. Vérifiez dans Agenda.`,
      navigateTo: `/app/agenda?id=${encodeURIComponent(id)}`,
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
