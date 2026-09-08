/**
 * Lola formateur — comprend les actions du site et répond aux petites
 * lectures de données EN LOCAL (sans attendre le cloud).
 *
 * Pourquoi : le modèle cloud se perd souvent sur « combien d’INT », « où est
 * le client X », alors que les données sont déjà dans AppData.
 */

import type { AppData } from './types'
import { clientDisplayName } from './types'
import {
  computeOtStats,
  normalizeOtTypos,
  searchOrgData,
  type SearchHit,
} from './assistantDataQuery'
import { todayIsoLocal } from './agenda'
import { isOtCloture } from './ordreTravail'
import type { TeamMemberLite } from './assistantOtLookup'
import { ABSENCE_STATUT_LABELS, ABSENCE_TYPE_LABELS } from './demandesAbsence'

export type LolaActionId =
  | 'intervenir'
  | 'liste_int'
  | 'cerfa'
  | 'agenda'
  | 'absences'
  | 'pointage'
  | 'temps_hors_int'
  | 'stock_fluides'
  | 'stock_pieces'
  | 'clients'
  | 'sites'
  | 'scan_qr'
  | 'devis'
  | 'commandes'
  | 'contrats'
  | 'fiche_clim'
  | 'fiche_chaufferie'
  | 'fiche_cta'
  | 'equipe'
  | 'profil'
  | 'entreprise'
  | 'signatures'
  | 'vocal'
  | 'decaler_int'
  | 'corriger_pointage'

export type LolaAction = {
  id: LolaActionId
  title: string
  keywords: string[]
  path: string
  /** Étapes formateur (où cliquer). */
  howTo: string
  /** Phrases que l’utilisateur peut dire à Lola. */
  sayToLola: string[]
  canPropose?: boolean
}

