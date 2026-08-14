/**
 * Nom de la personne qui signe côté client / détenteur.
 * Ne jamais utiliser la raison sociale (société) comme nom du signataire.
 */
export function nomSignataireClient(opts: {
  /** Nom déjà saisi / enregistré sur le doc ou le site */
  signatureNom?: string | null
  /** Contact personne chez le client */
  nomContact?: string | null
  /** Raison sociale — uniquement pour détecter un mauvais préremplissage */
  raisonSociale?: string | null
}): string {
  const signed = (opts.signatureNom || '').trim()
  const contact = (opts.nomContact || '').trim()
  const company = (opts.raisonSociale || '').trim().toLowerCase()

  if (signed) {
    // Ancien bug : on avait parfois mis la société dans le champ signataire
    if (company && signed.toLowerCase() === company) {
      return contact
    }
    return signed
  }
  return contact
}
