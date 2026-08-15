import { normalizeFluideCode } from './fluides'

/** Valeurs typiques bouteille frigoriste (récup / stock courant). */
export type BouteilleDefaults = {
  capaciteMaxKg: number
  tareKg: number
  pressionEpreuveBar: number
}

/** Défauts génériques — bouteille 12,5 kg fluide (ex. R-32). */
export const BOUTEILLE_DEFAULTS: BouteilleDefaults = {
  capaciteMaxKg: 12.5,
  tareKg: 10,
  pressionEpreuveBar: 48,
}

/** Surcharges optionnelles par fluide (sinon génériques). */
const BY_FLUIDE: Record<string, Partial<BouteilleDefaults>> = {
  'R-32': { capaciteMaxKg: 12.5, tareKg: 10, pressionEpreuveBar: 48 },
  'R-410A': { capaciteMaxKg: 11.3, tareKg: 10, pressionEpreuveBar: 45 },
  'R-134A': { capaciteMaxKg: 12.5, tareKg: 10, pressionEpreuveBar: 30 },
  'R-404A': { capaciteMaxKg: 10.9, tareKg: 10, pressionEpreuveBar: 40 },
  'R-407C': { capaciteMaxKg: 11.3, tareKg: 10, pressionEpreuveBar: 40 },
  'R-1234YF': { capaciteMaxKg: 10, tareKg: 9, pressionEpreuveBar: 30 },
  'R-454B': { capaciteMaxKg: 12.5, tareKg: 10, pressionEpreuveBar: 48 },
}

export function bouteilleDefaultsForFluide(fluide: string): BouteilleDefaults {
  const key = normalizeFluideCode(fluide || '')
  const over = key ? BY_FLUIDE[key] : undefined
  return {
    capaciteMaxKg: over?.capaciteMaxKg ?? BOUTEILLE_DEFAULTS.capaciteMaxKg,
    tareKg: over?.tareKg ?? BOUTEILLE_DEFAULTS.tareKg,
    pressionEpreuveBar: over?.pressionEpreuveBar ?? BOUTEILLE_DEFAULTS.pressionEpreuveBar,
  }
}

function nearly(a: number | undefined, b: number) {
  if (a == null || !Number.isFinite(a)) return true
  return Math.abs(a - b) < 1e-6
}

/**
 * Applique capacité / tare / PH selon le fluide.
 * Ne remplace que les valeurs vides ou encore égales aux défauts du fluide précédent.
 */
export function applyBouteilleDefaults<
  T extends {
    fluide: string
    capaciteMaxKg?: number
    tareKg?: number
    pressionEpreuveBar?: number
  },
>(form: T, fluide: string, force = false): T {
  const next = bouteilleDefaultsForFluide(fluide)
  const prev = bouteilleDefaultsForFluide(form.fluide)
  return {
    ...form,
    fluide,
    capaciteMaxKg:
      force || nearly(form.capaciteMaxKg, prev.capaciteMaxKg)
        ? next.capaciteMaxKg
        : form.capaciteMaxKg,
    tareKg: force || nearly(form.tareKg, prev.tareKg) ? next.tareKg : form.tareKg,
    pressionEpreuveBar:
      force || nearly(form.pressionEpreuveBar, prev.pressionEpreuveBar)
        ? next.pressionEpreuveBar
        : form.pressionEpreuveBar,
  }
}
