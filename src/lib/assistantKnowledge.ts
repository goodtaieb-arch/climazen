/**
 * Base de connaissances ClimaZEN — intelligence unique (app + Lola téléphone).
 * Utilisée en local (sans clé API) et comme contexte pour OpenAI.
 */

import { AI_UNIFIED_SYSTEM_RULES, wantsAnnulerOt, answerAnnulerOtGuide, AI_HOW_I_WORK } from './aiActionCatalog'
import { wantsStockPieceQuery, answerStockPieceQuery } from './assistantStockPieces'
import type { AppData } from './types'

export type AideTopic = {
  id: string
  title: string
  keywords: string[]
  /** Chemins app où le sujet est particulièrement pertinent */
  paths?: string[]
  answer: string
}

export const AIDE_SYSTEM_PROMPT = `Tu es l’intelligence ClimaZEN UNIQUE (assistant dans l’app ET Lola au téléphone) pour techniciens froid / clim.

${AI_UNIFIED_SYSTEM_RULES}

ACCÈS DONNÉES (ouvert, pas cas par cas) :
- Chaque message contient un bloc « DONNÉES RÉELLES DE LA SOCIÉTÉ » : totaux de TOUS les domaines (interventions/INT, clients, sites, devis, commandes, pièces, fluides, CERFA, agenda, équipe…) + une RECHERCHE libre sur les mots de la question.
- Tu réponds à N’IMPORTE quelle question métier à partir de ce bloc. Pas besoin d’une formulation précise ni d’un exemple appris.
- Les TOTAUX sont exacts même si une liste est tronquée. « or » / « o.t » / « ot » / « di » = INT (intervention).
- Interdit d’inventer un chiffre, un client ou une INT absente du bloc. Si tu ne trouves pas : dis-le et propose comment reformuler ou où regarder dans l’app.
- Si un rapport d’intervention mentionne une pièce HS / à changer / bruyante : oriente vers la chaîne « demande devis fournisseur + devis client » (validation humaine).

Parcours principaux :
1) Intervenir → /app/appel (nouvelle INT, case astreinte si besoin) ou dossier INT déjà ouverte (Rédiger / signer / fin) → client, site, équipements → docs → signatures → Clôturer (HUMAIN).
2) CERFA → /app/interventions (PDF final = HUMAIN).
3) Stock fluides → /app/stock.
4) Clients / Sites → équipements.
5) Agenda → /app/agenda.
6) Devis → /app/devis · Commandes → /app/commandes · Pièces → /app/stock-pieces.
7) Mon entreprise → /app/operateur (clé IA Cloud : OpenAI et/ou Claude + numéro Twilio).

Astreinte : Accueil → Intervenir (nouvelle INT) → cocher « C’est une astreinte ». Le dossier d’une INT déjà ouverte (Rédiger / signer / fin) reste simple — pas d’agent accueil IA (le bouton Aide IA est déjà permanent).

Pointage : le tech ne modifie jamais une heure déjà enregistrée. Oubli « en cours » à l’arrivée → bureau (Pointeuse) ou Aide IA (vérifie le GPS puis corrige).

Règles stock / CERFA :
- Récupération temporaire → bouteilles Transfert / Service.
- Démantèlement / récup. définitive → bouteilles Récupération.
- N° de série = officiel CERFA ; Surnom = interne.
`

