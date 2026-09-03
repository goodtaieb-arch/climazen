import { v4 as uuid } from 'uuid'
import type { AppData, Operateur } from './types'
import { migrateAppData } from './migrate'
import { sanitizePersonnelDossiers } from './rhDocuments'

export const defaultOperateur = (): Operateur => ({
  id: uuid(),
  raisonSociale: '',
  adresse: '',
  siret: '',
  attestationNumero: '',
  telephone: '',
  email: '',
})

export function emptyData(): AppData {
  return {
    appEdition: 'light',
    operateur: defaultOperateur(),
    clients: [],
    chantiers: [],
    stock: [],
    stockMouvements: [],
    interventions: [],
    detecteurs: [],
    voitures: [],
    outillages: [],
    bonsRemiseMateriel: [],
    fichesMaintenanceClim: [],
    fichesMaintenanceChaufferie: [],
    fichesMaintenanceCtaVmc: [],
    ordresTravail: [],
    contratsMaintenance: [],
    devis: [],
    commandesFournisseur: [],
    piecesDetachees: [],
    piecesMouvements: [],
    factures: [],
    agendaEvents: [],
    pointageRegles: undefined,
    pointageEvents: [],
    pointageBureauJours: [],
    personnelDossiers: [],
    personnelRhAccesUserIds: [],
    personnelRetiresUserIds: [],
    aiPendingValidations: [],
    deletedEntityIds: {
      clients: [],
      chantiers: [],
      stock: [],
      stockMouvements: [],
      ordresTravail: [],
      interventions: [],
    },
  }
}

function dataKeyForOrg(organizationId: string) {
  return `climazen_orgdata_${organizationId}`
}

/** Cache local (backup / import). La source de vérité est Supabase. */
export function loadData(organizationId?: string | null): AppData {
  try {
    if (!organizationId) return emptyData()
    const key = dataKeyForOrg(organizationId)
    const raw = localStorage.getItem(key)
    if (!raw) return emptyData()
    const parsed = JSON.parse(raw) as Partial<AppData>
    const base = emptyData()
    const stock = (parsed.stock || []).map((s) => ({
      ...s,
      quantiteInitialeKg: s.quantiteInitialeKg ?? s.quantiteKg,
      capaciteMaxKg:
        s.capaciteMaxKg ??
        (s.contenantType === 'recuperation'
          ? s.quantiteInitialeKg || undefined
          : s.capaciteMaxKg),
    }))
    return migrateAppData({
      ...base,
      ...parsed,
      stock,
      stockMouvements: parsed.stockMouvements || [],
      interventions: parsed.interventions || [],
      chantiers: parsed.chantiers || [],
      clients: parsed.clients || [],
      operateur: parsed.operateur || base.operateur,
      detecteurs: parsed.detecteurs,
      voitures: parsed.voitures,
      outillages: parsed.outillages,
      fichesMaintenanceClim: parsed.fichesMaintenanceClim || [],
      fichesMaintenanceChaufferie: parsed.fichesMaintenanceChaufferie || [],
      fichesMaintenanceCtaVmc: parsed.fichesMaintenanceCtaVmc || [],
      ordresTravail: parsed.ordresTravail || [],
      contratsMaintenance: parsed.contratsMaintenance || [],
      devis: parsed.devis || [],
      commandesFournisseur: parsed.commandesFournisseur || [],
      piecesDetachees: parsed.piecesDetachees || [],
      piecesMouvements: parsed.piecesMouvements || [],
      factures: parsed.factures || [],
      agendaEvents: parsed.agendaEvents || [],
      pointageRegles: parsed.pointageRegles,
      pointageEvents: parsed.pointageEvents || [],
      pointageBureauJours: parsed.pointageBureauJours || [],
      personnelDossiers: parsed.personnelDossiers || [],
      personnelRhAccesUserIds: parsed.personnelRhAccesUserIds || [],
      personnelRetiresUserIds: parsed.personnelRetiresUserIds || [],
      deletedEntityIds: parsed.deletedEntityIds || {
        clients: [],
        chantiers: [],
        stock: [],
        stockMouvements: [],
      },
    })
  } catch {
    return emptyData()
  }
}

export function saveData(data: AppData, organizationId?: string | null) {
  try {
    if (!organizationId) return
    const key = dataKeyForOrg(organizationId)
    const light: AppData = {
      ...data,
      personnelDossiers: sanitizePersonnelDossiers(data.personnelDossiers),
      interventions: data.interventions.map((rest) => {
        const { cerfaPdfBase64: _drop, ...clean } = rest as typeof rest & { cerfaPdfBase64?: string }
        return clean
      }),
    }
    localStorage.setItem(key, JSON.stringify(light))
  } catch (err) {
    console.error('ClimaZEN: impossible d’enregistrer les données locales', err)
  }
}

export function seedDemoData(): AppData {
  const clientId = uuid()
  const chantierId = uuid()
  const stockId = uuid()
  const now = new Date().toISOString()

  return {
    operateur: {
      id: uuid(),
      raisonSociale: 'ClimaZEN Froid SARL',
      adresse: '12 rue des Artisans, 75011 Paris',
      siret: '123 456 789 00012',
      attestationNumero: 'ATTEST-2024-001',
      telephone: '01 23 45 67 89',
      email: 'contact@climazen.fr',
      detecteurIdentification: 'DET-SN-2024-0042',
      detecteurControleDate: new Date().toISOString().slice(0, 10),
    },
    detecteurs: [
      {
        id: uuid(),
        identification: 'DET-SN-2024-0042',
        controleDate: new Date().toISOString().slice(0, 10),
        notes: 'Détecteur démo',
        updatedAt: now,
      },
    ],
    clients: [
      {
        id: clientId,
        raisonSociale: 'Supermarché Dupont',
        nomContact: 'Marie Dupont',
        adresse: '45 avenue de la République',
        codePostal: '69003',
        ville: 'Lyon',
        telephone: '04 78 00 00 00',
        email: 'marie@dupont-market.fr',
        createdAt: now,
      },
    ],
    chantiers: [
      {
        id: chantierId,
        clientId,
        nom: 'Supermarché Dupont — Lyon',
        adresse: '45 avenue de la République',
        codePostal: '69003',
        ville: 'Lyon',
        statut: 'actif',
        modeGestion: 'contrat',
        typeTravaux: 'maintenance',
        createdAt: now,
        equipementType: 'Groupe froid monobloc',
        equipementMarque: 'Carrier',
        equipementModele: '30RB-160',
        equipementNumeroSerie: 'SN-88421',
        fluideType: 'R-448A',
        chargeNominaleKg: 4.2,
        detectionPermanente: false,
        equipements: [
          {
            id: uuid(),
            nom: 'Chambre froide — Rayon frais',
            type: 'Groupe froid monobloc',
            marque: 'Carrier',
            modele: '30RB-160',
            numeroSerie: 'SN-88421',
            fluideType: 'R-448A',
            chargeNominaleKg: 4.2,
            detectionPermanente: false,
          },
        ],
      },
    ],
    stock: [
      {
        id: stockId,
        fluide: 'R-448A',
        contenantType: 'vierge',
        numeroContenant: 'BOT-R448A-001',
        quantiteKg: 12.5,
        quantiteInitialeKg: 12.5,
        updatedAt: now,
      },
    ],
    stockMouvements: [],
    interventions: [],
    personnelDossiers: [],
    personnelRhAccesUserIds: [],
    personnelRetiresUserIds: [],
  }
}

export function seedIfEmpty(data: AppData): AppData {
  if (data.clients.length > 0) return data
  return seedDemoData()
}
