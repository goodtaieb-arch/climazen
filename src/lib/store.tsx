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
  saveOrgDataRemote,
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
import { detecteurForUser } from './detecteurs'

type Store = {
  data: AppData
  loading: boolean
  syncError: string | null
  setOperateur: (o: Operateur) => void
  /** Enregistre le logo société et sync cloud immédiat (affiché à côté de ClimaZEN). */
  setCompanyLogo: (logoImage: string | undefined) => Promise<void>
  upsertClient: (c: Omit<Client, 'id' | 'createdAt'> & { id?: string }) => string
  deleteClient: (id: string) => void
  upsertChantier: (c: Omit<Site, 'id' | 'createdAt'> & { id?: string }) => string
  deleteChantier: (id: string) => void
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
  ) => string
  deleteDetecteur: (id: string) => void
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
  const [hydrated, setHydrated] = useState(false)
  const skipNextSave = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dataRef = useRef(data)
  dataRef.current = data

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!orgId) {
        setData(emptyData())
        setHydrated(false)
        setLoading(false)
        return
      }
      setLoading(true)
      setSyncError(null)
      try {
        const remote = await loadOrgDataRemote(orgId)
        if (cancelled) return
        const localLogo = loadCompanyLogoLocal(orgId)
        const merged: AppData = {
          ...remote,
          operateur: {
            ...remote.operateur,
            logoImage: remote.operateur.logoImage || localLogo || undefined,
          },
        }
        if (merged.operateur.logoImage) {
          saveCompanyLogoLocal(orgId, merged.operateur.logoImage)
        }
        skipNextSave.current = true
        setData(merged)
        saveData(merged, orgId)
        setHydrated(true)
      } catch (err) {
        console.error(err)
        if (!cancelled) {
          const local = loadData(orgId)
          const localLogo = loadCompanyLogoLocal(orgId)
          const merged: AppData = {
            ...local,
            operateur: {
              ...local.operateur,
              logoImage: local.operateur.logoImage || localLogo || undefined,
            },
          }
          skipNextSave.current = true
          setData(merged)
          setHydrated(true)
          setSyncError(err instanceof Error ? err.message : 'Sync impossible')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [orgId])

  useEffect(() => {
    if (!orgId || !hydrated) return
    if (skipNextSave.current) {
      skipNextSave.current = false
      return
    }
    saveData(data, orgId)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void saveOrgDataRemote(orgId, data)
        .then(() => setSyncError(null))
        .catch((err) => {
          console.error(err)
          setSyncError(err instanceof Error ? err.message : 'Enregistrement cloud impossible')
        })
    }, 400)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [data, orgId, hydrated])

  const replaceData = useCallback(
    async (next: AppData) => {
      if (!orgId) return
      skipNextSave.current = true
      setData(next)
      saveData(next, orgId)
      await saveOrgDataRemote(orgId, next)
      setSyncError(null)
    },
    [orgId],
  )

  const setOperateur = useCallback(
    (o: Operateur) => {
      if (user?.role !== 'owner') {
        console.warn('ClimaZEN: seul l’administrateur peut modifier les infos société.')
        return
      }
      if (orgId) saveCompanyLogoLocal(orgId, o.logoImage || null)
      setData((d) => ({ ...d, operateur: o }))
    },
    [user?.role, orgId],
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
      if (saveTimer.current) clearTimeout(saveTimer.current)
      skipNextSave.current = true
      dataRef.current = next
      setData(next)
      saveData(next, orgId)
      saveCompanyLogoLocal(orgId, logoImage || null)
      try {
        await saveOrgDataRemote(orgId, next)
        setSyncError(null)
      } catch (err) {
        console.error(err)
        setSyncError(err instanceof Error ? err.message : 'Enregistrement cloud impossible')
        throw err
      }
    },
    [orgId, user?.role],
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

  const validateMaintenanceCerfas = useCallback(
    (opts: {
      siteId: string
      dateIntervention?: string
      signataireNom: string
      signataireQualite: string
      signatureOperateurImage: string
      userId?: string
      userName?: string
    }) => {
      const d = dataRef.current
      const site = d.chantiers.find((s) => s.id === opts.siteId)
      if (!site) throw new Error('Site introuvable.')
      const client = d.clients.find((c) => c.id === site.clientId)
      if (!client) throw new Error('Client du site introuvable.')
      const det = detecteurForUser(d, opts.userId)
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
        detecteurIdentification: det?.identification,
        detecteurControleDate: det?.controleDate,
      })
      const now = new Date().toISOString()
      setData((prev) => ({
        ...prev,
        interventions: [...prev.interventions, ...drafts],
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
      return { drafts, site, client }
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
        return { ...d, chantiers: sites, interventions }
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
        const next: CerfaDraft = {
          ...i,
          id,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        }
        return {
          ...d,
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
        const next: CerfaDraft = {
          ...i,
          id,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        }
        const withIntervention: AppData = {
          ...d,
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
    (d: Omit<DetecteurManuel, 'id' | 'updatedAt'> & { id?: string }) => {
      const id = d.id ?? uuid()
      const now = new Date().toISOString()
      setData((prev) => {
        const list = prev.detecteurs || []
        const existing = list.find((x) => x.id === id)
        let nextList: DetecteurManuel[]
        const next: DetecteurManuel = {
          id,
          identification: d.identification.trim(),
          controleDate: d.controleDate || '',
          assigneeUserId: d.assigneeUserId || undefined,
          assigneeName: d.assigneeName || undefined,
          notes: d.notes || undefined,
          updatedAt: now,
        }
        // Un technicien = un détecteur max
        if (next.assigneeUserId) {
          nextList = list.map((x) =>
            x.assigneeUserId === next.assigneeUserId && x.id !== id
              ? { ...x, assigneeUserId: undefined, assigneeName: undefined, updatedAt: now }
              : x,
          )
        } else {
          nextList = [...list]
        }
        if (existing) {
          nextList = nextList.map((x) => (x.id === id ? next : x))
        } else {
          nextList = [...nextList.filter((x) => x.id !== id), next]
        }
        const unassigned = nextList.find((x) => !x.assigneeUserId)
        return {
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
      })
      return id
    },
    [],
  )

  const deleteDetecteur = useCallback((id: string) => {
    setData((prev) => {
      const nextList = (prev.detecteurs || []).filter((x) => x.id !== id)
      const unassigned = nextList.find((x) => !x.assigneeUserId)
      return {
        ...prev,
        detecteurs: nextList,
        operateur: {
          ...prev.operateur,
          detecteurIdentification: unassigned?.identification || nextList[0]?.identification || '',
          detecteurControleDate: unassigned?.controleDate || nextList[0]?.controleDate || '',
        },
      }
    })
  }, [])

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
      setOperateur,
      setCompanyLogo,
      upsertClient,
      deleteClient,
      upsertChantier,
      deleteChantier,
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
      setOperateur,
      setCompanyLogo,
      upsertClient,
      deleteClient,
      upsertChantier,
      deleteChantier,
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