export const LOLA_ACTIONS: LolaAction[] = [
  {
    id: 'intervenir',
    title: 'Créer une intervention (INT)',
    keywords: [
      'intervenir',
      'nouvelle int',
      'nouvelle intervention',
      'creer int',
      'creer ot',
      'appel',
      'depannage',
      'panne',
      'astreinte',
    ],
    path: '/app/appel',
    howTo: `Pour ouvrir une intervention :
1. Accueil → Intervenir (/app/appel) — ou Mes interventions → « Rédiger / signer / fin » si elle existe déjà.
2. Cochez « C’est une astreinte » si hors horaires / week-end / nuit.
3. Client → Site → Équipement(s) si connus (sinon « à déterminer »).
4. Documents : CERFA si fluide, signatures, puis clôture (toujours vous).`,
    sayToLola: ['Crée une INT dépannage pour Mr Dupont site Atelier'],
    canPropose: true,
  },
  {
    id: 'liste_int',
    title: 'Liste des interventions',
    keywords: [
      'liste int',
      'mes interventions',
      'interventions ouvertes',
      'ordres de travail',
      'cloturer',
    ],
    path: '/app/ot',
    howTo: `Les INT sont dans Interventions (/app/ot).
Filtres : ouvertes / clôturées, tech, date.
Sur le téléphone terrain : Accueil → Intervenir, ou « Mes INT » à la voix.`,
    sayToLola: ['Combien d’INT restent à clôturer ce mois ?', 'INT de Karim aujourd’hui'],
  },
  {
    id: 'cerfa',
    title: 'CERFA fluides',
    keywords: ['cerfa', '15497', 'fiche fluide', 'pdf cerfa'],
    path: '/app/interventions',
    howTo: `CERFA :
1. Depuis l’INT → bouton CERFA, ou menu CERFA (/app/interventions).
2. Cochez les natures vous-même (récup. temporaire vs démantèlement).
3. Fluide [7], puis récupérer (D/E) et/ou recharger neuf (A/B/C).
4. Signatures → « Enregistrer & générer ce CERFA ».
Le PDF final = toujours vous (Lola ne le génère pas).`,
    sayToLola: ['Comment faire un CERFA ?', 'Crée une INT + CERFA pour Mr Martin'],
    canPropose: true,
  },
  {
    id: 'agenda',
    title: 'Agenda / RDV',
    keywords: ['agenda', 'rdv', 'rendez-vous', 'calendrier', 'planifie', 'visite'],
    path: '/app/agenda',
    howTo: `Agenda (/app/agenda) : RDV, maintenances, rappels, absences posées.
Croix rouge sur un bloc INT = retirer du tech (revient dans « à poser »).
Recliquer / glisser = changer d’heure ou de tech.
Lola peut préparer un lot : « Affecte 2 INT à chaque tech » ou « remplis l’agenda avec les ordres » → Accueil (Valider par tech / par INT). Après OK, les blocs sont sur le jour demandé. Un tech ne change pas de secteur.`,
    sayToLola: [
      'Agenda RDV demain 14h pour Mr Martin site Atelier',
      'Affecte 2 INT à chaque tech, sans changer de secteur',
      'Remplis l’agenda avec les ordres',
    ],
    canPropose: true,
  },
  {
    id: 'absences',
    title: 'Absences / congés',
    keywords: ['absence', 'absences', 'conges', 'vacances', 'rtt', 'maladie', 'feuille absence'],
    path: '/app/absences',
    howTo: `Absences (/app/absences) :
1. Nouvelle feuille → type (congés, RTT, maladie…) + dates.
2. Vérifiez, envoyez à la direction.
3. Une fois validée, l’indispo se pose sur l’Agenda (plus d’INT sur ces jours).`,
    sayToLola: ['Pose mes congés du 12 au 16 mars'],
    canPropose: true,
  },
  {
    id: 'pointage',
    title: 'Pointeuse',
    keywords: ['pointage', 'pointeuse', 'pointer', 'en cours', 'deplacement', 'pause'],
    path: '/app/pointage',
    howTo: `Pointeuse (/app/pointage) — ou à la voix (Dis Lola) :
• Déplacement → En cours (arrivé site) → Pause → Fin d’intervention.
Le tech ne modifie JAMAIS une heure déjà enregistrée.
Oubli « en cours » : dire « j’ai oublié de pointer en cours, arrivé à 10h15 » (GPS) ou bureau.`,
    sayToLola: ['Mets-moi en déplacement', 'J’ai oublié de pointer en cours, arrivé à 10h15'],
    canPropose: true,
  },
  {
    id: 'temps_hors_int',
    title: 'Temps hors INT',
    keywords: ['temps hors', 'hors int', 'entrees de temps', 'fournisseur', 'atelier'],
    path: '/app/temps-hors-int',
    howTo: `Temps hors INT (/app/temps-hors-int) : fournisseur, atelier, formation — pas dans le dossier INT.
Sur le téléphone : cercle à part, à côté d’Intervenir.`,
    sayToLola: ['Ouvre les temps hors INT'],
  },
  {
    id: 'stock_fluides',
    title: 'Stock fluides / bouteilles',
    keywords: ['stock fluide', 'bouteille', 'r-32', 'r32', 'r-410', 'fgas', 'gaz'],
    path: '/app/stock',
    howTo: `Stock fluides (/app/stock) :
• Vert = utilisable (charge / appoint / service)
• Orange = récupération déchet (BSFF)
Ajout : photo étiquette ou scan QR. N° de série = CERFA ; surnom = interne.`,
    sayToLola: ['Ajoute bouteille R-32 transfert', 'Combien de bouteilles R-32 ?'],
    canPropose: true,
  },
  {
    id: 'stock_pieces',
    title: 'Stock pièces détachées',
    keywords: ['piece', 'pieces', 'filtre', 'compresseur', 'magasin', 'stock pieces'],
    path: '/app/stock-pieces',
    howTo: `Pièces magasin (/app/stock-pieces) : quantités, emplacement, mouvements.
Les commandes fournisseur sont dans /app/commandes.
Fluides F-Gas restent dans Stock fluides, pas ici.`,
    sayToLola: ['Combien de filtre M5 en stock ?', 'Préviens-moi quand le compresseur arrive'],
    canPropose: true,
  },
  {
    id: 'clients',
    title: 'Clients',
    keywords: ['client', 'clients', 'particulier', 'entreprise', 'mr', 'mme'],
    path: '/app/clients',
    howTo: `Clients (/app/clients) : fiche, contacts, sites rattachés.
Depuis la fiche : créer un site, voir les INT, devis.
Le tech terrain n’a pas ce menu en accueil — Lola peut quand même chercher le nom.`,
    sayToLola: ['Où est le client Dupont ?', 'Crée le client Mr Martin'],
    canPropose: true,
  },
  {
    id: 'sites',
    title: 'Sites & parc équipements',
    keywords: ['site', 'sites', 'parc', 'chantier', 'equipement', 'equipements', 'clim'],
    path: '/app/chantiers',
    howTo: `Sites & Parc (/app/chantiers) : sites groupés par client, équipements, QR.
Un équipement inconnu à l’INT → « à déterminer », puis compléter ici.`,
    sayToLola: ['Ajoute 2 clim salon et chambre pour Mr Dupont'],
    canPropose: true,
  },
  {
    id: 'scan_qr',
    title: 'Scanner QR / étiquette',
    keywords: ['scan', 'scanner', 'qr', 'etiquette', 'code barre', 'barcode'],
    path: '/app/scan-equip?camera=1',
    howTo: `Scanner QR (/app/scan-equip) : étiquette équipement ou QR bâtiment → ouvre le site / l’INT.
Bouteille : Accueil → Stock fluides → scan (photo étiquette).`,
    sayToLola: ['Ouvre le scan QR'],
  },
  {
    id: 'devis',
    title: 'Devis client',
    keywords: ['devis', 'chiffrage', 'estimation', 'devis client'],
    path: '/app/devis',
    howTo: `Devis (/app/devis) : brouillon → envoyer → accepté.
Une pièce HS sur un rapport INT peut lancer devis client + demande fournisseur (dites « oui »).`,
    sayToLola: ['Prépare un devis pour Mr Martin 450 € HT', 'Où en est le devis Martin ?'],
    canPropose: true,
  },
  {
    id: 'commandes',
    title: 'Commandes fournisseur',
    keywords: ['commande', 'commandes', 'fournisseur', 'demande devis piece'],
    path: '/app/commandes',
    howTo: `Commandes (/app/commandes) : pièce à commander, statut (demandée / reçue).
À la réception, le stock pièces monte. Lola peut veiller (« préviens-moi quand X arrive »).`,
    sayToLola: ['Commande un compresseur chez Daikin', 'Le compresseur est arrivé ?'],
    canPropose: true,
  },
  {
    id: 'contrats',
    title: 'Contrats de maintenance',
    keywords: ['contrat', 'contrats', 'maintenance annuelle', 'contrat clim'],
    path: '/app/contrats',
    howTo: `Contrats (/app/contrats) : modèle (clim, chaufferie, CTA…) → sites → signature.
Les visites du contrat se planifient ensuite à l’Agenda / INT du mois.`,
    sayToLola: ['Comment créer un contrat de maintenance ?'],
  },
  {
    id: 'fiche_clim',
    title: 'Fiche maintenance clim / PAC',
    keywords: ['fiche clim', 'fiche maintenance', 'checklist clim', 'pac'],
    path: '/app/fiche-maintenance-clim',
    howTo: `Fiche clim (/app/fiche-maintenance-clim) : checklist optionnelle depuis l’INT (Documents).
Elle n’est pas le CERFA. CERFA = fluides ; fiche = entretien machine.`,
    sayToLola: ['Fiche maintenance clim pour Mr Dupont'],
    canPropose: true,
  },
  {
    id: 'fiche_chaufferie',
    title: 'Fiche maintenance chaufferie',
    keywords: ['fiche chaufferie', 'chaufferie', 'chaudiere'],
    path: '/app/fiche-maintenance-chaufferie',
    howTo: `Fiche chaufferie (/app/fiche-maintenance-chaufferie) : registre périodique P2/P3, depuis l’INT ou le menu.`,
    sayToLola: ['Ouvre la fiche chaufferie'],
  },
  {
    id: 'fiche_cta',
    title: 'Fiche CTA / VMC',
    keywords: ['fiche cta', 'cta', 'vmc', 'ventilation'],
    path: '/app/fiche-maintenance-cta-vmc',
    howTo: `Fiche CTA / VMC (/app/fiche-maintenance-cta-vmc) : registre 1M → 1Y, depuis l’INT ou le menu.`,
    sayToLola: ['Ouvre la fiche CTA'],
  },
  {
    id: 'equipe',
    title: 'Équipe / dossier technicien',
    keywords: ['equipe', 'dossier', 'cni', 'habilitation', 'aptitude', 'rh'],
    path: '/app/equipe',
    howTo: `Équipe (/app/equipe) → Dossier du tech :
signature CERFA personnelle, CNI, aptitude fluides, habilitation électrique, dates d’expiration.
Les pièces d’identité : gérant + personnes autorisées seulement.`,
    sayToLola: ['Quels documents mettre dans le dossier technicien ?'],
  },
  {
    id: 'profil',
    title: 'Mon profil / détecteur / outillage',
    keywords: ['profil', 'detecteur', 'outillage', 'etalonnage', 'ma signature'],
    path: '/app/profil',
    howTo: `Mon profil (/app/profil) : outillage affecté, détecteur de fuite (contrôle < 1 an pour CERFA), lien dossier.
Signature : Équipe → votre dossier (invisible aux collègues).`,
    sayToLola: ['Ajoute détecteur nom XXX validité 12/03/27', 'Qui a le détecteur X ?'],
    canPropose: true,
  },
  {
    id: 'entreprise',
    title: 'Mon entreprise / clé IA',
    keywords: ['entreprise', 'operateur', 'siret', 'logo', 'cle ia', 'openai', 'claude', 'lola'],
    path: '/app/operateur',
    howTo: `Mon entreprise (/app/operateur) — gérant :
raison sociale, SIRET, logo, coffre documents, clé IA (OpenAI / Claude / Gemini) = même clé pour le site et Lola téléphone.`,
    sayToLola: ['Où coller la clé IA ?'],
  },
  {
    id: 'signatures',
    title: 'Signatures et clôture',
    keywords: ['signature', 'signer', 'cloture', 'cloturer', 'detenteur'],
    path: '/app/appel',
    howTo: `Signatures :
• Tech : dossier Équipe — reprise auto INT / CERFA.
• Client : pad vide à CHAQUE intervention (pas de réutilisation).
Clôturer : signatures + « Clôturer signé ». Lola ne signe pas et ne clôture pas.`,
    sayToLola: ['Comment clôturer une INT ?'],
  },
  {
    id: 'vocal',
    title: 'Voix / Dis Lola',
    keywords: ['voix', 'vocal', 'micro', 'dis lola', 'main libre', 'dicter'],
    path: '/app',
    howTo: `Main libre : bouton micro en haut.
« Dis Lola » = même effet qu’un appui micro.
Silence ~5 s sans parole → micro coupé.
« Stop » coupe tout. Pointage vocal marche sans Agent IA.`,
    sayToLola: ['Dis Lola, mets-moi en pause'],
  },
  {
    id: 'decaler_int',
    title: 'Décaler une INT sur l’Agenda',
    keywords: ['decale', 'decaler', 'deplace', 'deplacer int', 'changer heure'],
    path: '/app/agenda',
    howTo: `Pour changer l’heure sans ouvrir la fiche :
dites « décale l’INT de 7h à 9h » (avec le nom du tech si besoin) → « oui ».
Ou Agenda → glisser le bloc / recliquer.`,
    sayToLola: ['Décale l’INT de Karim de 7h à 9h'],
    canPropose: true,
  },
  {
    id: 'corriger_pointage',
    title: 'Corriger un oubli de pointage',
    keywords: ['oublie pointer', 'corriger pointage', 'oublie en cours', 'horodatage'],
    path: '/app/pointage',
    howTo: `Le tech ne change pas une heure déjà posée.
Oubli « en cours » à l’arrivée : « j’ai oublié de pointer en cours, arrivé à 10h15 » → oui (GPS obligatoire).
Sans GPS : bureau → Pointeuse → « Corriger une arrivée oubliée ».`,
    sayToLola: ['J’ai oublié de pointer en cours, arrivé à 10h15'],
    canPropose: true,
  },
]

