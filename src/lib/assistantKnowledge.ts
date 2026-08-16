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
- Ne signe pas, ne clôture pas, ne génère pas de CERFA à la place de l’utilisateur.
- Pour le réglementaire F-Gas / CERFA, reste prudent : rappelle les règles de l’app et invite à vérifier si doute.
- Si tu ne sais pas, dis-le et propose où aller dans l’app.

Parcours principaux :
1) Client appelle → /app/appel (OT) → client, site, équipements → docs (CERFA / fiche) → signatures → Clôturer.
2) CERFA → /app/interventions ou depuis l’OT.
3) Stock fluides → /app/stock (utilisable vs récupération déchet).
4) Mon entreprise → /app/operateur (logo, attestation, détecteurs).

Règles stock / CERFA importantes :
- Récupération temporaire (réinjection) → bouteilles Transfert / Service uniquement.
- Démantèlement / récup. définitive → bouteilles Récupération (déchet) uniquement.
- Jamais de bouteille déchet en charge / réinjection.
- N° de série = officiel CERFA ; Surnom = affichage interne seulement.
- Stock utilisable ≠ gaz récupéré (déchet → BSFF).
`

export const AIDE_TOPICS: AideTopic[] = [
  {
    id: 'parcours-ot',
    title: 'Parcours OT / Client appelle',
    keywords: ['ot', 'ordre', 'appel', 'client appelle', 'cloturer', 'clôturer', 'parcours', 'etape', 'étape'],
    paths: ['/app/appel', '/app/ot'],
    answer: `Parcours terrain typique :
1. Accueil → « Client appelle » (ou Ordres de travail).
2. Remplir OT → Client → Site → Équipement(s).
3. Étape Documents : CERFA (si fluide), fiche checklist optionnelle, signatures.
4. « Clôturer signé » pour terminer.

Après un CERFA, utilise « Retour à l’OT — signer & clôturer » pour ne pas tout quitter.`,
  },
  {
    id: 'cerfa',
    title: 'Faire un CERFA',
    keywords: ['cerfa', '15497', 'pdf', 'generer', 'générer', 'intervention', 'fiche'],
    paths: ['/app/interventions'],
    answer: `Pour un CERFA :
1. Depuis l’OT → bouton CERFA, ou menu Interventions.
2. Cochez les natures (récup. temporaire, démantèlement, charge…).
3. Fluide [7], bouteilles [11], signatures.
4. « Enregistrer & générer ce CERFA ».

Le PDF se voit sous le formulaire. Le brouillon se sauve aussi tout seul.`,
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
- Nature « Démantèlement / récup. définitive ».
- Uniquement bouteilles « Récupération (déchet) ».
- Ce gaz va au traitement / BSFF — jamais en recharge.

Dans Stock, il apparaît dans le bloc orange « Récupération déchet », séparé du stock utilisable.`,
  },
  {
    id: 'stock',
    title: 'Stock fluides',
    keywords: ['stock', 'bouteille', 'kg', 'utilisable', 'jauge', 'fluide'],
    paths: ['/app/stock'],
    answer: `Stock fluides (/app/stock) a 2 blocs :
• Vert — Stock utilisable (charge / appoint / service)
• Orange — Récupération déchet (BSFF uniquement)

Totaux kg séparés pour ne pas mélanger gaz utilisable et déchet.`,
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

Dans les menus : « Surnom (N° de série : BOT-XXX) ». Jamais mettre « Transfert » à la place du n° officiel.`,
  },
  {
    id: 'signatures',
    title: 'Signatures et clôture',
    keywords: ['signature', 'signer', 'technicien', 'client', 'detenteur', 'détenteur'],
    paths: ['/app/appel', '/app/profil', '/app/interventions'],
    answer: `Signatures :
- Technicien : Ma signature (/app/profil) — reprise sur OT et CERFA.
- Client : sur l’OT (étape docs) ou sur le CERFA ; peut être mémorisée sur le site.

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
    id: 'offline',
    title: 'Hors ligne / sync',
    keywords: ['offline', 'hors ligne', 'sync', 'synchron', 'reseau', 'réseau', 'connexion'],
    paths: ['/app'],
    answer: `ClimaZEN est une PWA : vous pouvez travailler terrain hors ligne puis synchroniser quand le réseau revient. Les brouillons CERFA se sauvent localement.`,
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
      'Comment clôturer un OT après le CERFA ?',
      'Parcours Client appelle étape par étape',
      'Où signer technicien et client ?',
    ]
  }
  if (p.includes('/operateur')) {
    return ['Où mettre le logo société ?', 'Détecteur de fuite obligatoire ?']
  }
  return [
    'Comment démarrer un OT ?',
    'Comment faire un CERFA ?',
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
• Stock (utilisable vs déchet, A2L, n° série / surnom)
• Signatures et clôture

Exemple : « Quelle bouteille pour une récupération temporaire ? »

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
