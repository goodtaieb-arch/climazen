/**
 * Version affichée à l’utilisateur — à incrémenter à CHAQUE mise en ligne.
 * Si tu ne vois pas ce numéro (login + en-tête app), tu es sur un ancien cache → bouton MAJ.
 */
export const APP_VERSION = 'v234'

/** Stamp technique (cache PWA / debug). */
export const APP_BUILD = '2026-09-05-v234-pointage-correction-gps'

/** Pastille / bandeau « Bêta » sur le site et dans l’app. Passer à false à la sortie bêta. */
export const APP_IS_BETA = true

export const APP_VERSION_LABEL = `${APP_VERSION} · ${APP_BUILD}`
