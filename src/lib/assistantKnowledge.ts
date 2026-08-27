/**
 * Base de connaissances ClimaZEN — assistant d’aide terrain.
 * Utilisée en local (sans clé API) et comme contexte pour l’API Gemini.
 */

export type AideTopic = {
  id: string
  title: string
  keywords: string[]
  /** Chemins app où le sujet est particulièrement pertinent */
  paths?: string[]
  answer: string
}

export const AIDE_SYSTEM_PROMPT = `Tu es l’assistant ClimaZEN, une app terrain pour techniciens froid / clim (CERFA 15497, F-Gas, stock fluides, OT).

Règles :
- Réponds en français, clair et court (mobile terrain).
- Explique comment faire dans l’app (menus, boutons), pas de jargon inutile.
- Tu PEUX préparer la création d’un OT + CERFA brouillon quand l’utilisateur le demande clairement (ex. « crée une OT pour Mr X sur le site Y… »).
- Tu PEUX préparer la création de PLUSIEURS équipements sur un site (salon, chambre…).
- Ne signe PAS, ne clôture PAS, ne génère PAS le PDF CERFA final à la place de l’utilisateur.
- INTERDIT de dire « c’est fait », « ont été créés », « j’ai créé » : l’app crée seulement après confirmation « oui ». Tu proposes, tu n’affirmes pas l’exécution.
- Pour le réglementaire F-Gas / CERFA, reste prudent : rappelle les règles de l’app et invite à vérifier si doute.
- Si tu ne sais pas, dis-le et propose où aller dans l’app.

Quand l’utilisateur demande de CRÉER un OT / CERFA :
1) Identifie client, site, équipement et type (contrôle d’étanchéité, maintenance, dépannage…).
2) Prefère les clients/sites/équipements listés dans le contexte ; si absents, propose quand même la création (l’app créera les fiches manquantes).
3) Ajoute à la FIN de ta réponse un bloc JSON exact (rien d’autre dans le bloc) :

\`\`\`json
{"action":"propose_create_ot_cerfa","typeOt":"controle_etancheite","clientQuery":"Depon","siteQuery":"test","equipQuery":"clim RDC","actionText":"Contrôle d’étanchéité — clim RDC","createCerfa":true}
\`\`\`

Quand l’utilisateur demande d’AJOUTER PLUSIEURS équipements (sans OT) :
\`\`\`json
{"action":"propose_create_equipements","clientQuery":"Dupont","siteQuery":"Maison","equips":[{"nom":"Clim monobloc — Salon","type":"Climatisation"},{"nom":"Clim monobloc — Chambre","type":"Climatisation"}]}
\`\`\`

typeOt possible : controle_etancheite | maintenance | depanage | demantelement | entretien | installation
L’app demandera ensuite confirmation (« oui ») avant de créer.

Tu peux aussi expliquer que l’utilisateur peut dire :
- « Crée un nouveau client Monsieur Albert Dupont, téléphone 06…, mail …, adresse … »
- « Crée 2 clim monobloc : une au salon, une dans la chambre chez Mr Dupont »
- « Ajoute un détecteur de fuite nom 3 XXXX3, validité 15/03/26 »
- « Ajoute une bouteille R-32 transfert n° BOT-123 10 kg »
- « Agenda RDV demain 14h pour Mr Martin site Atelier »
(ces actions sont gérées directement par l’app).

Parcours principaux :
1) Client appelle → /app/appel (OT) → client, site, équipements → docs (CERFA / fiche) → signatures → Clôturer.
2) CERFA → /app/interventions ou depuis l’OT.
3) Stock fluides → /app/stock (utilisable vs fluide récupéré).
4) Clients / Sites → équipements du parc.
5) Agenda → /app/agenda (RDV, rappels, maintenances).
6) Mon entreprise → /app/operateur (logo, attestation, détecteurs).
7) Équipe → dossier de chaque technicien (CNI, permis, aptitude froid, habilitation électrique, dates d’expiration).

Règles stock / CERFA importantes :
- Récupération temporaire (réinjection) → bouteilles Transfert / Service uniquement.
- Démantèlement / récup. définitive → bouteilles Récupération uniquement.
- Jamais de bouteille récupération déchet en charge / réinjection.
- N° de série = officiel CERFA ; Surnom = affichage interne seulement.
- Stock utilisable ≠ fluide récupéré (régénération / recyclage / destruction BSFF).
`

