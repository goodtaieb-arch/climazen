import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ChevronDown, ChevronRight, FileCheck2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import type { UserAccount } from '../lib/auth'
import {
  clientDisplayName,
  contenantDemarreVide,
  contenantSansRecharge,
  isBouteilleRetournee,
  isContenantDestination,
  needsRetourConsigne,
  type ContenantType,
  type StockItem,
  type StockMouvement,
} from '../lib/types'
import { formatOtNumero, otBaseNumero } from '../lib/ordreTravail'

/** Affiche OT26081702 pour un n° OT ; laisse ACHAT- / BON-RETOUR- inchangés. */
function displayMouvementLabel(label?: string) {
  if (!label) return ''
  const t = label.trim()
  const base = otBaseNumero(t)
  if (/^OT/i.test(t) || /^\d{6,}$/.test(base)) {
    // Évite de préfixer DEST- / ACHAT- si le label contient des lettres hors OT
    const withoutOt = t.replace(/^OT\s*/i, '')
    if (/^\d{6,}(-\d+)?$/.test(withoutOt) || /^\d{6,}$/.test(base)) {
      return formatOtNumero(t)
    }
  }
  return t
}
import { DecimalField } from '../components/DecimalField'
import { FluideSelect } from '../components/FluideSelect'
import { LabelHint } from '../components/LabelHint'
import { SearchField, matchesQuery } from '../components/SearchField'
import { BarcodeScanButton } from '../components/BarcodeScanButton'
import { BouteillePhotoButton } from '../components/BouteillePhotoButton'
import {
  adrInfoForFluide,
  findFluide,
  formatGwp,
  isFluideInflammableA2LOrA3,
  isFluideNonAssigne,
  labelFluideStock,
} from '../lib/fluides'
import {
  applyBouteilleDefaults,
  bouteilleDefaultsForFluide,
} from '../lib/bouteilleDefaults'
import {
  mergeBouteilleScanIntoForm,
  parseBarcodePayload,
  summarizeBouteilleScan,
  type BouteilleScanFields,
} from '../lib/bouteilleOcr'
import {
  assertNumeroContenantCerfa,
  labelBouteilleAffichage,
  sousTitreNumeroSerie,
  titreBouteilleStock,
} from '../lib/bouteilleLabel'
import { TIP_ADR, TIP_BSFF, TIP_BOUTEILLE, TIP_RETOUR_CONSIGNE, TIP_UN } from '../lib/fieldTips'
import { labelEmplacement, mouvementsForBottle } from '../lib/stockMouvements'
import { resumeRegleContenant, jaugeRemplissageRecup } from '../lib/stockRegles'
import {
  TYPE_HUILE_LABELS,
  ORIGINE_DESTRUCTION_VALUE,
  alerteConsigneJours,
  anneesValiditeContenant,
  dateReepreuveDepuisEpreuve,
  isBouteilleReepreuveBientot,
  isBouteilleReepreuveExpiree,
  type TypeHuile,
} from '../lib/stockBouteilleExtras'
import { A2lConformiteLigne } from '../components/A2lRecupAlert'
import { RecupJaugeBanner } from '../components/RecupJaugeBanner'
import { MobileFab } from '../components/MobileFab'
import { StockBottleIcon } from '../components/StockBottleIcon'

function roundKg(n: number) {
  return Math.round(n * 1000) / 1000
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

const blank = (opts?: {
  fluide?: string
  contenantType?: ContenantType
}): Omit<StockItem, 'id' | 'updatedAt'> => {
  const contenantType = opts?.contenantType || 'vierge'
  const fluide =
    opts?.fluide?.trim() || (contenantType === 'recuperation' ? '' : 'R-32')
  const adr = fluide ? adrInfoForFluide(fluide) : null
  const defs = bouteilleDefaultsForFluide(fluide)
  const entree = today()
  const annees = anneesValiditeContenant(contenantType)
  return {
    fluide,
    contenantType,
    numeroContenant: '',
    surnom: '',
    quantiteKg: contenantDemarreVide(contenantType) ? 0 : 0,
    quantiteInitialeKg: 0,
    capaciteMaxKg: defs.capaciteMaxKg,
    emplacement: 'atelier',
    assigneeUserId: undefined,
    assigneeName: undefined,
    origineClientId: undefined,
    origineDestructionDistributeur: false,
    bsffReference: '',
    codeUn: adr?.codeUn || '',
    denominationAdr: adr?.denominationAdr || '',
    notes: '',
    conformeA2LA3: false,
    pressionEpreuveBar: defs.pressionEpreuveBar,
    dateEntreePossession: entree,
    dateDerniereEpreuve: entree,
    /** Défaut : dernière épreuve + 10 ans (propre) ou +5 ans (récup/recyclage). */
    dateReepreuvage: dateReepreuveDepuisEpreuve(entree, annees),
    tareKg: defs.tareKg,
    seuilAlerteConsigneJours: 30,
    typeHuile: contenantType === 'recuperation' ? 'inconnu' : undefined,
  }
}

/** Famille UI : charge (10 ans) vs récup chantier (5 ans). */
type FamilleBouteille = 'charge' | 'recuperation'

function familleFromType(t: ContenantType): FamilleBouteille {
  return t === 'recuperation' || t === 'recycle' ? 'recuperation' : 'charge'
}

const CHARGE_SUBTYPES: ContenantType[] = ['vierge', 'regenere', 'transfert']

function applyContenantTypeChange(
  f: Omit<StockItem, 'id' | 'updatedAt'>,
  contenantType: ContenantType,
  editId: string | null,
): Omit<StockItem, 'id' | 'updatedAt'> {
  const demarreVide = contenantDemarreVide(contenantType)
  const nextFluide =
    contenantType === 'recuperation' && !editId && !f.fluide.trim()
      ? ''
      : contenantType !== 'recuperation' && !f.fluide.trim()
        ? 'R-32'
        : f.fluide
  const qty = demarreVide && !editId ? 0 : f.quantiteKg
  const epreuve = f.dateDerniereEpreuve || f.dateEntreePossession || ''
  const prevAuto = dateReepreuveDepuisEpreuve(
    epreuve,
    anneesValiditeContenant(f.contenantType),
  )
  const wasAuto = !f.dateReepreuvage?.trim() || f.dateReepreuvage === prevAuto
  const base: Omit<StockItem, 'id' | 'updatedAt'> = {
    ...f,
    contenantType,
    quantiteKg: qty,
    quantiteInitialeKg: demarreVide && !editId ? 0 : f.quantiteInitialeKg,
    capaciteMaxKg: contenantSansRecharge(contenantType)
      ? qty || f.capaciteMaxKg || bouteilleDefaultsForFluide(nextFluide).capaciteMaxKg
      : f.capaciteMaxKg || bouteilleDefaultsForFluide(nextFluide).capaciteMaxKg,
    emplacement: f.emplacement || 'atelier',
    typeHuile: contenantType === 'recuperation' ? f.typeHuile || 'inconnu' : f.typeHuile,
    dateReepreuvage: wasAuto
      ? dateReepreuveDepuisEpreuve(epreuve, anneesValiditeContenant(contenantType))
      : f.dateReepreuvage,
    ...(contenantType !== 'recuperation' && contenantType !== 'recycle'
      ? {
          origineClientId: undefined,
          origineDestructionDistributeur: false,
        }
      : {}),
  }
  return nextFluide === f.fluide
    ? base
    : {
        ...applyFluideAdr(base, nextFluide, true),
        conformeA2LA3:
          isFluideInflammableA2LOrA3(nextFluide) ||
          (contenantType === 'recuperation' && isFluideNonAssigne(nextFluide))
            ? f.conformeA2LA3
            : false,
      }
}

const TYPE_BADGE: Record<ContenantType, { label: string; cls: string }> = {
  vierge: { label: 'Vierge (neuf)', cls: 'bg-emerald-100 text-emerald-800' },
  recuperation: { label: 'Récup. déchet', cls: 'bg-orange-100 text-orange-800' },
  recycle: { label: 'Recyclé site', cls: 'bg-sky-100 text-sky-800' },
  regenere: { label: 'Régénéré', cls: 'bg-indigo-100 text-indigo-800' },
  transfert: { label: 'Transfert / Service', cls: 'bg-slate-100 text-slate-700' },
}

/** Récupération déchet = hors stock utilisable (traitement / destruction BSFF). */
function isStockDechet(s: Pick<StockItem, 'contenantType'>): boolean {
  return s.contenantType === 'recuperation'
}

type StockFluideGroup = {
  fluide: string
  bottles: StockItem[]
  totalKg: number
}

function groupStockByFluide(items: StockItem[]): StockFluideGroup[] {
  const map = new Map<string, StockItem[]>()
  for (const s of items) {
    const key = labelFluideStock(s.fluide)
    const list = map.get(key) || []
    list.push(s)
    map.set(key, list)
  }
  return [...map.entries()]
    .map(([fluide, bottles]) => ({
      fluide,
      bottles: [...bottles].sort((a, b) =>
        titreBouteilleStock(a).localeCompare(titreBouteilleStock(b), 'fr'),
      ),
      totalKg: roundKg(bottles.reduce((sum, b) => sum + (Number(b.quantiteKg) || 0), 0)),
    }))
    .sort((a, b) => a.fluide.localeCompare(b.fluide, 'fr'))
}

function applyFluideAdr(
  form: Omit<StockItem, 'id' | 'updatedAt'>,
  fluide: string,
  force = false,
): Omit<StockItem, 'id' | 'updatedAt'> {
  if (!fluide.trim()) {
    return {
      ...form,
      fluide: '',
      codeUn: force ? '' : form.codeUn,
      denominationAdr: force ? '' : form.denominationAdr,
    }
  }
  const adr = adrInfoForFluide(fluide)
  const withDefaults = applyBouteilleDefaults(form, fluide, force)
  if (!adr) return withDefaults
  const prevAdr = adrInfoForFluide(form.fluide)
  const unWasAuto = !form.codeUn || (prevAdr && form.codeUn === prevAdr.codeUn)
  const denomWasAuto =
    !form.denominationAdr || (prevAdr && form.denominationAdr === prevAdr.denominationAdr)
  return {
    ...withDefaults,
    codeUn: force || unWasAuto ? adr.codeUn : form.codeUn,
    denominationAdr: force || denomWasAuto ? adr.denominationAdr : form.denominationAdr,
  }
}

function BottleLevelBar({ current, initial }: { current: number; initial: number }) {
  const cap = initial > 0 ? initial : current > 0 ? current : 0
  const pct = cap > 0 ? Math.max(0, Math.min(100, Math.round((current / cap) * 100))) : 0
  const tone =
    pct <= 15 ? 'bg-danger' : pct <= 40 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="mt-1.5 w-full min-w-[7rem] max-w-[11rem]">
      <div className="h-2 overflow-hidden rounded-full bg-mist">
        <div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-0.5 text-[10px] font-medium text-muted">
        {roundKg(current)} kg / {roundKg(cap)} kg
      </div>
    </div>
  )
}

