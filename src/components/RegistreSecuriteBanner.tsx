import { REGISTRE_SECURITE_AVERTISSEMENT } from '../lib/otParcours'

/** Rappel norme — à afficher à chaque passage maintenance. */
export function RegistreSecuriteBanner() {
  return (
    <p
      className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950"
      role="status"
    >
      <span className="font-bold">Registre de sécurité — </span>
      {REGISTRE_SECURITE_AVERTISSEMENT}
    </p>
  )
}
