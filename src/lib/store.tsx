import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { v4 as uuid } from 'uuid'
import type {
  AppData,
  BonRemiseMateriel,
  CerfaDraft,
  Client,
  DetecteurManuel,
  Equipement,
  Operateur,
  Site,
  StockItem,
  Voiture,
  VoitureEtatLieux,
  Outillage,
} from './types'
import { emptyData, loadData, saveData, seedDemoData } from './storage'
import { seedSandboxData, sandboxDataLooksEmpty } from './seedSandboxData'
import { isSandboxTestEmail } from './sandboxAccount'
import {
  loadOrgDataRemote,
  resolveRemoteVsLocal,
  saveOrgDataRemote,
  updateOrganizationName,
} from './auth'
import { loadCompanyLogoLocal, saveCompanyLogoLocal } from './companyLogo'
import { deleteCerfaPdf, saveCerfaPdf } from './pdfStore'
import { receptionPreserved, outillageLigne, voitureLigne } from './attributionMateriel'
import {
  buildBonRemiseMaterielPdf,
  downloadBonRemisePdf,
  fileNameBonRemise,
  pdfIdBonRemise,
  telechargerBonRemise as telechargerBonRemisePdf,
} from './bonRemiseMaterielPdf'
import { erreurEtatLieux, sanitizeEtatLieux } from './voitures'
import { useAuth } from './AuthContext'
import { applyStockFromIntervention, enregistrerDestruction, enregistrerPerteEmission, enregistrerRetourConsigne, enregistrerTransfertInterne, revertStockForIntervention } from './stockMouvements'
import {
  buildMaintenanceCerfaDrafts,
  syncEquipementsFromFlat,
  syncFlatFromEquipements,
} from './cerfaBatch'
import { assertDetecteurValidePourCerfa } from './detecteurs'
import { nextNumeroIntervention } from './numeroIntervention'
import { nextNumeroOt, blankOrdreTravail, type OrdreTravail } from './ordreTravail'
import type { ContratMaintenance } from './contratMaintenance'
import { contratsActifsForSite } from './contratMaintenance'
import { applyContratSigneSync } from './contratSync'
import { listNouveauxTicketsOrg, markTicketTraite, processClientTicket } from './portailClient'
import { isSupabaseConfigured } from './supabase'
import {
  nextNumeroCommande,
  nextNumeroDevis,
  nextNumeroFacture,
  type CommandeFournisseur,
  type Devis,
  type Facture,
} from './chaineCommerciale'
import type { AgendaEvent } from './agenda'
import {
  parsePointageEvents,
  parsePointageRegles,
  parsePointageBureauJours,
  type PointageEvent,
  type PointageRegles,
  type PointageBureauJour,
} from './pointage'
import { buildAutoAgendaEvents } from './agenda'
import { buildOtDraftsDepuisContrats, mergeOtsDepuisContrats, scinderOtContratParEquipement } from './contratOtAuto'
import {
  applyPersonnelRhScopeToAppData,
  defaultPersonnelDossier,
  estDocumentRhAdminSeulement,
  migratePersonnelDossiers,
  normalizePersonnelRhAccesUserIds,
  normalizePersonnelRetiresUserIds,
  peutVoirIdentitesRh,
  sanitizeDocumentRh,
  typesAMasquer,
  type DocumentRh,
  type PersonnelDossier,
  type RhAccessActor,
} from './rhDocuments'
import { parsePostePersonnel, parseActiviteBureau, parseMetiersCouverts, type PostePersonnelId } from './postePersonnel'
import { parseAgenceCode, parseAgencesCouvertes } from './agences'
import {
  getCloudUpdatedAt,
  getPendingSync,
  isBrowserOnline,
  markSynced,
  setCloudUpdatedAt,
  setPendingSync,
} from './offlineSync'
import { withDeletedIds } from './deletedEntities'
import {
  applyPendingEditionIfNeeded,
  resolveAppEdition,
  type AppEdition,
} from './appEdition'
import {
  appliquerMouvementPiece,
  receptionCommandeEnStock,
  peutGererPiecesDetachees as peutGererPiecesDetacheesFn,
  type PieceDetachee,
  type PieceMouvementKind,
} from './piecesDetachees'

