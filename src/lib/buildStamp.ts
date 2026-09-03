/**
 * Version affichée à l’utilisateur — à incrémenter à CHAQUE mise en ligne.
 * Si tu ne vois pas ce numéro (login + en-tête app), tu es sur un ancien cache → bouton MAJ.
 */
export const APP_VERSION = 'v204'

/** Stamp technique (cache PWA / debug). */
<<<<<<< HEAD
export const APP_BUILD = '2026-09-03-v204-agenda-tech-heure'
=======
export const APP_BUILD = '2026-09-03-v204-agenda-filtre-tech'
>>>>>>> ac50496 (fix(agenda): filtre tech appliqué en vue Semaine / Jour (v204))

/** Pastille / bandeau « Bêta » sur le site et dans l’app. Passer à false à la sortie bêta. */
export const APP_IS_BETA = true

export const APP_VERSION_LABEL = `${APP_VERSION} · ${APP_BUILD}`
