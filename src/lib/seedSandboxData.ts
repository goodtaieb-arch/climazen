/**
 * Jeu de données sandbox — ~10 sites, ~10 techniciens, parc équipements, GMAO complète.
 */

import type { AppData, Client, Site, Equipement } from './types'
import { createContratFromModele } from './contratMaintenance'
import { blankOrdreTravail, type OrdreTravail } from './ordreTravail'
import type { PersonnelDossier } from './rhDocuments'
import { defaultPersonnelDossier } from './rhDocuments'
import { blankPiece } from './piecesDetachees'
import { blankDevis } from './chaineCommerciale'
import {
  SANDBOX_MAGASINIER_USER_ID,
  SANDBOX_TEST_EMAIL,
  SANDBOX_TECH_IDS,
} from './sandboxAccount'

const CID_HORIZON = 'b1000001-0001-4000-8000-000000000001'
const CID_EHPAD = 'b1000001-0001-4000-8000-000000000002'
const CID_HYPER = 'b1000001-0001-4000-8000-000000000003'

const SITE_IDS = [
  'c1000001-0001-4000-8000-000000000001',
  'c1000001-0001-4000-8000-000000000002',
  'c1000001-0001-4000-8000-000000000003',
  'c1000001-0001-4000-8000-000000000004',
  'c1000001-0001-4000-8000-000000000005',
  'c1000001-0001-4000-8000-000000000006',
  'c1000001-0001-4000-8000-000000000007',
  'c1000001-0001-4000-8000-000000000008',
  'c1000001-0001-4000-8000-000000000009',
  'c1000001-0001-4000-8000-000000000010',
] as const

const TECH_NAMES = [
  'Karim Benali',
  'Sophie Martin',
  'Lucas Petit',
  'Amélie Durand',
  'Thomas Roux',
  'Nina Lefèvre',
  'Hugo Bernard',
  'Claire Moreau',
  'Mehdi Ali',
  'Julie Garnier',
] as const

const TECH_POSTES = [
  'tech_frigoriste',
  'tech_cvc',
  'electricien',
  'tech_cvc',
  'tech_frigoriste',
  'plombier',
  'magasinier',
  'secretaire',
  'tech_frigoriste',
  'tech_cvc',
] as const

function eq(
  id: string,
  nom: string,
  type: string,
  marque: string,
  fluide = true,
): Equipement {
  return {
    id,
    nom,
    type,
    marque,
    modele: fluide ? 'Série Pro' : 'Standard',
    numeroSerie: `SN-${id.slice(-4)}`,
    avecFluideFrigorigene: fluide,
    fluideType: fluide ? 'R-448A' : '',
    chargeNominaleKg: fluide ? 3.5 : 0,
    teqCO2: fluide ? 0.8 : 0,
    detectionPermanente: false,
  }
}

function site(
  id: string,
  clientId: string,
  nom: string,
  adresse: string,
  cp: string,
  ville: string,
  equipements: Equipement[],
  extra?: Partial<Site>,
): Site {
  const first = equipements?.[0]
  return {
    id,
    clientId,
    nom,
    adresse,
    codePostal: cp,
    ville,
    statut: 'actif',
    modeGestion: 'contrat',
    typeTravaux: 'maintenance',
    createdAt: extra?.createdAt || new Date().toISOString(),
    equipementType: first?.type || 'Climatisation',
    equipementMarque: first?.marque || '',
    equipementModele: first?.modele || '',
    equipementNumeroSerie: first?.numeroSerie || '',
    fluideType: first?.fluideType || 'R-448A',
    chargeNominaleKg: first?.chargeNominaleKg || 0,
    detectionPermanente: false,
    equipements,
    ...extra,
  }
}

