import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { v4 as uuid } from 'uuid'
import type {
  AppData,
  CerfaDraft,
  Chantier,
  Client,
  Operateur,
  StockItem,
} from './types'
import { emptyData, loadData, saveData, seedDemoData } from './storage'
import { deleteCerfaPdf } from './pdfStore'
import { useAuth } from './AuthContext'
import { applyStockFromIntervention, revertStockForIntervention } from './stockMouvements'

type Store = {
  data: AppData
  setOperateur: (o: Operateur) => void
  upsertClient: (c: Omit<Client, 'id' | 'createdAt'> & { id?: string }) => string
  deleteClient: (id: string) => void
  upsertChantier: (c: Omit<Chantier, 'id' | 'createdAt'> & { id?: string }) => string
  deleteChantier: (id: string) => void
  upsertStock: (s: Omit<StockItem, 'id' | 'updatedAt'> & { id?: string }) => string
  deleteStock: (id: string) => void
  upsertIntervention: (
    i: Omit<CerfaDraft, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  ) => string
  /** Enregistre la fiche + met à jour le stock (historique lié au CERFA) */
  saveInterventionWithStock: (
    i: Omit<CerfaDraft, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    opts?: { createdByName?: string },
  ) => string
  deleteIntervention: (id: string) => void
  resetDemo: () => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const orgId = user?.organizationId || null

  const [data, setData] = useState<AppData>(() => emptyData())

  useEffect(() => {
    if (!orgId) {
      setData(emptyData())
      return
    }
    setData(loadData(orgId))
  }, [orgId])

  useEffect(() => {
    if (!orgId) return
    saveData(data, orgId)
  }, [data, orgId])

  const setOperateur = useCallback((o: Operateur) => {
    setData((d) => ({ ...d, operateur: o }))
  }, [])

  const upsertClient = useCallback(
    (c: Omit<Client, 'id' | 'createdAt'> & { id?: string }) => {
      const id = c.id ?? uuid()
      setData((d) => {
        const existing = d.clients.find((x) => x.id === id)
        const next: Client = {
          ...c,
          id,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
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
    (c: Omit<Chantier, 'id' | 'createdAt'> & { id?: string }) => {
      const id = c.id ?? uuid()
      setData((d) => {
        const existing = d.chantiers.find((x) => x.id === id)
        const next: Chantier = {
          ...c,
          id,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
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

  const deleteIntervention = useCallback((id: string) => {
    setData((d) => {
      const reverted = revertStockForIntervention(d, id)
      return {
        ...reverted,
        interventions: reverted.interventions.filter((x) => x.id !== id),
      }
    })
    void deleteCerfaPdf(id)
  }, [])

  const resetDemo = useCallback(() => {
    if (!orgId) return
    localStorage.removeItem(`climazen_orgdata_${orgId}`)
    setData(seedDemoData())
  }, [orgId])

  const value = useMemo(
    () => ({
      data,
      setOperateur,
      upsertClient,
      deleteClient,
      upsertChantier,
      deleteChantier,
      upsertStock,
      deleteStock,
      upsertIntervention,
      saveInterventionWithStock,
      deleteIntervention,
      resetDemo,
    }),
    [
      data,
      setOperateur,
      upsertClient,
      deleteClient,
      upsertChantier,
      deleteChantier,
      upsertStock,
      deleteStock,
      upsertIntervention,
      saveInterventionWithStock,
      deleteIntervention,
      resetDemo,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
