/**
 * Client GraphQL Trackdéchets (API publique, jeton d'accès personnel utilisateur).
 * https://api.trackdechets.beta.gouv.fr — doc : doc.trackdechets.beta.gouv.fr
 */

function apiUrl() {
  return (process.env.TRACKDECHETS_API_URL || 'https://api.trackdechets.beta.gouv.fr').replace(/\/$/, '')
}

/**
 * @param {string} token — jeton personnel de l'utilisateur (jamais celui de ClimaZEN)
 * @param {string} query
 * @param {Record<string, unknown>} [variables]
 */
export async function callTrackdechets(token, query, variables) {
  const t = String(token || '').trim()
  if (!t) throw new Error('Jeton Trackdéchets manquant.')

  let res
  try {
    res = await fetch(apiUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${t}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables: variables || {} }),
    })
  } catch (err) {
    throw new Error(
      `Impossible de joindre l’API Trackdéchets (${err instanceof Error ? err.message : 'réseau'}).`,
    )
  }

  let json = null
  try {
    json = await res.json()
  } catch {
    throw new Error(`Réponse Trackdéchets illisible (HTTP ${res.status}).`)
  }

  if (!res.ok && !json?.errors) {
    throw new Error(`Trackdéchets a refusé la requête (HTTP ${res.status}).`)
  }

  if (json?.errors?.length) {
    const first = json.errors[0]
    const code = first?.extensions?.code
    const msg = first?.message || 'Erreur Trackdéchets inconnue.'
    if (code === 'UNAUTHENTICATED' || res.status === 401) {
      throw new Error(`Jeton Trackdéchets invalide ou expiré (${msg}).`)
    }
    throw new Error(msg)
  }

  return json?.data
}

/** Vérifie que le jeton est valide — utilisé par « Tester la connexion ». */
export async function testTrackdechetsToken(token) {
  const data = await callTrackdechets(token, 'query ClimaZENAuthCheck { me { id name email } }')
  const me = data?.me
  if (!me) throw new Error('Jeton accepté mais réponse Trackdéchets inattendue.')
  return { id: me.id, name: me.name || '', email: me.email || '' }
}

const CREATE_BSFF_MUTATION = `
  mutation ClimaZENCreateBsff($input: BsffInput!) {
    createBsff(input: $input) {
      id
      status
    }
  }
`

/**
 * Crée un BSFF (bordereau fluides frigorigènes) — type TRACER_FLUIDE (traçage
 * d'un fluide récupéré vers un partenaire de traitement), un seul contenant
 * (BOUTEILLE). Champs du schéma vérifiés sur developers.trackdechets.beta.gouv.fr
 * (BsffInput, CompanyInput, BsffWasteInput, BsffWeightInput, BsffPackagingInput).
 *
 * @param {string} token
 * @param {{
 *   emitter: { nom: string, siret: string, adresse: string, telephone?: string, email?: string },
 *   destinataire: { nom: string, siret: string, adresse: string, codeCap: string, codeOperation: string },
 *   transporteur: { nom?: string, siret: string, adresse?: string },
 *   numeroContenant: string,
 *   codeDechet: string,
 *   denominationAdr?: string,
 *   quantiteKg: number,
 * }} payload
 */
export async function createBsff(token, payload) {
  const input = {
    type: 'TRACER_FLUIDE',
    emitter: {
      company: {
        siret: payload.emitter.siret,
        name: payload.emitter.nom,
        address: payload.emitter.adresse,
        phone: payload.emitter.telephone || undefined,
        mail: payload.emitter.email || undefined,
      },
    },
    packagings: [
      {
        type: 'BOUTEILLE',
        numero: payload.numeroContenant,
        weight: payload.quantiteKg,
      },
    ],
    waste: {
      code: payload.codeDechet,
      adr: payload.denominationAdr || undefined,
    },
    weight: {
      value: payload.quantiteKg,
      isEstimate: false,
    },
    transporter: {
      company: {
        siret: payload.transporteur.siret,
        name: payload.transporteur.nom || undefined,
        address: payload.transporteur.adresse || undefined,
      },
    },
    destination: {
      company: {
        siret: payload.destinataire.siret,
        name: payload.destinataire.nom,
        address: payload.destinataire.adresse,
      },
      cap: payload.destinataire.codeCap,
      plannedOperationCode: payload.destinataire.codeOperation,
    },
  }

  const data = await callTrackdechets(token, CREATE_BSFF_MUTATION, { input })
  const created = data?.createBsff
  if (!created?.id) throw new Error('Trackdéchets n’a pas renvoyé de bordereau créé.')
  return { id: created.id, status: created.status || 'INITIAL' }
}

const BSFF_STATUS_QUERY = `
  query ClimaZENBsffStatus($id: ID!) {
    bsff(id: $id) {
      id
      status
    }
  }
`

export async function fetchBsffStatus(token, id) {
  const data = await callTrackdechets(token, BSFF_STATUS_QUERY, { id })
  const bsff = data?.bsff
  if (!bsff?.id) throw new Error('Bordereau introuvable sur Trackdéchets.')
  return { id: bsff.id, status: bsff.status || 'INITIAL' }
}