export const AIDE_TOPICS: AideTopic[] = [
  {
    id: 'comment-lola',
    title: 'Comment Lola / l’assistant fonctionne',
    keywords: [
      'comment tu marches',
      'comment tu fonctionnes',
      'comment lola',
      'ce que tu fais',
      'ce que tu peux',
      'aide ia',
      'comment ca marche',
      'comment ça marche',
    ],
    paths: ['/app'],
    answer: AI_HOW_I_WORK,
  },
  {
    id: 'stock-pieces-lola',
    title: 'Stock pièces / arrivée (Lola)',
    keywords: [
      'filtre m5',
      'en stock',
      'combien de',
      'est arrive',
      'est arrivé',
      'piece arrive',
      'préviens',
      'previens',
      'stock pieces',
      'stock pièces',
    ],
    paths: ['/app/stock-pieces', '/app/commandes'],
    answer: `Stock pièces (magasin) et commandes fournisseur :
• « Combien de filtre M5 ? » / « Le compresseur est arrivé ? » → je lis le stock et le statut commande.
• « Préviens-moi quand le filtre M5 arrive » → veille : Accueil notifié à la réception.
• Ajout magasin : « ajoute pièce … » puis « oui ».
Fluides F-Gas restent sur /app/stock (bouteilles).`,
  },
  {
    id: 'annuler-ot',
    title: 'Annuler / retirer / déplacer une intervention',
    keywords: [
      'annule',
      'annuler',
      'anulle',
      'anuller',
      'supprime',
      'supprimer',
      'retirer',
      'deplacer',
      'déplacer',
      'enlever ot',
      'enlever int',
      'intervention',
    ],
    paths: ['/app/agenda', '/app/ot', '/app/appel'],
    answer: `Je ne peux pas annuler (= supprimer) une intervention (INT / INT / DI).

Pour corriger le planning :
• Agenda → croix rouge sur le bloc = retirer l’INT du tech (revient dans « à poser »)
• Recliquer / reposer = déplacer l’heure ou changer de tech
• Interventions → ouvrir l’INT pour modifier date, tech, action`,
  },
  {
    id: 'pointage-oubli',
    title: 'Oubli de pointer en cours / corriger les heures',
    keywords: [
      'pointage',
      'pointeuse',
      'oublie',
      'oublié',
      'en cours',
      'arrivée',
      'gps',
      'heure',
      'horodatage',
      'corriger pointage',
    ],
    paths: ['/app/pointage', '/app'],
    answer: `Le technicien ne peut pas modifier une heure déjà enregistrée (porte-à-porte).

Oubli « En cours d’intervention » en arrivant sur site :
• Appeler le bureau → Pointeuse → « Corriger une arrivée oubliée » (l’heure que le tech donne).
• Ou Aide IA : « j’ai oublié de pointer en cours, arrivé à 10h15 » → « oui » → l’IA vérifie le GPS et corrige.

Sans GPS, l’IA refuse — le bureau reste la solution.`,
  },
  {
    id: 'parcours-ot',
    title: 'Parcours Intervention / Intervenir',
    keywords: [
      'ot',
      'int',
      'di',
      'ordre',
      'intervention',
      'appel',
      'intervenir',
      'client appelle',
      'astreinte',
      'urgence',
      'cloturer',
      'clôturer',
      'parcours',
      'etape',
      'étape',
      'avancement',
      'partiel',
      'pourcentage',
      'présence',
    ],
    paths: ['/app/appel', '/app/ot'],
    answer: `Parcours terrain typique :
1. Accueil → « Intervenir » (nouvelle INT) ou Mes interventions → « Rédiger / signer / fin » (INT déjà ouverte).
2. Nouvelle INT : cochez « C’est une astreinte » si hors horaires / week-end / nuit.
3. Remplir INT → Client → Site → Équipement(s).
4. Étape Documents : CERFA (si fluide), fiche checklist optionnelle, signatures.
5. « Valider la présence du jour » (signature client, même si le travail n’est pas fini) ou « Clôturer signé » quand c’est terminé.

Le dossier d’une INT déjà ouverte est volontairement simple. L’IA c’est le bouton Aide IA (permanent) — Cloud OpenAI et/ou Claude, pas un second panneau « accueil téléphone » dans l’INT.

Chantier sur plusieurs jours : cochez « Intervention partielle », mettez le %, faites signer le client à chaque passage. L’intervention reste ouverte jusqu’à clôture.

Après un CERFA, utilise « Retour à l’intervention — signer & clôturer » pour ne pas tout quitter.`,
  },
  {
    id: 'cerfa',
    title: 'Faire un CERFA',
    keywords: ['cerfa', '15497', 'pdf', 'generer', 'générer', 'intervention', 'fiche'],
    paths: ['/app/interventions'],
    answer: `Pour un CERFA :
1. Depuis l’intervention → bouton CERFA, ou menu CERFA.
2. Cochez les natures vous-même. Destruction / BSFF : « Démantèlement / récup. définitive (déchet) ». Réinjection prévue : « Récupération temporaire ».
3. Fluide [7], puis en [11] : « Récupérer le gaz (D/E) » et/ou « Recharger du neuf (A/B/C) ».
4. Signatures → « Enregistrer & générer ce CERFA ».

Le PDF se voit sous le formulaire. Le brouillon (bouteilles comprises) se sauve tout seul.`,
  },
  {
    id: 'recup-temporaire',
    title: 'Récupération temporaire',
    keywords: ['temporaire', 'reparation', 'réparation', 'reinjection', 'réinjection', 'transfert', 'service'],
    paths: ['/app/interventions', '/app/stock'],
    answer: `Récupération temporaire (réinjection prévue) :
- Cochez la nature « Récupération temporaire (réinjection prévue) ».
- Seules les bouteilles « Transfert / Service » sont proposées.
- Ensuite vous pourrez réinjecter depuis cette bouteille (pas une récup. déchet).

Le n° de série officiel reste obligatoire ; le surnom (ex. camion Luc) est optionnel.`,
  },
  {
    id: 'recup-definitive',
    title: 'Récupération définitive / déchet',
    keywords: ['definitive', 'définitive', 'dechet', 'déchet', 'demantelement', 'démantèlement', 'bsff', 'rebut'],
    paths: ['/app/interventions', '/app/stock'],
    answer: `Récupération définitive / démantèlement :
- Nature « Démantèlement / récup. définitive (déchet) » — à cocher vous-même en [4].
- Bouton orange « Récupérer le gaz (D / E) » → bouteille Récupération (déchet).
- Ce gaz va au traitement / BSFF — jamais en recharge.

Pour vidanger puis remettre du neuf : même CERFA, ajoutez aussi « Recharger du neuf (A) ».

Dans Stock, le déchet apparaît dans le bloc orange, séparé du stock utilisable.`,
  },
  {
    id: 'reparation-recup-neuf',
    title: 'Réparation : récup destruction + gaz neuf',
    keywords: [
      'reparation',
      'réparation',
      'destruction',
      'neuf',
      'recharge',
      'vidange',
      'bouteille d',
      'bouteille e',
      'appoint',
      'liste vide',
      'annuler',
      'choisir',
      'disparu',
      'menu bouteille',
    ],
    paths: ['/app/interventions', '/app/stock'],
    answer: `Vidanger pour destruction puis recharger du neuf :
1. En [4], cochez vous-même « Démantèlement / récup. définitive (déchet) » (et « Charge de fluide » si vous remettez du neuf). Pas de raccourci : c’est le tech qui choisit.
2. Fluide [7].
3. Bouton orange « Récupérer le gaz (D / E) » → bouteille Récupération (déchet).
4. Bouton vert « Recharger du neuf (A / B / C) » → bouteille Vierge / Régénéré.
Les lettres D/E et A/B/C se mettent toutes seules. Le choix de bouteille est enregistré dans le brouillon si vous quittez la page.
Si le menu « Contenant / bouteille » est vide : vérifiez [7], ou utilisez le bouton orange pour une bouteille Récupération (D/E) plutôt que le bouton vert (A/B/C). Annuler une sélection remet la bouteille dans la liste.`,
  },
  {
    id: 'stock',
    title: 'Stock fluides',
    keywords: ['stock', 'bouteille', 'kg', 'utilisable', 'jauge', 'fluide'],
    paths: ['/app/stock'],
    answer: `Stock fluides (/app/stock) a 2 blocs :
• Vert — Stock utilisable (charge / appoint / service)
• Orange — Récupération déchet (BSFF uniquement)

Ajout rapide : photo de l’étiquette bouteille ou scan QR / code-barres pour préremplir n°, fluide, UN, capacité / tare si lisibles. Vérifiez toujours avant d’enregistrer.

Totaux kg séparés pour ne pas mélanger gaz utilisable et déchet.`,
  },
  {
    id: 'agenda',
    title: 'Agenda / RDV',
    keywords: ['agenda', 'rdv', 'rendez-vous', 'rappel', 'planifie', 'programme', 'calendrier', 'visite'],
    paths: ['/app/agenda'],
    answer: `Agenda (/app/agenda) : RDV, maintenances, contrôles d’étanchéité, rappels d’appel.

Via l’assistant, dites par ex. :
• « Agenda RDV demain 14h pour Mr Martin site Atelier »
• « Planifie un rappel appel client Mr Dupont demain »
• « Programme maintenance le 20/08 »

Répondez « oui » pour créer. Ouvrez ensuite l’événement pour ajuster heure / statut.`,
  },
  {
    id: 'a2l',
    title: 'Bouteilles A2L',
    keywords: ['a2l', 'a3', 'inflammable', 'r-32', 'r32', 'triangle', 'collerette'],
    paths: ['/app/stock', '/app/interventions'],
    answer: `Fluides A2L/A3 (ex. R-32) :
- Bouteille de récup. doit être certifiée A2L/A3 (collerette rouge).
- Une bouteille marquée A2L ne peut pas servir pour un fluide A1 (ex. R-410A).
- Le triangle d’avertissement apparaît sur le stock pour les bouteilles destinées aux inflammables.`,
  },
  {
    id: 'numero-surnom',
    title: 'N° série et surnom',
    keywords: ['numero', 'numéro', 'serie', 'série', 'surnom', 'libelle', 'libellé', 'contenant', 'barcode'],
    paths: ['/app/stock'],
    answer: `Deux champs distincts :
• N° de série / contenant (obligatoire) → imprimé sur le CERFA (ex. BOT-32-4890).
• Surnom (optionnel) → aide interne (ex. « Transfert camion Luc »).

Le n° se remplit par scan QR/code-barres ou photo d’étiquette ; le surnom reste manuel.
Dans les menus : « Surnom (N° de série : BOT-XXX) ». Jamais mettre « Transfert » à la place du n° officiel.`,
  },
  {
    id: 'signatures',
    title: 'Signatures et clôture',
    keywords: ['signature', 'signer', 'technicien', 'client', 'detenteur', 'détenteur'],
    paths: ['/app/appel', '/app/equipe', '/app/interventions'],
    answer: `Signatures :
- Technicien : Équipe → son dossier (/app/equipe/…) — signature personnelle, invisible aux collègues. Reprise auto sur INT et CERFA.
- Client : signature à chaque intervention (pad vide sur chaque nouvel INT / CERFA / fiche). Pas de réutilisation auto de l’ancienne signature site.

Pour clôturer : signatures tech + client sur l’intervention, puis « Clôturer signé ».`,
  },
  {
    id: 'entreprise',
    title: 'Mon entreprise',
    keywords: ['entreprise', 'logo', 'attestation', 'siret', 'operateur', 'opérateur', 'nas', 'coffre', 'excel'],
    paths: ['/app/operateur'],
    answer: `Mon entreprise (/app/operateur) — administration seulement :
- Raison sociale, SIRET, attestation de capacité.
- Logo (apparaît sur le rapport INT).
- Dossier cloud RH : UN lien général (Drive / OneDrive / SharePoint). ClimaZEN classe ClimaZEN → Dossiers techniciens → nom du tech → catégorie.
- Coffre documents : NAS / Nextcloud. Les PDF ne sont pas sur le site. Le bureau ouvre CERFA / rapports depuis l’app. Copie Excel de secours (clients, sites, équipe…).
Signature personnelle : dossier Équipe. Détecteur / véhicules / outillage : Mon profil.`,
  },
  {
    id: 'coffre-docs',
    title: 'Coffre documents hors site',
    keywords: [
      'coffre',
      'nas',
      'webdav',
      'nextcloud',
      'pdf',
      'cerfa',
      'archive',
      'excel',
      'secours',
      'stockage',
    ],
    paths: ['/app/operateur', '/app/interventions', '/app/equipe'],
    answer: `Les PDF ne sont pas stockés sur ClimaZEN (place + sécurité). Tout part sur le NAS / Nextcloud de la société.
Le bureau n’ouvre jamais le coffre : il sort CERFA, rapport, devis depuis l’app, comme si le fichier était sur le site.
Seul le gérant (et les personnes cochées « Accès coffre documents » dans Équipe) voit l’URL / le jeton.
Une copie Excel à jour (clients, sites, équipements, équipe sans CNI, INT, stock…) est dans ClimaZEN/Documents/Secours/climazen-donnees.xlsx — pour tout régénérer si on perd le site.`,
  },
  {
    id: 'profil',
    title: 'Mon profil',
    keywords: ['profil', 'signature', 'detecteur', 'détecteur', 'ma signature', 'étalonnage', 'outillage'],
    paths: ['/app/profil', '/app/equipe'],
    answer: `Mon profil (/app/profil) :
- Outillage : menu frigoriste + CVC. Les appareils à étalonner (détecteur, balance, caméra thermique, analyseur de combustion, anémomètre…) exigent une date. L’accueil alerte 45 jours avant l’échéance, puis à expiration.
- Détecteur de fuite : le gérant crée l’outil et l’affecte ; contrôle < 1 an obligatoire pour le CERFA.
- Lien vers Mon dossier Équipe pour la signature CERFA (propre au tech, invisible aux autres).
Équipe → Dossier : signature + documents RH.`,
  },
  {
    id: 'dossier-rh',
    title: 'Dossier documents technicien',
    keywords: [
      'dossier',
      'cni',
      'permis',
      'vitale',
      'aptitude',
      'habilitation',
      'electrique',
      'électrique',
      'expiration',
      'expire',
      'expiré',
      'document',
      'equipe',
      'équipe',
      'rh',
      'drive',
      'onedrive',
      'photos',
      'piece',
      'pièce',
      'cloud',
      'signature',
    ],
    paths: ['/app/equipe', '/app/profil'],
    answer: `Dossier de chaque technicien (Équipe → Dossier, ou Mon profil → Mon dossier) :
• Signature CERFA personnelle — seul le tech la voit et la modifie ; reprise auto sur INT / CERFA.
• Identité (CNI / passeport / titre de séjour), permis, carte Vitale, visite médicale.
• Attestation d’aptitude fluides (cat. I–IV) — obligatoire pour le froid, validité typique 5 ans.
• Habilitation électrique (BR, B1V…) — obligatoire dès qu’on touche à l’électrique, recyclage ~3 ans.
• Selon chantiers : SST, CACES nacelle, travail en hauteur, AIPR, amiante SS4.
• Admin : RIB, justificatif de domicile, contrat, diplôme.

Saisissez la date limite des pièces que vous enregistrez. L’accueil alerte 45 jours avant, puis à l’expiration. Les pièces non disponibles se masquent avec la croix rouge — rien n’est imposé.
Les photos d’identité / scans ne sont pas stockés dans ClimaZEN. Sur chaque tech : bouton « Photos pièces » qui ouvre UNIQUEMENT le lien exact de CET opérateur (collé sous son nom dans Équipe). Google Drive, OneDrive ou SharePoint. Après la MAJ, un bandeau explique quoi faire dans VOTRE cloud (Drive Restreint, OneDrive Personnes spécifiques, SharePoint organisation). Si le dossier est public, l’app arrête et affiche l’alerte du cloud utilisé — identifiant + mot de passe obligatoires.
Les pièces d’identité (CNI, passeport, Vitale, RIB) ne sont visibles que par le gérant et les personnes qu’il autorise dans Équipe → « Donner accès identités » (secrétariat, accueil d’appels / agent IA). Un technicien ne voit pas le dossier identité d’un collègue.
L’attestation de capacité SOCIÉTÉ reste dans Mon entreprise. Le détecteur de fuite est dans Mon profil.`,
  },
  {
    id: 'offline',
    title: 'Hors ligne / sync',
    keywords: ['offline', 'hors ligne', 'sync', 'synchron', 'reseau', 'réseau', 'connexion'],
    paths: ['/app'],
    answer: `ClimaZEN synchronise automatiquement PC et téléphone via le cloud :
• À chaque modification (sous ~1 s)
• Quand vous rouvrez l’app / repassez dessus
• Toutes les 20 secondes en arrière-plan
Le dernier changement gagne. Bouton « Actualiser maintenant » si besoin.
Hors ligne : les saisies restent sur l’appareil puis partent au retour du réseau.`,
  },
  {
    id: 'vocal',
    title: 'Dictée et commandes vocales',
    keywords: ['vocal', 'voix', 'dicter', 'micro', 'microphone', 'commande vocale', 'parler'],
    paths: ['/app'],
    answer: `Sur mobile (Chrome / Android) :
- Bouton « Dicter » sur panne, observations, rapport d’action, CERFA.
- Micro en bas à gauche : dites « stock », « appel », « interventions », « INT », « INT », « scan », « GPS », « CERFA », « sites » ou « aide ».
Sur iPhone, la dictée peut être limitée selon Safari.`,
  },
]