export const AIDE_TOPICS: AideTopic[] = [
  {
    id: 'parcours-ot',
    title: 'Parcours OT / Client appelle',
    keywords: ['ot', 'ordre', 'appel', 'client appelle', 'cloturer', 'clôturer', 'parcours', 'etape', 'étape', 'avancement', 'partiel', 'pourcentage', 'présence'],
    paths: ['/app/appel', '/app/ot'],
    answer: `Parcours terrain typique :
1. Accueil → « Client appelle » (ou Ordres de travail).
2. Remplir OT → Client → Site → Équipement(s).
3. Étape Documents : CERFA (si fluide), fiche checklist optionnelle, signatures.
4. « Valider la présence du jour » (signature client, même si le travail n’est pas fini) ou « Clôturer signé » quand c’est terminé.

Chantier sur plusieurs jours : cochez « Intervention partielle », mettez le %, faites signer le client à chaque passage. L’OT reste ouvert jusqu’à clôture.

Après un CERFA, utilise « Retour à l’OT — signer & clôturer » pour ne pas tout quitter.`,
  },
  {
    id: 'cerfa',
    title: 'Faire un CERFA',
    keywords: ['cerfa', '15497', 'pdf', 'generer', 'générer', 'intervention', 'fiche'],
    paths: ['/app/interventions'],
    answer: `Pour un CERFA :
1. Depuis l’OT → bouton CERFA, ou menu Interventions.
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
    paths: ['/app/appel', '/app/profil', '/app/interventions'],
    answer: `Signatures :
- Technicien : Ma signature (/app/profil) — reprise automatiquement sur OT et CERFA.
- Client : signature à chaque intervention (pad vide sur chaque nouvel OT / CERFA / fiche). Pas de réutilisation auto de l’ancienne signature site.

Pour clôturer : signatures tech + client sur l’OT, puis « Clôturer signé ».`,
  },
  {
    id: 'entreprise',
    title: 'Mon entreprise',
    keywords: ['entreprise', 'logo', 'attestation', 'siret', 'operateur', 'opérateur', 'detecteur', 'détecteur'],
    paths: ['/app/operateur'],
    answer: `Mon entreprise (/app/operateur) :
- Raison sociale, SIRET, attestation de capacité.
- Logo (apparaît sur le rapport OT).
- Parc détecteurs de fuite (contrôle annuel) — obligatoire pour CERFA.`,
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
    ],
    paths: ['/app/equipe', '/app/profil'],
    answer: `Dossier de chaque technicien (Équipe → Dossier, ou Ma signature → Mon dossier) :
• Identité (CNI / passeport / titre de séjour), permis, carte Vitale, visite médicale.
• Attestation d’aptitude fluides (cat. I–IV) — obligatoire pour le froid, validité typique 5 ans.
• Habilitation électrique (BR, B1V…) — obligatoire dès qu’on touche à l’électrique, recyclage ~3 ans.
• Selon chantiers : SST, CACES nacelle, travail en hauteur, AIPR, amiante SS4.
• Admin : RIB, justificatif de domicile, contrat, diplôme.

Saisissez la date limite des pièces que vous enregistrez. L’accueil alerte 45 jours avant, puis à l’expiration. Les pièces non disponibles se masquent avec la croix rouge — rien n’est imposé.
L’attestation de capacité SOCIÉTÉ et le détecteur restent dans Mon entreprise.`,
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
- Micro en bas à gauche : dites « stock », « appel », « OT », « scan », « GPS », « CERFA », « sites » ou « aide ».
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
      'Crée une OT pour contrôle d’étanchéité',
      'Comment clôturer un OT après le CERFA ?',
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
    'Crée une OT + CERFA pour un client',
    'Agenda RDV demain 14h',
    'Stock utilisable vs déchet ?',
  ]
}

/** Réponse locale (sans API) — matching mots-clés + page courante. */
export function answerAideLocal(question: string, pathname = ''): string {
  const q = normalize(question)
  if (!q.trim()) {
    return 'Posez une question sur ClimaZEN (OT, CERFA, stock, bouteilles…).'
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
  return `Je peux vous aider sur :
• Parcours OT / Client appelle
• CERFA 15497 (récup. temporaire vs définitive, charge)
• Agenda (RDV, rappels, maintenances)
• Stock (utilisable vs déchet, A2L, n° série / surnom)
• Signatures et clôture

Exemple : « Agenda RDV demain 14h pour Mr Martin »

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
