/** Politique mot de passe ClimaZEN — réduit le risque de comptes faibles. */

export const PASSWORD_MIN_LENGTH = 8

export function validatePasswordStrength(password: string): string | null {
  const p = password || ''
  if (p.length < PASSWORD_MIN_LENGTH) {
    return `Mot de passe : au moins ${PASSWORD_MIN_LENGTH} caractères.`
  }
  if (!/[A-Za-zÀ-ÿ]/.test(p)) {
    return 'Mot de passe : ajoutez au moins une lettre.'
  }
  if (!/[0-9]/.test(p)) {
    return 'Mot de passe : ajoutez au moins un chiffre.'
  }
  // Mots de passe trop banals (liste courte)
  const lower = p.toLowerCase()
  const banned = ['password', 'motdepasse', 'climazen', '12345678', 'azertyui', 'qwertyui']
  if (banned.some((b) => lower.includes(b))) {
    return 'Mot de passe trop courant — choisissez-en un plus difficile à deviner.'
  }
  return null
}

export const PASSWORD_HINT = `Au moins ${PASSWORD_MIN_LENGTH} caractères, avec lettres et chiffres.`
