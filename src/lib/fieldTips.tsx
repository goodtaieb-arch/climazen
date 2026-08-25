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
      Rempli <strong className="text-white">automatiquement</strong> selon le fluide choisi en [7]
      (ex. R-32 → 3252, R-410A → 3163, R-134a → 3159).
    </span>
    <span className="mt-2 block text-white/80">
      Numéro à 4 chiffres ADR/RID identifiant la matière dangereuse pour le transport. Non
      modifiable ici — changez le fluide [7] pour mettre à jour.
    </span>
  </>
)

export const TIP_ADR = (
  <>
    <strong className="font-semibold text-accent">Dénomination ADR/RID</strong>
    <span className="mt-1 block text-white/85">
      Désignation officielle de transport, remplie <strong className="text-white">automatiquement</strong>{' '}
      dès que le fluide [7] est sélectionné.
    </span>
    <span className="mt-2 block text-white/80">
      Structure :{' '}
      <strong className="text-white">
        UN [code] [NOM OFFICIEL] (GAZ RÉFRIGÉRANT R xx), [classe]
      </strong>
      <br />
      Ex. : UN 3252 DIFLUOROMÉTHANE (GAZ RÉFRIGÉRANT R 32), 2.1
    </span>
  </>
)

export const TIP_DESTINATION = (
  <>
    <strong className="font-semibold text-accent">Installation de destination [13]</strong>
    <span className="mt-1 block text-white/85">
      Lieu où part le fluide récupéré / les déchets : distributeur (Climalife, Gazechim…), dépôt
      atelier ou filière destruction (BSFF).
    </span>
    <span className="mt-2 block text-white/80">
      Choisissez dans la liste ou saisissez un texte libre (« Autre »). Les destinations utilisées
      sont mémorisées pour la prochaine fiche.
    </span>
  </>
)

export const TIP_BOUTEILLE = (
  <>
    <strong className="font-semibold text-accent">N° de série / n° de contenant</strong>
    <span className="mt-1 block text-white/85">
      Obligatoire dès qu’il y a un <strong className="text-white">mouvement de fluide</strong>{' '}
      (récupération, charge ou transfert) — Code de l’environnement & F-Gas. C’est{' '}
      <strong className="text-white">ce numéro réel</strong> qui est imprimé sur le Cerfa 15497*04.
    </span>
    <ul className="mt-2 list-disc space-y-1.5 pl-4 text-white/80">
      <li>
        <strong className="text-white">CERFA :</strong> n° de série / identification fourni par le
        distributeur, gravé ou code-barres — jamais le mot « Transfert » ni le type de contenant.
      </li>
      <li>
        <strong className="text-white">Surnom (optionnel) :</strong> libellé interne pour le dépôt /
        les menus (ex. « Transfert camion Luc ») — n’apparaît pas à la place du n° sur le CERFA.
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

