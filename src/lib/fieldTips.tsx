/** Textes d’aide — stock / CERFA cadres [11]–[12] */

export const TIP_BSFF = (
  <>
    <strong className="font-semibold text-accent">Réf. BSFF</strong>
    <span className="mt-1 block text-white/85">
      Numéro unique du Bordereau de Suivi des Fluides Frigorigènes (fluide récupéré).
    </span>
    <ul className="mt-2 list-disc space-y-1 pl-4 text-white/80">
      <li>
        <strong className="text-white">Trackdéchets :</strong> n° du bordereau dématérialisé (ex.
        BSFF-2026-XXXXXXXX).
      </li>
      <li>
        <strong className="text-white">Papier :</strong> n° pré-imprimé en haut du bordereau.
      </li>
      <li>
        <strong className="text-white">Pas de récupération :</strong> laissez vide ou indiquez N/A.
      </li>
    </ul>
  </>
)

export const TIP_UN = (
  <>
    <strong className="font-semibold text-accent">Code UN</strong>
    <span className="mt-1 block text-white/85">
      Numéro à <strong className="text-white">4 chiffres</strong> qui identifie la matière dangereuse
      pour le transport (réglementation ADR/RID).
    </span>
    <span className="mt-2 block text-white/80">
      Il forme le début de la dénomination :{' '}
      <strong className="text-white">UN [code] + nom du gaz</strong>
      <br />
      Ex. : <strong className="text-white">3163</strong>, <strong className="text-white">1078</strong>,{' '}
      <strong className="text-white">3159</strong>…
    </span>
  </>
)

export const TIP_ADR = (
  <>
    <strong className="font-semibold text-accent">Dénomination ADR/RID</strong>
    <span className="mt-1 block text-white/85">
      Désignation officielle de transport des marchandises dangereuses (réglementation ADR)
      correspondant au fluide récupéré dans la bouteille.
    </span>
    <span className="mt-2 block text-white/80">
      Structure : <strong className="text-white">UN [Code UN] + nom du gaz</strong>
      <br />
      Ex. : UN 3163 Gaz liquéfié, n.s.a. (R-410A)
    </span>
  </>
)

export const TIP_BOUTEILLE = (
  <>
    <strong className="font-semibold text-accent">N° de bouteille / contenant</strong>
    <span className="mt-1 block text-white/85">
      Obligatoire dès qu’il y a un <strong className="text-white">mouvement de fluide</strong>{' '}
      (récupération, charge ou transfert) impliquant un conteneur — Code de l’environnement & F-Gas.
    </span>
    <ul className="mt-2 list-disc space-y-1.5 pl-4 text-white/80">
      <li>
        <strong className="text-white">Récupération / charge :</strong> identifier la bouteille sur
        le Cerfa 15497*04 (n° de série / identification fourni par le distributeur ou gravé).
      </li>
      <li>
        <strong className="text-white">Registre de stock (annexe) :</strong> chaque bouteille sous
        son numéro propre, pour lier la quantité chantier ↔ bouteille véhicule/dépôt.
      </li>
      <li>
        <strong className="text-white">Simple entretien sans mouvement :</strong> pas de bouteille
        engagée → champ vide (N/A).
      </li>
    </ul>
  </>
)

export const TIP_RETOUR_CONSIGNE = (
  <>
    <strong className="font-semibold text-accent">Bon de retour de consigne</strong>
    <span className="mt-1 block text-white/85">
      Pour une bouteille <strong className="text-white">neuve / consignable</strong> rendue vide au
      fournisseur (emballage réutilisable).
    </span>
    <ul className="mt-2 list-disc space-y-1.5 pl-4 text-white/80">
      <li>
        <strong className="text-white">Comptabilité :</strong> preuve pour crédit / remboursement de
        la consigne.
      </li>
      <li>
        <strong className="text-white">Audit :</strong> justifier le mouvement en cas de contrôle
        d’attestation de capacité (Qualiclimat, Bureau Veritas, CEMAFROID…).
      </li>
    </ul>
  </>
)

