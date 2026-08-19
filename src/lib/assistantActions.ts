/**
 * Assistant ClimaZEN — créer OT + CERFA brouillon depuis une phrase.
 * Peut aussi créer client / site / équipement s’ils n’existent pas encore.
 * Le technicien valide ensuite (fluide, signatures, PDF).
 */

import type { AppData, CerfaDraft, Client, Equipement, NatureIntervention, Site } from './types'
import { clientDisplayName } from './types'
import { allEquipements, equipementsForCerfa } from './cerfaBatch'
import {
  formatOtNumero,
  naturesCerfaPourTypeOt,
  TYPE_OT_LABELS,
  type TypeOt,
} from './ordreTravail'
import type { PendingTerrainAction } from './assistantTerrainActions'

export type CreateOtCerfaIntent = {
  kind: 'create_ot_cerfa'
  typeOt: TypeOt
  actionText: string
  clientQuery: string
  siteQuery: string
  equipQuery: string
  createCerfa: boolean
  /** true si la phrase dit Mr / Mme */
  clientIsParticulier?: boolean
}

export type PendingCreates = {
  /** Client à créer (si pas trouvé) */
  client?: {
    typeClient: 'particulier' | 'entreprise'
    raisonSociale: string
    nom?: string
    prenom?: string
  }
  /** Site à créer */
  site?: { nom: string }
  /** Équipement à créer sur le site */
  equip?: { nom: string; type?: string }
}

export type ResolvedCreateOtCerfa = {
  intent: CreateOtCerfaIntent
  /** IDs existants (sinon créés à l’exécution) */
  clientId?: string
  siteId?: string
  equipId?: string
  /** Aperçu libellés (existants ou à créer) */
  clientLabel: string
  siteLabel: string
  equipLabel: string
  create: PendingCreates
  needsCerfa: boolean
  summary: string
}

export type ExecuteCreateResult = {
  otId: string
  otNumero: string
  cerfaId?: string
  navigateTo: string
  message: string
}

