/**
 * Rappels sécurité terrain — messages courts, oraux, qui tournent.
 * Sensibilisation : EPI, conduite, chaufferie/CO, toiture, électricité/SAT, véhicule.
 */

import type { OrdreTravail } from './ordreTravail'
import type { Equipement, Site } from './types'
import type { PointageAction } from './pointage'
import { normaliserAction } from './pointage'
import { allEquipements } from './cerfaBatch'
import { docsFichesPourEquipements } from './equipementFiche'

export type SafetyTipContext =
  | 'arrivee'
  | 'deplacement'
  | 'vehicule_hebdo'
  | 'toiture'
  | 'electricite'
  | 'chaufferie'
  | 'general'

export type SafetyTip = {
  id: string
  contexts: SafetyTipContext[]
  /** Texte écran (court). */
  text: string
  /** Phrase orale (peut être un peu plus longue / naturelle). */
  speak: string
}

const STORAGE_DAY = 'climazen_safety_tip_day'
const STORAGE_INDEX = 'climazen_safety_tip_idx'
const STORAGE_VEHICULE_WEEK = 'climazen_safety_vehicule_week'
const STORAGE_LAST_ID = 'climazen_safety_last_id'

export const SAFETY_TIPS: SafetyTip[] = [
  // —— Arrivée / chantier ——
  {
    id: 'arr-epi',
    contexts: ['arrivee', 'general'],
    text: 'Sur site : EPI complets avant de commencer (chaussures, gants, lunettes).',
    speak: 'Rappel sécurité : sur site, mets tes équipements de protection avant de commencer.',
  },
  {
    id: 'arr-balisage',
    contexts: ['arrivee'],
    text: 'Sécurise la zone : balisage, accès client, matériel hors passage.',
    speak: 'Rappel : balise la zone et laisse le passage libre pour le client.',
  },
  {
    id: 'arr-registre',
    contexts: ['arrivee', 'general'],
    text: 'Pense au registre de sécurité si tu interviens sur une installation.',
    speak: 'Rappel : pense au registre de sécurité du site si tu touches à l’installation.',
  },
  {
    id: 'arr-signalement',
    contexts: ['arrivee', 'general'],
    text: 'Anomalie dangereuse ? Stoppe, sécurise, préviens le bureau.',
    speak: 'Si tu vois une anomalie dangereuse, arrête, sécurise, et préviens le bureau.',
  },

  // —— Déplacement / conduite ——
  {
    id: 'dep-alcool',
    contexts: ['deplacement'],
    text: 'Au volant : zéro alcool, zéro stupéfiants. Sécurité avant tout.',
    speak: 'Rappel conduite : ne conduis jamais sous alcool ou stupéfiants.',
  },
  {
    id: 'dep-telephone',
    contexts: ['deplacement'],
    text: 'Téléphone au volant : kit main libre ou arrêt complet.',
    speak: 'Au volant, utilise le main libre ou arrête-toi pour téléphoner.',
  },
  {
    id: 'dep-ceinture',
    contexts: ['deplacement'],
    text: 'Ceinture bouclée, vitesse adaptée, distance de sécurité.',
    speak: 'Rappel : ceinture, vitesse adaptée, et garde tes distances.',
  },
  {
    id: 'dep-fatigue',
    contexts: ['deplacement', 'general'],
    text: 'Fatigué ? Fais une pause avant de reprendre la route.',
    speak: 'Si tu es fatigué, fais une pause avant de reprendre la route.',
  },
  {
    id: 'dep-chargement',
    contexts: ['deplacement'],
    text: 'Charge bien arrimée : bouteilles, échelle, outillage.',
    speak: 'Vérifie que bouteilles, échelle et outillage sont bien arrimés.',
  },
  {
    id: 'dep-bouteilles-gaz',
    contexts: ['deplacement', 'arrivee'],
    text: 'Bouteilles de gaz (clim) : attachées solidement dans le véhicule, valves protégées.',
    speak: 'Attache bien tes bouteilles de gaz frigorigène dans la voiture, valves protégées — ce sont des gaz dangereux.',
  },
  {
    id: 'dep-bouteilles-manut',
    contexts: ['deplacement', 'arrivee', 'general'],
    text: 'Manutention bouteilles : verticales, sanglées, jamais en vrac sur le siège.',
    speak: 'Pour la manutention : bouteilles verticales et sanglées, jamais en vrac sur le siège.',
  },

  // —— Brasage / chalumeau ——
  {
    id: 'brasage-chalumeau',
    contexts: ['arrivee', 'general'],
    text: 'Chalumeau / brasage : zone dégagée, extincteur à portée, lunettes et gants.',
    speak: 'Au chalumeau ou au brasage : zone dégagée, extincteur à portée, lunettes et gants.',
  },
  {
    id: 'brasage-flammes',
    contexts: ['arrivee', 'general'],
    text: 'Brasage : éloigne matières inflammables, surveille la flamme jusqu’à extinction.',
    speak: 'Pendant le brasage, éloigne tout ce qui peut brûler et surveille la flamme jusqu’à extinction.',
  },
  {
    id: 'brasage-bouteilles',
    contexts: ['arrivee', 'deplacement'],
    text: 'Oxygène / acétylène : bouteilles attachées, détendeurs en bon état, pas de graisse.',
    speak: 'Bouteilles oxygène et acétylène : bien attachées, détendeurs OK, jamais de graisse sur les raccordements.',
  },

  // —— Véhicule hebdo ——
  {
    id: 'veh-huile-eau',
    contexts: ['vehicule_hebdo', 'deplacement'],
    text: 'Contrôle hebdo voiture : niveaux d’huile et d’eau / liquide de refroidissement.',
    speak: 'Rappel hebdomadaire : contrôle les niveaux d’huile et d’eau de la voiture.',
  },
  {
    id: 'veh-pneus',
    contexts: ['vehicule_hebdo'],
    text: 'Coup d’œil pneus, freins et voyants avant de partir.',
    speak: 'Avant de partir, jette un œil aux pneus, freins et voyants du tableau de bord.',
  },
  {
    id: 'veh-laveglace',
    contexts: ['vehicule_hebdo', 'deplacement'],
    text: 'Lave-glace et essuie-glaces OK ? Visibilité = sécurité.',
    speak: 'Vérifie lave-glace et essuie-glaces : la visibilité, c’est la sécurité.',
  },

  // —— Chaufferie / CO ——
  {
    id: 'chauf-co',
    contexts: ['chaufferie', 'arrivee'],
    text: 'Chaufferie : prends ton détecteur CO avant d’entrer.',
    speak: 'Chaufferie : récupère ton détecteur de monoxyde de carbone avant d’entrer.',
  },
  {
    id: 'chauf-aera',
    contexts: ['chaufferie'],
    text: 'Vérifie aération et accès gaz. Ne reste pas seul trop longtemps.',
    speak: 'En chaufferie, vérifie l’aération et l’accès gaz. Ne reste pas isolé trop longtemps.',
  },
  {
    id: 'chauf-epi',
    contexts: ['chaufferie', 'arrivee'],
    text: 'Chaufferie : EPI + chaussures adaptées, sol souvent glissant.',
    speak: 'En chaufferie, mets tes EPI : le sol est souvent glissant.',
  },
  {
    id: 'chauf-vanne',
    contexts: ['chaufferie'],
    text: 'Repère la vanne d’arrêt gaz avant d’intervenir.',
    speak: 'Repère la vanne d’arrêt gaz avant de commencer l’intervention.',
  },

  // —— Toiture / hauteur ——
  {
    id: 'toit-harnais',
    contexts: ['toiture'],
    text: 'Toiture / hauteur : harnais accroché avant de monter.',
    speak: 'Travail en hauteur : accroche ton harnais avant de monter.',
  },
  {
    id: 'toit-ancrage',
    contexts: ['toiture'],
    text: 'Points d’ancrage, échelle stable, météo et vent OK.',
    speak: 'Vérifie points d’ancrage, échelle stable, et la météo avant d’aller en toiture.',
  },
  {
    id: 'toit-seul',
    contexts: ['toiture'],
    text: 'Ne travaille pas en hauteur seul sans prévenir quelqu’un.',
    speak: 'Ne travaille pas en hauteur seul : préviens un collègue ou le bureau.',
  },

  // —— Électricité / SAT ——
  {
    id: 'elec-sat',
    contexts: ['electricite'],
    text: 'Électricité / SAT : consignation, VAT, et EPI isolants.',
    speak: 'Sur du SAT ou de l’électricité : consignation, vérification d’absence de tension, EPI isolants.',
  },
  {
    id: 'elec-consign',
    contexts: ['electricite'],
    text: 'Ne touche jamais un circuit sans être sûr qu’il est hors tension.',
    speak: 'Ne touche jamais un circuit sans être sûr qu’il est hors tension.',
  },
  {
    id: 'elec-humidite',
    contexts: ['electricite', 'arrivee'],
    text: 'Zone humide + électricité : double vigilance.',
    speak: 'Zone humide et électricité : redouble de vigilance.',
  },

  // —— Général ——
  {
    id: 'gen-hydratation',
    contexts: ['general'],
    text: 'Pense à boire, surtout en local technique chaud.',
    speak: 'Pense à t’hydrater, surtout dans les locaux techniques chauds.',
  },
  {
    id: 'gen-eau-ete',
    contexts: ['general', 'arrivee', 'deplacement'],
    text: 'Il fait chaud ? Bois de l’eau régulièrement et rafraîchis-toi à l’ombre.',
    speak: 'N’oublie pas de boire de l’eau, surtout quand il fait chaud l’été, et prends le temps de te rafraîchir.',
  },
  {
    id: 'gen-coup-chaleur',
    contexts: ['general', 'arrivee'],
    text: 'Coup de chaleur : vertiges, nausée → stoppe, bois, mets-toi au frais, préviens.',
    speak: 'Si tu sens un coup de chaleur — vertiges ou nausée — arrête, bois, mets-toi au frais et préviens quelqu’un.',
  },
  {
    id: 'gen-dos',
    contexts: ['general', 'arrivee'],
    text: 'Lève les charges avec les jambes, pas le dos.',
    speak: 'Pour soulever une charge, utilise tes jambes, pas ton dos.',
  },
  {
    id: 'gen-echelle',
    contexts: ['general', 'arrivee'],
    text: 'Échelle : trois points d’appui, quelqu’un au pied si possible.',
    speak: 'Sur une échelle, garde trois points d’appui. Idéalement quelqu’un au pied.',
  },
  {
    id: 'gen-gaz',
    contexts: ['general', 'arrivee'],
    text: 'Circuit frigo : lunettes et gants avant d’ouvrir.',
    speak: 'Avant d’ouvrir un circuit frigorifique, mets lunettes et gants.',
  },
  {
    id: 'gen-incendie',
    contexts: ['general'],
    text: 'Repère les issues et extincteurs en arrivant sur un site inconnu.',
    speak: 'Sur un site inconnu, repère les issues de secours et les extincteurs.',
  },
]