export function seedSandboxData(ownerUserId?: string): AppData {
  const now = new Date().toISOString()
  const today = now.slice(0, 10)
  const dayKey = today.slice(2).replace(/-/g, '').slice(0, 6) // aammjj approx — use fixed nums

  const clients: Client[] = [
    {
      id: CID_HORIZON,
      raisonSociale: 'Groupe Horizon Tertiaire',
      nomContact: 'Paul Mercier',
      adresse: '10 place Bellecour',
      codePostal: '69002',
      ville: 'Lyon',
      telephone: '04 78 10 20 30',
      email: 'p.mercier@groupe-horizon.fr',
      agenceCode: '69',
      createdAt: now,
    },
    {
      id: CID_EHPAD,
      raisonSociale: 'Résidence Les Oliviers',
      nomContact: 'Dr. Anne Vidal',
      adresse: '22 chemin des Oliviers',
      codePostal: '13008',
      ville: 'Marseille',
      telephone: '04 91 55 66 77',
      email: 'direction@oliviers-ehpad.fr',
      agenceCode: '13',
      createdAt: now,
    },
    {
      id: CID_HYPER,
      raisonSociale: 'Hyper Frais Sud',
      nomContact: 'Marc Dubois',
      adresse: 'Zone commerciale Sud',
      codePostal: '31000',
      ville: 'Toulouse',
      telephone: '05 61 44 55 66',
      email: 'm.dubois@hyperfrais.fr',
      agenceCode: '31',
      createdAt: now,
    },
  ]

  const chantiers: Site[] = [
    site(SITE_IDS[0], CID_HORIZON, 'Tour Part-Dieu — Bureaux', '129 rue Servient', '69003', 'Lyon', [
      eq('e001', 'Bureau 117 — VRV Daikin', 'VRV', 'Daikin'),
      eq('e002', 'CTA hall', 'CTA', 'Carrier', false),
      eq('e003', 'Split open-space', 'Split', 'Mitsubishi'),
    ], { portailActif: true, portailToken: 'sandboxportail001horizon117' }),
    site(SITE_IDS[1], CID_HORIZON, 'Campus Gerland', '35 avenue Tony Garnier', '69007', 'Lyon', [
      eq('e004', 'PAC rooftop', 'PAC', 'Atlantic'),
      eq('e005', 'Chaufferie gaz', 'Chaudière', 'Frisquet', false),
    ]),
    site(SITE_IDS[2], CID_HORIZON, 'Agence Villeurbanne', '12 rue Paul Verlaine', '69100', 'Villeurbanne', [
      eq('e006', 'Clim réversible', 'Split', 'Fujitsu'),
    ]),
    site(SITE_IDS[3], CID_HORIZON, 'Data center Bron', '8 rue de la Poudrette', '69500', 'Bron', [
      eq('e007', 'Précision clim', 'Précision', 'Schneider', true),
      eq('e008', 'VMC extraction', 'VMC', 'Aldes', false),
    ], { portailActif: true, portailToken: 'sandboxportail002datacenter' }),
    site(SITE_IDS[4], CID_EHPAD, 'EHPAD — Bât. A', '22 chemin des Oliviers', '13008', 'Marseille', [
      eq('e009', 'Chambres — splits', 'Split', 'Daikin'),
      eq('e010', 'Chaufferie P2', 'Chaudière', 'De Dietrich', false),
    ]),
    site(SITE_IDS[5], CID_EHPAD, 'EHPAD — Bât. B', '24 chemin des Oliviers', '13008', 'Marseille', [
      eq('e011', 'VMC double flux', 'VMC', 'Atlantic', false),
    ]),
    site(SITE_IDS[6], CID_EHPAD, 'Buanderie / cuisine', '26 chemin des Oliviers', '13008', 'Marseille', [
      eq('e012', 'Groupe froid cuisine', 'Groupe froid', 'Carrier'),
    ]),
    site(SITE_IDS[7], CID_HYPER, 'Hyper Toulouse — Rayons', '1 av. de l\'Occitanie', '31000', 'Toulouse', [
      eq('e013', 'Meubles froids positifs', 'Groupe froid', 'Huissier'),
      eq('e014', 'Meubles froids négatifs', 'Groupe froid', 'Arneg'),
    ]),
    site(SITE_IDS[8], CID_HYPER, 'Hyper — CVC toiture', '1 av. de l\'Occitanie', '31000', 'Toulouse', [
      eq('e015', 'Roof top 1', 'Roof top', 'Trane'),
      eq('e016', 'Roof top 2', 'Roof top', 'Trane'),
    ]),
    site(SITE_IDS[9], CID_HYPER, 'Drive — annex', '2 av. de l\'Occitanie', '31000', 'Toulouse', [
      eq('e017', 'Clim accueil drive', 'Split', 'LG'),
    ]),
  ]

  const personnelDossiers: PersonnelDossier[] = SANDBOX_TECH_IDS.map((userId, i) => ({
    ...defaultPersonnelDossier(userId, TECH_NAMES[i], now),
    id: `dossier-${userId}`,
    poste: TECH_POSTES[i] as PersonnelDossier['poste'],
    telephone: `06 10 20 3${i} ${i}${i}`,
    agenceCode: ['69', '13', '31'][i % 3],
  }))

  if (ownerUserId) {
    personnelDossiers.push({
      ...defaultPersonnelDossier(ownerUserId, 'Gérant Sandbox', now),
      id: `dossier-${ownerUserId}`,
      poste: 'directeur',
    })
  }

  const contratId = 'f1000001-0001-4000-8000-000000000001'
  const contratCtx = {
    operateur: { raisonSociale: 'ClimaZEN Sandbox Demo SARL', adresse: 'Paris', telephone: '01 99 88 77 66' },
    client: clients[0],
    sites: chantiers.filter((s) => s.clientId === CID_HORIZON).map((s) => ({ nom: s.nom, ville: s.ville, adresse: s.adresse })),
  }
  const c1 = createContratFromModele('semestrielle_clim', {
    ...contratCtx,
    clientId: CID_HORIZON,
    chantierIds: [SITE_IDS[0], SITE_IDS[1], SITE_IDS[2]],
  }, [])
  const c2 = createContratFromModele('chaufferie_12', {
    ...contratCtx,
    client: clients[1],
    sites: chantiers.filter((s) => s.clientId === CID_EHPAD).map((s) => ({ nom: s.nom, ville: s.ville })),
    clientId: CID_EHPAD,
    chantierIds: [],
  }, [c1])
  const contratsMaintenance = [
    {
      ...c1,
      id: contratId,
      statut: 'signe' as const,
      signeAt: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      ...c2,
      id: 'f1000001-0001-4000-8000-000000000002',
      statut: 'signe' as const,
      signeAt: now,
      createdAt: now,
      updatedAt: now,
    },
  ]

  const mkOt = (id: string, num: string, partial: Partial<OrdreTravail>): OrdreTravail => ({
    ...blankOrdreTravail(),
    id,
    numero: num,
    date: today,
    createdAt: now,
    updatedAt: now,
    ...partial,
  })

  const ordresTravail: OrdreTravail[] = [
    mkOt('ot001', `${dayKey}01`, {
      clientId: CID_HORIZON,
      chantierId: SITE_IDS[0],
      equipementId: 'e001',
      typeOt: 'maintenance',
      action: 'Maintenance semestrielle VRV',
      rapportAction: 'Filtres remplacés, contrôle étanchéité OK.',
      statut: 'signe',
      technicien: TECH_NAMES[0],
      technicienUserId: SANDBOX_TECH_IDS[0],
      technicienUserIds: [SANDBOX_TECH_IDS[0]],
      contratId,
      lienCommandeType: 'contrat',
      lienCommandeRef: c1.numero,
      origineOt: 'maintenance_contrat',
      statutFacturation: 'sous_contrat',
      mainOeuvreIncluseContrat: true,
    }),
    mkOt('ot002', `${dayKey}02`, {
      clientId: CID_HORIZON,
      chantierId: SITE_IDS[0],
      typeOt: 'depanage',
      action: '[Ticket client] Bureau 117 — Fuite condensats',
      localisationClient: 'Bureau 117',
      ticketClient: true,
      ticketClientId: 'ticket-demo-001',
      statut: 'pret_a_planifier',
      origineOt: 'depannage_urgence',
      statutFacturation: 'non_facture',
      mainOeuvreIncluseContrat: false,
      lienCommandeType: 'aucun',
      technicien: '',
      technicienUserIds: [],
    }),
    mkOt('ot003', `${dayKey}03`, {
      clientId: CID_EHPAD,
      chantierId: SITE_IDS[4],
      equipementId: 'e010',
      typeOt: 'entretien',
      action: 'Visite chaufferie P2',
      statut: 'en_cours',
      technicien: TECH_NAMES[1],
      technicienUserId: SANDBOX_TECH_IDS[1],
      technicienUserIds: [SANDBOX_TECH_IDS[1]],
      contratId: 'f1000001-0001-4000-8000-000000000002',
      lienCommandeType: 'contrat',
      origineOt: 'maintenance_contrat',
      statutFacturation: 'sous_contrat',
      mainOeuvreIncluseContrat: true,
    }),
    mkOt('ot004', `${dayKey}04`, {
      clientId: CID_HYPER,
      chantierId: SITE_IDS[7],
      equipementId: 'e013',
      typeOt: 'depanage',
      action: 'Alarme haute pression meuble froid',
      statut: 'en_attente_piece',
      origineOt: 'commande_materiel',
      statutFacturation: 'non_facture',
      mainOeuvreIncluseContrat: false,
      commandeFournisseurId: 'cmd001',
      technicien: TECH_NAMES[2],
      technicienUserId: SANDBOX_TECH_IDS[2],
      technicienUserIds: [SANDBOX_TECH_IDS[2]],
    }),
    mkOt('ot005', `${dayKey}05`, {
      clientId: CID_HORIZON,
      chantierId: SITE_IDS[3],
      typeOt: 'maintenance',
      action: 'Maintenance préventive data center',
      statut: 'termine',
      rapportAction: 'Contrôle visuel, températures OK.',
      technicien: TECH_NAMES[4],
      technicienUserId: SANDBOX_TECH_IDS[4],
      technicienUserIds: [SANDBOX_TECH_IDS[4]],
      origineOt: 'maintenance_contrat',
      statutFacturation: 'sous_contrat',
      mainOeuvreIncluseContrat: true,
    }),
  ]

  const piecesDetachees = [
    { ...blankPiece(), id: 'p001', reference: 'FILTRE-M5', designation: 'Filtre plissé M5', categorie: 'filtre' as const, quantite: 24, seuilAlerte: 5, emplacement: 'atelier' as const, fournisseur: 'Daikin', createdAt: now, updatedAt: now },
    { ...blankPiece(), id: 'p002', reference: 'COMP-SCROLL-3', designation: 'Compresseur scroll 3kW', categorie: 'compresseur' as const, quantite: 2, seuilAlerte: 1, emplacement: 'depot' as const, fournisseur: 'Mitsubishi', createdAt: now, updatedAt: now },
    { ...blankPiece(), id: 'p003', reference: 'VENT-ECO-400', designation: 'Ventilateur EC 400mm', categorie: 'ventilateur' as const, quantite: 6, emplacement: 'atelier' as const, createdAt: now, updatedAt: now },
    { ...blankPiece(), id: 'p004', reference: 'CONTACTOR-25A', designation: 'Contacteur 25A', categorie: 'electrique' as const, quantite: 10, emplacement: 'atelier' as const, createdAt: now, updatedAt: now },
    { ...blankPiece(), id: 'p005', reference: 'VANNE-1/4', designation: 'Vanne 1/4 tour R410A', categorie: 'gaz' as const, quantite: 8, seuilAlerte: 2, emplacement: 'vehicule' as const, assigneeUserId: SANDBOX_TECH_IDS[0], assigneeName: TECH_NAMES[0], createdAt: now, updatedAt: now },
  ]

  const devis = [
    {
      ...blankDevis(CID_HORIZON, { libelle: 'Régularisation remplacement filtres', chantierId: SITE_IDS[0] }),
      id: 'dv001',
      numero: 'DV20260001',
      statut: 'accepte' as const,
      montantHt: 420,
      createdAt: now,
      updatedAt: now,
    },
    {
      ...blankDevis(CID_HYPER, { libelle: 'Installation split drive', chantierId: SITE_IDS[9] }),
      id: 'dv002',
      numero: 'DV20260002',
      statut: 'envoye' as const,
      montantHt: 2800,
      createdAt: now,
      updatedAt: now,
    },
  ]

  const commandesFournisseur = [
    {
      id: 'cmd001',
      numero: 'CF20260001',
      fournisseur: 'Daikin',
      libelle: 'Pressostat haute HP meuble froid',
      statut: 'commandee' as const,
      clientId: CID_HYPER,
      chantierId: SITE_IDS[7],
      otId: 'ot004',
      referencePiece: 'HPS-DK-8842',
      quantite: 1,
      commandeeAt: now,
      createdAt: now,
      updatedAt: now,
    },
  ]

  const stock = [
    {
      id: 'stk001',
      fluide: 'R-448A',
      contenantType: 'vierge' as const,
      numeroContenant: 'BOT-R448A-SB01',
      quantiteKg: 18,
      quantiteInitialeKg: 18,
      updatedAt: now,
    },
    {
      id: 'stk002',
      fluide: 'R-32',
      contenantType: 'recuperation' as const,
      numeroContenant: 'BOT-R32-REC01',
      quantiteKg: 0,
      quantiteInitialeKg: 0,
      updatedAt: now,
    },
  ]

  const agendaEvents = [
    {
      id: 'ag001',
      title: 'Maintenance Tour Part-Dieu',
      date: today,
      type: 'maintenance' as const,
      clientId: CID_HORIZON,
      chantierId: SITE_IDS[0],
      contratId,
      statut: 'a_faire' as const,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'ag002',
      title: 'Chaufferie EHPAD — P2',
      date: today,
      type: 'maintenance' as const,
      clientId: CID_EHPAD,
      chantierId: SITE_IDS[4],
      statut: 'a_faire' as const,
      createdAt: now,
      updatedAt: now,
    },
  ]

  return {
    appEdition: 'pro',
    operateur: {
      id: 'op-sandbox-001',
      raisonSociale: 'ClimaZEN Sandbox Demo SARL',
      adresse: '12 rue des Artisans, 75011 Paris',
      siret: '999 888 777 00099',
      attestationNumero: 'ATTEST-SANDBOX-2026',
      telephone: '01 99 88 77 66',
      email: SANDBOX_TEST_EMAIL,
      ticketNotificationEmail: SANDBOX_TEST_EMAIL,
      detecteurIdentification: 'DET-SANDBOX-001',
      detecteurControleDate: today,
      magasinierUserId: SANDBOX_MAGASINIER_USER_ID,
    },
    detecteurs: [
      {
        id: 'det-sandbox-001',
        identification: 'DET-SANDBOX-001',
        controleDate: today,
        notes: 'Détecteur sandbox',
        updatedAt: now,
      },
    ],
    clients,
    chantiers,
    stock,
    stockMouvements: [],
    interventions: [],
    voitures: [
      {
        id: 'v001',
        matricule: 'AB-123-CD',
        marque: 'Renault',
        modele: 'Kangoo',
        assigneeUserId: SANDBOX_TECH_IDS[0],
        assigneeName: TECH_NAMES[0],
        updatedAt: now,
      },
    ],
    outillages: [],
    bonsRemiseMateriel: [],
    fichesMaintenanceClim: [],
    fichesMaintenanceChaufferie: [],
    fichesMaintenanceCtaVmc: [],
    ordresTravail,
    contratsMaintenance,
    devis,
    commandesFournisseur,
    piecesDetachees,
    piecesMouvements: [],
    factures: [],
    agendaEvents,
    pointageRegles: undefined,
    pointageEvents: [],
    pointageBureauJours: [],
    personnelDossiers,
    personnelRhAccesUserIds: [],
    personnelStockageDocsUserIds: [],
    documentsArchives: [],
    personnelRetiresUserIds: [],
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

export function sandboxDataLooksEmpty(data: AppData): boolean {
  return (data.clients?.length || 0) < 2 && (data.chantiers?.length || 0) < 2
}