function normalize(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function scoreMatch(haystack: string, needle: string): number {
  const h = normalize(haystack)
  const n = normalize(needle)
  if (!n || !h) return 0
  if (h === n) return 100
  if (h.includes(n) || n.includes(h)) return 80
  const parts = n.split(' ').filter((p) => p.length > 1)
  if (parts.length === 0) return 0
  const hits = parts.filter((p) => h.includes(p)).length
  return Math.round((hits / parts.length) * 60)
}

function detectTypeOt(q: string): TypeOt {
  const n = normalize(q)
  if (/etancheite|etancheite|controle.*fuite|test.*fuite/.test(n)) return 'controle_etancheite'
  if (/demantel|rebut|recuperation definitive|recup definitive/.test(n)) return 'demantelement'
  if (/depan|panne|depannage/.test(n)) return 'depanage'
  if (/install/.test(n)) return 'installation'
  if (/entretien/.test(n)) return 'entretien'
  if (/maintenance|controle|contrat/.test(n)) return 'maintenance'
  return 'controle_etancheite'
}

function wantsCreateCerfa(q: string): boolean {
  const n = normalize(q)
  return /cerfa|15497|fiche fluide|cree.*cerfa|creer.*cerfa|cr[eé]e.*cerfa/.test(n)
}

function wantsCreateOt(q: string): boolean {
  const n = normalize(q)
  // « crée / créer / cree moi une ot / ordre / intervention »
  if (!/(cree|creer|cr[eé]e|cr[eé]er|fais|faire|ouvre|ouvre|lance)/.test(n)) return false
  return /\b(ot|ordre|ordres|intervention|interventions)\b/.test(n) || wantsCreateCerfa(q)
}

function extractClientQuery(raw: string): string {
  const patterns = [
    /(?:mr|m\.|monsieur|mme|madame)\s+([a-zà-ÿ0-9'’\-]+(?:\s+[a-zà-ÿ0-9'’\-]+)?)/i,
    /(?:client|pour)\s+(?:mr|m\.|monsieur|mme|madame)?\s*([a-zà-ÿ0-9'’\-]+)/i,
    /chez\s+([a-zà-ÿ0-9'’\-]+)/i,
  ]
  for (const re of patterns) {
    const m = raw.match(re)
    if (m?.[1]) return m[1].trim()
  }
  return ''
}

function extractSiteQuery(raw: string): string {
  const patterns = [
    /site\s+(?:de\s+|du\s+|des\s+)?(.+?)(?:\s+pour\b|\s+equip|\s+équip|\s+clim\b|\s+et\s+|\s+et$|$)/i,
    /chantier\s+(?:de\s+|du\s+)?(.+?)(?:\s+pour\b|\s+equip|\s+équip|$)/i,
    /sur\s+le\s+site\s+(?:de\s+)?(.+?)(?:\s+pour\b|\s+equip|\s+équip|$)/i,
  ]
  for (const re of patterns) {
    const m = raw.match(re)
    if (m?.[1]) return m[1].replace(/\s+/g, ' ').trim()
  }
  return ''
}

function extractEquipQuery(raw: string): string {
  const patterns = [
    /equipement\s+(.+?)(?:\s+et\s+cr|\s+et\s+cree|\s+et\s+créer|\s*$)/i,
    /équipement\s+(.+?)(?:\s+et\s+cr|\s+et\s+cree|\s+et\s+créer|\s*$)/i,
    /(clim(?:atisation)?\s+(?:rdc|rdc|etage|étage|toiture|cave|combles)[a-z0-9\s]*)/i,
    /(cta|groupe|split|vrv|chambre froide)[a-z0-9\s]*/i,
  ]
  for (const re of patterns) {
    const m = raw.match(re)
    if (m?.[1]) return m[1].replace(/\s+/g, ' ').trim()
    if (m?.[0] && !m[1]) return m[0].replace(/\s+/g, ' ').trim()
  }
  return ''
}

/** Détecte une intention de création OT (+ CERFA optionnel). */
export function parseCreateOtCerfaIntent(text: string): CreateOtCerfaIntent | null {
  const raw = (text || '').trim()
  if (!raw || !wantsCreateOt(raw)) return null

  const typeOt = detectTypeOt(raw)
  const createCerfa = wantsCreateCerfa(raw) || /etancheite|etancheite|fluide/.test(normalize(raw))
  const clientQuery = extractClientQuery(raw)
  const siteQuery = extractSiteQuery(raw)
  const equipQuery = extractEquipQuery(raw)
  const actionText =
    TYPE_OT_LABELS[typeOt] +
    (equipQuery ? ` — ${equipQuery}` : '') +
    (siteQuery ? ` — ${siteQuery}` : '')

  const clientIsParticulier = /(?:mr|m\.|monsieur|mme|madame)\s+/i.test(raw)
  return {
    kind: 'create_ot_cerfa',
    typeOt,
    actionText: actionText.slice(0, 160),
    clientQuery,
    siteQuery,
    equipQuery,
    createCerfa,
    clientIsParticulier,
  }
}

/** Confirmation courte (« oui », « ok », « confirme »…). */
export function isConfirmPhrase(text: string): boolean {
  const n = normalize(text)
  return /^(oui|ok|okay|confirme|confirmer|vas[- ]y|go|daccord|d accord|parfait|cest bon|c est bon|cree|creer|cr[eé]e|valide|valider)[!?.]*$/.test(
    n,
  )
}

export function isCancelPhrase(text: string): boolean {
  const n = normalize(text)
  return /^(non|annule|annuler|stop|cancel|laisse)[!?.]*$/.test(n)
}

function bestClient(data: AppData, query: string): { hit: Client | null; alternatives: Client[] } {
  if (!query) return { hit: null, alternatives: [] }
  const scored = (data.clients || [])
    .map((c) => {
      const label = clientDisplayName(c)
      const s = Math.max(
        scoreMatch(label, query),
        scoreMatch(c.raisonSociale || '', query),
        scoreMatch(c.nom || '', query),
        scoreMatch(c.nomContact || '', query),
        scoreMatch(`${c.prenom || ''} ${c.nom || ''}`, query),
      )
      return { c, s }
    })
    .filter((x) => x.s >= 40)
    .sort((a, b) => b.s - a.s)
  if (scored.length === 0) return { hit: null, alternatives: [] }
  const top = scored[0]
  const close = scored.filter((x) => x.s >= top.s - 15).map((x) => x.c)
  if (close.length > 1 && scored[1] && scored[1].s >= top.s - 5) {
    return { hit: null, alternatives: close.slice(0, 5) }
  }
  return { hit: top.c, alternatives: [] }
}

function bestSite(
  data: AppData,
  query: string,
  clientId?: string,
): { hit: Site | null; alternatives: Site[] } {
  let sites = data.chantiers || []
  if (clientId) sites = sites.filter((s) => s.clientId === clientId)
  if (!query) {
    if (sites.length === 1) return { hit: sites[0], alternatives: [] }
    return { hit: null, alternatives: sites.slice(0, 5) }
  }
  const scored = sites
    .map((s) => ({
      s,
      score: Math.max(scoreMatch(s.nom || '', query), scoreMatch(s.adresse || '', query)),
    }))
    .filter((x) => x.score >= 40)
    .sort((a, b) => b.score - a.score)
  if (scored.length === 0) return { hit: null, alternatives: [] }
  const top = scored[0]
  const close = scored.filter((x) => x.score >= top.score - 15).map((x) => x.s)
  if (close.length > 1 && scored[1] && scored[1].score >= top.score - 5) {
    return { hit: null, alternatives: close.slice(0, 5) }
  }
  return { hit: top.s, alternatives: [] }
}

function bestEquip(site: Site, query: string): { hit: Equipement | null; alternatives: Equipement[] } {
  const list = allEquipements(site)
  if (list.length === 0) return { hit: null, alternatives: [] }
  if (!query) {
    const forCerfa = equipementsForCerfa(site)
    if (forCerfa.length === 1) return { hit: forCerfa[0], alternatives: [] }
    if (list.length === 1) return { hit: list[0], alternatives: [] }
    return { hit: null, alternatives: list.slice(0, 6) }
  }
  const scored = list
    .map((e) => ({
      e,
      score: Math.max(
        scoreMatch(e.nom || '', query),
        scoreMatch(e.type || '', query),
        scoreMatch(`${e.marque || ''} ${e.modele || ''}`, query),
        scoreMatch(e.numeroSerie || '', query),
      ),
    }))
    .filter((x) => x.score >= 35)
    .sort((a, b) => b.score - a.score)
  if (scored.length === 0) return { hit: null, alternatives: list.slice(0, 6) }
  const top = scored[0]
  const close = scored.filter((x) => x.score >= top.score - 15).map((x) => x.e)
  if (close.length > 1 && scored[1] && scored[1].score >= top.score - 5) {
    return { hit: null, alternatives: close.slice(0, 6) }
  }
  return { hit: top.e, alternatives: [] }
}

/** Résout client / site / équipement — crée le manquant si la phrase le nomme. */
export function resolveCreateOtCerfa(
  data: AppData,
  intent: CreateOtCerfaIntent,
): { ok: true; resolved: ResolvedCreateOtCerfa } | { ok: false; message: string } {
  if (!intent.clientQuery?.trim()) {
    return {
      ok: false,
      message:
        'Indiquez le client dans la phrase (ex. « crée une OT pour Mr Martin sur le site Atelier… »).',
    }
  }

  const { hit: client, alternatives: clientAlts } = bestClient(data, intent.clientQuery)
  if (!client && clientAlts.length > 1) {
    return {
      ok: false,
      message:
        `Plusieurs clients possibles :\n` +
        clientAlts.map((c) => `• ${clientDisplayName(c)}`).join('\n') +
        `\n\nPrécisez lequel, ou reformulez le nom.`,
    }
  }

  const create: PendingCreates = {}
  let clientId = client?.id
  let clientLabel = client ? clientDisplayName(client) : ''

  if (!client) {
    const q = intent.clientQuery.trim()
    if (intent.clientIsParticulier) {
      const parts = q.split(/\s+/).filter(Boolean)
      const nom = parts.length > 1 ? parts[parts.length - 1] : parts[0] || q
      const prenom = parts.length > 1 ? parts.slice(0, -1).join(' ') : ''
      create.client = {
        typeClient: 'particulier',
        nom,
        prenom: prenom || '—',
        raisonSociale: [prenom, nom].filter((x) => x && x !== '—').join(' ') || q,
      }
      clientLabel = `${prenom && prenom !== '—' ? prenom + ' ' : ''}${nom}`.trim() + ' (nouveau)'
    } else {
      create.client = {
        typeClient: 'entreprise',
        raisonSociale: q,
      }
      clientLabel = `${q} (nouveau)`
    }
  }

  // Site
  let site: Site | null = null
  let siteAlts: Site[] = []
  if (clientId) {
    const r = bestSite(data, intent.siteQuery, clientId)
    site = r.hit
    siteAlts = r.alternatives
  }
  if (!site && siteAlts.length > 1 && !intent.siteQuery) {
    return {
      ok: false,
      message:
        `Plusieurs sites pour ce client :\n` +
        siteAlts.map((s) => `• ${s.nom}`).join('\n') +
        `\n\nPrécisez le site.`,
    }
  }

  let siteId = site?.id
  let siteLabel = site?.nom || ''
  if (!site) {
    const siteNom = (intent.siteQuery || 'Site intervention').trim()
    create.site = { nom: siteNom }
    siteLabel = `${siteNom} (nouveau)`
  }

  // Équipement
  let equip: Equipement | null = null
  let equipAlts: Equipement[] = []
  if (site) {
    const r = bestEquip(site, intent.equipQuery)
    equip = r.hit
    equipAlts = r.alternatives
  }
  if (!equip && equipAlts.length > 1 && intent.equipQuery) {
    // Ambigu parmi existants → demander
    const stillAmbiguous =
      equipAlts.filter((e) => scoreMatch(e.nom || '', intent.equipQuery) >= 40).length > 1
    if (stillAmbiguous) {
      return {
        ok: false,
        message:
          `Plusieurs équipements sur « ${site?.nom} » :\n` +
          equipAlts.map((e) => `• ${e.nom || e.type || e.id}`).join('\n') +
          `\n\nPrécisez lequel.`,
      }
    }
  }

  let equipId = equip?.id
  let equipLabel = equip ? equip.nom || eqLabel(equip) : ''
  if (!equip) {
    const eqNom = (intent.equipQuery || 'Équipement clim').trim()
    create.equip = { nom: eqNom, type: /clim/i.test(eqNom) ? 'Climatisation' : '' }
    equipLabel = `${eqNom} (nouveau)`
  }

  // CERFA brouillon si demandé — le tech complète fluide / signatures
  const needsCerfa = intent.createCerfa

  const willCreate: string[] = []
  if (create.client) willCreate.push('client')
  if (create.site) willCreate.push('site')
  if (create.equip) willCreate.push('équipement')
  willCreate.push('OT')
  if (needsCerfa) willCreate.push('CERFA brouillon')

  const summary = [
    `Je peux préparer :`,
    `• OT « ${TYPE_OT_LABELS[intent.typeOt]} »`,
    `• Client : ${clientLabel}`,
    `• Site : ${siteLabel}`,
    `• Équipement : ${equipLabel}`,
    needsCerfa
      ? `• + CERFA brouillon (à compléter / valider par le technicien)`
      : `• CERFA : non demandé`,
    willCreate.length
      ? `\nÀ créer : ${willCreate.join(', ')}.`
      : '',
    `\nLe technicien valide ensuite (fluide, signatures, PDF).`,
    `Répondez « oui » pour créer, ou « non » pour annuler.`,
  ]
    .filter(Boolean)
    .join('\n')

  return {
    ok: true,
    resolved: {
      intent,
      clientId,
      siteId,
      equipId,
      clientLabel,
      siteLabel,
      equipLabel,
      create,
      needsCerfa,
      summary,
    },
  }
}

function eqLabel(e: Equipement): string {
  return [e.type, e.marque, e.modele].filter(Boolean).join(' ') || e.id
}

/** Catalogue compact pour Gemini (contexte). */
export function buildEntityCatalog(data: AppData, max = 40): string {
  const clients = (data.clients || []).slice(0, max)
  const lines: string[] = [
    'Clients / sites / équipements (données actuelles).',
    'Si un nom n’existe pas, l’app peut le créer après confirmation.',
  ]
  for (const c of clients) {
    const sites = (data.chantiers || []).filter((s) => s.clientId === c.id).slice(0, 8)
    lines.push(`- Client « ${clientDisplayName(c)} »`)
    for (const s of sites) {
      const eqs = allEquipements(s)
        .slice(0, 8)
        .map((e) => e.nom || e.type || 'équipement')
        .join(', ')
      lines.push(`  · Site « ${s.nom} »${eqs ? ` → ${eqs}` : ''}`)
    }
  }
  if (clients.length === 0) lines.push('(aucun client encore — création possible depuis la phrase)')
  return lines.join('\n')
}

export type CreateOtCerfaDeps = {
  createOtForAction: (opts: {
    typeOt: TypeOt
    action: string
    clientId?: string
    chantierId?: string
    equipementId?: string
    technicien?: string
    observations?: string
    statut?: 'en_cours'
  }) => { id: string; numero: string }
  upsertClient: (c: Omit<Client, 'id' | 'createdAt'> & { id?: string }) => string
  upsertChantier: (c: Omit<Site, 'id' | 'createdAt'> & { id?: string }) => string
  upsertIntervention: (
    i: Omit<CerfaDraft, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  ) => string
  data: AppData
  technicien?: string
  userId?: string
  userName?: string
}

/** Crée client/site/équipement manquants + OT (+ CERFA brouillon). */
export function executeCreateOtCerfa(
  resolved: ResolvedCreateOtCerfa,
  deps: CreateOtCerfaDeps,
): ExecuteCreateResult {
  const { intent, create, needsCerfa } = resolved
  let clientId = resolved.clientId
  let siteId = resolved.siteId
  let equipId = resolved.equipId

  if (create.client) {
    const c = create.client
    clientId = deps.upsertClient({
      typeClient: c.typeClient,
      raisonSociale: c.raisonSociale,
      nom: c.nom || '',
      prenom: c.prenom || '',
      nomContact: c.typeClient === 'entreprise' ? c.raisonSociale : '',
      adresse: '',
      codePostal: '',
      ville: '',
      telephone: '',
      email: '',
      createdByUserId: deps.userId,
      createdByName: deps.userName,
    })
  }
  if (!clientId) throw new Error('Client manquant.')

  if (create.site) {
    siteId = deps.upsertChantier({
      clientId,
      nom: create.site.nom,
      adresse: '',
      codePostal: '',
      ville: '',
      statut: 'actif',
      equipements: [],
      equipementType: '',
      equipementMarque: '',
      equipementModele: '',
      equipementNumeroSerie: '',
      fluideType: '',
      chargeNominaleKg: 0,
      detectionPermanente: false,
      avecFluideFrigorigene: true,
      createdByUserId: deps.userId,
      createdByName: deps.userName,
    })
  }
  if (!siteId) throw new Error('Site manquant.')

  // Recharger site depuis data peut être stale juste après upsert — reconstruire équipement
  let equip: Equipement | null = null
  if (equipId) {
    const siteRow = deps.data.chantiers.find((s) => s.id === siteId)
    equip = siteRow ? allEquipements(siteRow).find((e) => e.id === equipId) || null : null
  }

  if (create.equip) {
    const existingSite = deps.data.chantiers.find((s) => s.id === siteId)
    const existingEqs = existingSite ? allEquipements(existingSite) : []
    const newEq: Equipement = {
      id: crypto.randomUUID(),
      nom: create.equip.nom,
      type: create.equip.type || '',
      marque: '',
      modele: '',
      numeroSerie: '',
      avecFluideFrigorigene: true,
      fluideType: '',
      chargeNominaleKg: 0,
      detectionPermanente: false,
    }
    siteId = deps.upsertChantier({
      ...(existingSite || {
        clientId,
        nom: create.site?.nom || resolved.siteLabel.replace(/\s*\(nouveau\)\s*$/, ''),
        adresse: '',
        codePostal: '',
        ville: '',
        statut: 'actif' as const,
        equipementType: '',
        equipementMarque: '',
        equipementModele: '',
        equipementNumeroSerie: '',
        fluideType: '',
        chargeNominaleKg: 0,
        detectionPermanente: false,
      }),
      id: siteId,
      clientId,
      equipements: [...existingEqs, newEq],
      createdByUserId: deps.userId,
      createdByName: deps.userName,
    })
    equipId = newEq.id
    equip = newEq
  }

  if (!equip && equipId) {
    const siteRow = deps.data.chantiers.find((s) => s.id === siteId)
    equip = siteRow ? allEquipements(siteRow).find((e) => e.id === equipId) || null : null
  }

  const ot = deps.createOtForAction({
    typeOt: intent.typeOt,
    action: intent.actionText,
    clientId,
    chantierId: siteId,
    equipementId: equipId,
    technicien: deps.technicien || deps.data.operateur?.raisonSociale || '',
    observations: intent.actionText,
    statut: 'en_cours',
  })

  let cerfaId: string | undefined
  if (needsCerfa && equipId) {
    const natures = naturesCerfaPourTypeOt(intent.typeOt) as NatureIntervention[]
    const charge = Number(equip?.chargeNominaleKg) || 0
    cerfaId = deps.upsertIntervention({
      clientId,
      chantierId: siteId,
      equipementId: equipId,
      dateIntervention: new Date().toISOString().slice(0, 10),
      numeroIntervention: ot.numero,
      ordreTravailId: ot.id,
      operateur: deps.data.operateur,
      natures,
      detectionPermanente: !!equip?.detectionPermanente,
      fluideType: equip?.fluideType || '',
      quantiteTotaleKg: charge,
      teqCO2: equip?.teqCO2,
      fuiteConstatee: false,
      manipulations: [],
      status: 'brouillon',
      createdByUserId: deps.userId,
      createdByName: deps.userName,
      observations: intent.actionText,
    })
  }

  const createdBits = [
    create.client ? 'client' : null,
    create.site ? 'site' : null,
    create.equip ? 'équipement' : null,
    'OT',
    cerfaId ? 'CERFA brouillon' : null,
  ].filter(Boolean)

  const label = formatOtNumero(ot.numero)
  if (cerfaId) {
    return {
      otId: ot.id,
      otNumero: ot.numero,
      cerfaId,
      navigateTo: `/app/interventions/${cerfaId}?ot=${encodeURIComponent(ot.id)}`,
      message: `${label} prêt (${createdBits.join(', ')}). Complétez fluide / signatures / PDF — le technicien valide.`,
    }
  }
  return {
    otId: ot.id,
    otNumero: ot.numero,
    navigateTo: `/app/ot?id=${encodeURIComponent(ot.id)}`,
    message: `${label} créé (${createdBits.join(', ')}). Ouvrez l’OT pour finaliser.`,
  }
}

/** Extrait propose_create_equipements depuis une réponse Gemini. */
export function extractEquipementsActionFromReply(
  reply: string,
): PendingTerrainAction | null {
  const fenced = reply.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = fenced?.[1] || reply
  const m = raw.match(/\{[\s\S]*"action"\s*:\s*"propose_create_equipements"[\s\S]*\}/)
  if (!m) return null
  try {
    const obj = JSON.parse(m[0]) as {
      action?: string
      clientQuery?: string
      siteQuery?: string
      equips?: { nom?: string; type?: string }[]
    }
    if (obj.action !== 'propose_create_equipements') return null
    const equips = (obj.equips || [])
      .map((e) => ({
        nom: (e.nom || '').trim(),
        type: (e.type || '').trim() || undefined,
      }))
      .filter((e) => e.nom)
    if (equips.length === 0) return null
    const clientQuery = (obj.clientQuery || '').trim()
    const siteQuery = (obj.siteQuery || '').trim()
    return {
      kind: 'equipements',
      clientQuery,
      siteQuery,
      equips,
      summary: [
        `Je peux créer ${equips.length} équipement${equips.length > 1 ? 's' : ''} :`,
        ...equips.map((e, i) => `${i + 1}. ${e.nom}`),
        clientQuery ? `• Client : ${clientQuery}` : null,
        siteQuery ? `• Site : ${siteQuery}` : null,
        ``,
        `Rien n’est encore enregistré. Répondez « oui » pour créer, ou « non » pour annuler.`,
      ]
        .filter(Boolean)
        .join('\n'),
    }
  } catch {
    return null
  }
}

/** Extrait un bloc JSON ACTION depuis une réponse Gemini. */
export function extractActionFromReply(reply: string): CreateOtCerfaIntent | null {
  const fenced = reply.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = fenced?.[1] || reply
  const m = raw.match(/\{[\s\S]*"action"\s*:\s*"propose_create_ot_cerfa"[\s\S]*\}/)
  if (!m) return null
  try {
    const obj = JSON.parse(m[0]) as {
      action?: string
      typeOt?: string
      clientQuery?: string
      siteQuery?: string
      equipQuery?: string
      actionText?: string
      createCerfa?: boolean
    }
    if (obj.action !== 'propose_create_ot_cerfa') return null
    const allowed: TypeOt[] = [
      'controle_etancheite',
      'maintenance',
      'depanage',
      'demantelement',
      'entretien',
      'installation',
    ]
    const typeOt = (allowed.includes(obj.typeOt as TypeOt)
      ? obj.typeOt
      : 'controle_etancheite') as TypeOt
    return {
      kind: 'create_ot_cerfa',
      typeOt,
      actionText: (obj.actionText || TYPE_OT_LABELS[typeOt]).slice(0, 160),
      clientQuery: (obj.clientQuery || '').trim(),
      siteQuery: (obj.siteQuery || '').trim(),
      equipQuery: (obj.equipQuery || '').trim(),
      createCerfa: obj.createCerfa !== false,
      clientIsParticulier: /^(mr|mme|m\.|monsieur|madame)\b/i.test(
        (obj.clientQuery || '').trim(),
      ),
    }
  } catch {
    return null
  }
}