function normalize(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function suggestQuestionsForPath(pathname: string): string[] {
  const p = pathname || ''
  if (p.includes('/stock')) {
    return [
      'Différence stock utilisable et récupération déchet ?',
      'À quoi sert le surnom de bouteille ?',
      'Quand utiliser Transfert / Service ?',
    ]
  }
  if (p.includes('/interventions') || p.includes('/cerfa')) {
    return [
      'Comment faire une récupération temporaire ?',
      'Quelle bouteille pour un démantèlement ?',
      'Comment générer le PDF CERFA ?',
    ]
  }
  if (p.includes('/appel') || p.includes('/ot')) {
    return [
      'Crée une intervention pour contrôle d’étanchéité',
      'Comment clôturer une INT après le CERFA ?',
      'Où signer technicien et client ?',
    ]
  }
  if (p.includes('/agenda')) {
    return [
      'Agenda RDV demain 14h',
      'Planifie un rappel appel client',
      'Comment ajouter une visite ?',
    ]
  }
  if (p.includes('/equipe') || p.includes('/profil')) {
    return [
      'Quels documents mettre dans le dossier technicien ?',
      'Quelle validité pour l’aptitude froid ?',
      'Habilitation électrique obligatoire ?',
    ]
  }
  if (p.includes('/operateur')) {
    return ['Où mettre le logo société ?', 'Détecteur de fuite obligatoire ?']
  }
  return [
    'Crée une intervention + CERFA pour un client',
    'Agenda RDV demain 14h',
    'Stock utilisable vs déchet ?',
  ]
}

/** Réponse locale (sans API) — matching mots-clés + page courante. */
export function answerAideLocal(question: string, pathname = '', data?: AppData): string {
  const q = normalize(question)
  if (!q.trim()) {
    return 'Posez une question sur ClimaZEN (interventions, CERFA, stock, bouteilles…).'
  }

  if (wantsAnnulerOt(question)) {
    return `${answerAnnulerOtGuide(question)}\n\n— Assistant ClimaZEN (mode guide)`
  }

  if (data && wantsStockPieceQuery(question)) {
    return `${answerStockPieceQuery(data, question)}\n\n— Assistant ClimaZEN (mode guide)`
  }

  if (/comment\s+(tu|vous)\s+(marche|fonctionne)|ce\s+que\s+tu\s+(fais|peux)|comment\s+lola/.test(q)) {
    return `${AI_HOW_I_WORK}\n\n— Assistant ClimaZEN (mode guide)`
  }

  let best: AideTopic | null = null
  let bestScore = 0
  for (const topic of AIDE_TOPICS) {
    let score = 0
    for (const kw of topic.keywords) {
      if (q.includes(normalize(kw))) score += 2
    }
    if (topic.paths?.some((path) => pathname.startsWith(path))) score += 1
    if (score > bestScore) {
      bestScore = score
      best = topic
    }
  }

  if (best && bestScore >= 2) {
    return `${best.answer}\n\n— Assistant ClimaZEN (mode guide)`
  }

  // Accueil générique
  return `${AI_HOW_I_WORK}

Exemples :
• « Combien de filtre M5 en stock ? »
• « Préviens-moi quand le compresseur arrive »
• « Agenda RDV demain 14h pour Mr Martin »

— Assistant ClimaZEN (mode guide)`
}

export function buildAideContext(pathname: string): string {
  const relevant = AIDE_TOPICS.filter(
    (t) => !t.paths?.length || t.paths.some((p) => pathname.startsWith(p)),
  )
  const blocks = (relevant.length ? relevant : AIDE_TOPICS.slice(0, 4)).map(
    (t) => `### ${t.title}\n${t.answer}`,
  )
  return `Page actuelle : ${pathname || '/app'}\n\n${blocks.join('\n\n')}`
}