function normalize(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function nq(raw: string): string {
  return normalize(normalizeOtTypos(raw))
}

const CREATE_VERBS =
  /\b(cree|creer|ajoute|ajouter|planifie|programme|pose|prend|prendre|decaler|decale|lance|prepare|preparer|commande|commander|enregistre|nouveau|nouvelle|fais moi|faites moi|affecte|affecter|attribue|attribuer|reparti|repartir)\b/

const HOWTO_RE =
  /\b(comment|ou cliquer|ou trouver|ou est le bouton|a quoi sert|c est quoi|explique|tutoriel|guide moi|aide moi|je (suis|me) perdu|je ne (sais|comprends)|montre moi comment|apprendre|formateur)\b/

const COUNT_RE =
  /\b(combien|nombre|reste|restent|restant|encore ouvert|a cloturer|a effectuer|bilan|synthese)\b/

const STATUS_RE =
  /\bou en est\b|\bstatut\b|\best il\b|\best elle\b|\ba t il\b|\by a t il\b|\by a til\b|\bexiste\b|\bdisponible\b|\bdispo\b/

const FIND_RE =
  /\b(trouve|trouver|cherche|chercher|qui a|qui est|c est qui)\b/

const SHOW_RE = /\b(montre|affiche|liste|lister)\b/

const PAGE_ONLY_RE =
  /\b(agenda|accueil|stock|clients?|sites?|equipe|profil|pointeuse|pointage|cerfa|devis|commandes?|absences?|contrats?)\b/

export type LolaIntentKind = 'howto' | 'lookup' | 'action' | 'unknown'

export function wantsHowTo(raw: string): boolean {
  const n = nq(raw)
  if (!n) return false
  if (HOWTO_RE.test(n)) return true
  if (/\b(ouvre|ouvrir|va sur|vas sur|page)\b/.test(n) && PAGE_ONLY_RE.test(n)) return true
  return false
}

/**
 * Petite lecture de données (chiffres, fiche, statut) — pas une création.
 */
export function wantsLookup(raw: string): boolean {
  const n = nq(raw)
  if (!n) return false
  if (HOWTO_RE.test(n)) return false
  if (CREATE_VERBS.test(n) && !COUNT_RE.test(n) && !STATUS_RE.test(n) && !FIND_RE.test(n)) {
    return false
  }
  if (COUNT_RE.test(n) || STATUS_RE.test(n)) return true
  // « où est le client Dupont » = lecture ; « où est le bouton » = formateur
  if (/\bou est\b/.test(n) && !/\b(bouton|menu|page|icone|onglet)\b/.test(n)) return true
  if (FIND_RE.test(n) || SHOW_RE.test(n)) {
    // « INT de Karim » / « trouve l’INT de Julie » → lookup tech dédié
    if (
      /\b(int|ot|or|ordre|intervention)\b/.test(n) &&
      /\b(de|du|pour)\s+[a-z]{3,}/.test(n) &&
      !COUNT_RE.test(n)
    ) {
      return false
    }
    // « montre l’agenda » = navigation, pas une recherche de fiche
    const pageOnly = PAGE_ONLY_RE.test(n) && n.split(' ').length <= 5
    if (pageOnly) return false
    return true
  }
  return false
}

export function classifyLolaIntent(raw: string): LolaIntentKind {
  if (wantsHowTo(raw)) return 'howto'
  if (wantsLookup(raw)) return 'lookup'
  if (CREATE_VERBS.test(nq(raw))) return 'action'
  return 'unknown'
}

function scoreAction(n: string, action: LolaAction): number {
  let score = 0
  for (const kw of action.keywords) {
    const k = normalize(kw)
    if (!k) continue
    if (n === k) score += 8
    else if (n.includes(k)) score += 4
    else {
      const parts = k.split(' ').filter((p) => p.length >= 3)
      const hits = parts.filter((p) => n.includes(p)).length
      if (parts.length && hits === parts.length) score += 3
      else if (hits) score += 1
    }
  }
  return score
}

export function matchLolaAction(raw: string): { action: LolaAction; score: number } | null {
  const n = nq(raw)
  if (!n) return null
  let best: { action: LolaAction; score: number } | null = null
  for (const action of LOLA_ACTIONS) {
    const score = scoreAction(n, action)
    if (!best || score > best.score) best = { action, score }
  }
  if (!best || best.score < 3) return null
  return best
}

function formatActionTrainer(action: LolaAction): string {
  const say = action.sayToLola[0]
  const propose = action.canPropose
    ? `\nJe peux aussi le préparer pour vous. Ex. : « ${say} » puis « oui ».`
    : say
      ? `\nExemple : « ${say} ».`
      : ''
  return `${action.title} — ${action.path}\n\n${action.howTo}${propose}`
}

export function answerLolaTrainer(raw: string, pathname = ''): string | null {
  const n = nq(raw)
  if (!n) return null
  // Ne pas voler une création (« crée une INT », « fiche clim pour Dupont »)
  if (CREATE_VERBS.test(n) && !wantsHowTo(raw)) return null

  const matched = matchLolaAction(raw)
  if (wantsHowTo(raw)) {
    if (matched) return formatActionTrainer(matched.action)
    return overviewTrainer(pathname)
  }

  // Navigation courte : « ouvre l’agenda »
  if (/\b(ouvre|ouvrir|va sur|vas sur)\b/.test(n) && matched) {
    return formatActionTrainer(matched.action)
  }

  return null
}

function overviewTrainer(pathname: string): string {
  const here = LOLA_ACTIONS.find((a) => pathname && pathname.startsWith(a.path.split('?')[0]))
  const lines = [
    'Je suis Lola, formateur ClimaZEN. Je lis vos données et je vous guide — je n’écris rien sans « oui ».',
    '',
    'Actions principales :',
    ...LOLA_ACTIONS.slice(0, 10).map((a) => `• ${a.title} → ${a.path}`),
    '• … CERFA, devis, commandes, contrats, fiches, équipe, profil, voix.',
    '',
    'Exemples : « combien d’INT ce mois ? » · « où est le client Dupont ? » · « comment faire un CERFA ? »',
  ]
  if (here) {
    lines.splice(1, 0, `Vous êtes sur ${here.title} (${here.path}).`)
  }
  return lines.join('\n')
}

function monthPrefix(iso = todayIsoLocal()): string {
  return iso.slice(0, 7)
}

function monthLabelFr(ym: string): string {
  const names = [
    'janvier',
    'février',
    'mars',
    'avril',
    'mai',
    'juin',
    'juillet',
    'août',
    'septembre',
    'octobre',
    'novembre',
    'décembre',
  ]
  const m = Number(ym.slice(5, 7))
  return `${names[(m || 1) - 1] || m} ${ym.slice(0, 4)}`
}

function domainHint(hits: SearchHit[], n: string): LolaAction | null {
  const top = hits[0]?.domain
  const byDomain: Record<string, LolaActionId> = {
    ot: 'liste_int',
    client: 'clients',
    site: 'sites',
    piece: 'stock_pieces',
    commande: 'commandes',
    devis: 'devis',
    fluide: 'stock_fluides',
    agenda: 'agenda',
    detecteur: 'profil',
    tech: 'equipe',
    absence: 'absences',
    contrat: 'contrats',
    voiture: 'profil',
    outillage: 'profil',
    cerfa: 'cerfa',
  }
  if (top && byDomain[top]) {
    return LOLA_ACTIONS.find((a) => a.id === byDomain[top]) || null
  }
  return matchLolaAction(n)?.action || null
}

function extraSearchHits(data: AppData, raw: string): SearchHit[] {
  const tokens = nq(raw)
    .split(' ')
    .filter((t) => t.length >= 2)
  if (!tokens.length) return []
  const hits: SearchHit[] = []
  const has = (blob: string, t: string) => normalize(blob).includes(t)

  for (const a of data.demandesAbsence || []) {
    const blob = `${a.technicienName || ''} ${a.type} ${a.motif || ''} ${a.statut}`
    if (tokens.some((t) => has(blob, t) || t === 'absence' || t === 'conges' || t === 'vacances')) {
      const type = ABSENCE_TYPE_LABELS[a.type] || a.type
      const st = ABSENCE_STATUT_LABELS[a.statut] || a.statut
      hits.push({
        domain: 'absence',
        score: 55,
        line: `Absence ${a.technicienName || '—'} · ${type} · ${a.dateDebut} → ${a.dateFin} · ${st}`,
      })
    }
  }
  for (const c of data.contratsMaintenance || []) {
    const blob = `${c.titre || ''} ${c.numero || ''} ${c.statut || ''} ${c.modeleId || ''}`
    if (tokens.some((t) => has(blob, t) || t === 'contrat' || t === 'contrats')) {
      hits.push({
        domain: 'contrat',
        score: 50,
        line: `Contrat ${c.numero || '—'} — « ${(c.titre || '').slice(0, 50) || '—'} » · ${c.statut || '—'}`,
      })
    }
  }
  for (const v of data.voitures || []) {
    const blob = `${v.matricule || ''} ${v.marque || ''} ${v.modele || ''} ${v.assigneeName || ''}`
    if (tokens.some((t) => has(blob, t) || t === 'voiture' || t === 'vehicule')) {
      hits.push({
        domain: 'voiture',
        score: 50,
        line: `Véhicule ${v.matricule || v.marque || '—'} · ${v.assigneeName || 'non attribué'}`,
      })
    }
  }
  for (const o of data.outillages || []) {
    const blob = `${o.identification} ${o.marque || ''} ${o.assigneeName || ''} ${o.type}`
    if (tokens.some((t) => has(blob, t) || t === 'outillage' || t === 'outil')) {
      hits.push({
        domain: 'outillage',
        score: 50,
        line: `Outillage ${o.identification}${o.assigneeName ? ` · ${o.assigneeName}` : ''}`,
      })
    }
  }
  for (const i of data.interventions || []) {
    const blob = `${i.numeroIntervention || ''} ${i.cerfaPdfFileName || ''}`
    if (tokens.some((t) => has(blob, t) || t === 'cerfa')) {
      hits.push({
        domain: 'cerfa',
        score: 45,
        line: `CERFA ${i.numeroIntervention || i.id.slice(0, 8)} · ${i.dateIntervention || ''}`,
      })
    }
  }
  return hits.slice(0, 12)
}

function relevantTotals(data: AppData, n: string): string[] {
  const today = todayIsoLocal()
  const ym = monthPrefix(today)
  const month = computeOtStats(data, { monthYm: ym })
  const allOpen = (data.ordresTravail || []).filter((o) => !isOtCloture(o.statut))
  const lines: string[] = []

  if (/\b(int|intervention|ot|ordre|clotur|ouvert|mois)\b/.test(n) || COUNT_RE.test(n)) {
    lines.push(
      `${month.open} INT encore ouverte${month.open > 1 ? 's' : ''} en ${monthLabelFr(ym)} (${month.closed} clôturée${month.closed > 1 ? 's' : ''} ce mois, ${allOpen.length} ouverte${allOpen.length > 1 ? 's' : ''} au total).`,
    )
  }
  if (/\bclient/.test(n)) {
    lines.push(`${(data.clients || []).length} client(s) au parc.`)
  }
  if (/\bsite|\bchantier/.test(n)) {
    lines.push(`${(data.chantiers || []).length} site(s).`)
  }
  if (/\bdevis\b/.test(n)) {
    lines.push(`${(data.devis || []).length} devis.`)
  }
  if (/\bcommande/.test(n)) {
    lines.push(`${(data.commandesFournisseur || []).length} commande(s) fournisseur.`)
  }
  if (/\bpiece|\bfiltre|\bcompresseur|\bmagasin/.test(n)) {
    lines.push(`${(data.piecesDetachees || []).length} pièce(s) magasin.`)
  }
  if (/\bbouteille|\bfluide|\br\d|\bstock/.test(n)) {
    lines.push(`${(data.stock || []).length} bouteille(s) fluide.`)
  }
  if (/\babsence|\bconges|\bvacances|\brtt/.test(n)) {
    lines.push(`${(data.demandesAbsence || []).length} demande(s) d’absence.`)
  }
  if (/\bdetecteur/.test(n)) {
    lines.push(`${(data.detecteurs || []).length} détecteur(s).`)
  }
  if (!lines.length) {
    lines.push(
      `${allOpen.length} INT ouverte${allOpen.length > 1 ? 's' : ''} · ${(data.clients || []).length} client(s) · ${(data.chantiers || []).length} site(s).`,
    )
  }
  return lines
}

/**
 * Réponse locale à une petite recherche. Jamais « je ne sais pas » sans indiquer
 * où regarder dans l’app.
 */
export function answerLolaLookup(
  data: AppData,
  raw: string,
  team?: TeamMemberLite[],
): string | null {
  if (!wantsLookup(raw)) return null

  const n = nq(raw)
  const hits = [
    ...searchOrgData(data, raw, { team, max: 12 }),
    ...extraSearchHits(data, raw),
  ]
  const seen = new Set<string>()
  const unique: SearchHit[] = []
  for (const h of hits) {
    if (seen.has(h.line)) continue
    seen.add(h.line)
    unique.push(h)
    if (unique.length >= 12) break
  }

  const totals = relevantTotals(data, n)
  const action = domainHint(unique, n)
  const lines: string[] = []

  // Phrase 1 = le chiffre (voix terrain)
  lines.push(totals[0] || 'Voici ce que je trouve dans vos données.')
  for (const t of totals.slice(1)) lines.push(t)

  if (unique.length) {
    lines.push('', 'Trouvé :')
    for (const h of unique.slice(0, 8)) lines.push(`• ${h.line}`)
    if (unique.length > 8) lines.push(`… +${unique.length - 8} autre(s)`)
  } else {
    const named = raw.match(
      /(?:client|site|devis|int|ot|piece|pi[eè]ce|bouteille|detecteur|mr|mme)\s+([A-Za-zÀ-ÿ0-9'’.-]{2,40})/i,
    )?.[1]
    lines.push(
      '',
      named
        ? `Je n’ai pas trouvé « ${named.trim()} » dans les libellés. Vérifiez l’orthographe, ou ouvrez la page ci-dessous pour filtrer.`
        : 'Aucun nom / réf. précis dans la question — je m’appuie sur les totaux ci-dessus.',
    )
  }

  if (action) {
    lines.push('', `Pour le voir dans l’app : ${action.title} → ${action.path}`)
    if (action.sayToLola[0] && action.canPropose) {
      lines.push(`Si vous voulez que je prépare une action : « ${action.sayToLola[0]} » puis « oui ».`)
    }
  } else {
    lines.push('', 'Pages utiles : Interventions /app/ot · Clients /app/clients · Stock /app/stock')
  }

  return lines.join('\n')
}

/** Bloc compact injecté dans le prompt cloud (formateur + actions). */
export function trainerCatalogForPrompt(): string {
  const list = LOLA_ACTIONS.map((a) => `• ${a.title} (${a.path}) — dire : « ${a.sayToLola[0] || a.title} »`).join(
    '\n',
  )
  return `=== FORMATEUR LOLA (toutes les actions du site) ===
Tu es aussi formateur : tu aides l’utilisateur comme un collègue qui connaît TOUS les menus.
1) Lecture de données : cite d’abord les TOTAUX et la RECHERCHE du contexte. N’invente aucun chiffre. N’avoue pas « je ne trouve pas » si un total répond à la question.
2) Explique OÙ cliquer (nom du menu + chemin /app/…).
3) Si tu peux le faire : propose l’action et demande « oui ». N’affirme jamais « c’est fait ».
4) Réponses courtes, étapes numérotées, français terrain.

${list}`
}

export function listClientsBrief(data: AppData, max = 8): string {
  const clients = data.clients || []
  if (!clients.length) return 'Aucun client au parc.'
  return clients
    .slice(0, max)
    .map((c) => clientDisplayName(c))
    .join(' · ')
}