export function StockPage() {
  const {
    data,
    upsertStock,
    deleteStock,
    enregistrerRetourConsigneBouteille,
    enregistrerDestructionBouteille,
    enregistrerTransfertInterneBouteille,
    enregistrerPerteEmissionBouteille,
  } = useStore()
  const { user, listTeam } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [team, setTeam] = useState<UserAccount[]>([])
  const [form, setForm] = useState(blank)
  const [editId, setEditId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [regsOpen, setRegsOpen] = useState(false)
  const [techOpen, setTechOpen] = useState(false)
  const [retourId, setRetourId] = useState<string | null>(null)
  const [retourForm, setRetourForm] = useState({
    bonRetourConsigne: '',
    bonRetourDate: today(),
    bonRetourFournisseur: '',
    bonRetourNotes: '',
  })
  const [destrId, setDestrId] = useState<string | null>(null)
  const [destrForm, setDestrForm] = useState({
    quantiteKg: 0,
    date: today(),
    centreDestruction: '',
    documentReference: '',
    notes: '',
  })
  const [trfId, setTrfId] = useState<string | null>(null)
  const [trfForm, setTrfForm] = useState({
    versEmplacement: 'vehicule' as 'atelier' | 'vehicule',
    versLabel: '',
    assigneeUserId: '',
    date: today(),
    documentAdr: '',
    notes: '',
  })
  const [perteId, setPerteId] = useState<string | null>(null)
  const [perteForm, setPerteForm] = useState({
    quantiteKg: 0,
    date: today(),
    motif: 'Fuite / dégazage accidentel',
    notes: '',
  })
  const [q, setQ] = useState('')
  const [scanHint, setScanHint] = useState('')

  useEffect(() => {
    let cancelled = false
    void listTeam()
      .then((t) => {
        if (cancelled) return
        const active = t.filter((m) => m.active !== false)
        if (user && !active.some((m) => m.id === user.id)) {
          setTeam([
            {
              id: user.id,
              organizationId: user.organizationId,
              email: user.email,
              username: user.username,
              fullName: user.fullName || user.email || 'Moi',
              role: user.role,
              active: true,
              createdAt: user.createdAt,
            } as UserAccount,
            ...active,
          ])
        } else {
          setTeam(active)
        }
      })
      .catch(() => {
        if (cancelled) return
        if (user) {
          setTeam([
            {
              id: user.id,
              organizationId: user.organizationId,
              email: user.email,
              username: user.username,
              fullName: user.fullName || user.email || 'Moi',
              role: user.role,
              active: true,
              createdAt: user.createdAt,
            } as UserAccount,
          ])
        } else {
          setTeam([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [listTeam, user])

  /** Solo (auto-entrepreneur) : pas d’affectation tech sur les bouteilles. */
  const isSolo = team.length <= 1

  const resolveStockAssigneeName = (uid: string) => {
    if (!uid) return undefined
    const member = team.find((m) => m.id === uid)
    if (member?.fullName) return member.fullName
    if (uid === user?.id) return user.fullName || user.email || 'Moi'
    return undefined
  }

  const applyScanFields = (fields: BouteilleScanFields, forceNumero = false) => {
    setForm((f) => {
      const merged = mergeBouteilleScanIntoForm(f, fields, { force: forceNumero })
      const fluideChanged = Boolean(merged.fluide && merged.fluide !== f.fluide)
      const withAdr = merged.fluide
        ? applyFluideAdr(merged, merged.fluide, fluideChanged)
        : merged
      return {
        ...withAdr,
        conformeA2LA3:
          isFluideInflammableA2LOrA3(withAdr.fluide) || isFluideNonAssigne(withAdr.fluide)
            ? withAdr.conformeA2LA3
            : false,
      }
    })
    setScanHint(summarizeBouteilleScan(fields))
  }

  // Prefill depuis CERFA / lien « bouteille de récupération / transfert »
  useEffect(() => {
    const type = searchParams.get('type') as ContenantType | null
    const fluide = searchParams.get('fluide') || ''
    const wantType =
      type === 'recuperation' || type === 'transfert' || type === 'recycle' ? type : null
    if (!wantType && !fluide) return
    setEditId(null)
    setForm(
      blank({
        fluide: fluide || undefined,
        contenantType: wantType || undefined,
      }),
    )
    setOpen(true)
    setRegsOpen(false)
    setTechOpen(false)
    const next = new URLSearchParams(searchParams)
    next.delete('type')
    next.delete('fluide')
    setSearchParams(next, { replace: true })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Commande vocale « scan » → ouvrir formulaire + caméra code-barres
  const [autoScan, setAutoScan] = useState(false)
  useEffect(() => {
    if (searchParams.get('scan') !== '1') return
    setEditId(null)
    setForm(blank())
    setOpen(true)
    setRegsOpen(false)
    setTechOpen(false)
    setAutoScan(true)
    setScanHint('')
    const next = new URLSearchParams(searchParams)
    next.delete('scan')
    setSearchParams(next, { replace: true })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const actifStock = useMemo(
    () =>
      data.stock.filter(
        (s) =>
          !isBouteilleRetournee(s) &&
          matchesQuery(
            [s.fluide, s.numeroContenant, s.surnom, s.contenantType, s.bsffReference, s.codeUn, s.notes]
              .filter(Boolean)
              .join(' '),
            q,
          ),
      ),
    [data.stock, q],
  )
  const retournees = useMemo(
    () =>
      data.stock.filter(
        (s) =>
          isBouteilleRetournee(s) &&
          matchesQuery(
            [s.fluide, s.numeroContenant, s.surnom, s.contenantType, s.bsffReference].filter(Boolean).join(' '),
            q,
          ),
      ),
    [data.stock, q],
  )

  const stockUtilisable = useMemo(
    () => actifStock.filter((s) => !isStockDechet(s)),
    [actifStock],
  )
  const stockDechet = useMemo(() => actifStock.filter((s) => isStockDechet(s)), [actifStock])

  const groupsUtilisable = useMemo(() => groupStockByFluide(stockUtilisable), [stockUtilisable])
  const groupsDechet = useMemo(() => groupStockByFluide(stockDechet), [stockDechet])

  const totalUtilisableKg = useMemo(
    () => roundKg(stockUtilisable.reduce((sum, b) => sum + (Number(b.quantiteKg) || 0), 0)),
    [stockUtilisable],
  )
  const totalDechetKg = useMemo(
    () => roundKg(stockDechet.reduce((sum, b) => sum + (Number(b.quantiteKg) || 0), 0)),
    [stockDechet],
  )

  const mouvementContext = (m: StockMouvement) => {
    if (!m.interventionId) return null
    const intervention = data.interventions.find((i) => i.id === m.interventionId)
    if (!intervention) return { cerfa: displayMouvementLabel(m.cerfaLabel), client: '', site: '' }
    const client = data.clients.find((c) => c.id === intervention.clientId)
    const site = data.chantiers.find((c) => c.id === intervention.chantierId)
    return {
      cerfa: displayMouvementLabel(
        m.cerfaLabel || intervention.numeroIntervention || intervention.cerfaPdfFileName || 'CERFA',
      ),
      client: client?.raisonSociale || '',
      site: site?.nom || '',
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    let numeroOfficiel: string
    try {
      numeroOfficiel = assertNumeroContenantCerfa(form.numeroContenant)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'N° de série invalide')
      return
    }
    let qty = Number(form.quantiteKg) || 0
    let contenantType = form.contenantType
    const fluide = form.fluide.trim()
    const defs = bouteilleDefaultsForFluide(fluide)
    let capaciteMaxKg = Number(form.capaciteMaxKg) || defs.capaciteMaxKg
    const surnom = (form.surnom || '').trim() || undefined

    if (contenantType !== 'recuperation' && !fluide) {
      alert('Indiquez le fluide de la bouteille (sauf récupération vide non assignée).')
      return
    }

    // Récupération / Recyclé site : démarrent toujours vides à la création
    if (!editId && contenantDemarreVide(contenantType)) {
      qty = 0
    }

    // Vierge / régénéré : pas de recharge → capacité = quantité à l’entrée
    if (contenantSansRecharge(contenantType) && qty > 0) {
      capaciteMaxKg = qty
    }

    if (
      !isSolo &&
      (form.emplacement || 'atelier') === 'vehicule' &&
      !form.assigneeUserId
    ) {
      alert('Indiquez le technicien qui a la bouteille (hors atelier / dépôt).')
      return
    }

    if (
      !editId &&
      qty <= 0 &&
      !isContenantDestination(contenantType) &&
      contenantType !== 'transfert'
    ) {
      const ok = window.confirm(
        'Quantité à 0 kg : une bouteille Vierge / Régénérée doit arriver pleine (achat). Pour une destination de vidange, choisissez Récupération ou Recyclé site.\n\nPasser en Récupération vide ?',
      )
      if (ok) {
        contenantType = 'recuperation'
        capaciteMaxKg = capaciteMaxKg || defs.capaciteMaxKg
        qty = 0
      } else {
        return
      }
    }

    if ((contenantType === 'vierge' || contenantType === 'regenere') && qty <= 0) {
      alert(
        contenantType === 'regenere'
          ? 'Bouteille régénérée (achat distributeur) : indiquez la quantité à l’entrée (kg) > 0.'
          : 'Bouteille vierge (neuf) : indiquez la quantité à l’entrée (kg) > 0.',
      )
      return
    }

    if (contenantType === 'recuperation') {
      if (!form.origineDestructionDistributeur && !form.origineClientId) {
        alert(
          'Bouteille de récupération : indiquez le site / client d’origine, ou « Non attribué / Pour destruction chez le distributeur ».',
        )
        return
      }
      if (!capaciteMaxKg || capaciteMaxKg <= 0) {
        alert(
          'Bouteille de récupération : capacité nominale (kg) obligatoire. Le plafond sécurité sera 80 % de cette valeur.',
        )
        return
      }
      const maxAutorise = Math.round(capaciteMaxKg * 0.8 * 1000) / 1000
      if (qty > maxAutorise + 1e-9) {
        alert(
          `Quantité (${qty} kg) supérieure au max autorisé ${maxAutorise} kg (80 % de ${capaciteMaxKg} kg).`,
        )
        return
      }
      if (fluide && isFluideInflammableA2LOrA3(fluide) && !form.conformeA2LA3) {
        alert(
          'Fluide inflammable (A2L/A3) : cochez la confirmation « bouteille certifiée A2L/A3 » (collerette rouge + pas à gauche).',
        )
        return
      }
    }

    upsertStock({
      ...form,
      fluide,
      contenantType,
      numeroContenant: numeroOfficiel,
      surnom,
      capaciteMaxKg:
        contenantType === 'recuperation' ||
        contenantType === 'recycle' ||
        contenantType === 'regenere' ||
        contenantType === 'transfert' ||
        contenantType === 'vierge'
          ? capaciteMaxKg
          : form.capaciteMaxKg,
      tareKg: form.tareKg ?? defs.tareKg,
      pressionEpreuveBar: form.pressionEpreuveBar ?? defs.pressionEpreuveBar,
      emplacement: form.emplacement || 'atelier',
      emplacementLabel:
        (form.emplacement || 'atelier') === 'vehicule'
          ? form.emplacementLabel?.trim() ||
            (form.assigneeName?.trim() ? `Véhicule ${form.assigneeName.trim()}` : undefined)
          : undefined,
      assigneeUserId:
        !isSolo && (form.emplacement || 'atelier') === 'vehicule'
          ? form.assigneeUserId || undefined
          : undefined,
      assigneeName:
        !isSolo && (form.emplacement || 'atelier') === 'vehicule'
          ? form.assigneeName?.trim() ||
            resolveStockAssigneeName(form.assigneeUserId || '') ||
            undefined
          : undefined,
      origineClientId:
        contenantType === 'recuperation' && !form.origineDestructionDistributeur
          ? form.origineClientId || undefined
          : contenantType === 'recuperation'
            ? undefined
            : form.origineClientId,
      origineDestructionDistributeur:
        contenantType === 'recuperation' ? Boolean(form.origineDestructionDistributeur) : false,
      dateDerniereEpreuve: form.dateDerniereEpreuve || undefined,
      dateReepreuvage: form.dateReepreuvage || undefined,
      quantiteKg: qty,
      quantiteInitialeKg: editId
        ? form.quantiteInitialeKg ?? qty
        : form.quantiteInitialeKg || qty,
      id: editId ?? undefined,
    })
    setOpen(false)
    setEditId(null)
    setRegsOpen(false)
    setTechOpen(false)
  }

  const startEdit = (s: StockItem) => {
    setEditId(s.id)
    const epreuve = s.dateDerniereEpreuve || s.dateEntreePossession || ''
    setForm({
      ...s,
      dateDerniereEpreuve: epreuve || undefined,
      origineDestructionDistributeur: Boolean(s.origineDestructionDistributeur),
    })
    setRegsOpen(Boolean(s.bsffReference || s.codeUn || s.denominationAdr))
    setTechOpen(
      Boolean(
        s.dateReepreuvage ||
          s.dateDerniereEpreuve ||
          (s.tareKg != null && s.tareKg > 0) ||
          (s.pressionEpreuveBar != null && s.pressionEpreuveBar > 0) ||
          (s.typeHuile && s.typeHuile !== 'inconnu'),
      ),
    )
    setOpen(true)
  }

  const openRetour = (s: StockItem) => {
    setRetourId(s.id)
    setRetourForm({
      bonRetourConsigne: '',
      bonRetourDate: today(),
      bonRetourFournisseur: '',
      bonRetourNotes: '',
    })
  }

  const submitRetour = (e: FormEvent) => {
    e.preventDefault()
    if (!retourId) return
    try {
      enregistrerRetourConsigneBouteille({
        stockItemId: retourId,
        ...retourForm,
        createdByName: user?.fullName || user?.email || user?.username,
      })
      setRetourId(null)
      setExpandedId(retourId)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur retour consigne')
    }
  }

  const openDestruction = (s: StockItem) => {
    setDestrId(s.id)
    setDestrForm({
      quantiteKg: Number(s.quantiteKg) || 0,
      date: today(),
      centreDestruction: '',
      documentReference: s.bsffReference || '',
      notes: '',
    })
  }

  const submitDestruction = (e: FormEvent) => {
    e.preventDefault()
    if (!destrId) return
    try {
      enregistrerDestructionBouteille({
        stockItemId: destrId,
        ...destrForm,
        createdByName: user?.fullName || user?.email || user?.username,
      })
      setDestrId(null)
      setExpandedId(destrId)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur destruction / BSFF')
    }
  }

  const openTransfert = (s: StockItem) => {
    const from = s.emplacement || 'atelier'
    setTrfId(s.id)
    setTrfForm({
      versEmplacement: from === 'vehicule' ? 'atelier' : 'vehicule',
      versLabel: from === 'vehicule' ? '' : s.emplacementLabel || '',
      assigneeUserId: from === 'vehicule' ? '' : s.assigneeUserId || '',
      date: today(),
      documentAdr: '',
      notes: '',
    })
  }

  const submitTransfert = (e: FormEvent) => {
    e.preventDefault()
    if (!trfId) return
    try {
      const assigneeUserId =
        !isSolo && trfForm.versEmplacement === 'vehicule'
          ? trfForm.assigneeUserId || undefined
          : undefined
      enregistrerTransfertInterneBouteille({
        stockItemId: trfId,
        versEmplacement: trfForm.versEmplacement,
        versLabel: trfForm.versLabel,
        assigneeUserId,
        assigneeName: assigneeUserId
          ? resolveStockAssigneeName(assigneeUserId)
          : undefined,
        date: trfForm.date,
        documentAdr: trfForm.documentAdr,
        notes: trfForm.notes,
        createdByName: user?.fullName || user?.email || user?.username,
      })
      setTrfId(null)
      setExpandedId(trfId)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur transfert interne')
    }
  }

  const openPerte = (s: StockItem) => {
    setPerteId(s.id)
    setPerteForm({
      quantiteKg: Number(s.quantiteKg) || 0,
      date: today(),
      motif: 'Fuite / dégazage accidentel',
      notes: '',
    })
  }

  const submitPerte = (e: FormEvent) => {
    e.preventDefault()
    if (!perteId) return
    try {
      enregistrerPerteEmissionBouteille({
        stockItemId: perteId,
        ...perteForm,
        createdByName: user?.fullName || user?.email || user?.username,
      })
      setPerteId(null)
      setExpandedId(perteId)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur déclaration perte')
    }
  }

  const retourBottle = retourId ? data.stock.find((s) => s.id === retourId) : null
  const destrBottle = destrId ? data.stock.find((s) => s.id === destrId) : null
  const trfBottle = trfId ? data.stock.find((s) => s.id === trfId) : null
  const perteBottle = perteId ? data.stock.find((s) => s.id === perteId) : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <StockBottleIcon size={56} float delay="0.15s" className="shrink-0" />
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-bold tracking-tight">Stock fluides</h1>
            <p className="mt-1 text-muted">
              Gaz utilisable (charge) séparé du gaz récupéré (déchet → BSFF / traitement).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setEditId(null)
              setForm(blank({ contenantType: 'recuperation' }))
              setRegsOpen(false)
              setTechOpen(false)
              setOpen(true)
            }}
            className="hidden min-h-12 items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 text-sm font-semibold text-orange-900 hover:bg-orange-100 md:inline-flex"
          >
            <Plus className="h-4 w-4" /> Récup. vide
          </button>
          <button
            type="button"
            onClick={() => {
              setEditId(null)
              setForm(blank())
              setRegsOpen(false)
              setTechOpen(false)
              setOpen(true)
            }}
            className="hidden min-h-12 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-ink hover:bg-accent-hover md:inline-flex"
          >
            <Plus className="h-4 w-4" /> Ajouter
          </button>
        </div>
      </div>

      <SearchField
        value={q}
        onChange={setQ}
        placeholder="Rechercher fluide, n° bouteille, BSFF…"
        testId="stock-search"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3">
          <div className="text-[11px] font-bold uppercase tracking-wide text-emerald-800">
            Stock utilisable
          </div>
          <div className="mt-0.5 font-display text-2xl font-bold text-emerald-950">
            {totalUtilisableKg}{' '}
            <span className="text-base font-semibold text-emerald-800/80">kg</span>
          </div>
          <p className="mt-1 text-xs text-emerald-900/80">
            Vierge, régénéré, recyclé site — pour charge / appoint.
          </p>
        </div>
        <div className="rounded-2xl border border-orange-200 bg-orange-50/80 px-4 py-3">
          <div className="text-[11px] font-bold uppercase tracking-wide text-orange-900">
            Récupération déchet
          </div>
          <div className="mt-0.5 font-display text-2xl font-bold text-orange-950">
            {totalDechetKg}{' '}
            <span className="text-base font-semibold text-orange-800/80">kg</span>
          </div>
          <p className="mt-1 text-xs text-orange-950/80">
            Destiné au traitement / destruction (BSFF) — pas de réinjection.
          </p>
        </div>
      </div>

      {open && (
        <form
          onSubmit={onSubmit}
          className="grid gap-3 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2"
        >
          <p className="rounded-xl bg-mist/50 px-3 py-2 text-xs text-muted sm:col-span-2">
            Saisie rapide : <strong className="text-ink">photo étiquette</strong> ou{' '}
            <strong className="text-ink">scan QR / code-barres</strong>, puis vérifiez fluide,
            type et n°. Capacité / tare / PH / ADR se complètent si lisibles ou selon le fluide.
            {form.contenantType === 'recuperation' ? (
              <> Fluide optionnel (non assigné jusqu’au 1er CERFA).</>
            ) : null}
          </p>

          <BouteillePhotoButton onParsed={(fields) => applyScanFields(fields)} />

          {scanHint ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 sm:col-span-2">
              Données détectées : <strong>{scanHint}</strong> — vérifiez avant d’enregistrer.
            </p>
          ) : null}

          <FluideSelect
            label="Fluide"
            value={form.fluide}
            onChange={(v) =>
              setForm((f) => ({
                ...applyFluideAdr(f, v, true),
                // Garder le marquage A2L si fluide inflam. OU récup non assignée
                conformeA2LA3:
                  isFluideInflammableA2LOrA3(v) || isFluideNonAssigne(v)
                    ? f.conformeA2LA3
                    : false,
              }))
            }
            required={form.contenantType !== 'recuperation'}
            allowUnassigned={form.contenantType === 'recuperation'}
            disabled={
              !!editId &&
              form.contenantType === 'recuperation' &&
              !isFluideNonAssigne(form.fluide) &&
              (Number(form.quantiteKg) || 0) > 0
            }
          />
          <div className="sm:col-span-2 space-y-2">
            <span className="mb-1 block text-sm font-semibold text-ink">Type de bouteille *</span>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  const nextType = CHARGE_SUBTYPES.includes(form.contenantType)
                    ? form.contenantType
                    : 'vierge'
                  setForm((f) => applyContenantTypeChange(f, nextType, editId))
                }}
                className={[
                  'rounded-xl border-2 px-3 py-3 text-left transition',
                  familleFromType(form.contenantType) === 'charge'
                    ? 'border-emerald-600 bg-emerald-50 shadow-sm'
                    : 'border-line bg-white hover:border-emerald-300',
                ].join(' ')}
              >
                <span className="block text-sm font-bold text-ink">
                  Bouteille de charge / service
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  Fluide neuf ou régénéré propre — validité <strong>10 ans</strong>
                </span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setForm((f) => applyContenantTypeChange(f, 'recuperation', editId))
                }
                className={[
                  'rounded-xl border-2 px-3 py-3 text-left transition',
                  familleFromType(form.contenantType) === 'recuperation'
                    ? 'border-orange-600 bg-orange-50 shadow-sm'
                    : 'border-line bg-white hover:border-orange-300',
                ].join(' ')}
              >
                <span className="block text-sm font-bold text-ink">
                  Bouteille de récupération
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  Fluide usagé / chantier — validité <strong>5 ans</strong>
                </span>
              </button>
            </div>

            {familleFromType(form.contenantType) === 'charge' && (
              <label className="mt-2 block text-sm">
                <span className="mb-1 block font-semibold text-ink">Précision (fluide propre)</span>
                <select
                  value={
                    CHARGE_SUBTYPES.includes(form.contenantType) ? form.contenantType : 'vierge'
                  }
                  onChange={(e) => {
                    const contenantType = e.target.value as ContenantType
                    setForm((f) => applyContenantTypeChange(f, contenantType, editId))
                  }}
                  className="h-11 w-full rounded-xl border border-line bg-white px-3"
                >
                  <option value="vierge">Vierge (neuf distributeur)</option>
                  <option value="regenere">Régénéré (achat distributeur)</option>
                  <option value="transfert">Transfert / service</option>
                </select>
                <p className="mt-1 text-xs text-muted">
                  {resumeRegleContenant(
                    CHARGE_SUBTYPES.includes(form.contenantType)
                      ? form.contenantType
                      : 'vierge',
                  )}
                </p>
              </label>
            )}

            {familleFromType(form.contenantType) === 'recuperation' && (
              <div className="mt-2 space-y-2">
                {editId && form.contenantType === 'recycle' ? (
                  <p className="text-xs font-semibold text-sky-900">
                    Type actuel : Recyclé site (même client) — validité 5 ans.
                  </p>
                ) : null}
                <p className="rounded-xl border border-orange-200 bg-orange-50/90 px-3 py-2 text-xs leading-snug text-orange-950">
                  Les bouteilles de récupération sont soumises au{' '}
                  <strong>contrôle quinquennal (5 ans)</strong> en raison des risques de corrosion
                  liés aux fluides usagés.
                </p>
                <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-snug text-amber-950">
                  ⚠️ <strong>Rappel F-Gaz :</strong> le fluide récupéré non régénéré en usine est
                  exclusivement réservé aux interventions sur le <strong>même site</strong> ou
                  le <strong>même détenteur</strong>.
                </p>
              </div>
            )}
          </div>

          {form.contenantType === 'recuperation' && (
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-semibold text-ink">Site / Client d’origine *</span>
              <select
                required
                value={
                  form.origineDestructionDistributeur
                    ? ORIGINE_DESTRUCTION_VALUE
                    : form.origineClientId || ''
                }
                onChange={(e) => {
                  const v = e.target.value
                  if (v === ORIGINE_DESTRUCTION_VALUE) {
                    setForm({
                      ...form,
                      origineDestructionDistributeur: true,
                      origineClientId: undefined,
                    })
                  } else {
                    setForm({
                      ...form,
                      origineDestructionDistributeur: false,
                      origineClientId: v || undefined,
                    })
                  }
                }}
                className="h-11 w-full rounded-xl border border-line bg-white px-3"
              >
                <option value="">— Choisir —</option>
                <option value={ORIGINE_DESTRUCTION_VALUE}>
                  Non attribué / Pour destruction chez le distributeur
                </option>
                {[...data.clients]
                  .sort((a, b) =>
                    clientDisplayName(a).localeCompare(clientDisplayName(b), 'fr'),
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {clientDisplayName(c)}
                      {c.ville ? ` — ${c.ville}` : ''}
                    </option>
                  ))}
              </select>
              <p className="mt-1 text-[11px] text-muted">
                Obligatoire pour la traçabilité F-Gaz des bouteilles de récupération.
              </p>
            </label>
          )}

          <div className="sm:col-span-2">
            <LabelHint label="N° de série / n° de contenant *" tip={TIP_BOUTEILLE}>
              <div className="flex gap-2">
                <input
                  required
                  value={form.numeroContenant}
                  onChange={(e) => setForm({ ...form, numeroContenant: e.target.value })}
                  placeholder="ex. BOT-32-4890 ou code-barres (CERFA)"
                  className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-white px-3"
                />
                <BarcodeScanButton
                  autoStart={autoScan}
                  title="Scanner code-barres / QR bouteille"
                  dialogTitle="Scanner le contenant"
                  hint="Cadrez le code-barres / QR du fournisseur (Gazechim, Westfalen, Climalife…)."
                  onDetected={(value) => {
                    applyScanFields(parseBarcodePayload(value), true)
                    setAutoScan(false)
                  }}
                />
              </div>
            </LabelHint>
            <p className="mt-1 text-[11px] text-muted">
              Numéro officiel imprimé sur le CERFA — scan QR / code-barres ou photo d’étiquette.
            </p>
          </div>

          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-semibold text-ink">Surnom / libellé interne (optionnel)</span>
            <input
              value={form.surnom || ''}
              onChange={(e) => setForm({ ...form, surnom: e.target.value })}
              placeholder={
                form.contenantType === 'transfert'
                  ? 'ex. Bouteille Transfert Camion Luc'
                  : 'ex. Récup atelier — usage dépôt uniquement'
              }
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            />
            <p className="mt-1 text-[11px] text-muted">
              Affiché dans le stock et les menus pour les techniciens — jamais à la place du n° sur
              le CERFA.
            </p>
          </label>

          <DecimalField
            label={editId ? 'Quantité restante (kg)' : "Quantité à l'entrée (kg)"}
            value={
              !editId && contenantDemarreVide(form.contenantType) ? 0 : form.quantiteKg
            }
            onChange={(n) => {
              if (!editId && contenantDemarreVide(form.contenantType)) return
              setForm({
                ...form,
                quantiteKg: n,
                quantiteInitialeKg: editId ? form.quantiteInitialeKg : n,
                // Vierge / régénéré : la jauge suit l’entrée (pas de champ capacité)
                ...(contenantSansRecharge(form.contenantType) ? { capaciteMaxKg: n } : {}),
              })
            }}
            placeholder={
              contenantDemarreVide(form.contenantType) ? '0 (vide)' : 'ex. 10,5'
            }
            disabled={!editId && contenantDemarreVide(form.contenantType)}
          />
          {editId ? (
            <DecimalField
              label="Quantité d’entrée (kg)"
              value={
                contenantDemarreVide(form.contenantType)
                  ? 0
                  : (form.quantiteInitialeKg ?? form.quantiteKg)
              }
              onChange={(n) => {
                if (contenantDemarreVide(form.contenantType)) return
                setForm({
                  ...form,
                  quantiteInitialeKg: n,
                  ...(contenantSansRecharge(form.contenantType) ? { capaciteMaxKg: n } : {}),
                })
              }}
              placeholder="entrée d’origine"
              disabled={contenantDemarreVide(form.contenantType)}
            />
          ) : contenantSansRecharge(form.contenantType) ? (
            <p className="text-xs text-muted sm:self-end sm:pb-2">
              Capacité = quantité à l’entrée (bouteille neuve / régénérée : pas de recharge).
            </p>
          ) : (
            <DecimalField
              label={
                form.contenantType === 'recuperation'
                  ? 'Capacité nominale (kg)'
                  : form.contenantType === 'recycle'
                    ? 'Capacité max (kg)'
                    : 'Capacité (kg)'
              }
              value={form.capaciteMaxKg ?? bouteilleDefaultsForFluide(form.fluide).capaciteMaxKg}
              onChange={(n) => setForm({ ...form, capaciteMaxKg: n })}
              placeholder="12,5"
              emptyZero
            />
          )}

          {(form.contenantType === 'recuperation' || form.contenantType === 'recycle') &&
            Number(form.capaciteMaxKg) > 0 && (
            <p className="text-xs text-muted sm:col-span-2">
              Max sécurité 80 % :{' '}
              <strong>
                {Math.round(Number(form.capaciteMaxKg) * 0.8 * 1000) / 1000} kg
              </strong>
            </p>
          )}

          {form.contenantType === 'recuperation' && isFluideNonAssigne(form.fluide) && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-ink sm:col-span-2">
              <input
                type="checkbox"
                checked={!!form.conformeA2LA3}
                onChange={(e) => setForm({ ...form, conformeA2LA3: e.target.checked })}
                className="mt-0.5 h-4 w-4 shrink-0 accent-amber-700"
              />
              <span className="min-w-0 leading-snug">
                Bouteille adaptée A2L/A3 (collerette rouge + pas à gauche) — à cocher si le 1er
                CERFA sera un gaz inflammable (ex. R-32).
              </span>
            </label>
          )}

          {form.contenantType === 'recuperation' &&
            !isFluideNonAssigne(form.fluide) &&
            isFluideInflammableA2LOrA3(form.fluide) && (
            <A2lConformiteLigne
              fluide={form.fluide}
              checked={!!form.conformeA2LA3}
              onChange={(v) => setForm({ ...form, conformeA2LA3: v })}
              id="stock-conforme-a2l"
            />
          )}

          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink">Emplacement</span>
            <select
              value={form.emplacement || 'atelier'}
              onChange={(e) => {
                const emplacement = e.target.value as 'atelier' | 'vehicule'
                setForm({
                  ...form,
                  emplacement,
                  ...(emplacement === 'atelier'
                    ? { assigneeUserId: undefined, assigneeName: undefined, emplacementLabel: undefined }
                    : {}),
                })
              }}
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            >
              <option value="atelier">Atelier / dépôt</option>
              <option value="vehicule">Chez un technicien / véhicule</option>
            </select>
          </label>
          {(form.emplacement || 'atelier') === 'vehicule' && (
            <>
              {!isSolo && (
                <label className="block text-sm">
                  <span className="mb-1 block font-semibold text-ink">Technicien *</span>
                  <select
                    value={form.assigneeUserId || ''}
                    onChange={(e) => {
                      const assigneeUserId = e.target.value
                      setForm({
                        ...form,
                        assigneeUserId: assigneeUserId || undefined,
                        assigneeName: resolveStockAssigneeName(assigneeUserId),
                      })
                    }}
                    required
                    className="h-11 w-full rounded-xl border border-line bg-white px-3"
                  >
                    <option value="">— Choisir le technicien —</option>
                    {team.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName || m.email}
                        {m.id === user?.id ? ' (moi)' : ''}
                        {m.role === 'owner' ? ' · gérant' : ' · opérateur'}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-muted">
                    Qui a la bouteille hors atelier — visible pour toute l’équipe.
                  </p>
                </label>
              )}
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-ink">
                  Nom du véhicule {isSolo ? '' : '(optionnel)'}
                </span>
                <input
                  value={form.emplacementLabel || ''}
                  onChange={(e) => setForm({ ...form, emplacementLabel: e.target.value })}
                  placeholder="ex. Véhicule A"
                  className="h-11 w-full rounded-xl border border-line bg-white px-3"
                />
              </label>
            </>
          )}

          <div className="sm:col-span-2 overflow-hidden rounded-xl border border-line">
            <button
              type="button"
              onClick={() => setTechOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 bg-mist/40 px-4 py-3 text-left text-sm font-semibold"
            >
              <span>Caractéristiques techniques avancées (optionnel)</span>
              {techOpen ? (
                <ChevronDown className="h-4 w-4 text-muted" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted" />
              )}
            </button>
            {techOpen && (
              <div className="grid gap-3 border-t border-line p-4 sm:grid-cols-2">
                <p className="text-xs text-muted sm:col-span-2">
                  Préremplis selon le fluide (ex. R-32 → tare 10 kg, PH 48 bar). Modifiables si la
                  bouteille diffère.
                </p>
                <DecimalField
                  label="Tare (poids vide, kg)"
                  value={form.tareKg ?? 0}
                  onChange={(n) => setForm({ ...form, tareKg: n || undefined })}
                  placeholder="ex. 10"
                  emptyZero
                />
                <DecimalField
                  label="Pression d’épreuve PH (bar)"
                  value={form.pressionEpreuveBar ?? 0}
                  onChange={(n) => setForm({ ...form, pressionEpreuveBar: n || undefined })}
                  placeholder="ex. 48"
                  emptyZero
                />
                <label className="block text-sm">
                  <span className="mb-1 block font-semibold text-ink">
                    Date de dernière épreuve
                  </span>
                  <input
                    type="date"
                    value={form.dateDerniereEpreuve || ''}
                    onChange={(e) => {
                      const dateDerniereEpreuve = e.target.value
                      setForm((f) => {
                        const prevAuto = dateReepreuveDepuisEpreuve(
                          f.dateDerniereEpreuve || f.dateEntreePossession,
                          anneesValiditeContenant(f.contenantType),
                        )
                        const wasAuto =
                          !f.dateReepreuvage?.trim() || f.dateReepreuvage === prevAuto
                        return {
                          ...f,
                          dateDerniereEpreuve,
                          dateReepreuvage: wasAuto
                            ? dateReepreuveDepuisEpreuve(
                                dateDerniereEpreuve,
                                anneesValiditeContenant(f.contenantType),
                              )
                            : f.dateReepreuvage,
                        }
                      })
                    }}
                    className="h-11 w-full rounded-xl border border-line bg-white px-3"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-semibold text-ink">
                    Date de rééprouvage / fin de validité
                  </span>
                  <input
                    type="date"
                    value={form.dateReepreuvage || ''}
                    onChange={(e) => setForm({ ...form, dateReepreuvage: e.target.value })}
                    className="h-11 w-full rounded-xl border border-line bg-white px-3"
                  />
                  <p className="mt-1 text-[11px] text-muted">
                    Défaut : dernière épreuve +{' '}
                    {anneesValiditeContenant(form.contenantType)} ans (
                    {form.contenantType === 'recuperation' || form.contenantType === 'recycle'
                      ? 'récup / recyclage'
                      : 'neuf / transfert / régénéré'}
                    ). Modifiable si la bouteille a été éprouvée plus tôt.
                  </p>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-semibold text-ink">Entrée en possession (consigne)</span>
                  <input
                    type="date"
                    value={form.dateEntreePossession || ''}
                    onChange={(e) =>
                      setForm({ ...form, dateEntreePossession: e.target.value })
                    }
                    className="h-11 w-full rounded-xl border border-line bg-white px-3"
                  />
                </label>
                <DecimalField
                  label="Alerte consigne après (jours)"
                  value={form.seuilAlerteConsigneJours ?? 30}
                  onChange={(n) => setForm({ ...form, seuilAlerteConsigneJours: n || 30 })}
                  placeholder="30"
                  emptyZero
                />
                {form.contenantType === 'recuperation' && (
                  <label className="block text-sm">
                    <span className="mb-1 block font-semibold text-ink">Type d’huile (récupération)</span>
                    <select
                      value={form.typeHuile || 'inconnu'}
                      onChange={(e) => setForm({ ...form, typeHuile: e.target.value as TypeHuile })}
                      className="h-11 w-full rounded-xl border border-line bg-white px-3"
                    >
                      {(Object.keys(TYPE_HUILE_LABELS) as TypeHuile[]).map((k) => (
                        <option key={k} value={k}>
                          {TYPE_HUILE_LABELS[k]}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {editId && !contenantSansRecharge(form.contenantType) && (
                  <DecimalField
                    label="Capacité nominale / max (kg)"
                    value={form.capaciteMaxKg ?? 0}
                    onChange={(n) => setForm({ ...form, capaciteMaxKg: n })}
                    placeholder="12,5"
                    emptyZero
                  />
                )}
              </div>
            )}
          </div>

          <div className="sm:col-span-2 overflow-hidden rounded-xl border border-line">
            <button
              type="button"
              onClick={() => setRegsOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 bg-mist/40 px-4 py-3 text-left text-sm font-semibold"
            >
              <span>Informations réglementaires (ADR / BSFF)</span>
              {regsOpen ? (
                <ChevronDown className="h-4 w-4 text-muted" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted" />
              )}
            </button>
            {regsOpen && (
              <div className="grid gap-3 border-t border-line p-4 sm:grid-cols-2">
                <p className="text-xs text-muted sm:col-span-2">
                  Code UN et ADR sont préremplis selon le fluide — modifiables si besoin.
                </p>
                <LabelHint label="Réf. BSFF" tip={TIP_BSFF}>
                  <input
                    value={form.bsffReference || ''}
                    onChange={(e) => setForm({ ...form, bsffReference: e.target.value })}
                    placeholder={
                      form.contenantType === 'recuperation'
                        ? 'ex. BSFF-2026-XXXXXXXX'
                        : 'N/A si pas de récupération'
                    }
                    className="h-11 w-full rounded-xl border border-line bg-white px-3"
                  />
                </LabelHint>
                <LabelHint label="Code UN" tip={TIP_UN}>
                  <input
                    value={form.codeUn || ''}
                    onChange={(e) => setForm({ ...form, codeUn: e.target.value })}
                    placeholder="ex. 3252"
                    className="h-11 w-full rounded-xl border border-line bg-white px-3"
                  />
                </LabelHint>
                <LabelHint label="Dénomination ADR/RID" tip={TIP_ADR} className="sm:col-span-2">
                  <input
                    value={form.denominationAdr || ''}
                    onChange={(e) => setForm({ ...form, denominationAdr: e.target.value })}
                    placeholder="ex. UN 3252 DIFLUOROMETHANE (REFRIGERANT GAS R 32)"
                    className="h-11 w-full rounded-xl border border-line bg-white px-3"
                  />
                </LabelHint>
              </div>
            )}
          </div>

          <p className="text-xs text-muted sm:col-span-2">
            Neuve ou récup : chaque ajout / sortie sur CERFA met à jour le reste et l&apos;historique
            (ex. 10 kg → sortie 2 kg → reste 8 kg, lié au n° CERFA).
          </p>
          <div className="flex gap-2 sm:col-span-2">
            <button
              type="submit"
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink hover:bg-accent-hover"
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setRegsOpen(false)
                setTechOpen(false)
              }}
              className="rounded-full border border-line px-5 py-2.5 text-sm"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {retourBottle && (
        <form
          onSubmit={submitRetour}
          className="grid gap-3 rounded-2xl border border-accent/40 bg-accent-soft/30 p-5 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <h2 className="font-display text-lg font-semibold">Bon de retour de consigne</h2>
            <p className="mt-1 text-sm text-muted">
              {retourBottle.numeroContenant} · {retourBottle.fluide} (bouteille neuve vide)
            </p>
          </div>
          <LabelHint label="N° bon de retour *" tip={TIP_RETOUR_CONSIGNE}>
            <input
              required
              value={retourForm.bonRetourConsigne}
              onChange={(e) =>
                setRetourForm({ ...retourForm, bonRetourConsigne: e.target.value })
              }
              placeholder="ex. BR-2026-0042"
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            />
          </LabelHint>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink">Date de retour *</span>
            <input
              required
              type="date"
              value={retourForm.bonRetourDate}
              onChange={(e) => setRetourForm({ ...retourForm, bonRetourDate: e.target.value })}
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-semibold text-ink">Fournisseur</span>
            <input
              value={retourForm.bonRetourFournisseur}
              onChange={(e) =>
                setRetourForm({ ...retourForm, bonRetourFournisseur: e.target.value })
              }
              placeholder="ex. Distributeur fluides"
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-semibold text-ink">Notes</span>
            <input
              value={retourForm.bonRetourNotes}
              onChange={(e) => setRetourForm({ ...retourForm, bonRetourNotes: e.target.value })}
              placeholder="Optionnel"
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button
              type="submit"
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink hover:bg-accent-hover"
            >
              Enregistrer le retour
            </button>
            <button
              type="button"
              onClick={() => setRetourId(null)}
              className="rounded-full border border-line px-5 py-2.5 text-sm"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {destrId && destrBottle && (
        <form
          onSubmit={submitDestruction}
          className="grid gap-3 rounded-2xl border border-orange-200 bg-orange-50/60 p-5 sm:grid-cols-2"
        >
          <p className="text-sm text-orange-950 sm:col-span-2">
            Évacuation BSFF — bouteille <strong>{destrBottle.numeroContenant}</strong> (
            {destrBottle.fluide}). Fluide usagé remis à un centre agréé (pas de réinjection CERFA).
          </p>
          <DecimalField
            label="Quantité à évacuer (kg) *"
            value={destrForm.quantiteKg}
            onChange={(n) => setDestrForm({ ...destrForm, quantiteKg: n })}
            emptyZero
          />
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink">Date *</span>
            <input
              required
              type="date"
              value={destrForm.date}
              onChange={(e) => setDestrForm({ ...destrForm, date: e.target.value })}
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            />
          </label>
          <LabelHint label="Réf. BSFF *" tip={TIP_BSFF}>
            <input
              required
              value={destrForm.documentReference}
              onChange={(e) => setDestrForm({ ...destrForm, documentReference: e.target.value })}
              placeholder="ex. BSFF-2026-XXXXXXXX"
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            />
          </LabelHint>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink">Centre / installation agréée</span>
            <input
              value={destrForm.centreDestruction}
              onChange={(e) => setDestrForm({ ...destrForm, centreDestruction: e.target.value })}
              placeholder="ex. Centre de traitement"
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-semibold text-ink">Notes</span>
            <input
              value={destrForm.notes}
              onChange={(e) => setDestrForm({ ...destrForm, notes: e.target.value })}
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button
              type="submit"
              className="rounded-full bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
            >
              Enregistrer l’évacuation
            </button>
            <button
              type="button"
              onClick={() => setDestrId(null)}
              className="rounded-full border border-line bg-white px-5 py-2.5 text-sm"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {trfId && trfBottle && (
        <form
          onSubmit={submitTransfert}
          className="grid gap-3 rounded-2xl border border-sky-200 bg-sky-50/70 p-5 sm:grid-cols-2"
        >
          <div className="sm:col-span-2 space-y-1 text-sm text-sky-950">
            <p className="font-semibold">
              Transfert interne (sans CERFA) — {trfBottle.numeroContenant} · {trfBottle.fluide} ·{' '}
              {roundKg(Number(trfBottle.quantiteKg) || 0)} kg
            </p>
            <p className="text-xs">
              Emplacement actuel :{' '}
              <strong>
                {labelEmplacement(trfBottle.emplacement || 'atelier', trfBottle.emplacementLabel)}
              </strong>
              . Le fluide reste propriété de l’entreprise — registre F-Gas mis à jour, aucun CERFA
              client.
            </p>
            {(trfBottle.codeUn || trfBottle.denominationAdr) && (
              <p className="rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs">
                ADR transport : {trfBottle.codeUn || '—'}
                {trfBottle.denominationAdr ? ` · ${trfBottle.denominationAdr}` : ''} — document ADR
                / seuil 1000 points à prévoir dans le véhicule.
              </p>
            )}
          </div>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink">Destination *</span>
            <select
              value={trfForm.versEmplacement}
              onChange={(e) =>
                setTrfForm({
                  ...trfForm,
                  versEmplacement: e.target.value as 'atelier' | 'vehicule',
                  assigneeUserId:
                    e.target.value === 'atelier' ? '' : trfForm.assigneeUserId,
                })
              }
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            >
              <option value="atelier">Atelier / dépôt</option>
              <option value="vehicule">Chez un technicien / véhicule</option>
            </select>
          </label>
          {trfForm.versEmplacement === 'vehicule' && !isSolo && (
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-ink">Technicien *</span>
              <select
                required
                value={trfForm.assigneeUserId}
                onChange={(e) => setTrfForm({ ...trfForm, assigneeUserId: e.target.value })}
                className="h-11 w-full rounded-xl border border-line bg-white px-3"
              >
                <option value="">— Choisir le technicien —</option>
                {team.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName || m.email}
                    {m.id === user?.id ? ' (moi)' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink">Date *</span>
            <input
              required
              type="date"
              value={trfForm.date}
              onChange={(e) => setTrfForm({ ...trfForm, date: e.target.value })}
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            />
          </label>
          {trfForm.versEmplacement === 'vehicule' && (
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-semibold text-ink">
                Nom du véhicule {!isSolo && trfForm.assigneeUserId ? '(optionnel)' : '*'}
              </span>
              <input
                required={isSolo || !trfForm.assigneeUserId}
                value={trfForm.versLabel}
                onChange={(e) => setTrfForm({ ...trfForm, versLabel: e.target.value })}
                placeholder="ex. Véhicule A"
                className="h-11 w-full rounded-xl border border-line bg-white px-3"
              />
            </label>
          )}
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-semibold text-ink">Réf. document ADR (optionnel)</span>
            <input
              value={trfForm.documentAdr}
              onChange={(e) => setTrfForm({ ...trfForm, documentAdr: e.target.value })}
              placeholder="ex. Déclaration transport / n° doc."
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-semibold text-ink">Notes</span>
            <input
              value={trfForm.notes}
              onChange={(e) => setTrfForm({ ...trfForm, notes: e.target.value })}
              placeholder="ex. Préparation tournée"
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button
              type="submit"
              className="rounded-full bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-800"
            >
              Enregistrer le transfert
            </button>
            <button
              type="button"
              onClick={() => setTrfId(null)}
              className="rounded-full border border-line bg-white px-5 py-2.5 text-sm"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {perteId && perteBottle && (
        <form
          onSubmit={submitPerte}
          className="grid gap-3 rounded-2xl border border-rose-200 bg-rose-50/70 p-5 sm:grid-cols-2"
        >
          <p className="text-sm text-rose-950 sm:col-span-2">
            Déclaration de perte / fuite — <strong>{perteBottle.numeroContenant}</strong> (
            {perteBottle.fluide}). Met à jour le stock et le bilan F-Gas annuel.
          </p>
          <DecimalField
            label="Quantité perdue (kg) *"
            value={perteForm.quantiteKg}
            onChange={(n) => setPerteForm({ ...perteForm, quantiteKg: n })}
            emptyZero
          />
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink">Date *</span>
            <input
              required
              type="date"
              value={perteForm.date}
              onChange={(e) => setPerteForm({ ...perteForm, date: e.target.value })}
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-semibold text-ink">Motif</span>
            <input
              value={perteForm.motif}
              onChange={(e) => setPerteForm({ ...perteForm, motif: e.target.value })}
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-semibold text-ink">Notes</span>
            <input
              value={perteForm.notes}
              onChange={(e) => setPerteForm({ ...perteForm, notes: e.target.value })}
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button
              type="submit"
              className="rounded-full bg-rose-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-800"
            >
              Enregistrer la perte
            </button>
            <button
              type="button"
              onClick={() => setPerteId(null)}
              className="rounded-full border border-line bg-white px-5 py-2.5 text-sm"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      <div className="space-y-8">
        {(
          [
            {
              id: 'utilisable' as const,
              title: 'Stock utilisable',
              hint: 'Gaz pour charge / appoint / récup. temporaire — vierge, régénéré, recyclé site, transfert / service.',
              groups: groupsUtilisable,
              empty: 'Aucune bouteille utilisable pour le moment.',
              border: 'border-emerald-200',
              head: 'border-emerald-100 bg-emerald-50/70',
              qtyLabel: 'Quantité utilisable',
            },
            {
              id: 'dechet' as const,
              title: 'Récupération déchet → traitement / destruction',
              hint: 'Fluide usagé uniquement pour BSFF / retour distributeur — jamais réinjecté en charge.',
              groups: groupsDechet,
              empty: 'Aucune bouteille de récupération.',
              border: 'border-orange-200',
              head: 'border-orange-100 bg-orange-50/80',
              qtyLabel: 'À évacuer (BSFF)',
            },
          ] as const
        ).map((cat) => (
          <div key={cat.id} className="space-y-3">
            <div>
              <h2 className="font-display text-lg font-bold text-ink">{cat.title}</h2>
              <p className="text-xs text-muted">{cat.hint}</p>
            </div>
            {cat.groups.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line bg-white px-4 py-3 text-sm text-muted">
                {cat.empty}
              </p>
            ) : (
              cat.groups.map((group) => {
          const f = findFluide(group.fluide === 'Non assigné' ? '' : group.fluide)
          return (
            <section
              key={`${cat.id}-${group.fluide}`}
              className={['overflow-hidden rounded-2xl border bg-white', cat.border].join(' ')}
            >
              <div
                className={[
                  'flex flex-wrap items-end justify-between gap-3 border-b px-4 py-3',
                  cat.head,
                ].join(' ')}
              >
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Type de gaz
                    {cat.id === 'dechet' ? ' · déchet' : ' · utilisable'}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-display text-xl font-bold text-ink">{group.fluide}</div>
                    {isFluideInflammableA2LOrA3(group.fluide) && (
                      <span
                        className="inline-flex items-center gap-1 rounded-md border-2 border-amber-700 bg-amber-400 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-amber-950 shadow-sm"
                        title="Fluide inflammable (A2L/A3)"
                      >
                        <AlertTriangle className="h-4 w-4" strokeWidth={2.75} />
                        {findFluide(group.fluide)?.classeSecurite || 'A2L'}
                      </span>
                    )}
                    {cat.id === 'dechet' && (
                      <span className="rounded-full bg-orange-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        Non utilisable
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {group.bottles.length} bouteille
                    {group.bottles.length > 1 ? 's' : ''}
                    {f ? ` · GWP ${formatGwp(f)}` : ''}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    {cat.qtyLabel}
                  </div>
                  <div className="font-display text-2xl font-bold text-ink">
                    {group.totalKg}{' '}
                    <span className="text-base font-semibold text-muted">kg</span>
                  </div>
                </div>
              </div>

              <ul className="divide-y divide-line">
                {group.bottles.map((s) => {
                  const hist = [...mouvementsForBottle(data, s.id)].sort((a, b) =>
                    (b.date || '').localeCompare(a.date || ''),
                  )
                  const openHist = expandedId === s.id
                  const badge = TYPE_BADGE[s.contenantType] || TYPE_BADGE.transfert
                  const awaitRetour = needsRetourConsigne(s)
                  const jauge = jaugeRemplissageRecup(s)
                  // Vierge / régénéré : jauge = reste / entrée (pas la capacité catalogue)
                  const entreeKg =
                    Number(s.quantiteInitialeKg) || Number(s.quantiteKg) || 0
                  const initial = contenantSansRecharge(s.contenantType)
                    ? entreeKg || Number(s.capaciteMaxKg) || 0
                    : (jauge ? jauge.maxAutoriseKg : 0) ||
                      Number(s.capaciteMaxKg) ||
                      Number(s.quantiteInitialeKg) ||
                      Number(s.quantiteKg) ||
                      0
                  const current = Number(s.quantiteKg) || 0
                  const canDestroy =
                    s.contenantType === 'recuperation' && current > 0 && !isBouteilleRetournee(s)
                  const canTransfer = !isBouteilleRetournee(s)
                  return (
                    <li key={s.id}>
                      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:px-4">
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          onClick={() => setExpandedId(openHist ? null : s.id)}
                        >
                          {openHist ? (
                            <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="min-w-0 truncate font-semibold text-ink">
                                {titreBouteilleStock(s)}
                              </span>
                              {sousTitreNumeroSerie(s) && (
                                <span className="truncate text-xs font-medium text-muted">
                                  {sousTitreNumeroSerie(s)}
                                </span>
                              )}
                              {(s.conformeA2LA3 || isFluideInflammableA2LOrA3(s.fluide)) && (
                                <span
                                  className="inline-flex shrink-0 items-center gap-1 rounded-md border-2 border-amber-700 bg-amber-400 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-950"
                                  title="Bouteille destinée aux fluides inflammables (A2L/A3)"
                                  aria-label="Avertissement : fluide inflammable A2L/A3"
                                >
                                  <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.75} />
                                  {findFluide(s.fluide)?.classeSecurite || 'A2L'}
                                </span>
                              )}
                              <span
                                className={[
                                  'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                                  badge.cls,
                                ].join(' ')}
                              >
                                {badge.label}
                              </span>
                              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-sky-900">
                                {labelEmplacement(s.emplacement || 'atelier', s.emplacementLabel)}
                              </span>
                              {s.assigneeName && (s.emplacement || 'atelier') === 'vehicule' && (
                                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-violet-950">
                                  {s.assigneeName}
                                </span>
                              )}
                              {isFluideNonAssigne(s.fluide) && s.contenantType === 'recuperation' && (
                                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-800">
                                  Non assigné
                                </span>
                              )}
                              {s.contenantType === 'recuperation' && current > 0 && (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950">
                                  BSFF seul
                                </span>
                              )}
                              {s.contenantType === 'recuperation' &&
                                s.origineDestructionDistributeur && (
                                  <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-stone-800">
                                    Non attribué / destruction
                                  </span>
                                )}
                              {s.contenantType === 'recuperation' &&
                                s.origineClientId &&
                                !s.origineDestructionDistributeur && (
                                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-violet-950">
                                    Réservé Site :{' '}
                                    {clientDisplayName(
                                      data.clients.find((c) => c.id === s.origineClientId) || {
                                        raisonSociale: 'Client',
                                        nomContact: '',
                                      },
                                    )}
                                  </span>
                                )}
                              {s.contenantType === 'recycle' && s.origineClientId && (
                                <span className="rounded-full bg-sky-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-950">
                                  Même client
                                </span>
                              )}
                              {isBouteilleReepreuveExpiree(s) && (
                                <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                                  Périmée / Échéance dépassée
                                </span>
                              )}
                              {!isBouteilleReepreuveExpiree(s) &&
                                isBouteilleReepreuveBientot(s) && (
                                  <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                                    Rééprouvage bientôt
                                  </span>
                                )}
                              {(() => {
                                const c = alerteConsigneJours(s)
                                if (!c) return null
                                return (
                                  <span
                                    className={[
                                      'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                                      c.alerte
                                        ? 'bg-violet-700 text-white'
                                        : 'bg-violet-100 text-violet-900',
                                    ].join(' ')}
                                  >
                                    {c.jours} j consigne
                                    {c.alerte ? ' !' : ''}
                                  </span>
                                )
                              })()}
                              {s.typeHuile && s.typeHuile !== 'inconnu' && (
                                <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-stone-800">
                                  {s.typeHuile}
                                </span>
                              )}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-muted">
                              {awaitRetour
                                ? 'Vide — retour consigne'
                                : contenantSansRecharge(s.contenantType) && entreeKg > 0
                                  ? `Entrée : ${roundKg(entreeKg)} kg`
                                  : initial > 0
                                    ? `Entrée : ${roundKg(
                                        Number(s.quantiteInitialeKg) || initial,
                                      )} kg`
                                    : 'Reste actuel'}
                              {hist.length > 0
                                ? ` · ${hist.length} mvt${hist.length > 1 ? 's' : ''}`
                                : ''}
                            </span>
                            <BottleLevelBar current={current} initial={initial} />
                            {jauge && (jauge.alerteBientotPleine || jauge.pleine) && (
                              <div className="mt-1.5">
                                <RecupJaugeBanner item={s} />
                              </div>
                            )}
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="font-display text-base font-bold text-ink">
                              {roundKg(current)}{' '}
                              <span className="text-xs font-semibold text-muted">kg</span>
                            </span>
                          </span>
                        </button>
                        <div className="flex shrink-0 flex-wrap items-center gap-0.5">
                          {awaitRetour && (
                            <button
                              type="button"
                              onClick={() => openRetour(s)}
                              className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-accent-hover"
                              title="Bon de retour de consigne"
                            >
                              <FileCheck2 className="h-3.5 w-3.5" />
                              Retour
                            </button>
                          )}
                          {canDestroy && (
                            <button
                              type="button"
                              onClick={() => openDestruction(s)}
                              className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-xs font-semibold text-orange-950 hover:bg-orange-100"
                              title="Évacuation BSFF / destruction"
                            >
                              BSFF
                            </button>
                          )}
                          {canTransfer && (
                            <button
                              type="button"
                              onClick={() => openTransfert(s)}
                              className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-950 hover:bg-sky-100"
                              title="Transfert interne atelier ↔ véhicule (sans CERFA)"
                            >
                              Transfert
                            </button>
                          )}
                          {current > 0 && !isBouteilleRetournee(s) && (
                            <button
                              type="button"
                              onClick={() => openPerte(s)}
                              className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-950 hover:bg-rose-100"
                              title="Déclaration perte / fuite (bilan F-Gas)"
                            >
                              Perte
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => startEdit(s)}
                            className="rounded-lg p-2 text-accent hover:bg-accent-soft"
                            title="Modifier"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('Supprimer cette bouteille et son historique ?'))
                                deleteStock(s.id)
                            }}
                            className="rounded-lg p-2 text-danger hover:bg-red-50"
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {openHist && (
                        <div className="border-t border-line bg-mist/40 px-4 py-3">
                          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                            Historique des mouvements
                          </div>
                          {hist.length === 0 ? (
                            <p className="text-sm text-muted">Aucun mouvement pour l&apos;instant.</p>
                          ) : (
                            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white text-sm">
                              {hist.map((m) => {
                                const ctx = mouvementContext(m)
                                const otLabel =
                                  m.kind === 'cerfa' || m.interventionId
                                    ? displayMouvementLabel(
                                        m.cerfaLabel || ctx?.cerfa || '',
                                      )
                                    : displayMouvementLabel(m.cerfaLabel)
                                const isCerfa = m.kind === 'cerfa' || Boolean(m.interventionId)
                                return (
                                  <li key={m.id} className="space-y-1 px-3 py-2.5">
                                    {isCerfa && otLabel ? (
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-extrabold text-emerald-900">
                                          {otLabel}
                                        </span>
                                        {m.interventionId ? (
                                          <Link
                                            to={`/app/interventions/${m.interventionId}`}
                                            className="text-xs font-semibold text-accent hover:underline"
                                          >
                                            Ouvrir CERFA →
                                          </Link>
                                        ) : null}
                                      </div>
                                    ) : null}
                                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                                      <div>
                                        {m.kind === 'retour_consigne' ? (
                                          <span className="font-semibold text-accent">
                                            Retour consigne
                                            {m.bonRetourReference
                                              ? ` · ${m.bonRetourReference}`
                                              : ''}
                                          </span>
                                        ) : m.kind === 'transfert_interne' ? (
                                          <span className="font-semibold text-sky-800">
                                            Transfert interne
                                          </span>
                                        ) : m.kind === 'perte_emission' ? (
                                          <span className="font-semibold text-rose-800">
                                            Perte / émission −{m.quantiteKg} kg
                                          </span>
                                        ) : m.kind === 'destruction' ? (
                                          <span className="font-semibold text-orange-800">
                                            Évacuation BSFF −{m.quantiteKg} kg
                                          </span>
                                        ) : (
                                          <span
                                            className={
                                              m.sens === 'sortie'
                                                ? 'font-semibold text-danger'
                                                : 'font-semibold text-emerald-700'
                                            }
                                          >
                                            {m.sens === 'sortie' ? '−' : '+'}
                                            {m.quantiteKg} kg
                                            {m.sens === 'sortie' ? ' sortis' : ' entrés'}
                                          </span>
                                        )}
                                        <span className="text-muted">
                                          {' '}
                                          · {m.date}
                                          {ctx?.client ? ` · ${ctx.client}` : ''}
                                          {ctx?.site ? ` · ${ctx.site}` : ''}
                                          {m.note ? ` · ${m.note}` : ''}
                                          {m.kind !== 'retour_consigne' &&
                                          m.kind !== 'transfert_interne'
                                            ? ` · stock ${m.quantiteAvantKg} → ${m.quantiteApresKg} kg`
                                            : ''}
                                        </span>
                                      </div>
                                      {!isCerfa && otLabel ? (
                                        <span className="font-medium text-muted">{otLabel}</span>
                                      ) : null}
                                    </div>
                                  </li>
                                )
                              })}
                            </ul>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          )
              })
            )}
          </div>
        ))}

        {retournees.length > 0 && (
          <section className="space-y-2">
            <div className="rounded-2xl border border-line bg-mist/50 px-4 py-3">
              <div className="font-display text-lg font-semibold text-ink">
                Retours de consigne (archives)
              </div>
              <p className="mt-0.5 text-xs text-muted">
                Bouteilles neuves vides retournées — conservées pour contrôle / crédit fournisseur.
              </p>
            </div>
            {retournees.map((s) => {
              const hist = mouvementsForBottle(data, s.id)
              const openHist = expandedId === s.id
              return (
                <div
                  key={s.id}
                  className="overflow-hidden rounded-2xl border border-line bg-white"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setExpandedId(openHist ? null : s.id)}
                    >
                      <div className="font-display font-semibold">
                        {labelBouteilleAffichage(s)} · {s.fluide}
                      </div>
                      <div className="mt-1 text-sm text-muted">
                        Bon {s.bonRetourConsigne}
                        {s.bonRetourDate ? ` · ${s.bonRetourDate}` : ''}
                        {s.bonRetourFournisseur ? ` · ${s.bonRetourFournisseur}` : ''}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Supprimer cette archive et son historique ?'))
                          deleteStock(s.id)
                      }}
                      className="rounded-lg p-2 text-danger hover:bg-red-50"
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {openHist && hist.length > 0 && (
                    <div className="border-t border-line bg-mist/40 px-4 py-3 text-sm">
                      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
                        {hist.map((m) => (
                          <li key={m.id} className="px-3 py-2.5 text-muted">
                            {m.kind === 'retour_consigne'
                              ? `Retour consigne ${m.bonRetourReference || ''} · ${m.date}`
                              : `${m.sens === 'sortie' ? '−' : '+'}${m.quantiteKg} kg · ${displayMouvementLabel(m.cerfaLabel)} · ${m.date}`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )
            })}
          </section>
        )}

        {data.stock.length === 0 && (
          <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-muted">
            Stock vide — ajoutez vos bouteilles (neuves ou récup).
          </p>
        )}
      </div>

      <MobileFab
        label="Ajouter"
        hidden={open || !!retourId || !!destrId || !!trfId || !!perteId}
        onClick={() => {
          setEditId(null)
          setForm(blank())
          setRegsOpen(false)
          setTechOpen(false)
          setOpen(true)
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
      />
    </div>
  )
}
