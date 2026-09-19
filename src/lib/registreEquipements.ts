/**
 * Registre des équipements fluides frigorigènes — pièce « audit-ready » ISO 14001
 * (pilier 1 : identification des équipements, fluide chargé, PRG/GWP documenté).
 * Complète le bilan annuel fluides (pilier mass-balance, déjà couvert par
 * `bilanDatafluides.ts`) et la détection de fuite (CERFA / contrôles périodiques).
 */

import type { AppData, Site } from './types'
import { clientDisplayName, equipAvecFluideFrigorigene, siteAvecFluideFrigorigene } from './types'
import { allEquipements } from './cerfaBatch'
import { calcTeqCO2FromFluide, controlesPeriodiquesInfo, findFluide } from './fluides'

export type RegistreEquipementLigne = {
  siteId: string
  siteNom: string
  clientNom: string
  adresse: string
  ville: string
  equipementId: string
  equipementNom: string
  type: string
  marque: string
  modele: string
  numeroSerie: string
  fluideType: string
  gwp: number | null
  chargeNominaleKg: number
  teqCO2: number
  detectionPermanente: boolean
  controleObligatoire: boolean
  controlePeriodicite: string | null
}

export type RegistreEquipementsTotaux = {
  nbEquipements: number
  chargeTotaleKg: number
  teqCO2Total: number
  nbControleObligatoire: number
}

export type RegistreEquipements = {
  genereAt: string
  operateur: AppData['operateur']
  lignes: RegistreEquipementLigne[]
  totaux: RegistreEquipementsTotaux
}

function round(n: number, decimals: number) {
  const f = 10 ** decimals
  return Math.round(n * f) / f
}

/**
 * Parc actif uniquement (sites non archivés, au moins un équipement fluide) —
 * un registre d'audit décrit l'existant, pas l'historique des chantiers clos.
 */
export function buildRegistreEquipements(data: AppData): RegistreEquipements {
  const lignes: RegistreEquipementLigne[] = []

  const sites: Site[] = (data.chantiers || []).filter(
    (s) => s.statut === 'actif' && siteAvecFluideFrigorigene(s),
  )

  for (const site of sites) {
    const client = data.clients.find((c) => c.id === site.clientId)
    const clientNom = client ? clientDisplayName(client) : '—'

    const equipements = allEquipements(site).filter(
      (e) => equipAvecFluideFrigorigene(e) && (e.fluideType || '').trim(),
    )

    for (const eq of equipements) {
      const ref = findFluide(eq.fluideType)
      const gwp = ref ? ref.gwp : null
      // Toujours recalculé depuis charge × GWP ÷ 1000 (même formule que le CERFA) —
      // jamais depuis eq.teqCO2, un champ mis en cache qui peut être obsolète si le
      // fluide/la charge a été modifié depuis sans que ce champ soit recalculé.
      const teqCO2 = calcTeqCO2FromFluide(eq.chargeNominaleKg, eq.fluideType) ?? 0
      const controle = controlesPeriodiquesInfo({
        fluideCode: eq.fluideType,
        chargeKg: eq.chargeNominaleKg,
        teqCO2,
        detectionPermanente: !!eq.detectionPermanente,
      })

      lignes.push({
        siteId: site.id,
        siteNom: site.nom,
        clientNom,
        adresse: site.adresse,
        ville: site.ville,
        equipementId: eq.id,
        equipementNom: eq.nom,
        type: eq.type,
        marque: eq.marque,
        modele: eq.modele,
        numeroSerie: eq.numeroSerie,
        fluideType: eq.fluideType,
        gwp,
        chargeNominaleKg: round(Number(eq.chargeNominaleKg) || 0, 2),
        teqCO2: round(teqCO2, 3),
        detectionPermanente: !!eq.detectionPermanente,
        controleObligatoire: controle.obligatoire,
        controlePeriodicite: controle.periodeSuggeree,
      })
    }
  }

  lignes.sort(
    (a, b) =>
      a.clientNom.localeCompare(b.clientNom, 'fr') ||
      a.siteNom.localeCompare(b.siteNom, 'fr') ||
      a.equipementNom.localeCompare(b.equipementNom, 'fr'),
  )

  const totaux = lignes.reduce<RegistreEquipementsTotaux>(
    (acc, l) => ({
      nbEquipements: acc.nbEquipements + 1,
      chargeTotaleKg: round(acc.chargeTotaleKg + l.chargeNominaleKg, 2),
      teqCO2Total: round(acc.teqCO2Total + l.teqCO2, 3),
      nbControleObligatoire: acc.nbControleObligatoire + (l.controleObligatoire ? 1 : 0),
    }),
    { nbEquipements: 0, chargeTotaleKg: 0, teqCO2Total: 0, nbControleObligatoire: 0 },
  )

  return {
    genereAt: new Date().toISOString(),
    operateur: data.operateur,
    lignes,
    totaux,
  }
}