function readStorage(key: string): string {
  try {
    return localStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

export function isoWeekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

const TOITURE_RE = /toiture|hauteur|harnais|nacelle|toit\b|couverture|terrasse\s+tech/i
const ELEC_RE = /électri|electric|sat\b|consignat|tableau\s+élect|coffret|tension/i
const CHAUF_RE = /chaufferie|chaudi[eè]re|br[uû]leur|gaz\s+naturel|fioul/i

export function inferSafetyContexts(opts: {
  lastAction?: PointageAction | string | null
  ot?: Pick<OrdreTravail, 'action' | 'secteur' | 'typeOt' | 'docsRequis' | 'equipementId' | 'equipementIds'> | null
  site?: Pick<Site, 'nom' | 'equipements'> | null
  equipements?: Equipement[]
  forceVehiculeHebdo?: boolean
}): SafetyTipContext[] {
  const contexts: SafetyTipContext[] = []
  const action = opts.lastAction ? normaliserAction(opts.lastAction as PointageAction) : undefined

  if (action === 'deplacement' || action === 'sortie_domicile' || action === 'retour_domicile') {
    contexts.push('deplacement')
  }
  if (action === 'intervention_en_cours' || action === 'fin_intervention') {
    contexts.push('arrivee')
  }

  const blob = [
    opts.ot?.action,
    opts.site?.nom,
    ...(opts.equipements || []).map((e) => `${e.nom || ''} ${e.type || ''}`),
  ]
    .filter(Boolean)
    .join(' ')

  const eqs = opts.equipements || (opts.site ? allEquipements(opts.site as Site) : [])
  const docs = [
    ...(opts.ot?.docsRequis || []),
    ...docsFichesPourEquipements(eqs),
  ]

  if (
    opts.ot?.secteur === 'electricien' ||
    ELEC_RE.test(blob) ||
    ELEC_RE.test(String(opts.ot?.secteur || ''))
  ) {
    contexts.push('electricite')
  }
  if (TOITURE_RE.test(blob)) contexts.push('toiture')
  if (
    docs.includes('fiche_chaufferie') ||
    CHAUF_RE.test(blob) ||
    opts.ot?.secteur === 'tech_cvc'
  ) {
    // CVC alone is weak — only add chaufferie if docs or keywords
    if (docs.includes('fiche_chaufferie') || CHAUF_RE.test(blob)) {
      contexts.push('chaufferie')
    }
  }

  if (opts.forceVehiculeHebdo) contexts.push('vehicule_hebdo')

  if (!contexts.length) contexts.push('general')
  return [...new Set(contexts)]
}

function tipsForContexts(contexts: SafetyTipContext[]): SafetyTip[] {
  const set = new Set(contexts)
  const matched = SAFETY_TIPS.filter((t) => t.contexts.some((c) => set.has(c)))
  return matched.length ? matched : SAFETY_TIPS.filter((t) => t.contexts.includes('general'))
}

/**
 * Choisit un rappel : contexte du moment + rotation (évite de répéter le même).
 * `vehicule_hebdo` au plus une fois par semaine ISO.
 */
export function pickSafetyTip(opts: {
  lastAction?: PointageAction | string | null
  ot?: OrdreTravail | null
  site?: Site | null
  equipements?: Equipement[]
  now?: Date
  /** Si true, ne lit / n’écrit pas localStorage (tests). */
  dryRun?: boolean
  weekVehiculeAlreadyShown?: boolean
}): SafetyTip {
  const now = opts.now || new Date()
  const week = isoWeekKey(now)
  const day = todayKey(now)

  let forceVehicule = false
  if (!opts.dryRun) {
    const shownWeek = readStorage(STORAGE_VEHICULE_WEEK)
    const action = opts.lastAction ? normaliserAction(opts.lastAction as PointageAction) : undefined
    if (
      shownWeek !== week &&
      (action === 'sortie_domicile' || action === 'deplacement')
    ) {
      forceVehicule = true
    }
  } else if (opts.weekVehiculeAlreadyShown === false) {
    forceVehicule = true
  }

  const contexts = inferSafetyContexts({
    lastAction: opts.lastAction,
    ot: opts.ot,
    site: opts.site,
    equipements: opts.equipements,
    forceVehiculeHebdo: forceVehicule,
  })

  // Priorité : contexte métier > déplacement > arrivée > général
  const priority: SafetyTipContext[] = [
    'vehicule_hebdo',
    'toiture',
    'electricite',
    'chaufferie',
    'deplacement',
    'arrivee',
    'general',
  ]
  const ordered = priority.filter((c) => contexts.includes(c))
  const pool = tipsForContexts(ordered.length ? [ordered[0], ...ordered.slice(1, 2)] : ['general'])

  let lastId = opts.dryRun ? '' : readStorage(STORAGE_LAST_ID)
  let idx = opts.dryRun ? 0 : Number(readStorage(STORAGE_INDEX) || '0') || 0
  const dayStored = opts.dryRun ? '' : readStorage(STORAGE_DAY)

  // Nouveau jour → décale l’index pour varier
  if (!opts.dryRun && dayStored !== day) {
    idx = (idx + 1) % Math.max(pool.length, 1)
    writeStorage(STORAGE_DAY, day)
    writeStorage(STORAGE_INDEX, String(idx))
  }

  let pick = pool[idx % pool.length]
  if (pool.length > 1 && pick.id === lastId) {
    pick = pool[(idx + 1) % pool.length]
  }

  if (!opts.dryRun) {
    writeStorage(STORAGE_LAST_ID, pick.id)
    writeStorage(STORAGE_INDEX, String((idx + 1) % Math.max(pool.length, 1)))
    if (forceVehicule || pick.contexts.includes('vehicule_hebdo')) {
      writeStorage(STORAGE_VEHICULE_WEEK, week)
    }
  }

  return pick
}

/** Phrase orale courte à enchaîner après un pointage. */
export function speakSafetyAfterPunch(tip: SafetyTip): string {
  return tip.speak
}
