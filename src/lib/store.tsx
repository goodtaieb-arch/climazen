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
  CerfaDraft,
  Client,
  DetecteurManuel,
  Equipement,
  Operateur,
  Site,
  StockItem,
} from './types'
import { emptyData, loadData, saveData, seedDemoData } from './storage'
import {
  loadOrgDataRemote,
  resolveRemoteVsLocal,
  saveOrgDataRemote,
  updateOrganizationName,
} from './auth'
import { loadCompanyLogoLocal, saveCompanyLogoLocal } from './companyLogo'
import { deleteCerfaPdf } from './pdfStore'
import { useAuth } from './AuthContext'
import { applyStockFromIntervention, enregistrerRetourConsigne, revertStockForIntervention } from './stockMouvements'
import {
  buildMaintenanceCerfaDrafts,
  syncEquipementsFromFlat,
  syncFlatFromEquipements,
} from './cerfaBatch'
import { assertDetecteurValidePourCerfa } from './detecteurs'
import { nextNumeroIntervention } from './numeroIntervention'
import { nextNumeroOt, type OrdreTravail } from './ordreTravail'
import type { ContratMaintenance } from './contratMaintenance'
import type { AgendaEvent } from './agenda'
import { buildAutoAgendaEvents } from './agenda'
import {
  getPendingSync,
  isBrowserOnline,
  markSynced,
  setPendingSync,
} from './offlineSync'

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
  upsertAgendaEvent: (
    e: Omit<AgendaEvent, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  ) => string
  deleteAgendaEvent: (id: string) => void
  /** Synchronise les rappels depuis contrats signés + contrôles sites. */
  syncAgendaFromSources: () => number
  /** Crée un OT pour une action terrain — retourne { id, numero }. */
  createOtForAction: (opts: {
    typeOt: import('./ordreTravail').TypeOt
    action: string
    clientId?: string
    chantierId?: string
    equipementId?: string
    technicien?: string
    observations?: string
    interventionId?: string
    ficheMaintenanceId?: string
    signatureTechnicienImage?: string
    signatureClientImage?: string
    statut?: import('./ordreTravail').StatutOt
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
  /** Enregistre la signature client sur le site et l’applique à tous les CERFA du site */
  applySiteClientSignature: (opts: {
    siteId: string
    signatureDetenteur: string
    signatureDetenteurQualite: string
    signatureDetenteurImage: string
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
  resetDemo: () => void
  /** Remplace les données cloud par un payload (import local). */
  replaceData: (next: AppData) => Promise<void>
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const orgId = user?.organizationId || null

  const [data, setData] = useState<AppData>(() => emptyData())
  const [loading, setLoading] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [offline, setOffline] = useState(() => !isBrowserOnline())
  const [pendingSync, setPendingSyncState] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const skipNextSave = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flushing = useRef(false)
  const dataRef = useRef(data)
  dataRef.current = data

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
    return merged
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
      const payload = dataRef.current
      saveData(payload, orgId)
      await saveOrgDataRemote(orgId, payload)
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

  useEffect(() => {
    const onOnline = () => {
      setOffline(false)
      void flushPendingSync()
    }
    const onOffline = () => setOffline(true)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [flushPendingSync])

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
        const local = applyLocalLogo(loadData(orgId), orgId)
        skipNextSave.current = true
        dataRef.current = local
        setData(local)
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

        const remote = await Promise.race([
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
        const { data: resolved, shouldPushLocal } = resolveRemoteVsLocal(remote, local)
        const merged = applyLocalLogo(resolved, orgId)
        skipNextSave.current = true
        dataRef.current = merged
        setData(merged)
        saveData(merged, orgId)
        setHydrated(true)
        setOffline(false)
        if (shouldPushLocal) {
          // Cloud plus pauvre / société manquante → ne pas écraser le cache, re-pousser
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
      void saveOrgDataRemote(orgId, data)
        .then(() => {
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
      skipNextSave.current = true
      setData(next)
      saveData(next, orgId)
      if (!isBrowserOnline()) {
        markPending(true)
        setOffline(true)
        return
      }
      try {
        await saveOrgDataRemote(orgId, next)
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
      skipNextSave.current = true
      dataRef.current = next
      setData(next)
      saveData(next, orgId)
      if (!isBrowserOnline()) {
        markPending(true)
        setOffline(true)
        return
      }
      try {
        await saveOrgDataRemote(orgId, next)
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
    setData((d) => ({
      ...d,
      clients: d.clients.filter((c) => c.id !== id),
      chantiers: d.chantiers.filter((c) => c.clientId !== id),
    }))
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
    setData((d) => ({
      ...d,
      ordresTravail: (d.ordresTravail || []).filter((o) => o.id !== id),
    }))
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
        let chantiers = d.chantiers
        if (next.statut === 'signe' && next.clientId) {
          const coverAll = !next.chantierIds || next.chantierIds.length === 0
          chantiers = d.chantiers.map((s) => {
            if (s.clientId !== next.clientId) return s
            if (!coverAll && !next.chantierIds.includes(s.id)) return s
            return { ...s, modeGestion: 'contrat' as const }
          })
        }
        return {
          ...d,
          chantiers,
          contratsMaintenance: existing
            ? list.map((x) => (x.id === id ? next : x))
            : [...list, next],
        }
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
          // Ne pas écraser un statut déjà traité lors d’une sync auto
          statut: existing && e.autoKey ? existing.statut : e.statut,
          notes: e.notes ?? existing?.notes,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        }
        return {
          ...d,
          agendaEvents: existing
            ? list.map((x) => (x.id === next.id ? { ...existing, ...next, statut: existing.statut } : x))
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

  const syncAgendaFromSources = useCallback(() => {
    const d = dataRef.current
    const generated = buildAutoAgendaEvents({
      contrats: d.contratsMaintenance || [],
      sites: d.chantiers,
    })
    let added = 0
    setData((prev) => {
      const list = [...(prev.agendaEvents || [])]
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
      return { ...prev, agendaEvents: list }
    })
    return added
  }, [])

  const createOtForAction = useCallback(
    (opts: {
      typeOt: import('./ordreTravail').TypeOt
      action: string
      clientId?: string
      chantierId?: string
      equipementId?: string
      technicien?: string
      observations?: string
      interventionId?: string
      ficheMaintenanceId?: string
      signatureTechnicienImage?: string
      signatureClientImage?: string
      statut?: import('./ordreTravail').StatutOt
    }) => {
      const d = dataRef.current
      const numero = nextNumeroOt(d)
      const id = uuid()
      const now = new Date().toISOString()
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
        interventionId: opts.interventionId,
        ficheMaintenanceId: opts.ficheMaintenanceId,
        signatureTechnicienImage: opts.signatureTechnicienImage,
        signatureClientImage: opts.signatureClientImage,
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
      signatureDetenteurImage: string
    }) => {
      const now = new Date().toISOString()
      let count = 0
      setData((d) => {
        const site = d.chantiers.find((s) => s.id === opts.siteId)
        if (!site) return d
        const sites = d.chantiers.map((s) =>
          s.id === opts.siteId
            ? {
                ...s,
                signatureDetenteurNom: opts.signatureDetenteur,
                signatureDetenteurQualite: opts.signatureDetenteurQualite,
                signatureDetenteurImage: opts.signatureDetenteurImage,
                signatureDetenteurAt: now,
              }
            : s,
        )
        const interventions = d.interventions.map((i) => {
          if (i.chantierId !== opts.siteId) return i
          count += 1
          return {
            ...i,
            signatureDetenteur: opts.signatureDetenteur,
            signatureDetenteurQualite: opts.signatureDetenteurQualite,
            signatureDetenteurImage: opts.signatureDetenteurImage,
            updatedAt: now,
          }
        })
        const fiches = (d.fichesMaintenanceClim || []).map((f) => {
          if (f.chantierId !== opts.siteId) return f
          count += 1
          return {
            ...f,
            signatureClientImage: opts.signatureDetenteurImage,
            updatedAt: now,
          }
        })
        const ordres = (d.ordresTravail || []).map((o) => {
          if (o.chantierId !== opts.siteId) return o
          count += 1
          return {
            ...o,
            signatureClientImage: opts.signatureDetenteurImage,
            updatedAt: now,
          }
        })
        const contrats = (d.contratsMaintenance || []).map((c) => {
          if (c.clientId !== site.clientId) return c
          count += 1
          return {
            ...c,
            signatureClientImage: opts.signatureDetenteurImage,
            signatureClientNom: opts.signatureDetenteur,
            updatedAt: now,
          }
        })
        return {
          ...d,
          chantiers: sites,
          interventions,
          fichesMaintenanceClim: fiches,
          ordresTravail: ordres,
          contratsMaintenance: contrats,
        }
      })
      return count
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
    setData((d) => ({
      ...d,
      stock: d.stock.filter((s) => s.id !== id),
      stockMouvements: (d.stockMouvements || []).filter((m) => m.stockItemId !== id),
    }))
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

  const resetDemo = useCallback(() => {
    if (!orgId) return
    const demo = seedDemoData()
    skipNextSave.current = true
    setData(demo)
    saveData(demo, orgId)
    void saveOrgDataRemote(orgId, demo)
  }, [orgId])

  const value = useMemo(
    () => ({
      data,
      loading,
      syncError,
      offline,
      pendingSync,
      flushPendingSync,
      clearSyncError,
      setOperateur,
      setCompanyLogo,
      upsertClient,
      deleteClient,
      upsertChantier,
      deleteChantier,
      upsertFicheMaintenanceClim,
      deleteFicheMaintenanceClim,
      upsertOrdreTravail,
      deleteOrdreTravail,
      upsertContratMaintenance,
      deleteContratMaintenance,
      upsertAgendaEvent,
      deleteAgendaEvent,
      syncAgendaFromSources,
      createOtForAction,
      validateMaintenanceCerfas,
      applySiteClientSignature,
      upsertStock,
      deleteStock,
      enregistrerRetourConsigneBouteille,
      upsertIntervention,
      saveInterventionWithStock,
      deleteIntervention,
      upsertDetecteur,
      deleteDetecteur,
      resetDemo,
      replaceData,
    }),
    [
      data,
      loading,
      syncError,
      offline,
      pendingSync,
      flushPendingSync,
      clearSyncError,
      setOperateur,
      setCompanyLogo,
      upsertClient,
      deleteClient,
      upsertChantier,
      deleteChantier,
      upsertFicheMaintenanceClim,
      deleteFicheMaintenanceClim,
      upsertOrdreTravail,
      deleteOrdreTravail,
      upsertContratMaintenance,
      deleteContratMaintenance,
      upsertAgendaEvent,
      deleteAgendaEvent,
      syncAgendaFromSources,
      createOtForAction,
      validateMaintenanceCerfas,
      applySiteClientSignature,
      upsertStock,
      deleteStock,
      enregistrerRetourConsigneBouteille,
      upsertIntervention,
      saveInterventionWithStock,
      deleteIntervention,
      upsertDetecteur,
      deleteDetecteur,
      resetDemo,
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