type Store = {
  data: AppData
  loading: boolean
  syncError: string | null
  /** Appareil sans réseau */
  offline: boolean
  /** Saisies locales pas encore poussées au cloud */
  pendingSync: boolean
  /** Pousse maintenant les données locales vers le cloud */
  flushPendingSync: () => Promise<void>
  /** Tire le cloud (PC ↔ téléphone) et applique le plus récent. */
  pullFromCloud: () => Promise<void>
  clearSyncError: () => void
  /** Enregistre le cadre société + sync cloud immédiat (comme le logo). */
  setOperateur: (o: Operateur) => Promise<void>
  /** Enregistre le logo société et sync cloud immédiat (affiché à côté de ClimaZEN). */
  setCompanyLogo: (logoImage: string | undefined) => Promise<void>
  upsertClient: (c: Omit<Client, 'id' | 'createdAt'> & { id?: string }) => string
  deleteClient: (id: string) => void
  upsertChantier: (c: Omit<Site, 'id' | 'createdAt'> & { id?: string }) => string
  deleteChantier: (id: string) => void
  upsertFicheMaintenanceClim: (
    f: Omit<import('./ficheMaintenanceClim').FicheMaintenanceClim, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string
    },
  ) => string
  deleteFicheMaintenanceClim: (id: string) => void
  upsertFicheMaintenanceChaufferie: (
    f: Omit<
      import('./ficheMaintenanceChaufferie').FicheMaintenanceChaufferie,
      'id' | 'createdAt' | 'updatedAt'
    > & { id?: string },
  ) => string
  deleteFicheMaintenanceChaufferie: (id: string) => void
  upsertFicheMaintenanceCtaVmc: (
    f: Omit<
      import('./ficheMaintenanceCtaVmc').FicheMaintenanceCtaVmc,
      'id' | 'createdAt' | 'updatedAt'
    > & { id?: string },
  ) => string
  deleteFicheMaintenanceCtaVmc: (id: string) => void
  upsertOrdreTravail: (
    o: Omit<import('./ordreTravail').OrdreTravail, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string
    },
  ) => string
  deleteOrdreTravail: (id: string) => void
  upsertContratMaintenance: (
    c: Omit<ContratMaintenance, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  ) => string
  deleteContratMaintenance: (id: string) => void
  upsertDevis: (
    d: Omit<import('./chaineCommerciale').Devis, 'id' | 'createdAt' | 'updatedAt' | 'numero'> & {
      id?: string
      numero?: string
    },
  ) => { id: string; numero: string }
  deleteDevis: (id: string) => void
  upsertCommandeFournisseur: (
    c: Omit<
      import('./chaineCommerciale').CommandeFournisseur,
      'id' | 'createdAt' | 'updatedAt' | 'numero'
    > & {
      id?: string
      numero?: string
    },
  ) => { id: string; numero: string }
  deleteCommandeFournisseur: (id: string) => void
  upsertFacture: (
    f: Omit<import('./chaineCommerciale').Facture, 'id' | 'createdAt' | 'updatedAt' | 'numero'> & {
      id?: string
      numero?: string
    },
  ) => string
  /** Devis de régularisation depuis un OT (matériel / travaux hors urgence). */
  genererDevisReguleDepuisOt: (otId: string) => string
  /** Facture directe depuis un OT signé. */
  genererFactureDepuisOt: (otId: string) => string
  /** OT d’exécution depuis un devis accepté (1 devis → N OT). */
  creerOtDepuisDevis: (devisId: string, opts?: { action?: string }) => { id: string; numero: string }
  /** Marque commande reçue + OT prêt à planifier + entrée stock pièces. */
  marquerCommandeRecue: (commandeId: string) => void
  upsertPieceDetachee: (
    p: Omit<PieceDetachee, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  ) => string
  deletePieceDetachee: (id: string) => void
  enregistrerMouvementPiece: (opts: {
    pieceId: string
    kind: PieceMouvementKind
    quantite: number
    otId?: string
    otNumero?: string
    clientId?: string
    chantierId?: string
    emplacementApres?: PieceDetachee['emplacement']
    assigneeUserId?: string
    assigneeName?: string
    motif?: string
  }) => void
  upsertAgendaEvent: (
    e: Omit<AgendaEvent, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  ) => string
  deleteAgendaEvent: (id: string) => void
  upsertPointageRegles: (r: import('./pointage').PointageRegles) => void
  addPointageEvent: (
    e: Omit<import('./pointage').PointageEvent, 'id' | 'createdAt'> & { id?: string },
  ) => string
  annulerPointageEvent: (id: string, motif?: string) => void
  upsertPointageBureauJour: (
    j: Omit<PointageBureauJour, 'id' | 'updatedAt'> & { id?: string },
  ) => string
  /** Synchronise les rappels + OT de maintenance depuis les contrats signés. */
  syncAgendaFromSources: () => number
  /** Crée les OT manquants des contrats signés (sans dupliquer un créneau déjà déplacé). */
  syncOtsDepuisContrats: () => number
  /** Scinde un OT contrat multi-équipements en 1 OT par équipement. */
  scinderOtContrat: (otId: string) => { created: number } | null
  /** Tickets portail client → OT bureau (cloud). */
  syncClientPortalTickets: () => Promise<number>
  /** Crée un OT pour une action terrain — retourne { id, numero }. */
  createOtForAction: (opts: {
    typeOt: import('./ordreTravail').TypeOt
    action: string
    clientId?: string
    chantierId?: string
    equipementId?: string
    technicien?: string
    technicienUserId?: string
    observations?: string
    interventionId?: string
    ficheMaintenanceId?: string
    signatureTechnicienImage?: string
    signatureClientImage?: string
    statut?: import('./ordreTravail').StatutOt
    lienCommandeType?: import('./ordreTravail').LienCommandeType
    lienCommandeRef?: string
    contratId?: string
    devisId?: string
    commandeFournisseurId?: string
    origineOt?: import('./chaineCommerciale').OrigineOt
    statutFacturation?: import('./chaineCommerciale').StatutFacturationOt
    sousGarantie?: boolean
    clientPayeurId?: string
    mainOeuvreIncluseContrat?: boolean
    ticketClient?: boolean
    ticketClientId?: string
    localisationClient?: string
  }) => { id: string; numero: string }
  /**
   * Valide une maintenance : crée 1 CERFA par équipement (équipements déjà sauvés sur le site).
   * Retourne les fiches créées pour génération PDF côté UI.
   */
  validateMaintenanceCerfas: (opts: {
    siteId: string
    dateIntervention?: string
    signataireNom: string
    signataireQualite: string
    signatureOperateurImage: string
    userId?: string
    userName?: string
    equipementIds?: string[]
    natures?: import('./types').NatureIntervention[]
  }) => { drafts: CerfaDraft[]; site: Site; client: Client }
  /** Enregistre nom / qualité signataire sur le site (pas l’image — signature à chaque OT). */
  applySiteClientSignature: (opts: {
    siteId: string
    signatureDetenteur: string
    signatureDetenteurQualite: string
    signatureDetenteurImage?: string
  }) => number
  upsertStock: (s: Omit<StockItem, 'id' | 'updatedAt'> & { id?: string }) => string
  deleteStock: (id: string) => void
  enregistrerRetourConsigneBouteille: (opts: {
    stockItemId: string
    bonRetourConsigne: string
    bonRetourDate: string
    bonRetourFournisseur?: string
    bonRetourNotes?: string
    createdByName?: string
  }) => void
  enregistrerDestructionBouteille: (opts: {
    stockItemId: string
    quantiteKg: number
    date: string
    centreDestruction?: string
    documentReference?: string
    notes?: string
    createdByName?: string
  }) => void
  enregistrerTransfertInterneBouteille: (opts: {
    stockItemId: string
    versEmplacement: 'atelier' | 'vehicule'
    versLabel?: string
    assigneeUserId?: string
    assigneeName?: string
    date?: string
    notes?: string
    documentAdr?: string
    createdByName?: string
  }) => void
  enregistrerPerteEmissionBouteille: (opts: {
    stockItemId: string
    quantiteKg: number
    date: string
    motif?: string
    notes?: string
    createdByName?: string
  }) => void
  upsertIntervention: (
    i: Omit<CerfaDraft, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  ) => string
  saveInterventionWithStock: (
    i: Omit<CerfaDraft, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    opts?: { createdByName?: string },
  ) => string
  deleteIntervention: (id: string) => void
  upsertDetecteur: (
    d: Omit<DetecteurManuel, 'id' | 'updatedAt'> & { id?: string },
  ) => Promise<string>
  deleteDetecteur: (id: string) => Promise<void>
  upsertVoiture: (
    v: Omit<Voiture, 'id' | 'updatedAt'> & { id?: string },
  ) => Promise<string>
  deleteVoiture: (id: string) => Promise<void>
  upsertOutillage: (
    o: Omit<Outillage, 'id' | 'updatedAt'> & { id?: string },
  ) => Promise<string>
  deleteOutillage: (id: string) => Promise<void>
  /**
   * L’opérateur valide la réception : véhicule → état des lieux + documents pris ;
   * outillage / téléphone → bon de remise. PDF officiel stocké pour le gérant.
   */
  validerReceptionMateriel: (opts: {
    userId: string
    voitureId?: string
    etatVoiture?: VoitureEtatLieux
    outillageIds?: string[]
  }) => Promise<{ bonIds: string[] }>
  telechargerBonRemise: (bonId: string) => Promise<void>
  /** Crée / met à jour le dossier RH d’un technicien (activité + notes). */
  upsertPersonnelDossier: (
    d: Omit<PersonnelDossier, 'id' | 'updatedAt' | 'documents'> & {
      id?: string
      documents?: DocumentRh[]
    },
  ) => string
  upsertPersonnelDocument: (
    userId: string,
    userName: string,
    doc: Omit<DocumentRh, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  ) => string
  deletePersonnelDocument: (userId: string, documentId: string) => void
  /** Gérant seulement : autorise un employé (secrétariat, accueil appels) à voir les identités. */
  setPersonnelRhAcces: (userId: string, granted: boolean) => void
  /** Gérant : portable pro du technicien (affiché dans Équipe). */
  setPersonnelTelephone: (userId: string, userName: string, telephone: string) => void
  /** Gérant : poste métier (tech CVC, secrétaire, directeur…). */
  setPersonnelPoste: (userId: string, userName: string, poste: PostePersonnelId | '') => void
  /** Gérant (ou le tech lui-même) : lien Drive / OneDrive de SON dossier photos pièces. */
  setPersonnelLienCloud: (userId: string, userName: string, url: string) => void
  /** Gérant : retire le tech de l’équipe (départ) — plus listé. */
  retirePersonnel: (userId: string) => void
  /** Identités + dossiers des collègues : gérant ou personnel autorisé. */
  peutVoirIdentitesRh: boolean
  /** Stock pièces détachées : gérant, magasinier ou bureau. */
  peutGererPiecesDetachees: boolean
  /** Light (solo / AE) ou Pro (PME / TPE). */
  appEdition: AppEdition
  /** Gérant : bascule Light ↔ Pro. */
  setAppEdition: (edition: AppEdition) => void
  resetDemo: () => void
  /** Réinitialise avec le jeu de données sandbox complet (10 sites, 10 techs). */
  resetSandbox: () => void
  /** Remplace les données cloud par un payload (import local). */
  replaceData: (next: AppData) => Promise<void>
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user, isOwner } = useAuth()
  const orgId = user?.organizationId || null
  const rhActor: RhAccessActor | undefined = user?.id
    ? { userId: user.id, isOwner: Boolean(isOwner || user.role === 'owner') }
    : undefined
  const rhActorRef = useRef(rhActor)
  rhActorRef.current = rhActor

  const [data, setData] = useState<AppData>(() => emptyData())
  const [loading, setLoading] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [offline, setOffline] = useState(() => !isBrowserOnline())
  const [pendingSync, setPendingSyncState] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const skipNextSave = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flushing = useRef(false)
  const syncingPull = useRef(false)
  const dataRef = useRef(data)
  dataRef.current = data

  const applyEditionBootstrap = (payload: AppData): AppData => {
    const { appEdition, changed } = applyPendingEditionIfNeeded(payload)
    const resolved = resolveAppEdition(changed ? appEdition : payload.appEdition ?? appEdition)
    if (resolved === payload.appEdition) return payload
    return { ...payload, appEdition: resolved }
  }

  const applyLocalLogo = (payload: AppData, organizationId: string): AppData => {
    const localLogo = loadCompanyLogoLocal(organizationId)
    const merged: AppData = {
      ...payload,
      operateur: {
        ...payload.operateur,
        logoImage: payload.operateur.logoImage || localLogo || undefined,
      },
    }
    if (merged.operateur.logoImage) {
      saveCompanyLogoLocal(organizationId, merged.operateur.logoImage)
    }
    return applyEditionBootstrap(merged)
  }

  const applyRhView = (payload: AppData): AppData => {
    const actor = rhActorRef.current
    if (!actor) return payload
    return applyPersonnelRhScopeToAppData(payload, actor)
  }

  const markPending = useCallback(
    (pending: boolean) => {
      setPendingSync(orgId, pending)
      setPendingSyncState(pending)
    },
    [orgId],
  )

  const flushPendingSync = useCallback(async () => {
    if (!orgId || flushing.current) return
    if (!isBrowserOnline()) {
      setOffline(true)
      return
    }
    flushing.current = true
    try {
      let payload = dataRef.current
      // Tire d’abord le cloud (autre appareil) puis fusionne avant de pousser
      try {
        const remotePack = await loadOrgDataRemote(orgId)
        const { data: merged } = resolveRemoteVsLocal(remotePack.data, payload, {
          remoteUpdatedAt: remotePack.updatedAt,
          knownCloudAt: getCloudUpdatedAt(orgId),
          hasLocalPending: true,
          actor: rhActorRef.current,
        })
        payload = applyRhView(applyLocalLogo(merged, orgId))
        skipNextSave.current = true
        dataRef.current = payload
        setData(payload)
        if (remotePack.updatedAt) setCloudUpdatedAt(orgId, remotePack.updatedAt)
      } catch {
        /* réseau partiel → pousser le local quand même */
      }
      saveData(payload, orgId)
      const { updatedAt } = await saveOrgDataRemote(orgId, payload, rhActorRef.current)
      setCloudUpdatedAt(orgId, updatedAt)
      markSynced(orgId)
      setPendingSyncState(false)
      setSyncError(null)
      setOffline(false)
    } catch (err) {
      console.error(err)
      markPending(true)
      setSyncError(err instanceof Error ? err.message : 'Sync cloud impossible')
    } finally {
      flushing.current = false
    }
  }, [orgId, markPending])

  const syncClientPortalTickets = useCallback(async (): Promise<number> => {
    if (!orgId || !isSupabaseConfigured()) return 0
    const tickets = await listNouveauxTicketsOrg(orgId)
    if (!tickets.length) return 0
    const d = dataRef.current
    const pending = tickets.filter(
      (t) => !(d.ordresTravail || []).some((o) => o.ticketClientId === t.id),
    )
    if (!pending.length) return 0

    let created = 0
    const mergedOts = [...(d.ordresTravail || [])]
    let needsLocalPush = false

    for (const t of pending) {
      const remote = await processClientTicket({ ticketId: t.id })
      if (remote.ok) {
        if (remote.ot && !mergedOts.some((o) => o.id === remote.ot!.id)) {
          mergedOts.push(remote.ot)
        }
        created += 1
        continue
      }

      // Repli local si l’API serveur n’est pas configurée
      const site = d.chantiers.find((s) => s.id === t.site_id)
      if (!site) continue
      const now = new Date().toISOString()
      const numero = nextNumeroOt({ ...d, ordresTravail: mergedOts })
      const id = uuid()
      const ot: OrdreTravail = {
        ...blankOrdreTravail(),
        id,
        numero,
        date: now.slice(0, 10),
        typeOt: 'depanage',
        action: `[Ticket client] ${t.localisation} — ${t.description}`,
        localisationClient: t.localisation,
        ticketClient: true,
        ticketClientId: t.id,
        clientId: site.clientId,
        chantierId: site.id,
        origineOt: 'depannage_urgence',
        statut: 'pret_a_planifier',
        createdAt: now,
        updatedAt: now,
      }
      mergedOts.push(ot)
      await markTicketTraite(t.id, id, numero)
      created += 1
      needsLocalPush = true
    }

    if (!created) return 0

    setData((prev) => ({ ...prev, ordresTravail: mergedOts }))
    if (needsLocalPush) {
      markPending(true)
      setPendingSyncState(true)
    }
    return created
  }, [orgId, markPending])

  const pullFromCloud = useCallback(async () => {
    if (!orgId || !hydrated || syncingPull.current || flushing.current) return
    if (!isBrowserOnline()) {
      setOffline(true)
      return
    }
    // Saisies locales en attente → fusion + push (ne pas écraser)
    if (getPendingSync(orgId)) {
      await flushPendingSync()
      return
    }
    syncingPull.current = true
    try {
      const remotePack = await loadOrgDataRemote(orgId)
      const known = getCloudUpdatedAt(orgId)
      // Déjà à jour
      if (remotePack.updatedAt && known && remotePack.updatedAt <= known) {
        setOffline(false)
        return
      }
      const local = dataRef.current
      const { data: resolved, shouldPushLocal } = resolveRemoteVsLocal(remotePack.data, local, {
        remoteUpdatedAt: remotePack.updatedAt,
        knownCloudAt: known,
        hasLocalPending: false,
        actor: rhActorRef.current,
      })
      const merged = applyRhView(applyLocalLogo(resolved, orgId))
      skipNextSave.current = true
      dataRef.current = merged
      setData(merged)
      saveData(merged, orgId)
      if (remotePack.updatedAt) setCloudUpdatedAt(orgId, remotePack.updatedAt)
      setOffline(false)
      setSyncError(null)
      if (shouldPushLocal) {
        markPending(true)
        setPendingSyncState(true)
        await flushPendingSync()
      } else {
        markSynced(orgId)
        setPendingSyncState(false)
      }
      await syncClientPortalTickets()
    } catch (err) {
      console.error(err)
      setSyncError(err instanceof Error ? err.message : 'Sync cloud impossible')
    } finally {
      syncingPull.current = false
    }
  }, [orgId, hydrated, flushPendingSync, markPending, syncClientPortalTickets])

  useEffect(() => {
    const onOnline = () => {
      setOffline(false)
      void flushPendingSync()
      void pullFromCloud()
    }
    const onOffline = () => setOffline(true)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [flushPendingSync, pullFromCloud])

  // Sync auto PC ↔ téléphone : à chaque retour sur l’app + toutes les 20 s
  useEffect(() => {
    if (!orgId || !hydrated) return
    const tick = () => {
      if (document.visibilityState === 'visible') void pullFromCloud()
    }
    const onVis = () => {
      if (document.visibilityState === 'visible') void pullFromCloud()
    }
    window.addEventListener('focus', tick)
    document.addEventListener('visibilitychange', onVis)
    const poll = window.setInterval(tick, 20000)
    // Premier pull juste après hydrate (autre appareil a pu changer)
    const t0 = window.setTimeout(() => void pullFromCloud(), 800)
    return () => {
      window.removeEventListener('focus', tick)
      document.removeEventListener('visibilitychange', onVis)
      window.clearInterval(poll)
      window.clearTimeout(t0)
    }
  }, [orgId, hydrated, pullFromCloud])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!orgId) {
        // Ne pas vider le store en mémoire pendant un refresh auth (évite flash vide)
        setHydrated(false)
        setLoading(false)
        setPendingSyncState(false)
        return
      }
      setLoading(true)
      setSyncError(null)
      const hadPending = getPendingSync(orgId)
      setPendingSyncState(hadPending)

      const useLocal = () => {
        const local = applyRhView(applyLocalLogo(loadData(orgId), orgId))
        skipNextSave.current = true
        dataRef.current = local
        setData(local)
        saveData(local, orgId)
        setHydrated(true)
      }

      // Hors ligne : ouvrir immédiatement avec le cache local
      if (!isBrowserOnline()) {
        setOffline(true)
        useLocal()
        setLoading(false)
        return
      }

      try {
        // Saisies offline en attente : on pousse le local, on n’écrase pas avec le cloud
        if (hadPending) {
          useLocal()
          setLoading(false)
          await flushPendingSync()
          return
        }

        const remotePack = await Promise.race([
          loadOrgDataRemote(orgId),
          new Promise<never>((_, reject) =>
            window.setTimeout(
              () => reject(new Error('Sync cloud — délai dépassé (10s)')),
              10000,
            ),
          ),
        ])
        if (cancelled) return
        const local = loadData(orgId)
        const { data: resolved, shouldPushLocal } = resolveRemoteVsLocal(
          remotePack.data,
          local,
          {
            remoteUpdatedAt: remotePack.updatedAt,
            knownCloudAt: getCloudUpdatedAt(orgId),
            hasLocalPending: hadPending,
            actor: rhActorRef.current,
          },
        )
        const merged = applyRhView(applyLocalLogo(resolved, orgId))
        let final = merged
        if (
          isSandboxTestEmail(user?.email) &&
          sandboxDataLooksEmpty(merged) &&
          !hadPending
        ) {
          final = applyRhView(applyLocalLogo(seedSandboxData(user?.id), orgId))
        }
        skipNextSave.current = true
        dataRef.current = final
        setData(final)
        saveData(final, orgId)
        if (remotePack.updatedAt) setCloudUpdatedAt(orgId, remotePack.updatedAt)
        setHydrated(true)
        setOffline(false)
        if (final !== merged || shouldPushLocal) {
          markPending(true)
          setPendingSyncState(true)
          setLoading(false)
          await flushPendingSync()
          return
        }
        markSynced(orgId)
        setPendingSyncState(false)
      } catch (err) {
        console.error(err)
        if (!cancelled) {
          useLocal()
          setOffline(!isBrowserOnline())
          setSyncError(err instanceof Error ? err.message : 'Sync impossible — mode local')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // flushPendingSync volontairement omis : éviter de recharger le cloud à chaque identity change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])

  useEffect(() => {
    if (!orgId || !hydrated) return
    if (skipNextSave.current) {
      skipNextSave.current = false
      return
    }
    // Toujours enregistrer localement d’abord (terrain / hors ligne)
    saveData(data, orgId)
    // Marquer pending avant le cloud : un reload PWA ne doit pas écraser avec un cloud vide
    markPending(true)
    if (!isBrowserOnline()) {
      setOffline(true)
      return
    }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void saveOrgDataRemote(orgId, data, rhActorRef.current)
        .then(({ updatedAt }) => {
          setCloudUpdatedAt(orgId, updatedAt)
          markSynced(orgId)
          setPendingSyncState(false)
          setSyncError(null)
          setOffline(false)
        })
        .catch((err) => {
          console.error(err)
          markPending(true)
          setSyncError(err instanceof Error ? err.message : 'Enregistrement cloud impossible')
        })
    }, 400)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [data, orgId, hydrated, markPending])

  const clearSyncError = useCallback(() => setSyncError(null), [])

  const replaceData = useCallback(
    async (next: AppData) => {
      if (!orgId) return
      const viewed = applyRhView(next)
      skipNextSave.current = true
      setData(viewed)
      saveData(viewed, orgId)
      if (!isBrowserOnline()) {
        markPending(true)
        setOffline(true)
        return
      }
      try {
        const { updatedAt } = await saveOrgDataRemote(orgId, viewed, rhActorRef.current)
        setCloudUpdatedAt(orgId, updatedAt)
        markSynced(orgId)
        setPendingSyncState(false)
        setSyncError(null)
      } catch (err) {
        markPending(true)
        setSyncError(err instanceof Error ? err.message : 'Enregistrement cloud impossible')
      }
    },
    [orgId, markPending],
  )

  const persistNow = useCallback(
    async (next: AppData) => {
      if (!orgId) return
      if (saveTimer.current) clearTimeout(saveTimer.current)
      const viewed = applyRhView(next)
      skipNextSave.current = true
      dataRef.current = viewed
      setData(viewed)
      saveData(viewed, orgId)
      if (!isBrowserOnline()) {
        markPending(true)
        setOffline(true)
        return
      }
      try {
        const { updatedAt } = await saveOrgDataRemote(orgId, viewed, rhActorRef.current)
        setCloudUpdatedAt(orgId, updatedAt)
        markSynced(orgId)
        setPendingSyncState(false)
        setSyncError(null)
        setOffline(false)
      } catch (err) {
        console.error(err)
        markPending(true)
        setSyncError(err instanceof Error ? err.message : 'Enregistrement cloud impossible')
        throw err
      }
    },
    [orgId, markPending],
  )

  const setOperateur = useCallback(
    async (o: Operateur) => {
      if (user?.role !== 'owner') {
        throw new Error('Seul l’administrateur peut modifier les infos société.')
      }
      if (!orgId) throw new Error('Organisation introuvable.')
      const prev = dataRef.current
      const next: AppData = { ...prev, operateur: o }
      saveCompanyLogoLocal(orgId, o.logoImage || null)
      if (o.raisonSociale.trim() && user) {
        try {
          await updateOrganizationName(orgId, o.raisonSociale.trim(), user)
        } catch (err) {
          console.warn('ClimaZEN: maj nom organisation', err)
        }
      }
      await persistNow(next)
    },
    [user, orgId, persistNow],
  )

  const setCompanyLogo = useCallback(
    async (logoImage: string | undefined) => {
      if (!orgId) throw new Error('Organisation introuvable.')
      if (user?.role !== 'owner') throw new Error('Seul l’administrateur peut changer le logo.')
      const prev = dataRef.current
      const operateur: Operateur = { ...prev.operateur }
      if (logoImage) operateur.logoImage = logoImage
      else delete operateur.logoImage
      const next: AppData = { ...prev, operateur }
      saveCompanyLogoLocal(orgId, logoImage || null)
      await persistNow(next)
    },
    [orgId, user?.role, persistNow],
  )

  const upsertClient = useCallback(
    (c: Omit<Client, 'id' | 'createdAt'> & { id?: string }) => {
      const id = c.id ?? uuid()
      setData((d) => {
        const existing = d.clients.find((x) => x.id === id)
        const next: Client = {
          ...c,
          id,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
          createdByUserId: existing?.createdByUserId || c.createdByUserId,
          createdByName: existing?.createdByName || c.createdByName,
        }
        return {
          ...d,
          clients: existing
            ? d.clients.map((x) => (x.id === id ? next : x))
            : [...d.clients, next],
        }
      })
      return id
    },
    [],
  )

  const deleteClient = useCallback((id: string) => {
    setData((d) => {
      const removedSites = (d.chantiers || [])
        .filter((c) => c.clientId === id)
        .map((c) => c.id)
      return {
        ...d,
        clients: d.clients.filter((c) => c.id !== id),
        chantiers: d.chantiers.filter((c) => c.clientId !== id),
        deletedEntityIds: withDeletedIds(d.deletedEntityIds, {
          clients: [id],
          chantiers: removedSites,
        }),
      }
    })
  }, [])

  const upsertChantier = useCallback(
    (c: Omit<Site, 'id' | 'createdAt'> & { id?: string }) => {
      const id = c.id ?? uuid()
      setData((d) => {
        const existing = d.chantiers.find((x) => x.id === id)
        let equipements: Equipement[]
        if (Array.isArray(c.equipements) && c.equipements.length > 0) {
          equipements = c.equipements.map((e) => ({
            ...e,
            id: e.id || uuid(),
            nom: e.nom || e.type || 'Équipement',
          }))
        } else {
          equipements = syncEquipementsFromFlat(c, existing?.equipements)
        }
        const flat = syncFlatFromEquipements(equipements)
        const next: Site = {
          ...c,
          ...flat,
          id,
          equipements,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
          createdByUserId: existing?.createdByUserId || c.createdByUserId,
          createdByName: existing?.createdByName || c.createdByName,
          signatureDetenteurNom: c.signatureDetenteurNom ?? existing?.signatureDetenteurNom,
          signatureDetenteurQualite:
            c.signatureDetenteurQualite ?? existing?.signatureDetenteurQualite,
          signatureDetenteurImage: c.signatureDetenteurImage ?? existing?.signatureDetenteurImage,
          signatureDetenteurAt: c.signatureDetenteurAt ?? existing?.signatureDetenteurAt,
          derniereMaintenanceAt: c.derniereMaintenanceAt ?? existing?.derniereMaintenanceAt,
          derniereMaintenanceDate: c.derniereMaintenanceDate ?? existing?.derniereMaintenanceDate,
          modeGestion: c.modeGestion ?? existing?.modeGestion,
          prochaineControleEtancheite:
            c.prochaineControleEtancheite ?? existing?.prochaineControleEtancheite,
        }
        return {
          ...d,
          chantiers: existing
            ? d.chantiers.map((x) => (x.id === id ? next : x))
            : [...d.chantiers, next],
        }
      })
      return id
    },
    [],
  )

  const deleteChantier = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      chantiers: d.chantiers.filter((c) => c.id !== id),
      deletedEntityIds: withDeletedIds(d.deletedEntityIds, { chantiers: [id] }),
    }))
  }, [])

  const upsertFicheMaintenanceClim = useCallback(
    (
      f: Omit<import('./ficheMaintenanceClim').FicheMaintenanceClim, 'id' | 'createdAt' | 'updatedAt'> & {
        id?: string
      },
    ) => {
      const id = f.id ?? uuid()
      const now = new Date().toISOString()
      setData((d) => {
        const list = d.fichesMaintenanceClim || []
        const existing = list.find((x) => x.id === id)
        const numero =
          (f.numero || '').trim() ||
          (existing?.numero || '').trim() ||
          nextNumeroIntervention(d)
        const next = {
          ...f,
          numero,
          id,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        }
        let ordres = [...(d.ordresTravail || [])]
        const hasOt = ordres.some(
          (o) => o.ficheMaintenanceId === id || o.numero === numero,
        )
        if (!hasOt && !existing) {
          ordres = [
            ...ordres,
            {
              id: uuid(),
              numero,
              date: f.date || now.slice(0, 10),
              typeOt: 'entretien' as const,
              action: `Rapport sans CERFA — ${f.marqueModele || 'équipement'}`,
              rapportAction: f.observations || '',
              observations: f.observations || '',
              clientId: f.clientId,
              chantierId: f.chantierId,
              equipementId: f.equipementId,
              technicien: f.technicien || '',
              ficheMaintenanceId: id,
              signatureTechnicienImage: f.signatureTechnicienImage,
              signatureClientImage: f.signatureClientImage,
              statut: 'en_cours' as const,
              createdAt: now,
              updatedAt: now,
            },
          ]
        }
        return {
          ...d,
          ordresTravail: ordres,
          fichesMaintenanceClim: existing
            ? list.map((x) => (x.id === id ? next : x))
            : [...list, next],
        }
      })
      return id
    },
    [],
  )

  const deleteFicheMaintenanceClim = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      fichesMaintenanceClim: (d.fichesMaintenanceClim || []).filter((f) => f.id !== id),
    }))
  }, [])

  const upsertFicheMaintenanceChaufferie = useCallback(
    (
      f: Omit<
        import('./ficheMaintenanceChaufferie').FicheMaintenanceChaufferie,
        'id' | 'createdAt' | 'updatedAt'
      > & { id?: string },
    ) => {
      const id = f.id ?? uuid()
      const now = new Date().toISOString()
      setData((d) => {
        const list = d.fichesMaintenanceChaufferie || []
        const existing = list.find((x) => x.id === id)
        const numero =
          (f.numero || '').trim() ||
          (existing?.numero || '').trim() ||
          nextNumeroIntervention(d)
        const next = {
          ...f,
          numero,
          id,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        }
        let ordres = [...(d.ordresTravail || [])]
        const hasOt = ordres.some(
          (o) => o.ficheChaufferieId === id || o.numero === numero,
        )
        if (!hasOt && !existing) {
          ordres = [
            ...ordres,
            {
              id: uuid(),
              numero,
              date: f.date || now.slice(0, 10),
              typeOt: 'entretien' as const,
              action: `Maintenance chaufferie ${f.periode} — ${f.marqueModele || 'équipement'}`,
              rapportAction: f.observations || '',
              observations: f.observations || '',
              clientId: f.clientId,
              chantierId: f.chantierId,
              equipementId: f.equipementId,
              technicien: f.technicien || '',
              ficheChaufferieId: id,
              signatureTechnicienImage: f.signatureTechnicienImage,
              signatureClientImage: f.signatureClientImage,
              statut: 'en_cours' as const,
              createdAt: now,
              updatedAt: now,
            },
          ]
        } else {
          ordres = ordres.map((o) =>
            o.numero === numero || o.ficheChaufferieId === id
              ? { ...o, ficheChaufferieId: id, updatedAt: now }
              : o,
          )
        }
        return {
          ...d,
          ordresTravail: ordres,
          fichesMaintenanceChaufferie: existing
            ? list.map((x) => (x.id === id ? next : x))
            : [...list, next],
        }
      })
      return id
    },
    [],
  )

  const deleteFicheMaintenanceChaufferie = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      fichesMaintenanceChaufferie: (d.fichesMaintenanceChaufferie || []).filter((f) => f.id !== id),
    }))
  }, [])

  const upsertFicheMaintenanceCtaVmc = useCallback(
    (
      f: Omit<
        import('./ficheMaintenanceCtaVmc').FicheMaintenanceCtaVmc,
        'id' | 'createdAt' | 'updatedAt'
      > & { id?: string },
    ) => {
      const id = f.id ?? uuid()
      const now = new Date().toISOString()
      setData((d) => {
        const list = d.fichesMaintenanceCtaVmc || []
        const existing = list.find((x) => x.id === id)
        const numero =
          (f.numero || '').trim() ||
          (existing?.numero || '').trim() ||
          nextNumeroIntervention(d)
        const next = {
          ...f,
          numero,
          id,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        }
        let ordres = [...(d.ordresTravail || [])]
        const hasOt = ordres.some(
          (o) => o.ficheCtaVmcId === id || o.numero === numero,
        )
        if (!hasOt && !existing) {
          ordres = [
            ...ordres,
            {
              id: uuid(),
              numero,
              date: f.date || now.slice(0, 10),
              typeOt: 'entretien' as const,
              action: `Maintenance CTA/VMC ${f.periode} — ${f.marqueModele || 'équipement'}`,
              rapportAction: f.observations || '',
              observations: f.observations || '',
              clientId: f.clientId,
              chantierId: f.chantierId,
              equipementId: f.equipementId,
              technicien: f.technicien || '',
              ficheCtaVmcId: id,
              signatureTechnicienImage: f.signatureTechnicienImage,
              signatureClientImage: f.signatureClientImage,
              statut: 'en_cours' as const,
              createdAt: now,
              updatedAt: now,
            },
          ]
        } else {
          ordres = ordres.map((o) =>
            o.numero === numero || o.ficheCtaVmcId === id
              ? { ...o, ficheCtaVmcId: id, updatedAt: now }
              : o,
          )
        }
        return {
          ...d,
          ordresTravail: ordres,
          fichesMaintenanceCtaVmc: existing
            ? list.map((x) => (x.id === id ? next : x))
            : [...list, next],
        }
      })
      return id
    },
    [],
  )

  const deleteFicheMaintenanceCtaVmc = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      fichesMaintenanceCtaVmc: (d.fichesMaintenanceCtaVmc || []).filter((f) => f.id !== id),
    }))
  }, [])

  const upsertOrdreTravail = useCallback(
    (
      o: Omit<OrdreTravail, 'id' | 'createdAt' | 'updatedAt'> & {
        id?: string
      },
    ) => {
      const id = o.id ?? uuid()
      const now = new Date().toISOString()
      setData((d) => {
        const list = d.ordresTravail || []
        const existing = list.find((x) => x.id === id)
        const numero =
          (o.numero || '').trim() ||
          (existing?.numero || '').trim() ||
          nextNumeroOt(d)
        const next: OrdreTravail = {
          ...o,
          numero,
          id,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        }
        return {
          ...d,
          ordresTravail: existing
            ? list.map((x) => (x.id === id ? next : x))
            : [...list, next],
        }
      })
      return id
    },
    [],
  )

  const deleteOrdreTravail = useCallback((id: string) => {
    setData((d) => {
      const ot = (d.ordresTravail || []).find((o) => o.id === id)
      const linkedInterventionIds = (d.interventions || [])
        .filter((i) => {
          if (i.ordreTravailId === id) return true
          if (ot?.interventionId && i.id === ot.interventionId) return true
          if (ot?.numero && i.numeroIntervention) {
            const a = i.numeroIntervention.replace(/^OT\s*/i, '').trim()
            const b = ot.numero.replace(/^OT\s*/i, '').trim()
            if (a && b && (a === b || i.numeroIntervention === ot.numero)) return true
          }
          return false
        })
        .map((i) => i.id)
      return {
        ...d,
        ordresTravail: (d.ordresTravail || []).filter((o) => o.id !== id),
        interventions: (d.interventions || []).filter((i) => !linkedInterventionIds.includes(i.id)),
        deletedEntityIds: withDeletedIds(d.deletedEntityIds, {
          ordresTravail: [id],
          interventions: linkedInterventionIds,
        }),
      }
    })
  }, [])

  const upsertContratMaintenance = useCallback(
    (
      c: Omit<ContratMaintenance, 'id' | 'createdAt' | 'updatedAt'> & {
        id?: string
      },
    ) => {
      const id = c.id ?? uuid()
      const now = new Date().toISOString()
      setData((d) => {
        const list = d.contratsMaintenance || []
        const existing = list.find((x) => x.id === id)
        const next: ContratMaintenance = {
          ...c,
          id,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        }
        let updated: AppData = {
          ...d,
          contratsMaintenance: existing
            ? list.map((x) => (x.id === id ? next : x))
            : [...list, next],
        }
        updated = applyContratSigneSync(updated, next)
        return updated
      })
      return id
    },
    [],
  )

  const deleteContratMaintenance = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      contratsMaintenance: (d.contratsMaintenance || []).filter((c) => c.id !== id),
    }))
  }, [])

  const upsertDevis = useCallback(
    (
      raw: Omit<Devis, 'id' | 'createdAt' | 'updatedAt' | 'numero'> & {
        id?: string
        numero?: string
      },
    ) => {
      const id = raw.id ?? uuid()
      const now = new Date().toISOString()
      let numeroOut = raw.numero?.trim() || ''
      setData((d) => {
        const list = d.devis || []
        const existing = list.find((x) => x.id === id)
        const numero =
          raw.numero?.trim() ||
          existing?.numero ||
          nextNumeroDevis(list, raw.type || 'standard')
        numeroOut = numero
        const next: Devis = {
          ...raw,
          id,
          numero,
          lignes: raw.lignes || existing?.lignes || [],
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        }
        let ordres = d.ordresTravail || []
        if (next.otOrigineId) {
          ordres = ordres.map((o) =>
            o.id === next.otOrigineId
              ? {
                  ...o,
                  devisId: next.id,
                  lienCommandeType:
                    next.type === 'regularisation' ? 'devis_regule' : o.lienCommandeType || 'devis',
                  lienCommandeRef: next.numero,
                  updatedAt: now,
                }
              : o,
          )
        }
        return {
          ...d,
          devis: existing ? list.map((x) => (x.id === id ? next : x)) : [...list, next],
          ordresTravail: ordres,
        }
      })
      return { id, numero: numeroOut }
    },
    [],
  )

  const deleteDevis = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      devis: (d.devis || []).filter((x) => x.id !== id),
    }))
  }, [])

  const upsertCommandeFournisseur = useCallback(
    (
      raw: Omit<CommandeFournisseur, 'id' | 'createdAt' | 'updatedAt' | 'numero'> & {
        id?: string
        numero?: string
      },
    ) => {
      const id = raw.id ?? uuid()
      const now = new Date().toISOString()
      let numeroOut = raw.numero?.trim() || ''
      setData((d) => {
        const list = d.commandesFournisseur || []
        const existing = list.find((x) => x.id === id)
        const numero = raw.numero?.trim() || existing?.numero || nextNumeroCommande(list)
        numeroOut = numero
        const destination =
          raw.destination ||
          (raw.otId ? 'ot' : existing?.destination) ||
          (raw.otId || existing?.otId ? 'ot' : 'stock')
        const otId = destination === 'ot' ? raw.otId || existing?.otId : undefined
        const next: CommandeFournisseur = {
          ...raw,
          id,
          numero,
          destination,
          otId,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          commandeeAt:
            raw.statut === 'commandee'
              ? raw.commandeeAt || existing?.commandeeAt || now
              : raw.commandeeAt || existing?.commandeeAt,
        }
        let ordres = d.ordresTravail || []
        let pieces = [...(d.piecesDetachees || [])]
        let pieceMvts = [...(d.piecesMouvements || [])]
        const devientRecue = next.statut === 'recue' && existing?.statut !== 'recue'
        if (devientRecue) {
          try {
            const result = receptionCommandeEnStock({
              pieces,
              commande: next,
              parUserId: user?.id,
              parUserName: user?.fullName,
              now,
            })
            if (result.created) pieces.push(result.piece)
            else pieces = pieces.map((p) => (p.id === result.piece.id ? result.piece : p))
            pieceMvts.push(result.mouvement)
          } catch {
            /* référence manquante */
          }
        }

        const prevOtId = existing?.otId
        ordres = ordres.map((o) => {
          if (next.otId && o.id === next.otId) {
            let statut = o.statut
            if (next.statut === 'recue' && o.statut === 'en_attente_piece') {
              statut = 'pret_a_planifier'
            } else if (
              (next.statut === 'commandee' || next.statut === 'brouillon') &&
              !existing &&
              (o.statut === 'pret_a_planifier' || o.statut === 'brouillon' || !o.statut)
            ) {
              statut = 'en_attente_piece'
            }
            return {
              ...o,
              commandeFournisseurId: next.id,
              lienCommandeType: 'commande' as const,
              lienCommandeRef: next.numero,
              origineOt: o.origineOt || 'commande_materiel',
              statut,
              updatedAt: now,
            }
          }
          if (
            (prevOtId && o.id === prevOtId && prevOtId !== next.otId) ||
            (o.commandeFournisseurId === next.id && o.id !== next.otId)
          ) {
            return {
              ...o,
              commandeFournisseurId: undefined,
              updatedAt: now,
            }
          }
          return o
        })

        return {
          ...d,
          piecesDetachees: pieces,
          piecesMouvements: pieceMvts,
          commandesFournisseur: existing
            ? list.map((x) => (x.id === id ? next : x))
            : [...list, next],
          ordresTravail: ordres,
        }
      })
      return { id, numero: numeroOut }
    },
    [user?.id, user?.fullName],
  )

  const deleteCommandeFournisseur = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      commandesFournisseur: (d.commandesFournisseur || []).filter((x) => x.id !== id),
    }))
  }, [])

  const upsertFacture = useCallback(
    (
      raw: Omit<Facture, 'id' | 'createdAt' | 'updatedAt' | 'numero'> & {
        id?: string
        numero?: string
      },
    ) => {
      const id = raw.id ?? uuid()
      const now = new Date().toISOString()
      setData((d) => {
        const list = d.factures || []
        const existing = list.find((x) => x.id === id)
        const numero = raw.numero?.trim() || existing?.numero || nextNumeroFacture(list)
        const next: Facture = {
          ...raw,
          id,
          numero,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        }
        return {
          ...d,
          factures: existing ? list.map((x) => (x.id === id ? next : x)) : [...list, next],
        }
      })
      return id
    },
    [],
  )

  const genererDevisReguleDepuisOt = useCallback((otId: string) => {
    const d = dataRef.current
    const ot = (d.ordresTravail || []).find((o) => o.id === otId)
    if (!ot) throw new Error('OT introuvable.')
    if (!ot.clientId) throw new Error('Client manquant sur l’OT.')
    const now = new Date().toISOString()
    const devisId = uuid()
    const numero = nextNumeroDevis(d.devis || [], 'regularisation')
    const devis: Devis = {
      id: devisId,
      numero,
      type: 'regularisation',
      statut: 'brouillon',
      clientId: ot.clientId,
      chantierId: ot.chantierId,
      otOrigineId: ot.id,
      libelle: `Régularisation — OT${ot.numero} — ${ot.action || 'Intervention'}`,
      lignes: [
        {
          id: uuid(),
          designation: ot.rapportAction?.trim() || ot.action || 'Travaux / pièces hors urgence',
          quantite: 1,
          horsContrat: true,
        },
      ],
      notes: 'Généré depuis l’OT — à compléter (pièces, temps, fluides).',
      createdAt: now,
      updatedAt: now,
    }
    setData((prev) => ({
      ...prev,
      devis: [...(prev.devis || []), devis],
      ordresTravail: (prev.ordresTravail || []).map((o) =>
        o.id === otId
          ? {
              ...o,
              devisId,
              lienCommandeType: 'devis_regule',
              lienCommandeRef: numero,
              origineOt: o.origineOt || 'depannage_urgence',
              statutFacturation: 'devis_regule_emis',
              updatedAt: now,
            }
          : o,
      ),
    }))
    return devisId
  }, [])

  const genererFactureDepuisOt = useCallback((otId: string) => {
    const d = dataRef.current
    const ot = (d.ordresTravail || []).find((o) => o.id === otId)
    if (!ot) throw new Error('OT introuvable.')
    if (!ot.clientId) throw new Error('Client manquant sur l’OT.')
    if (!ot.signatureClientImage || !ot.signatureTechnicienImage) {
      throw new Error('Signatures tech + client requises avant facture.')
    }
    const now = new Date().toISOString()
    const factureId = uuid()
    const numero = nextNumeroFacture(d.factures || [])
    const facture: Facture = {
      id: factureId,
      numero,
      statut: 'emise',
      clientId: ot.clientPayeurId || ot.clientId,
      clientPayeurId: ot.clientPayeurId,
      chantierId: ot.chantierId,
      otId: ot.id,
      devisId: ot.devisId,
      libelle: `Facture — OT${ot.numero} — ${ot.action || 'Intervention'}`,
      createdAt: now,
      updatedAt: now,
    }
    setData((prev) => ({
      ...prev,
      factures: [...(prev.factures || []), facture],
      ordresTravail: (prev.ordresTravail || []).map((o) =>
        o.id === otId
          ? { ...o, factureId, statutFacturation: 'facture_generee', updatedAt: now }
          : o,
      ),
    }))
    return factureId
  }, [])

  const creerOtDepuisDevis = useCallback((devisId: string, opts?: { action?: string }) => {
    const d = dataRef.current
    const devis = (d.devis || []).find((x) => x.id === devisId)
    if (!devis) throw new Error('Devis introuvable.')
    if (devis.statut !== 'accepte' && devis.statut !== 'execute') {
      throw new Error('Le devis doit être accepté avant de créer un OT d’exécution.')
    }
    const now = new Date().toISOString()
    const id = uuid()
    const numero = nextNumeroOt(d)
    const detail = devis.lignes.map((l) => l.designation).filter(Boolean).join(' · ')
    const ot: OrdreTravail = {
      id,
      numero,
      date: now.slice(0, 10),
      typeOt: 'installation',
      action: opts?.action || devis.libelle || detail || 'Exécution devis',
      rapportAction: '',
      observations: detail ? `Prestations devis ${devis.numero} : ${detail}` : '',
      clientId: devis.clientId,
      chantierId: devis.chantierId,
      technicien: '',
      devisId: devis.id,
      lienCommandeType: devis.type === 'regularisation' ? 'devis_regule' : 'devis',
      lienCommandeRef: devis.numero,
      origineOt: 'installation_devis',
      statutFacturation: 'non_facture',
      statut: 'pret_a_planifier',
      parcoursStep: 'ot',
      createdAt: now,
      updatedAt: now,
    }
    setData((prev) => ({
      ...prev,
      ordresTravail: [...(prev.ordresTravail || []), ot],
      devis: (prev.devis || []).map((x) =>
        x.id === devisId ? { ...x, statut: 'execute' as const, updatedAt: now } : x,
      ),
    }))
    return { id, numero }
  }, [])

  const marquerCommandeRecue = useCallback(
    (commandeId: string) => {
      const now = new Date().toISOString()
      setData((d) => {
        const cmd = (d.commandesFournisseur || []).find((c) => c.id === commandeId)
        if (!cmd) return d

        let pieces = [...(d.piecesDetachees || [])]
        let mouvements = [...(d.piecesMouvements || [])]

        if (cmd.statut !== 'recue') {
          try {
            const result = receptionCommandeEnStock({
              pieces,
              commande: { ...cmd, statut: 'recue' },
              parUserId: user?.id,
              parUserName: user?.fullName,
              now,
            })
            if (result.created) {
              pieces.push(result.piece)
            } else {
              pieces = pieces.map((p) => (p.id === result.piece.id ? result.piece : p))
            }
            mouvements.push(result.mouvement)
          } catch {
            /* commande sans référence exploitable — on marque quand même reçue */
          }
        }

        return {
          ...d,
          piecesDetachees: pieces,
          piecesMouvements: mouvements,
          commandesFournisseur: (d.commandesFournisseur || []).map((c) =>
            c.id === commandeId
              ? { ...c, statut: 'recue' as const, recueAt: now, updatedAt: now }
              : c,
          ),
          ordresTravail: (d.ordresTravail || []).map((o) =>
            cmd.otId && o.id === cmd.otId && o.statut === 'en_attente_piece'
              ? { ...o, statut: 'pret_a_planifier', updatedAt: now }
              : o,
          ),
        }
      })
    },
    [user?.id, user?.fullName],
  )

  const upsertPieceDetachee = useCallback(
    (raw: Omit<PieceDetachee, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
      const id = raw.id ?? uuid()
      const now = new Date().toISOString()
      setData((d) => {
        const list = d.piecesDetachees || []
        const existing = list.find((x) => x.id === id)
        const next: PieceDetachee = {
          ...raw,
          id,
          reference: (raw.reference || '').trim(),
          designation: (raw.designation || '').trim(),
          quantite: Math.max(0, Number(raw.quantite) || 0),
          unite: (raw.unite || 'u').trim() || 'u',
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        }
        return {
          ...d,
          piecesDetachees: existing
            ? list.map((x) => (x.id === id ? next : x))
            : [...list, next],
        }
      })
      return id
    },
    [],
  )

  const deletePieceDetachee = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      piecesDetachees: (d.piecesDetachees || []).filter((p) => p.id !== id),
      deletedEntityIds: withDeletedIds(d.deletedEntityIds, { piecesDetachees: [id] }),
    }))
  }, [])

  const enregistrerMouvementPiece = useCallback(
    (opts: {
      pieceId: string
      kind: PieceMouvementKind
      quantite: number
      otId?: string
      otNumero?: string
      clientId?: string
      chantierId?: string
      emplacementApres?: PieceDetachee['emplacement']
      assigneeUserId?: string
      assigneeName?: string
      motif?: string
    }) => {
      setData((d) => {
        const piece = (d.piecesDetachees || []).find((p) => p.id === opts.pieceId)
        if (!piece) throw new Error('Pièce introuvable.')
        const { piece: nextPiece, mouvement } = appliquerMouvementPiece({
          piece,
          kind: opts.kind,
          quantite: opts.quantite,
          otId: opts.otId,
          otNumero: opts.otNumero,
          clientId: opts.clientId,
          chantierId: opts.chantierId,
          emplacementApres: opts.emplacementApres,
          assigneeUserId: opts.assigneeUserId,
          assigneeName: opts.assigneeName,
          motif: opts.motif,
          parUserId: user?.id,
          parUserName: user?.fullName,
        })
        return {
          ...d,
          piecesDetachees: (d.piecesDetachees || []).map((p) =>
            p.id === nextPiece.id ? nextPiece : p,
          ),
          piecesMouvements: [...(d.piecesMouvements || []), mouvement],
        }
      })
    },
    [user?.id, user?.fullName],
  )

  const upsertAgendaEvent = useCallback(
    (e: Omit<AgendaEvent, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
      const id = e.id ?? uuid()
      const now = new Date().toISOString()
      setData((d) => {
        const list = d.agendaEvents || []
        const existing =
          list.find((x) => x.id === id) ||
          (e.autoKey ? list.find((x) => x.autoKey === e.autoKey) : undefined)
        const next: AgendaEvent = {
          ...e,
          id: existing?.id ?? id,
          notes: e.notes ?? existing?.notes,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        }
        return {
          ...d,
          agendaEvents: existing
            ? list.map((x) => (x.id === next.id ? { ...existing, ...next } : x))
            : [...list, next],
        }
      })
      return id
    },
    [],
  )

  const deleteAgendaEvent = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      agendaEvents: (d.agendaEvents || []).filter((e) => e.id !== id),
    }))
  }, [])

  const upsertPointageRegles = useCallback((r: PointageRegles) => {
    const now = new Date().toISOString()
    setData((d) => ({
      ...d,
      pointageRegles: parsePointageRegles({ ...r, updatedAt: now }),
    }))
  }, [])

  const addPointageEvent = useCallback(
    (e: Omit<PointageEvent, 'id' | 'createdAt'> & { id?: string }) => {
      const id = e.id ?? uuid()
      const now = new Date().toISOString()
      const next: PointageEvent = {
        ...e,
        id,
        createdAt: now,
      }
      setData((d) => ({
        ...d,
        pointageEvents: [...parsePointageEvents(d.pointageEvents), next],
      }))
      return id
    },
    [],
  )

  const annulerPointageEvent = useCallback((id: string, motif?: string) => {
    setData((d) => ({
      ...d,
      pointageEvents: parsePointageEvents(d.pointageEvents).map((e) =>
        e.id === id ? { ...e, annule: true, annuleMotif: motif || 'Annulé' } : e,
      ),
    }))
  }, [])

  const upsertPointageBureauJour = useCallback(
    (j: Omit<PointageBureauJour, 'id' | 'updatedAt'> & { id?: string }) => {
      const now = new Date().toISOString()
      const date = j.date.slice(0, 10)
      const id = j.id ?? uuid()
      const next: PointageBureauJour = {
        id,
        userId: j.userId,
        userName: j.userName,
        date,
        heureDebut: j.heureDebut,
        heureFin: j.heureFin,
        heurePauseDebut: j.heurePauseDebut,
        heurePauseFin: j.heurePauseFin,
        note: j.note,
        updatedAt: now,
      }
      setData((d) => {
        const list = parsePointageBureauJours(d.pointageBureauJours)
        const idx = list.findIndex((x) => x.userId === j.userId && x.date === date)
        const merged =
          idx >= 0
            ? list.map((x, i) => (i === idx ? { ...next, id: x.id } : x))
            : [...list, next]
        return { ...d, pointageBureauJours: merged }
      })
      return id
    },
    [],
  )

  const applyOtsDepuisContrats = useCallback((prev: AppData) => {
    const drafts = buildOtDraftsDepuisContrats({
      contrats: prev.contratsMaintenance || [],
      sites: prev.chantiers,
    })
    const existing = prev.ordresTravail || []
    const { toAdd } = mergeOtsDepuisContrats(existing, drafts)
    if (toAdd.length === 0) return { next: prev, added: 0 }
    const now = new Date().toISOString()
    const grown = [...existing]
    for (const draft of toAdd) {
      const numero = nextNumeroOt({ ...prev, ordresTravail: grown })
      grown.push({
        ...draft,
        id: uuid(),
        numero,
        createdAt: now,
        updatedAt: now,
      })
    }
    return { next: { ...prev, ordresTravail: grown }, added: toAdd.length }
  }, [])

  const syncOtsDepuisContrats = useCallback(() => {
    let added = 0
    setData((prev) => {
      const result = applyOtsDepuisContrats(prev)
      added = result.added
      return result.next
    })
    return added
  }, [applyOtsDepuisContrats])

  const scinderOtContrat = useCallback((otId: string) => {
    const d = dataRef.current
    const ot = (d.ordresTravail || []).find((o) => o.id === otId)
    if (!ot) return null
    const site = d.chantiers.find((s) => s.id === ot.chantierId)
    const plan = scinderOtContratParEquipement(ot, site?.equipements)
    if (!plan) return null
    const now = new Date().toISOString()
    setData((prev) => {
      let grown = (prev.ordresTravail || []).filter((o) => o.id !== plan.parentId)
      for (const draft of plan.children) {
        const numero = nextNumeroOt({ ...prev, ordresTravail: grown })
        grown = [
          ...grown,
          {
            ...draft,
            id: uuid(),
            numero,
            createdAt: now,
            updatedAt: now,
          },
        ]
      }
      return { ...prev, ordresTravail: grown }
    })
    return { created: plan.children.length }
  }, [])

  const syncAgendaFromSources = useCallback(() => {
    const d = dataRef.current
    const generated = buildAutoAgendaEvents({
      contrats: d.contratsMaintenance || [],
      sites: d.chantiers,
    })
    let added = 0
    setData((prev) => {
      const withOts = applyOtsDepuisContrats(prev)
      added += withOts.added
      const list = [...(withOts.next.agendaEvents || [])]
      const byKey = new Map(list.filter((e) => e.autoKey).map((e) => [e.autoKey!, e]))
      const now = new Date().toISOString()
      for (const g of generated) {
        const key = g.autoKey!
        const existing = byKey.get(key)
        if (existing) {
          // Met à jour titre/dates mais conserve statut manuel
          const idx = list.findIndex((x) => x.id === existing.id)
          if (idx >= 0) {
            list[idx] = {
              ...existing,
              title: g.title,
              date: g.date,
              dateRappel: g.dateRappel,
              notes: g.notes,
              type: g.type,
              clientId: g.clientId,
              chantierId: g.chantierId,
              contratId: g.contratId,
              updatedAt: now,
            }
          }
        } else {
          const ev: AgendaEvent = {
            ...g,
            id: uuid(),
            createdAt: now,
            updatedAt: now,
          }
          list.push(ev)
          byKey.set(key, ev)
          added += 1
        }
      }
      return { ...withOts.next, agendaEvents: list }
    })
    return added
  }, [applyOtsDepuisContrats])

  const createOtForAction = useCallback(
    (opts: {
      typeOt: import('./ordreTravail').TypeOt
      action: string
      clientId?: string
      chantierId?: string
      equipementId?: string
      technicien?: string
      technicienUserId?: string
      observations?: string
      interventionId?: string
      ficheMaintenanceId?: string
      signatureTechnicienImage?: string
      signatureClientImage?: string
      statut?: import('./ordreTravail').StatutOt
      lienCommandeType?: import('./ordreTravail').LienCommandeType
      lienCommandeRef?: string
      contratId?: string
      devisId?: string
      commandeFournisseurId?: string
      origineOt?: import('./chaineCommerciale').OrigineOt
      statutFacturation?: import('./chaineCommerciale').StatutFacturationOt
      sousGarantie?: boolean
      clientPayeurId?: string
      mainOeuvreIncluseContrat?: boolean
      ticketClient?: boolean
      ticketClientId?: string
      localisationClient?: string
    }) => {
      const d = dataRef.current
      const numero = nextNumeroOt(d)
      const id = uuid()
      const now = new Date().toISOString()
      const site = opts.chantierId
        ? d.chantiers.find((s) => s.id === opts.chantierId)
        : undefined
      let lienCommandeType = opts.lienCommandeType || 'aucun'
      let lienCommandeRef = opts.lienCommandeRef || ''
      let contratId = opts.contratId
      let origineOt = opts.origineOt
      let statutFacturation = opts.statutFacturation
      let mainOeuvreIncluseContrat = opts.mainOeuvreIncluseContrat || false
      if (!contratId && !opts.lienCommandeType && !opts.devisId && site) {
        const actifs = contratsActifsForSite(d.contratsMaintenance, site)
        if (actifs[0]) {
          lienCommandeType = 'contrat'
          lienCommandeRef = actifs[0].numero
          contratId = actifs[0].id
          origineOt = origineOt || 'maintenance_contrat'
          statutFacturation = statutFacturation || 'sous_contrat'
          mainOeuvreIncluseContrat = true
        }
      }
      const ot: OrdreTravail = {
        id,
        numero,
        date: now.slice(0, 10),
        typeOt: opts.typeOt,
        action: opts.action,
        rapportAction: '',
        observations: opts.observations || '',
        clientId: opts.clientId,
        chantierId: opts.chantierId,
        equipementId: opts.equipementId,
        technicien: opts.technicien || '',
        technicienUserId: opts.technicienUserId,
        interventionId: opts.interventionId,
        ficheMaintenanceId: opts.ficheMaintenanceId,
        signatureTechnicienImage: opts.signatureTechnicienImage,
        signatureClientImage: opts.signatureClientImage,
        lienCommandeType,
        lienCommandeRef,
        contratId,
        devisId: opts.devisId,
        commandeFournisseurId: opts.commandeFournisseurId,
        ticketClient: opts.ticketClient,
        ticketClientId: opts.ticketClientId,
        localisationClient: opts.localisationClient,
        origineOt: origineOt || (opts.typeOt === 'depanage' ? 'depannage_urgence' : 'depannage_urgence'),
        statutFacturation: statutFacturation || 'non_facture',
        sousGarantie: opts.sousGarantie || false,
        clientPayeurId: opts.clientPayeurId,
        mainOeuvreIncluseContrat,
        statut: opts.statut || 'en_cours',
        createdAt: now,
        updatedAt: now,
      }
      setData((prev) => ({
        ...prev,
        ordresTravail: [...(prev.ordresTravail || []), ot],
      }))
      return { id, numero }
    },
    [],
  )

  const validateMaintenanceCerfas = useCallback(
    (opts: {
      siteId: string
      dateIntervention?: string
      signataireNom: string
      signataireQualite: string
      signatureOperateurImage: string
      userId?: string
      userName?: string
      equipementIds?: string[]
      natures?: import('./types').NatureIntervention[]
    }) => {
      const d = dataRef.current
      const site = d.chantiers.find((s) => s.id === opts.siteId)
      if (!site) throw new Error('Site introuvable.')
      const client = d.clients.find((c) => c.id === site.clientId)
      if (!client) throw new Error('Client du site introuvable.')
      const det = assertDetecteurValidePourCerfa(d, opts.userId)
      const dateIntervention =
        opts.dateIntervention || new Date().toISOString().slice(0, 10)
      const drafts = buildMaintenanceCerfaDrafts({
        site,
        client,
        operateur: d.operateur,
        dateIntervention,
        userId: opts.userId,
        userName: opts.userName,
        signataireNom: opts.signataireNom,
        signataireQualite: opts.signataireQualite,
        signatureOperateurImage: opts.signatureOperateurImage,
        detecteurIdentification: det.identification,
        detecteurControleDate: det.controleDate,
        equipementIds: opts.equipementIds,
        natures: opts.natures,
      }).map((draft, i) => ({
        ...draft,
        numeroIntervention: nextNumeroIntervention(d, i),
      }))
      const now = new Date().toISOString()
      const withOt = drafts.map((draft) => {
        const otId = uuid()
        const natures = draft.natures || []
        const typeOt =
          natures.includes('demantelement')
            ? ('demantelement' as const)
            : natures.some((n) => n.startsWith('controle_etancheite'))
              ? ('controle_etancheite' as const)
              : natures.includes('entretien_reparation')
                ? ('entretien' as const)
                : ('maintenance' as const)
        const ot: OrdreTravail = {
          id: otId,
          numero: draft.numeroIntervention || nextNumeroOt(d),
          date: dateIntervention,
          typeOt,
          action: `Intervention CERFA — ${natures.join(', ') || 'travaux'}`,
          rapportAction: '',
          observations: '',
          clientId: draft.clientId,
          chantierId: draft.chantierId,
          equipementId: draft.equipementId,
          technicien: opts.signataireNom || opts.userName || '',
          interventionId: draft.id,
          signatureTechnicienImage: opts.signatureOperateurImage,
          statut: 'en_cours',
          createdByUserId: opts.userId,
          createdByName: opts.userName,
          createdAt: now,
          updatedAt: now,
        }
        return { draft: { ...draft, ordreTravailId: otId }, ot }
      })
      const draftsLinked = withOt.map((x) => x.draft)
      const ots = withOt.map((x) => x.ot)
      setData((prev) => ({
        ...prev,
        interventions: [...prev.interventions, ...draftsLinked],
        ordresTravail: [...(prev.ordresTravail || []), ...ots],
        chantiers: prev.chantiers.map((s) =>
          s.id === opts.siteId
            ? {
                ...s,
                derniereMaintenanceAt: now,
                derniereMaintenanceDate: dateIntervention,
              }
            : s,
        ),
      }))
      return { drafts: draftsLinked, site, client }
    },
    [],
  )

  const applySiteClientSignature = useCallback(
    (opts: {
      siteId: string
      signatureDetenteur: string
      signatureDetenteurQualite: string
      /** Trait de signature — laisser vide : on ne mémorise plus l’image sur le site */
      signatureDetenteurImage?: string
    }) => {
      // Nom / qualité seulement sur le site. Jamais d’image réutilisable entre OT.
      setData((d) => {
        const site = d.chantiers.find((s) => s.id === opts.siteId)
        if (!site) return d
        const sites = d.chantiers.map((s) =>
          s.id === opts.siteId
            ? {
                ...s,
                signatureDetenteurNom: opts.signatureDetenteur,
                signatureDetenteurQualite: opts.signatureDetenteurQualite,
                signatureDetenteurImage: undefined,
                signatureDetenteurAt: undefined,
              }
            : s,
        )
        return {
          ...d,
          chantiers: sites,
        }
      })
      return 1
    },
    [],
  )

  const upsertStock = useCallback(
    (s: Omit<StockItem, 'id' | 'updatedAt'> & { id?: string }) => {
      const id = s.id ?? uuid()
      setData((d) => {
        const existing = d.stock.find((x) => x.id === id)
        const next: StockItem = {
          ...s,
          id,
          quantiteInitialeKg:
            s.quantiteInitialeKg ?? existing?.quantiteInitialeKg ?? s.quantiteKg,
          updatedAt: new Date().toISOString(),
        }
        return {
          ...d,
          stock: existing
            ? d.stock.map((x) => (x.id === id ? next : x))
            : [...d.stock, next],
        }
      })
      return id
    },
    [],
  )

  const deleteStock = useCallback((id: string) => {
    setData((d) => {
      const mvtIds = (d.stockMouvements || [])
        .filter((m) => m.stockItemId === id)
        .map((m) => m.id)
      return {
        ...d,
        stock: d.stock.filter((s) => s.id !== id),
        stockMouvements: (d.stockMouvements || []).filter((m) => m.stockItemId !== id),
        deletedEntityIds: withDeletedIds(d.deletedEntityIds, {
          stock: [id],
          stockMouvements: mvtIds,
        }),
      }
    })
  }, [])

  const enregistrerRetourConsigneBouteille = useCallback(
    (opts: {
      stockItemId: string
      bonRetourConsigne: string
      bonRetourDate: string
      bonRetourFournisseur?: string
      bonRetourNotes?: string
      createdByName?: string
    }) => {
      let error: Error | null = null
      setData((d) => {
        try {
          return enregistrerRetourConsigne(d, opts)
        } catch (err) {
          error = err instanceof Error ? err : new Error('Erreur retour consigne')
          return d
        }
      })
      if (error) throw error
    },
    [],
  )

  const enregistrerDestructionBouteille = useCallback(
    (opts: {
      stockItemId: string
      quantiteKg: number
      date: string
      centreDestruction?: string
      documentReference?: string
      notes?: string
      createdByName?: string
    }) => {
      let error: Error | null = null
      setData((d) => {
        try {
          return enregistrerDestruction(d, opts)
        } catch (err) {
          error = err instanceof Error ? err : new Error('Erreur destruction')
          return d
        }
      })
      if (error) throw error
    },
    [],
  )

  const enregistrerTransfertInterneBouteille = useCallback(
    (opts: {
      stockItemId: string
      versEmplacement: 'atelier' | 'vehicule'
      versLabel?: string
      assigneeUserId?: string
      assigneeName?: string
      date?: string
      notes?: string
      documentAdr?: string
      createdByName?: string
    }) => {
      let error: Error | null = null
      setData((d) => {
        try {
          return enregistrerTransfertInterne(d, opts)
        } catch (err) {
          error = err instanceof Error ? err : new Error('Erreur transfert interne')
          return d
        }
      })
      if (error) throw error
    },
    [],
  )

  const enregistrerPerteEmissionBouteille = useCallback(
    (opts: {
      stockItemId: string
      quantiteKg: number
      date: string
      motif?: string
      notes?: string
      createdByName?: string
    }) => {
      let error: Error | null = null
      setData((d) => {
        try {
          return enregistrerPerteEmission(d, opts)
        } catch (err) {
          error = err instanceof Error ? err : new Error('Erreur déclaration perte')
          return d
        }
      })
      if (error) throw error
    },
    [],
  )

  const upsertIntervention = useCallback(
    (i: Omit<CerfaDraft, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
      const id = i.id ?? uuid()
      const now = new Date().toISOString()
      setData((d) => {
        const existing = d.interventions.find((x) => x.id === id)
        const numeroIntervention =
          i.numeroIntervention?.trim() ||
          existing?.numeroIntervention?.trim() ||
          nextNumeroIntervention(d)
        let ordreTravailId = i.ordreTravailId || existing?.ordreTravailId
        let ordres = [...(d.ordresTravail || [])]
        if (ordreTravailId) {
          ordres = ordres.map((o) =>
            o.id === ordreTravailId || o.numero === numeroIntervention
              ? {
                  ...o,
                  interventionId: id,
                  numero: o.numero || numeroIntervention,
                  rapportAction: i.observations || o.rapportAction,
                  observations: i.observations || o.observations,
                  signatureTechnicienImage:
                    i.signatureOperateurImage || o.signatureTechnicienImage,
                  signatureClientImage:
                    i.signatureDetenteurImage || o.signatureClientImage,
                  statut: o.statut === 'signe' ? o.statut : 'en_cours',
                  updatedAt: now,
                }
              : o,
          )
        } else {
          const linked = ordres.find(
            (o) => o.interventionId === id || o.numero === numeroIntervention,
          )
          if (linked) ordreTravailId = linked.id
        }
        const next: CerfaDraft = {
          ...i,
          id,
          numeroIntervention,
          ordreTravailId,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        }
        return {
          ...d,
          ordresTravail: ordres,
          interventions: existing
            ? d.interventions.map((x) => (x.id === id ? next : x))
            : [...d.interventions, next],
        }
      })
      return id
    },
    [],
  )

  const saveInterventionWithStock = useCallback(
    (
      i: Omit<CerfaDraft, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
      opts?: { createdByName?: string },
    ) => {
      const id = i.id ?? uuid()
      const now = new Date().toISOString()
      let error: Error | null = null

      setData((d) => {
        const existing = d.interventions.find((x) => x.id === id)
        const numeroIntervention =
          i.numeroIntervention?.trim() ||
          existing?.numeroIntervention?.trim() ||
          nextNumeroIntervention(d)
        let ordreTravailId = i.ordreTravailId || existing?.ordreTravailId
        let ordres = [...(d.ordresTravail || [])]
        if (!ordreTravailId) {
          const linked = ordres.find(
            (o) => o.interventionId === id || o.numero === numeroIntervention,
          )
          if (linked) {
            ordreTravailId = linked.id
          } else {
            ordreTravailId = uuid()
            const ot: OrdreTravail = {
              id: ordreTravailId,
              numero: numeroIntervention,
              date: i.dateIntervention || now.slice(0, 10),
              typeOt: (i.natures || []).includes('demantelement')
                ? 'demantelement'
                : (i.natures || []).some((n) => n.startsWith('controle_etancheite'))
                  ? 'controle_etancheite'
                  : (i.natures || []).includes('entretien_reparation')
                    ? 'entretien'
                    : 'maintenance',
              action: `Intervention CERFA — ${(i.natures || []).join(', ') || 'travaux'}`,
              rapportAction: i.observations || '',
              observations: i.observations || '',
              clientId: i.clientId,
              chantierId: i.chantierId,
              equipementId: i.equipementId,
              technicien: opts?.createdByName || i.signatureOperateur || '',
              interventionId: id,
              signatureTechnicienImage: i.signatureOperateurImage,
              signatureClientImage: i.signatureDetenteurImage,
              statut:
                i.status === 'signe' || i.status === 'envoye' ? 'signe' : 'en_cours',
              createdByUserId: i.createdByUserId,
              createdByName: i.createdByName || opts?.createdByName,
              createdAt: now,
              updatedAt: now,
            }
            ordres = [...ordres, ot]
          }
        }
        if (ordreTravailId) {
          ordres = ordres.map((o) =>
            o.id === ordreTravailId || o.numero === numeroIntervention
              ? {
                  ...o,
                  interventionId: id,
                  numero: o.numero || numeroIntervention,
                  rapportAction: i.observations || o.rapportAction,
                  observations: i.observations || o.observations,
                  signatureTechnicienImage:
                    i.signatureOperateurImage || o.signatureTechnicienImage,
                  signatureClientImage:
                    i.signatureDetenteurImage || o.signatureClientImage,
                  statut:
                    i.status === 'signe' || i.status === 'envoye' ? 'signe' : o.statut,
                  updatedAt: now,
                }
              : o,
          )
        }
        const next: CerfaDraft = {
          ...i,
          id,
          numeroIntervention,
          ordreTravailId,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        }
        const withIntervention: AppData = {
          ...d,
          ordresTravail: ordres,
          interventions: existing
            ? d.interventions.map((x) => (x.id === id ? next : x))
            : [...d.interventions, next],
        }
        try {
          return applyStockFromIntervention(withIntervention, next, opts)
        } catch (err) {
          error = err instanceof Error ? err : new Error('Erreur stock')
          return d
        }
      })

      if (error) throw error
      return id
    },
    [],
  )

  const deleteIntervention = useCallback(
    (id: string) => {
      setData((d) => {
        const reverted = revertStockForIntervention(d, id)
        return {
          ...reverted,
          interventions: reverted.interventions.filter((x) => x.id !== id),
          ordresTravail: (reverted.ordresTravail || []).map((o) =>
            o.interventionId === id ? { ...o, interventionId: undefined } : o,
          ),
          deletedEntityIds: withDeletedIds(reverted.deletedEntityIds, {
            interventions: [id],
          }),
        }
      })
      void deleteCerfaPdf(id, orgId)
    },
    [orgId],
  )

  const upsertDetecteur = useCallback(
    async (d: Omit<DetecteurManuel, 'id' | 'updatedAt'> & { id?: string }) => {
      const id = d.id ?? uuid()
      const now = new Date().toISOString()
      const prev = dataRef.current
      const list = prev.detecteurs || []
      const existing = list.find((x) => x.id === id)
      let nextList: DetecteurManuel[]
      const nextDet: DetecteurManuel = {
        id,
        identification: d.identification.trim(),
        controleDate: d.controleDate || '',
        assigneeUserId: d.assigneeUserId || undefined,
        assigneeName: d.assigneeName || undefined,
        notes: d.notes || undefined,
        updatedAt: now,
      }
      if (nextDet.assigneeUserId) {
        nextList = list.map((x) =>
          x.assigneeUserId === nextDet.assigneeUserId && x.id !== id
            ? { ...x, assigneeUserId: undefined, assigneeName: undefined, updatedAt: now }
            : x,
        )
      } else {
        nextList = [...list]
      }
      if (existing) {
        nextList = nextList.map((x) => (x.id === id ? nextDet : x))
      } else {
        nextList = [...nextList.filter((x) => x.id !== id), nextDet]
      }
      const unassigned = nextList.find((x) => !x.assigneeUserId)
      const next: AppData = {
        ...prev,
        detecteurs: nextList,
        operateur: {
          ...prev.operateur,
          detecteurIdentification:
            unassigned?.identification ||
            nextList[0]?.identification ||
            prev.operateur.detecteurIdentification,
          detecteurControleDate:
            unassigned?.controleDate ||
            nextList[0]?.controleDate ||
            prev.operateur.detecteurControleDate,
        },
      }
      await persistNow(next)
      return id
    },
    [persistNow],
  )

  const deleteDetecteur = useCallback(
    async (id: string) => {
      const prev = dataRef.current
      const nextList = (prev.detecteurs || []).filter((x) => x.id !== id)
      const unassigned = nextList.find((x) => !x.assigneeUserId)
      const next: AppData = {
        ...prev,
        detecteurs: nextList,
        operateur: {
          ...prev.operateur,
          detecteurIdentification: unassigned?.identification || nextList[0]?.identification || '',
          detecteurControleDate: unassigned?.controleDate || nextList[0]?.controleDate || '',
        },
      }
      await persistNow(next)
    },
    [persistNow],
  )

  const upsertVoiture = useCallback(
    async (v: Omit<Voiture, 'id' | 'updatedAt'> & { id?: string }) => {
      const id = v.id ?? uuid()
      const now = new Date().toISOString()
      const prev = dataRef.current
      const list = prev.voitures || []
      const existing = list.find((x) => x.id === id)
      const rec = receptionPreserved(existing, v.assigneeUserId || undefined)
      let nextList: Voiture[]
      const nextV: Voiture = {
        id,
        matricule: v.matricule.trim().toUpperCase(),
        marque: v.marque.trim(),
        modele: v.modele?.trim() || undefined,
        controleTechniqueDate: v.controleTechniqueDate || undefined,
        assuranceDate: v.assuranceDate || undefined,
        assigneeUserId: v.assigneeUserId || undefined,
        assigneeName: v.assigneeName || undefined,
        receptionAt: rec.receptionAt,
        receptionParUserId: rec.receptionParUserId,
        documentsFournis: Array.isArray(v.documentsFournis)
          ? v.documentsFournis
          : existing?.documentsFournis,
        etatReception: rec.receptionAt
          ? v.etatReception || existing?.etatReception
          : undefined,
        notes: v.notes || undefined,
        updatedAt: now,
      }
      if (nextV.assigneeUserId) {
        nextList = list.map((x) =>
          x.assigneeUserId === nextV.assigneeUserId && x.id !== id
            ? {
                ...x,
                assigneeUserId: undefined,
                assigneeName: undefined,
                receptionAt: undefined,
                receptionParUserId: undefined,
                etatReception: undefined,
                updatedAt: now,
              }
            : x,
        )
      } else {
        nextList = [...list]
      }
      if (existing) {
        nextList = nextList.map((x) => (x.id === id ? nextV : x))
      } else {
        nextList = [...nextList.filter((x) => x.id !== id), nextV]
      }
      const next: AppData = {
        ...prev,
        voitures: nextList,
      }
      await persistNow(next)
      return id
    },
    [persistNow],
  )

  const deleteVoiture = useCallback(
    async (id: string) => {
      const prev = dataRef.current
      const nextList = (prev.voitures || []).filter((x) => x.id !== id)
      const next: AppData = {
        ...prev,
        voitures: nextList,
      }
      await persistNow(next)
    },
    [persistNow],
  )

  const syncDetecteurFromOutillage = (
    list: Outillage[],
    detecteurs: DetecteurManuel[],
    now: string,
  ): DetecteurManuel[] => {
    const detOutillages = list.filter((o) => o.type === 'detecteur_fuite' && o.identification.trim())
    let nextDetecteurs = [...(detecteurs || [])]
    for (const o of detOutillages) {
      const existing = nextDetecteurs.find((d) => d.id === o.id)
      const nextDet: DetecteurManuel = {
        id: o.id,
        identification: o.identification.trim(),
        controleDate: o.controleDate || '',
        assigneeUserId: o.assigneeUserId,
        assigneeName: o.assigneeName,
        notes: o.notes,
        updatedAt: now,
      }
      if (existing) {
        nextDetecteurs = nextDetecteurs.map((d) => (d.id === o.id ? nextDet : d))
      } else {
        nextDetecteurs = [...nextDetecteurs.filter((d) => d.id !== o.id), nextDet]
      }
    }
    const outillageDetIds = new Set(detOutillages.map((o) => o.id))
    nextDetecteurs = nextDetecteurs.filter(
      (d) => !outillageDetIds.has(d.id) || detOutillages.some((o) => o.id === d.id),
    )
    return nextDetecteurs
  }

  const upsertOutillage = useCallback(
    async (o: Omit<Outillage, 'id' | 'updatedAt'> & { id?: string }) => {
      const id = o.id ?? uuid()
      const now = new Date().toISOString()
      const prev = dataRef.current
      const list = prev.outillages || []
      const existing = list.find((x) => x.id === id)
      const rec = receptionPreserved(existing, o.assigneeUserId || undefined)
      let nextList: Outillage[]
      const nextO: Outillage = {
        id,
        type: o.type,
        identification: o.identification.trim(),
        marque: o.marque?.trim() || undefined,
        modele: o.modele?.trim() || undefined,
        controleDate: o.controleDate || undefined,
        assigneeUserId: o.assigneeUserId || undefined,
        assigneeName: o.assigneeName || undefined,
        receptionAt: rec.receptionAt,
        receptionParUserId: rec.receptionParUserId,
        notes: o.notes || undefined,
        updatedAt: now,
      }
      if (nextO.assigneeUserId) {
        nextList = list.map((x) =>
          x.assigneeUserId === nextO.assigneeUserId &&
          x.type === nextO.type &&
          x.id !== id
            ? {
                ...x,
                assigneeUserId: undefined,
                assigneeName: undefined,
                receptionAt: undefined,
                receptionParUserId: undefined,
                updatedAt: now,
              }
            : x,
        )
      } else {
        nextList = [...list]
      }
      if (existing) {
        nextList = nextList.map((x) => (x.id === id ? nextO : x))
      } else {
        nextList = [...nextList.filter((x) => x.id !== id), nextO]
      }

      let nextDetecteurs = prev.detecteurs || []
      if (nextO.type === 'detecteur_fuite') {
        nextDetecteurs = syncDetecteurFromOutillage(nextList, nextDetecteurs, now)
      }

      const unassigned = nextDetecteurs.find((x) => !x.assigneeUserId)
      const next: AppData = {
        ...prev,
        outillages: nextList,
        detecteurs: nextDetecteurs,
        operateur: {
          ...prev.operateur,
          detecteurIdentification:
            unassigned?.identification ||
            nextDetecteurs[0]?.identification ||
            prev.operateur.detecteurIdentification,
          detecteurControleDate:
            unassigned?.controleDate ||
            nextDetecteurs[0]?.controleDate ||
            prev.operateur.detecteurControleDate,
        },
      }
      await persistNow(next)
      return id
    },
    [persistNow],
  )

  const deleteOutillage = useCallback(
    async (id: string) => {
      const prev = dataRef.current
      const removed = (prev.outillages || []).find((x) => x.id === id)
      const nextList = (prev.outillages || []).filter((x) => x.id !== id)
      let nextDetecteurs = prev.detecteurs || []
      if (removed?.type === 'detecteur_fuite') {
        nextDetecteurs = nextDetecteurs.filter((d) => d.id !== id)
      }
      const unassigned = nextDetecteurs.find((x) => !x.assigneeUserId)
      const next: AppData = {
        ...prev,
        outillages: nextList,
        detecteurs: nextDetecteurs,
        operateur: {
          ...prev.operateur,
          detecteurIdentification: unassigned?.identification || nextDetecteurs[0]?.identification || '',
          detecteurControleDate: unassigned?.controleDate || nextDetecteurs[0]?.controleDate || '',
        },
      }
      await persistNow(next)
    },
    [persistNow],
  )

  const validerReceptionMateriel = useCallback(
    async (opts: {
      userId: string
      voitureId?: string
      etatVoiture?: VoitureEtatLieux
      outillageIds?: string[]
    }) => {
      if (!user?.id) throw new Error('Non connecté.')
      const gerantPeutValider = Boolean(isOwner || user.role === 'owner')
      if (user.id !== opts.userId && !gerantPeutValider) {
        throw new Error('Seul l’opérateur ou le gérant peut enregistrer la réception.')
      }
      if (!opts.voitureId && !opts.outillageIds?.length) {
        throw new Error('Aucun matériel à réceptionner.')
      }
      const prev = dataRef.current
      const now = new Date().toISOString()
      const destNom =
        (opts.userId === user.id ? user.fullName || user.email : undefined) ||
        (prev.voitures || []).find((v) => v.assigneeUserId === opts.userId)?.assigneeName ||
        (prev.outillages || []).find((o) => o.assigneeUserId === opts.userId)?.assigneeName ||
        (prev.personnelDossiers || []).find((d) => d.userId === opts.userId)?.userName ||
        'Opérateur'
      const createdByName = user.fullName || user.email || 'Gérant'
      let voitures = [...(prev.voitures || [])]
      let outillages = [...(prev.outillages || [])]
      const bons = [...(prev.bonsRemiseMateriel || [])]
      const created: BonRemiseMateriel[] = []

      if (opts.voitureId) {
        const v = voitures.find((x) => x.id === opts.voitureId)
        if (!v) throw new Error('Véhicule introuvable.')
        if (v.assigneeUserId !== opts.userId) {
          throw new Error('Ce véhicule ne vous est pas attribué.')
        }
        if (v.receptionAt) throw new Error('Réception déjà validée pour ce véhicule.')
        if (!opts.etatVoiture) {
          throw new Error('Complétez l’état des lieux du véhicule (état + documents pris).')
        }
        const etat = sanitizeEtatLieux(opts.etatVoiture)
        const err = erreurEtatLieux(etat)
        if (err) throw new Error(err)
        voitures = voitures.map((x) =>
          x.id === v.id
            ? {
                ...x,
                receptionAt: now,
                receptionParUserId: user.id,
                etatReception: etat,
                updatedAt: now,
              }
            : x,
        )
        const bon: BonRemiseMateriel = {
          id: uuid(),
          userId: opts.userId,
          userName: destNom,
          createdAt: now,
          items: [voitureLigne({ ...v, assigneeName: destNom })],
          kind: 'vehicule',
          voitureId: v.id,
          etatVoiture: etat,
          createdByUserId: user.id,
          createdByName,
          fileName: '',
        }
        bon.fileName = fileNameBonRemise(bon)
        bons.push(bon)
        created.push(bon)
      }

      if (opts.outillageIds?.length) {
        const wanted = new Set(opts.outillageIds)
        const pending = outillages.filter(
          (o) => o.assigneeUserId === opts.userId && !o.receptionAt && wanted.has(o.id),
        )
        if (pending.length === 0) {
          if (!opts.voitureId) throw new Error('Aucun outillage en attente de réception.')
        } else {
          const pendingIds = new Set(pending.map((o) => o.id))
          outillages = outillages.map((o) =>
            pendingIds.has(o.id)
              ? { ...o, receptionAt: now, receptionParUserId: user.id, updatedAt: now }
              : o,
          )
          const bon: BonRemiseMateriel = {
            id: uuid(),
            userId: opts.userId,
            userName: destNom,
            createdAt: now,
            items: pending.map(outillageLigne),
            kind: 'outillage',
            createdByUserId: user.id,
            createdByName,
            fileName: '',
          }
          bon.fileName = fileNameBonRemise(bon)
          bons.push(bon)
          created.push(bon)
        }
      }

      const next: AppData = {
        ...prev,
        voitures,
        outillages,
        bonsRemiseMateriel: bons,
      }
      await persistNow(next)

      for (const bon of created) {
        try {
          const blob = buildBonRemiseMaterielPdf({
            bon,
            data: next,
            signatureImage: user.signatureImage,
          })
          await saveCerfaPdf(pdfIdBonRemise(bon.id), blob, bon.fileName, orgId)
          downloadBonRemisePdf(blob, bon.fileName)
        } catch (err) {
          console.error('ClimaZEN: PDF bon de remise', err)
        }
      }
      return { bonIds: created.map((b) => b.id) }
    },
    [user, isOwner, persistNow, orgId],
  )

  const telechargerBonRemise = useCallback(
    async (bonId: string) => {
      const prev = dataRef.current
      const bon = (prev.bonsRemiseMateriel || []).find((b) => b.id === bonId)
      if (!bon) throw new Error('Bon de remise introuvable.')
      await telechargerBonRemisePdf({
        bon,
        data: prev,
        organizationId: orgId,
        signatureImage: user?.signatureImage,
      })
    },
    [orgId, user?.signatureImage],
  )

  const upsertPersonnelDossier = useCallback(
    (
      d: Omit<PersonnelDossier, 'id' | 'updatedAt' | 'documents'> & {
        id?: string
        documents?: DocumentRh[]
      },
    ) => {
      const actor = rhActorRef.current
      if (!actor) return ''
      const now = new Date().toISOString()
      const prev = dataRef.current
      const canSee = peutVoirIdentitesRh(actor, prev.personnelRhAccesUserIds)
      if (!canSee && d.userId !== actor.userId) return ''
      const list = migratePersonnelDossiers(prev.personnelDossiers)
      const existing = list.find((x) => x.id === d.id || x.userId === d.userId)
      const id = d.id || existing?.id || uuid()
      let documents = d.documents ?? existing?.documents ?? []
      if (!canSee) {
        documents = documents.filter((x) => !estDocumentRhAdminSeulement(x.type))
      }
      const nextDossier: PersonnelDossier = {
        ...(existing || defaultPersonnelDossier(d.userId, d.userName, now)),
        id,
        userId: d.userId,
        userName: d.userName.trim() || existing?.userName || 'Technicien',
        poste: Object.prototype.hasOwnProperty.call(d, 'poste')
          ? parsePostePersonnel(d.poste)
          : existing?.poste,
        agenceCode: Object.prototype.hasOwnProperty.call(d, 'agenceCode')
          ? parseAgenceCode(d.agenceCode)
          : existing?.agenceCode,
        agencesCouvertes: Object.prototype.hasOwnProperty.call(d, 'agencesCouvertes')
          ? parseAgencesCouvertes(d.agencesCouvertes)
          : existing?.agencesCouvertes,
        activiteBureau: Object.prototype.hasOwnProperty.call(d, 'activiteBureau')
          ? parseActiviteBureau(d.activiteBureau)
          : existing?.activiteBureau,
        metiersCouverts: Object.prototype.hasOwnProperty.call(d, 'metiersCouverts')
          ? parseMetiersCouverts(d.metiersCouverts)
          : existing?.metiersCouverts,
        telephone:
          d.telephone !== undefined
            ? d.telephone.trim() || undefined
            : existing?.telephone,
        lienCloudDossier:
          d.lienCloudDossier !== undefined
            ? d.lienCloudDossier.trim() || undefined
            : existing?.lienCloudDossier,
        toucheFroid: d.toucheFroid,
        toucheElectricite: d.toucheElectricite,
        conduitVehicule: d.conduitVehicule,
        notes: d.notes?.trim() || undefined,
        typesMasques: d.typesMasques ?? existing?.typesMasques,
        documents,
        updatedAt: now,
      }
      const nextList = existing
        ? list.map((x) => (x.id === existing.id || x.userId === d.userId ? nextDossier : x))
        : [...list, nextDossier]
      setData({
        ...prev,
        personnelDossiers: migratePersonnelDossiers(nextList),
      })
      return id
    },
    [],
  )

  const upsertPersonnelDocument = useCallback(
    (
      userId: string,
      userName: string,
      doc: Omit<DocumentRh, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    ) => {
      const now = new Date().toISOString()
      const prev = dataRef.current
      const actor = rhActorRef.current
      if (!actor) return ''
      const canSee = peutVoirIdentitesRh(actor, prev.personnelRhAccesUserIds)
      if (!canSee && userId !== actor.userId) return ''
      if (!canSee && estDocumentRhAdminSeulement(doc.type)) return ''
      const list = migratePersonnelDossiers(prev.personnelDossiers)
      const existing = list.find((x) => x.userId === userId)
      const dossierId = existing?.id || uuid()
      const docId = doc.id || uuid()
      const prevDoc = existing?.documents.find((x) => x.id === docId)
      const nextDoc: DocumentRh = sanitizeDocumentRh({
        id: docId,
        type: doc.type,
        libelle: doc.libelle?.trim() || undefined,
        numero: doc.numero?.trim() || undefined,
        dateObtention: doc.dateObtention?.trim() || undefined,
        dateExpiration: doc.dateExpiration?.trim() || undefined,
        lienCloud: doc.lienCloud?.trim() || undefined,
        lienCloudExpire: doc.lienCloudExpire?.trim() || undefined,
        fichierNom: doc.fichierNom?.trim() || undefined,
        fichierDataUrl: doc.fichierDataUrl || undefined,
        scanConfirme: Boolean(doc.fichierDataUrl || doc.fichierNom || prevDoc?.scanConfirme),
        notes: doc.notes?.trim() || undefined,
        createdAt: prevDoc?.createdAt || now,
        updatedAt: now,
      })
      const documents = prevDoc
        ? (existing?.documents || []).map((x) => (x.id === docId ? nextDoc : x))
        : [...(existing?.documents || []), nextDoc]
      const unmask = typesAMasquer(doc.type)
      const typesMasques = (existing?.typesMasques || []).filter((t) => !unmask.includes(t))
      const nextDossier: PersonnelDossier = {
        ...(existing || defaultPersonnelDossier(userId, userName, now)),
        id: dossierId,
        userId,
        userName: userName.trim() || existing?.userName || 'Technicien',
        typesMasques,
        documents,
        updatedAt: now,
      }
      const nextList = existing
        ? list.map((x) => (x.userId === userId ? nextDossier : x))
        : [...list, nextDossier]
      setData({
        ...prev,
        personnelDossiers: migratePersonnelDossiers(nextList),
      })
      return docId
    },
    [],
  )

  const deletePersonnelDocument = useCallback((userId: string, documentId: string) => {
    const now = new Date().toISOString()
    const prev = dataRef.current
    const actor = rhActorRef.current
    if (!actor) return
    const canSee = peutVoirIdentitesRh(actor, prev.personnelRhAccesUserIds)
    if (!canSee && userId !== actor.userId) return
    const list = migratePersonnelDossiers(prev.personnelDossiers)
    const existing = list.find((x) => x.userId === userId)
    if (!existing) return
    const target = existing.documents.find((d) => d.id === documentId)
    if (!canSee && target && estDocumentRhAdminSeulement(target.type)) return
    setData({
      ...prev,
      personnelDossiers: list.map((x) =>
        x.userId === userId
          ? {
              ...x,
              documents: x.documents.filter((d) => d.id !== documentId),
              updatedAt: now,
            }
          : x,
      ),
    })
  }, [])

  const setPersonnelRhAcces = useCallback((userId: string, granted: boolean) => {
    const actor = rhActorRef.current
    if (!actor?.isOwner) return
    const id = String(userId || '').trim()
    if (!id || id === actor.userId) return
    const prev = dataRef.current
    const current = new Set(normalizePersonnelRhAccesUserIds(prev.personnelRhAccesUserIds))
    if (granted) current.add(id)
    else current.delete(id)
    setData({
      ...prev,
      personnelRhAccesUserIds: [...current],
    })
  }, [])

  const setPersonnelTelephone = useCallback((userId: string, userName: string, telephone: string) => {
    const actor = rhActorRef.current
    if (!actor) return
    const id = String(userId || '').trim()
    if (!id) return
    if (!actor.isOwner && actor.userId !== id) return
    const prev = dataRef.current
    const list = migratePersonnelDossiers(prev.personnelDossiers)
    const existing = list.find((x) => x.userId === id)
    const now = new Date().toISOString()
    const tel = telephone.trim() || undefined
    const nextDossier: PersonnelDossier = {
      ...(existing || defaultPersonnelDossier(id, userName || 'Technicien', now)),
      id: existing?.id || id,
      userId: id,
      userName: (userName || existing?.userName || 'Technicien').trim(),
      telephone: tel,
      updatedAt: now,
    }
    const nextList = existing
      ? list.map((x) => (x.userId === id ? nextDossier : x))
      : [...list, nextDossier]
    setData({
      ...prev,
      personnelDossiers: migratePersonnelDossiers(nextList),
    })
  }, [])

  const setPersonnelPoste = useCallback(
    (userId: string, userName: string, poste: PostePersonnelId | '') => {
      const actor = rhActorRef.current
      if (!actor) return
      const id = String(userId || '').trim()
      if (!id) return
      if (!actor.isOwner && actor.userId !== id) return
      const prev = dataRef.current
      const list = migratePersonnelDossiers(prev.personnelDossiers)
      const existing = list.find((x) => x.userId === id)
      const now = new Date().toISOString()
      const nextDossier: PersonnelDossier = {
        ...(existing || defaultPersonnelDossier(id, userName || 'Technicien', now)),
        id: existing?.id || id,
        userId: id,
        userName: (userName || existing?.userName || 'Technicien').trim(),
        poste: parsePostePersonnel(poste),
        updatedAt: now,
      }
      const nextList = existing
        ? list.map((x) => (x.userId === id ? nextDossier : x))
        : [...list, nextDossier]
      setData({
        ...prev,
        personnelDossiers: migratePersonnelDossiers(nextList),
      })
    },
    [],
  )

  const setPersonnelLienCloud = useCallback((userId: string, userName: string, url: string) => {
    const actor = rhActorRef.current
    if (!actor) return
    const id = String(userId || '').trim()
    if (!id) return
    if (!actor.isOwner && actor.userId !== id) return
    const prev = dataRef.current
    const list = migratePersonnelDossiers(prev.personnelDossiers)
    const existing = list.find((x) => x.userId === id)
    const now = new Date().toISOString()
    const nextDossier: PersonnelDossier = {
      ...(existing || defaultPersonnelDossier(id, userName || 'Technicien', now)),
      id: existing?.id || id,
      userId: id,
      userName: (userName || existing?.userName || 'Technicien').trim(),
      lienCloudDossier: url.trim() || undefined,
      updatedAt: now,
    }
    const nextList = existing
      ? list.map((x) => (x.userId === id ? nextDossier : x))
      : [...list, nextDossier]
    setData({
      ...prev,
      personnelDossiers: migratePersonnelDossiers(nextList),
    })
  }, [])

  const retirePersonnel = useCallback((userId: string) => {
    const actor = rhActorRef.current
    if (!actor?.isOwner) return
    const id = String(userId || '').trim()
    if (!id || id === actor.userId) return
    const prev = dataRef.current
    const retired = new Set(normalizePersonnelRetiresUserIds(prev.personnelRetiresUserIds))
    retired.add(id)
    const acces = new Set(normalizePersonnelRhAccesUserIds(prev.personnelRhAccesUserIds))
    acces.delete(id)
    setData({
      ...prev,
      personnelRetiresUserIds: [...retired],
      personnelRhAccesUserIds: [...acces],
    })
  }, [])

  const resetDemo = useCallback(() => {
    if (!orgId) return
    const demo = seedDemoData()
    skipNextSave.current = true
    setData(demo)
    saveData(demo, orgId)
    void saveOrgDataRemote(orgId, demo, rhActorRef.current).then(({ updatedAt }) => {
      setCloudUpdatedAt(orgId, updatedAt)
      markSynced(orgId)
    })
  }, [orgId])

  const resetSandbox = useCallback(() => {
    if (!orgId) return
    const sandbox = seedSandboxData(user?.id)
    skipNextSave.current = true
    setData(sandbox)
    saveData(sandbox, orgId)
    markPending(true)
    setPendingSyncState(true)
    void saveOrgDataRemote(orgId, sandbox, rhActorRef.current).then(({ updatedAt }) => {
      setCloudUpdatedAt(orgId, updatedAt)
      markSynced(orgId)
      setPendingSyncState(false)
    })
  }, [orgId, user?.id, markPending])

  const setAppEdition = useCallback(
    (edition: AppEdition) => {
      if (!isOwner) throw new Error('Seul le gérant peut changer d’édition.')
      setData((prev) => ({ ...prev, appEdition: edition }))
    },
    [isOwner],
  )

  const appEdition = resolveAppEdition(data.appEdition)
  const peutVoirIdentitesRhFlag = peutVoirIdentitesRh(rhActor, data.personnelRhAccesUserIds)
  const dossierPosteCourant = data.personnelDossiers?.find((d) => d.userId === user?.id)?.poste
  const peutGererPiecesDetacheesFlag = peutGererPiecesDetacheesFn({
    isOwner: Boolean(isOwner),
    userId: user?.id,
    magasinierUserId: data.operateur.magasinierUserId,
    poste: dossierPosteCourant,
    peutVoirIdentitesRh: peutVoirIdentitesRhFlag,
  })

  const value = useMemo(
    () => ({
      data,
      loading,
      syncError,
      offline,
      pendingSync,
      flushPendingSync,
      pullFromCloud,
      clearSyncError,
      setOperateur,
      setCompanyLogo,
      upsertClient,
      deleteClient,
      upsertChantier,
      deleteChantier,
      upsertFicheMaintenanceClim,
      deleteFicheMaintenanceClim,
      upsertFicheMaintenanceChaufferie,
      deleteFicheMaintenanceChaufferie,
      upsertFicheMaintenanceCtaVmc,
      deleteFicheMaintenanceCtaVmc,
      upsertOrdreTravail,
      deleteOrdreTravail,
      upsertContratMaintenance,
      deleteContratMaintenance,
      upsertDevis,
      deleteDevis,
      upsertCommandeFournisseur,
      deleteCommandeFournisseur,
      upsertFacture,
      genererDevisReguleDepuisOt,
      genererFactureDepuisOt,
      creerOtDepuisDevis,
      marquerCommandeRecue,
      upsertPieceDetachee,
      deletePieceDetachee,
      enregistrerMouvementPiece,
      upsertAgendaEvent,
      deleteAgendaEvent,
      upsertPointageRegles,
      addPointageEvent,
      annulerPointageEvent,
      upsertPointageBureauJour,
      syncAgendaFromSources,
      syncOtsDepuisContrats,
      scinderOtContrat,
      syncClientPortalTickets,
      createOtForAction,
      validateMaintenanceCerfas,
      applySiteClientSignature,
      upsertStock,
      deleteStock,
      enregistrerRetourConsigneBouteille,
      enregistrerDestructionBouteille,
      enregistrerTransfertInterneBouteille,
      enregistrerPerteEmissionBouteille,
      upsertIntervention,
      saveInterventionWithStock,
      deleteIntervention,
      upsertDetecteur,
      deleteDetecteur,
      upsertVoiture,
      deleteVoiture,
      upsertOutillage,
      deleteOutillage,
      validerReceptionMateriel,
      telechargerBonRemise,
      upsertPersonnelDossier,
      upsertPersonnelDocument,
      deletePersonnelDocument,
      setPersonnelRhAcces,
      setPersonnelTelephone,
      setPersonnelPoste,
      setPersonnelLienCloud,
      retirePersonnel,
      peutVoirIdentitesRh: peutVoirIdentitesRhFlag,
      peutGererPiecesDetachees: peutGererPiecesDetacheesFlag,
      appEdition,
      setAppEdition,
      resetDemo,
      resetSandbox,
      replaceData,
    }),
    [
      data,
      appEdition,
      loading,
      syncError,
      offline,
      pendingSync,
      flushPendingSync,
      pullFromCloud,
      clearSyncError,
      setOperateur,
      setCompanyLogo,
      upsertClient,
      deleteClient,
      upsertChantier,
      deleteChantier,
      upsertFicheMaintenanceClim,
      deleteFicheMaintenanceClim,
      upsertFicheMaintenanceChaufferie,
      deleteFicheMaintenanceChaufferie,
      upsertFicheMaintenanceCtaVmc,
      deleteFicheMaintenanceCtaVmc,
      upsertOrdreTravail,
      deleteOrdreTravail,
      upsertContratMaintenance,
      deleteContratMaintenance,
      upsertDevis,
      deleteDevis,
      upsertCommandeFournisseur,
      deleteCommandeFournisseur,
      upsertFacture,
      genererDevisReguleDepuisOt,
      genererFactureDepuisOt,
      creerOtDepuisDevis,
      marquerCommandeRecue,
      upsertPieceDetachee,
      deletePieceDetachee,
      enregistrerMouvementPiece,
      upsertAgendaEvent,
      deleteAgendaEvent,
      upsertPointageRegles,
      addPointageEvent,
      annulerPointageEvent,
      upsertPointageBureauJour,
      syncAgendaFromSources,
      syncOtsDepuisContrats,
      scinderOtContrat,
      syncClientPortalTickets,
      createOtForAction,
      validateMaintenanceCerfas,
      applySiteClientSignature,
      upsertStock,
      deleteStock,
      enregistrerRetourConsigneBouteille,
      enregistrerDestructionBouteille,
      enregistrerTransfertInterneBouteille,
      enregistrerPerteEmissionBouteille,
      upsertIntervention,
      saveInterventionWithStock,
      deleteIntervention,
      upsertDetecteur,
      deleteDetecteur,
      upsertVoiture,
      deleteVoiture,
      upsertOutillage,
      deleteOutillage,
      validerReceptionMateriel,
      telechargerBonRemise,
      upsertPersonnelDossier,
      upsertPersonnelDocument,
      deletePersonnelDocument,
      setPersonnelRhAcces,
      setPersonnelTelephone,
      setPersonnelPoste,
      setPersonnelLienCloud,
      retirePersonnel,
      peutVoirIdentitesRhFlag,
      peutGererPiecesDetacheesFlag,
      setAppEdition,
      resetDemo,
      resetSandbox,
      replaceData,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
