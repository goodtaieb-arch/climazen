import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ClipboardList, FileCheck2, Plus, Pencil, RefreshCw, Trash2, Wrench } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import type { Chantier, Equipement, NatureIntervention, TypeTravaux } from '../lib/types'
import {
  equipAvecFluideFrigorigene,
  NATURE_LABELS,
  siteAvecFluideFrigorigene,
  TYPE_TRAVAUX_LABELS,
} from '../lib/types'
import { Field, Header } from './ClientsPage'
import { DecimalField } from '../components/DecimalField'
import { FluideSelect } from '../components/FluideSelect'
import { PlaquePhotoButton } from '../components/PlaquePhotoButton'
import { SearchField, matchesQuery } from '../components/SearchField'
import { SmartSuggestField, type SmartSuggestion } from '../components/SmartSuggestField'
import { calcTeqCO2FromFluide, findFluide, formatGwp } from '../lib/fluides'
import type { PlaqueFields } from '../lib/plaqueOcr'
import { equipementsForCerfa, equipmentLabel, allEquipements, syncEquipementsFromFlat } from '../lib/cerfaBatch'
import { buildCerfaPdf } from '../lib/cerfaPdf'
import { saveCerfaPdf } from '../lib/pdfStore'

const blankEquip = (avecFluide = true): Equipement => ({
  id: crypto.randomUUID(),
  nom: '',
  type: '',
  marque: '',
  modele: '',
  numeroSerie: '',
  avecFluideFrigorigene: avecFluide,
  fluideType: avecFluide ? 'R-448A' : '',
  chargeNominaleKg: 0,
  teqCO2: 0,
  detectionPermanente: false,
})

const blank = (clientId = ''): Omit<Chantier, 'id' | 'createdAt'> => ({
  clientId,
  nom: '',
  adresse: '',
  codePostal: '',
  ville: '',
  typeTravaux: 'installation',
  detailTravaux: '',
  avecFluideFrigorigene: true,
  equipementType: '',
  equipementMarque: '',
  equipementModele: '',
  equipementNumeroSerie: '',
  fluideType: 'R-448A',
  chargeNominaleKg: 0,
  teqCO2: 0,
  detectionPermanente: false,
  statut: 'actif',
  notes: '',
  equipements: [blankEquip(true)],
})

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function ChantiersPage() {
  const { data, upsertChantier, deleteChantier, validateMaintenanceCerfas, upsertIntervention } =
    useStore()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState(() => blank(data.clients[0]?.id || ''))
  const [editId, setEditId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [equipIdx, setEquipIdx] = useState(0)
  const [equipFilter, setEquipFilter] = useState('')
  const [clientQuery, setClientQuery] = useState(() => {
    const c = data.clients.find((cl) => cl.id === data.clients[0]?.id)
    return c?.raisonSociale || ''
  })
  const [batchBusy, setBatchBusy] = useState<string | null>(null)
  const [picker, setPicker] = useState<{
    site: Chantier
    mode: 'maintenance' | 'intervention'
    selected: string[]
    nature: 'maintenance' | 'depanage' | 'controle'
    filter: string
  } | null>(null)
  const [equipWork, setEquipWork] = useState<{
    site: Chantier
    equipementId: string
    natures: NatureIntervention[]
  } | null>(null)

  const ALL_NATURES = Object.keys(NATURE_LABELS) as NatureIntervention[]

  const equipements = form.equipements?.length ? form.equipements : syncEquipementsFromFlat(form)
  const currentEquip = equipements[Math.min(equipIdx, equipements.length - 1)] || blankEquip()
  const currentAvecFluide = equipAvecFluideFrigorigene(currentEquip)

  const closeForm = () => {
    setOpen(false)
    setEditId(null)
    setPicker(null)
    setEquipWork(null)
    setEquipFilter('')
  }

  // Clic menu Travaux (même page) → revenir à la liste
  useEffect(() => {
    const st = location.state as { travauxList?: number } | null
    if (st?.travauxList) closeForm()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state])

  const clientSuggestions: SmartSuggestion[] = useMemo(
    () =>
      data.clients.map((c) => ({
        id: c.id,
        label: c.raisonSociale,
        hint: [c.ville, c.codePostal].filter(Boolean).join(' · ') || undefined,
      })),
    [data.clients],
  )

  const siteSuggestions: SmartSuggestion[] = useMemo(() => {
    const sites = data.chantiers.filter((c) => !form.clientId || c.clientId === form.clientId)
    const seen = new Set<string>()
    const out: SmartSuggestion[] = []
    for (const s of sites) {
      const key = s.nom.trim().toLowerCase()
      if (!key || seen.has(key)) continue
      seen.add(key)
      out.push({
        id: s.id,
        label: s.nom,
        hint: [s.ville, s.adresse].filter(Boolean).join(' · ') || undefined,
      })
    }
    return out
  }, [data.chantiers, form.clientId])

  const equipSuggestions: SmartSuggestion[] = useMemo(() => {
    const seen = new Set<string>()
    const out: SmartSuggestion[] = []
    for (const site of data.chantiers) {
      if (form.clientId && site.clientId !== form.clientId) continue
      for (const eq of allEquipements(site)) {
        const label = (eq.nom || eq.type || '').trim()
        if (!label) continue
        const key = label.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        out.push({
          id: `${site.id}:${eq.id}`,
          label,
          hint: [eq.type && eq.nom !== eq.type ? eq.type : null, eq.marque, eq.modele, eq.fluideType]
            .filter(Boolean)
            .join(' · ') || undefined,
        })
      }
    }
    return out
  }, [data.chantiers, form.clientId])

  const filteredEquipIndices = useMemo(() => {
    if (!equipFilter.trim()) return equipements.map((_, i) => i)
    return equipements
      .map((eq, i) => ({ eq, i }))
      .filter(({ eq }) =>
        matchesQuery(
          [eq.nom, eq.type, eq.marque, eq.modele, eq.fluideType, eq.numeroSerie]
            .filter(Boolean)
            .join(' '),
          equipFilter,
        ),
      )
      .map(({ i }) => i)
  }, [equipements, equipFilter])

  const openPicker = (site: Chantier, mode: 'maintenance' | 'intervention') => {
    const eqs = equipementsForCerfa(site)
    setPicker({
      site,
      mode,
      selected: mode === 'maintenance' ? eqs.map((e) => e.id) : eqs[0] ? [eqs[0].id] : [],
      nature:
        mode === 'maintenance'
          ? 'maintenance'
          : site.typeTravaux === 'controle_etancheite'
            ? 'controle'
            : 'depanage',
      filter: '',
    })
  }

  const naturesForPicker = (nature: 'maintenance' | 'depanage' | 'controle'): NatureIntervention[] => {
    if (nature === 'depanage') return ['entretien_reparation']
    if (nature === 'controle') return ['controle_etancheite_periodique']
    return ['entretien_reparation', 'controle_etancheite_periodique']
  }

  const onConfirmPicker = async () => {
    if (!picker || !user) return
    const eqs = equipementsForCerfa(picker.site)
    const selected = picker.selected.filter((id) => eqs.some((e) => e.id === id))
    if (selected.length === 0) {
      alert('Cochez au moins un équipement.')
      return
    }

    if (picker.mode === 'intervention') {
      const eqId = selected[0]
      setPicker(null)
      setEquipWork({
        site: picker.site,
        equipementId: eqId,
        natures: naturesForPicker(picker.nature),
      })
      return
    }

    if (!user.signatureImage) {
      alert('Enregistrez d’abord votre signature dans « Ma signature ».')
      return
    }

    setBatchBusy(picker.site.id)
    try {
      const { drafts, site: s, client } = validateMaintenanceCerfas({
        siteId: picker.site.id,
        dateIntervention: today(),
        signataireNom: user.signataireNom || user.fullName || '',
        signataireQualite: user.signataireQualite || 'Opérateur attesté',
        signatureOperateurImage: user.signatureImage,
        userId: user.id,
        userName: user.fullName || user.email,
        equipementIds: selected,
        natures: naturesForPicker(picker.nature),
      })
      setPicker(null)
      for (const draft of drafts) {
        const blob = await buildCerfaPdf({ draft, client, chantier: s })
        const fileName = `CERFA-15497-04-${draft.dateIntervention}-${draft.id.slice(0, 8)}.pdf`
        await saveCerfaPdf(draft.id, blob, fileName, user.organizationId)
        upsertIntervention({
          ...draft,
          hasCerfaPdf: true,
          cerfaPdfFileName: fileName,
          cerfaPdfSavedAt: new Date().toISOString(),
        })
      }
      alert(
        `${drafts.length} CERFA généré${drafts.length > 1 ? 's' : ''} pour les équipements choisis.`,
      )
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Génération impossible')
    } finally {
      setBatchBusy(null)
    }
  }

  const filteredChantiers = useMemo(() => {
    return data.chantiers.filter((c) => {
      const client = data.clients.find((cl) => cl.id === c.clientId)
      const typeLabel = c.typeTravaux ? TYPE_TRAVAUX_LABELS[c.typeTravaux] : ''
      const eqNames = (c.equipements || []).map((e) => e.nom).join(' ')
      return matchesQuery(
        [
          c.nom,
          c.ville,
          c.fluideType,
          c.equipementMarque,
          c.equipementModele,
          client?.raisonSociale,
          typeLabel,
          c.detailTravaux,
          c.createdByName,
          eqNames,
          siteAvecFluideFrigorigene(c) ? 'fluide cerfa' : 'standard vmc',
        ]
          .filter(Boolean)
          .join(' '),
        q,
      )
    })
  }, [data.chantiers, data.clients, q])

  useEffect(() => {
    if (!open || !currentAvecFluide) return
    const teq = calcTeqCO2FromFluide(Number(form.chargeNominaleKg) || 0, form.fluideType)
    if (teq === null) return
    if (form.teqCO2 === teq) return
    setForm((f) => ({ ...f, teqCO2: teq }))
  }, [form.fluideType, form.chargeNominaleKg, open, currentAvecFluide]) // eslint-disable-line react-hooks/exhaustive-deps

  const patchCurrentEquip = (patch: Partial<Equipement>) => {
    const list = [...equipements]
    const i = Math.min(equipIdx, list.length - 1)
    const nextEq = { ...list[i], ...patch }
    if (patch.fluideType != null || patch.chargeNominaleKg != null) {
      const teq = calcTeqCO2FromFluide(
        Number(nextEq.chargeNominaleKg) || 0,
        nextEq.fluideType,
      )
      if (teq != null) nextEq.teqCO2 = teq
    }
    if (patch.avecFluideFrigorigene === false) {
      nextEq.fluideType = ''
      nextEq.chargeNominaleKg = 0
      nextEq.teqCO2 = 0
      nextEq.detectionPermanente = false
    }
    if (patch.avecFluideFrigorigene === true && !nextEq.fluideType) {
      nextEq.fluideType = 'R-448A'
    }
    list[i] = nextEq
    const siteFluide = list.some((e) => equipAvecFluideFrigorigene(e))
    setForm({
      ...form,
      equipements: list,
      avecFluideFrigorigene: siteFluide,
      equipementType: nextEq.type,
      equipementMarque: nextEq.marque,
      equipementModele: nextEq.modele,
      equipementNumeroSerie: nextEq.numeroSerie,
      fluideType: nextEq.fluideType,
      chargeNominaleKg: nextEq.chargeNominaleKg,
      teqCO2: nextEq.teqCO2,
      detectionPermanente: nextEq.detectionPermanente,
    })
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.clientId) {
      alert('Choisissez un client dans la liste de suggestions.')
      return
    }
    const list = (form.equipements?.length ? form.equipements : syncEquipementsFromFlat(form)).map(
      (eq) => {
        const fluide = equipAvecFluideFrigorigene(eq)
        return {
          ...eq,
          avecFluideFrigorigene: fluide,
          fluideType: fluide ? eq.fluideType || form.fluideType || 'R-448A' : '',
          chargeNominaleKg: fluide ? Number(eq.chargeNominaleKg) || 0 : 0,
          teqCO2: fluide
            ? eq.teqCO2 ??
              calcTeqCO2FromFluide(Number(eq.chargeNominaleKg) || 0, eq.fluideType || form.fluideType) ??
              undefined
            : undefined,
          detectionPermanente: fluide ? !!eq.detectionPermanente : false,
        }
      },
    )
    if (list.length === 0) {
      alert('Ajoutez au moins un équipement.')
      return
    }
    const siteFluide = list.some((e) => equipAvecFluideFrigorigene(e))
    const primary = list.find((e) => equipAvecFluideFrigorigene(e)) || list[0]
    upsertChantier({
      ...form,
      avecFluideFrigorigene: siteFluide,
      equipements: list,
      equipementType: primary?.type || form.equipementType,
      equipementMarque: primary?.marque || form.equipementMarque,
      equipementModele: primary?.modele || form.equipementModele,
      equipementNumeroSerie: primary?.numeroSerie || form.equipementNumeroSerie,
      chargeNominaleKg: siteFluide ? Number(primary?.chargeNominaleKg || form.chargeNominaleKg) || 0 : 0,
      teqCO2: siteFluide ? primary?.teqCO2 ?? form.teqCO2 : undefined,
      fluideType: siteFluide ? primary?.fluideType || form.fluideType : '',
      detectionPermanente: siteFluide
        ? !!(primary?.detectionPermanente ?? form.detectionPermanente)
        : false,
      detailTravaux: form.detailTravaux?.trim() || '',
      id: editId ?? undefined,
      createdByUserId: editId ? form.createdByUserId : user?.id,
      createdByName: editId
        ? form.createdByName
        : user?.fullName || user?.email || user?.username,
    })
    setOpen(false)
    setEditId(null)
    setEquipIdx(0)
  }

  const startEdit = (c: Chantier) => {
    setEditId(c.id)
    const eqs =
      c.equipements?.length && c.equipements.length > 0
        ? c.equipements
        : syncEquipementsFromFlat(c, c.equipements)
    const client = data.clients.find((cl) => cl.id === c.clientId)
    setClientQuery(client?.raisonSociale || '')
    setEquipFilter('')
    setForm({
      ...blank(c.clientId),
      ...c,
      typeTravaux: c.typeTravaux || 'installation',
      detailTravaux: c.detailTravaux || '',
      avecFluideFrigorigene: siteAvecFluideFrigorigene(c),
      equipements: eqs,
      adresse: c.adresse || client?.adresse || '',
      codePostal: c.codePostal || client?.codePostal || '',
      ville: c.ville || client?.ville || '',
    })
    setEquipIdx(0)
    setOpen(true)
  }

  const fluideMeta = findFluide(form.fluideType)

  const applyPlaque = (fields: PlaqueFields) => {
    patchCurrentEquip({
      type: fields.equipementType || currentEquip.type,
      marque: fields.equipementMarque || currentEquip.marque,
      modele: fields.equipementModele || currentEquip.modele,
      numeroSerie: fields.equipementNumeroSerie || currentEquip.numeroSerie,
      nom: fields.equipementType || currentEquip.nom,
      ...(fields.fluideType ? { fluideType: fields.fluideType } : {}),
      ...(fields.chargeNominaleKg != null && fields.chargeNominaleKg > 0
        ? { chargeNominaleKg: fields.chargeNominaleKg }
        : {}),
    })
  }

  const startEditEquip = (site: Chantier, equipementId: string) => {
    const eqs =
      site.equipements?.length && site.equipements.length > 0
        ? site.equipements
        : syncEquipementsFromFlat(site, site.equipements)
    const idx = Math.max(
      0,
      eqs.findIndex((e) => e.id === equipementId),
    )
    const eq = eqs[idx] || eqs[0]
    const client = data.clients.find((cl) => cl.id === site.clientId)
    setEditId(site.id)
    setClientQuery(client?.raisonSociale || '')
    setEquipFilter('')
    setForm({
      ...blank(site.clientId),
      ...site,
      typeTravaux: site.typeTravaux || 'installation',
      detailTravaux: site.detailTravaux || '',
      avecFluideFrigorigene: siteAvecFluideFrigorigene(site),
      equipements: eqs,
      equipementType: eq?.type || '',
      equipementMarque: eq?.marque || '',
      equipementModele: eq?.modele || '',
      equipementNumeroSerie: eq?.numeroSerie || '',
      fluideType: eq?.fluideType || site.fluideType,
      chargeNominaleKg: eq?.chargeNominaleKg ?? site.chargeNominaleKg,
      teqCO2: eq?.teqCO2 ?? site.teqCO2,
      detectionPermanente: eq?.detectionPermanente ?? site.detectionPermanente,
    })
    setEquipIdx(idx)
    setPicker(null)
    setOpen(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const removeEquipement = (site: Chantier, equipementId: string) => {
    const eqs =
      site.equipements?.length && site.equipements.length > 0
        ? site.equipements
        : syncEquipementsFromFlat(site, site.equipements)
    const target = eqs.find((e) => e.id === equipementId)
    const label = target?.nom?.trim() || (target ? equipmentLabel(target) : 'cet équipement')
    if (
      !confirm(
        `Retirer « ${label} » du site ?\n(matériel changé, hors contrat, ou plus présent)`,
      )
    ) {
      return
    }
    const next = eqs.filter((e) => e.id !== equipementId)
    if (next.length === 0) {
      alert('Il faut au moins un équipement sur le site.')
      return
    }
    upsertChantier({
      ...site,
      equipements: next,
      avecFluideFrigorigene: next.some((e) => equipAvecFluideFrigorigene(e)),
      id: site.id,
    })
    if (picker?.site.id === site.id) {
      setPicker({
        ...picker,
        site: {
          ...site,
          equipements: next,
          avecFluideFrigorigene: next.some((e) => equipAvecFluideFrigorigene(e)),
        },
        selected: picker.selected.filter((id) => id !== equipementId),
      })
    }
  }

  const fillAdresseFromClient = (
    clientId: string,
    base: Omit<Chantier, 'id' | 'createdAt'> | typeof form,
  ) => {
    const client = data.clients.find((c) => c.id === clientId)
    if (!client) return { ...base, clientId }
    return {
      ...base,
      clientId,
      adresse: client.adresse || base.adresse || '',
      codePostal: client.codePostal || base.codePostal || '',
      ville: client.ville || base.ville || '',
    }
  }

  const openNew = () => {
    setEditId(null)
    setEquipIdx(0)
    setEquipFilter('')
    const clientId = data.clients[0]?.id || ''
    const client = data.clients.find((c) => c.id === clientId)
    setClientQuery(client?.raisonSociale || '')
    setForm(fillAdresseFromClient(clientId, blank(clientId)))
    setOpen(true)
  }

  const addEquipementToSite = (site: Chantier) => {
    const eqs =
      site.equipements?.length && site.equipements.length > 0
        ? site.equipements
        : syncEquipementsFromFlat(site, site.equipements)
    const next = blankEquip(true)
    const list = [...eqs, next]
    const client = data.clients.find((c) => c.id === site.clientId)
    setEditId(site.id)
    setClientQuery(client?.raisonSociale || '')
    setEquipFilter('')
    setForm({
      ...blank(site.clientId),
      ...site,
      typeTravaux: site.typeTravaux || 'installation',
      detailTravaux: site.detailTravaux || '',
      avecFluideFrigorigene: true,
      equipements: list,
      equipementType: next.type,
      equipementMarque: next.marque,
      equipementModele: next.modele,
      equipementNumeroSerie: next.numeroSerie,
      fluideType: next.fluideType,
      chargeNominaleKg: next.chargeNominaleKg,
      teqCO2: next.teqCO2,
      detectionPermanente: next.detectionPermanente,
    })
    setEquipIdx(list.length - 1)
    setPicker(null)
    setOpen(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-6">
      <Header
        title="Travaux / équipements"
        subtitle="Choisissez le(s) équipement(s) déjà enregistrés — maintenance partielle ou dépannage ciblé."
        onAdd={openNew}
      />

      {!open && (
      <SearchField
        value={q}
        onChange={setQ}
        placeholder="Rechercher des travaux, client, fluide…"
        testId="chantiers-search"
      />
      )}

      {open && (
        <form
          onSubmit={onSubmit}
          className="grid gap-3 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2"
        >
          {editId && (
            <p className="sm:col-span-2 rounded-xl border border-accent/40 bg-accent-soft/50 px-3 py-2 text-xs text-slate">
              Site déjà enregistré — adresse et infos reprises. Ajoutez ou modifiez seulement les
              équipements.
            </p>
          )}
          <SmartSuggestField
            label="Client / détenteur *"
            value={clientQuery}
            onChange={(v) => {
              setClientQuery(v)
              const exact = data.clients.find(
                (c) => c.raisonSociale.trim().toLowerCase() === v.trim().toLowerCase(),
              )
              if (exact) setForm(fillAdresseFromClient(exact.id, form))
              else if (form.clientId) setForm({ ...form, clientId: '' })
            }}
            onPick={(s) => {
              setClientQuery(s.label)
              setForm(fillAdresseFromClient(s.id, form))
            }}
            suggestions={clientSuggestions}
            required
            showWhenEmpty
            placeholder="Tapez pour chercher un client…"
            className="sm:col-span-2"
            inputMode="search"
          />
          {/* Keep HTML5 required without native select */}
          <input type="hidden" required value={form.clientId} readOnly />
          <SmartSuggestField
            label="Nom des travaux / site *"
            value={form.nom}
            onChange={(v) => setForm({ ...form, nom: v })}
            onPick={(s) => {
              const site = data.chantiers.find((c) => c.id === s.id)
              if (!site) {
                setForm({ ...form, nom: s.label })
                return
              }
              // Création : reprendre adresse du site connu sans écraser un edit en cours
              if (editId) {
                setForm({ ...form, nom: s.label })
                return
              }
              setForm({
                ...form,
                nom: site.nom,
                adresse: site.adresse || form.adresse,
                codePostal: site.codePostal || form.codePostal,
                ville: site.ville || form.ville,
                typeTravaux: site.typeTravaux || form.typeTravaux,
                detailTravaux: form.detailTravaux || site.detailTravaux || '',
              })
            }}
            suggestions={siteSuggestions}
            required
            showWhenEmpty
            placeholder="Ex. EHPAD sud, hypermarché Nice…"
            className="sm:col-span-2"
            inputMode="search"
          />
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Type de travaux *</span>
            <select
              required
              value={form.typeTravaux || 'installation'}
              onChange={(e) =>
                setForm({ ...form, typeTravaux: e.target.value as TypeTravaux })
              }
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            >
              {(Object.keys(TYPE_TRAVAUX_LABELS) as TypeTravaux[]).map((key) => (
                <option key={key} value={key}>
                  {TYPE_TRAVAUX_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Précision des travaux"
            value={form.detailTravaux || ''}
            onChange={(v) => setForm({ ...form, detailTravaux: v })}
          />
          <p className="-mt-1 text-xs text-muted sm:col-span-2">
            Ex. maintenance semestrielle, installation clim bureau directeur, pose VMC…
          </p>
          <Field
            label="Adresse"
            value={form.adresse}
            onChange={(v) => setForm({ ...form, adresse: v })}
            className="sm:col-span-2"
          />
          <Field
            label="Code postal"
            value={form.codePostal}
            onChange={(v) => setForm({ ...form, codePostal: v })}
          />
          <Field label="Ville" value={form.ville} onChange={(v) => setForm({ ...form, ville: v })} />

          <div className="sm:col-span-2 mt-1 border-t border-line pt-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink">
                Équipements enregistrés
                {equipements.length > 0 ? (
                  <span className="ml-2 font-normal text-muted">
                    {filteredEquipIndices.length === equipements.length
                      ? `${equipements.length}`
                      : `${filteredEquipIndices.length} / ${equipements.length}`}
                  </span>
                ) : null}
              </p>
              <button
                type="button"
                onClick={() => {
                  const next = blankEquip(true)
                  const list = [...equipements, next]
                  setForm({ ...form, equipements: list, avecFluideFrigorigene: true })
                  setEquipIdx(list.length - 1)
                  setEquipFilter('')
                }}
                className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-mist"
              >
                <Plus className="h-3.5 w-3.5" /> Ajouter un équipement
              </button>
            </div>
            {equipements.length > 5 && (
              <div className="mb-3">
                <SearchField
                  value={equipFilter}
                  onChange={setEquipFilter}
                  placeholder="Filtrer les équipements (nom, marque, fluide…)"
                  testId="equipements-filter"
                />
              </div>
            )}
            {equipements.length > 1 && (
              <div className="mb-3 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                {filteredEquipIndices.map((i) => {
                  const eq = equipements[i]
                  return (
                    <button
                      key={eq.id}
                      type="button"
                      onClick={() => {
                        setEquipIdx(i)
                        setForm({
                          ...form,
                          equipementType: eq.type,
                          equipementMarque: eq.marque,
                          equipementModele: eq.modele,
                          equipementNumeroSerie: eq.numeroSerie,
                          fluideType: eq.fluideType,
                          chargeNominaleKg: eq.chargeNominaleKg,
                          teqCO2: eq.teqCO2,
                          detectionPermanente: eq.detectionPermanente,
                        })
                      }}
                      className={[
                        'rounded-full px-3 py-1 text-xs font-semibold',
                        i === equipIdx
                          ? 'bg-accent text-ink'
                          : 'border border-line text-muted hover:bg-mist',
                      ].join(' ')}
                    >
                      {eq.nom || eq.type || `Équipement ${i + 1}`}
                      {equipAvecFluideFrigorigene(eq) ? '' : ' · standard'}
                    </button>
                  )
                })}
                {filteredEquipIndices.length === 0 && (
                  <p className="text-xs text-muted">Aucun équipement pour ce filtre.</p>
                )}
              </div>
            )}
            <PlaquePhotoButton onParsed={applyPlaque} />
          </div>

          <label className="flex items-center gap-3 sm:col-span-2">
            <input
              type="checkbox"
              checked={currentAvecFluide}
              onChange={(e) => patchCurrentEquip({ avecFluideFrigorigene: e.target.checked })}
              className="h-5 w-5 shrink-0 rounded border-2 border-slate-300 accent-accent"
            />
            <span className="text-sm font-medium text-ink">
              Contient du fluide frigorigène
              <span className="mt-0.5 block text-xs font-normal text-muted">
                Case cochée = CERFA / stock gaz pour cet équipement. Décochée = matériel standard
                (ex. VMC).
              </span>
            </span>
          </label>

          <SmartSuggestField
            label="Nom / libellé équipement *"
            value={currentEquip.nom || ''}
            onChange={(v) => patchCurrentEquip({ nom: v, type: currentEquip.type || v })}
            onPick={(s) => {
              // Reprendre type/marque/modèle d’un équipement déjà connu (nouvel id)
              const [siteId, eqId] = s.id.split(':')
              const site = data.chantiers.find((c) => c.id === siteId)
              const src = site ? allEquipements(site).find((e) => e.id === eqId) : undefined
              if (!src) {
                patchCurrentEquip({ nom: s.label, type: currentEquip.type || s.label })
                return
              }
              patchCurrentEquip({
                nom: src.nom || s.label,
                type: src.type || src.nom || s.label,
                marque: src.marque || currentEquip.marque,
                modele: src.modele || currentEquip.modele,
                avecFluideFrigorigene: src.avecFluideFrigorigene,
                fluideType: src.fluideType || currentEquip.fluideType,
                chargeNominaleKg: src.chargeNominaleKg || currentEquip.chargeNominaleKg,
                teqCO2: src.teqCO2 ?? currentEquip.teqCO2,
                detectionPermanente: src.detectionPermanente,
              })
            }}
            suggestions={equipSuggestions}
            required
            showWhenEmpty
            placeholder="Ex. Chambre froide 1 — suggestions auto"
            className="sm:col-span-2"
            inputMode="search"
            limit={12}
          />
          <p className="-mt-1 text-xs text-muted sm:col-span-2">
            Tapez pour suggérer des libellés déjà utilisés. Ex. « Chambre froide rayon frais », « Clim
            bureau 2 ».
          </p>
          <Field
            label={currentAvecFluide ? 'Type d’équipement' : 'Équipement / matériel'}
            value={form.equipementType}
            onChange={(v) => patchCurrentEquip({ type: v, nom: currentEquip.nom || v })}
          />
          <Field
            label="Marque"
            value={form.equipementMarque}
            onChange={(v) => patchCurrentEquip({ marque: v })}
          />
          <Field
            label="Modèle"
            value={form.equipementModele}
            onChange={(v) => patchCurrentEquip({ modele: v })}
          />
          <Field
            label="N° série"
            value={form.equipementNumeroSerie}
            onChange={(v) => patchCurrentEquip({ numeroSerie: v })}
          />
          {equipements.length > 1 && (
            <button
              type="button"
              onClick={() => {
                if (equipements.length <= 1) return
                if (!confirm('Retirer cet équipement du site ?')) return
                const list = equipements.filter((_, i) => i !== equipIdx)
                const nextIdx = Math.max(0, equipIdx - 1)
                const eq = list[nextIdx]
                setEquipIdx(nextIdx)
                setForm({
                  ...form,
                  equipements: list,
                  avecFluideFrigorigene: list.some((e) => equipAvecFluideFrigorigene(e)),
                  equipementType: eq.type,
                  equipementMarque: eq.marque,
                  equipementModele: eq.modele,
                  equipementNumeroSerie: eq.numeroSerie,
                  fluideType: eq.fluideType,
                  chargeNominaleKg: eq.chargeNominaleKg,
                  teqCO2: eq.teqCO2,
                  detectionPermanente: eq.detectionPermanente,
                })
              }}
              className="text-left text-xs font-semibold text-danger hover:underline sm:col-span-2"
            >
              Retirer cet équipement de la liste
            </button>
          )}

          {currentAvecFluide ? (
            <>
              <div className="sm:col-span-2 mt-1 border-t border-line pt-3">
                <p className="text-sm font-semibold text-ink">Données fluide / CERFA</p>
                <p className="text-xs text-muted">
                  Saisis une fois — réutilisés à chaque maintenance / CERFA.
                </p>
              </div>
              <FluideSelect
                label="Fluide"
                value={form.fluideType}
                onChange={(v) => patchCurrentEquip({ fluideType: v })}
                required
              />
              <DecimalField
                label="Charge nominale (kg)"
                value={form.chargeNominaleKg}
                onChange={(n) => patchCurrentEquip({ chargeNominaleKg: n })}
                placeholder="ex. 2,2"
              />
              <DecimalField
                label="teq CO₂ (auto)"
                value={form.teqCO2 ?? 0}
                onChange={(n) => patchCurrentEquip({ teqCO2: n })}
                placeholder="auto"
              />
              <p className="-mt-1 text-xs text-muted sm:col-span-2">
                kg × GWP ÷ 1000
                {fluideMeta ? ` (${form.chargeNominaleKg || 0} × ${formatGwp(fluideMeta)})` : ''}
              </p>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.detectionPermanente}
                  onChange={(e) => patchCurrentEquip({ detectionPermanente: e.target.checked })}
                />
                Système permanent de détection des fuites (cadre [6])
              </label>
            </>
          ) : (
            <div className="sm:col-span-2 rounded-xl border border-dashed border-line bg-foam px-4 py-3 text-sm text-muted">
              Équipement standard : pas de CERFA ni de suivi fluide pour celui-ci.
            </div>
          )}

          <div className="flex gap-2 sm:col-span-2">
            <button
              type="submit"
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink hover:bg-accent-hover"
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-full border border-line px-5 py-2.5 text-sm"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {!open && (
      <div className="grid gap-3">
        {filteredChantiers.map((c) => {
          const client = data.clients.find((x) => x.id === c.clientId)
          const fluide = siteAvecFluideFrigorigene(c)
          const eqs = allEquipements(c)
          const eqsCerfa = equipementsForCerfa(c)
          const canBatch = eqsCerfa.length > 0

          return (
            <div key={c.id} className="rounded-2xl border border-line bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-display text-lg font-semibold">{c.nom}</div>
                    <span
                      className={[
                        'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                        fluide ? 'bg-accent-soft text-slate' : 'bg-mist text-muted',
                      ].join(' ')}
                    >
                      {fluide ? 'Fluide / CERFA' : 'Travaux standard'}
                    </span>
                  </div>
                  <div className="text-sm text-muted">
                    {client?.raisonSociale} · {c.ville}
                    {c.createdByName ? ` · par ${c.createdByName}` : ''}
                  </div>
                  {c.detailTravaux ? (
                    <p className="mt-1 text-sm text-muted">{c.detailTravaux}</p>
                  ) : null}
                  <div className="mt-3">
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                      Équipements — toucher pour choisir le type d’intervention
                    </p>
                    {eqs.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-line bg-foam/50 px-3 py-2.5 text-xs text-muted">
                        Aucun équipement encore. Ouvrez le crayon pour en ajouter.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {eqs.map((eq) => {
                          const eqFluide = equipAvecFluideFrigorigene(eq)
                          return (
                            <li
                              key={eq.id}
                              className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-foam/50 px-3 py-2.5"
                            >
                              <button
                                type="button"
                                disabled={!eqFluide}
                                onClick={() => {
                                  if (!eqFluide) return
                                  setEquipWork({
                                    site: c,
                                    equipementId: eq.id,
                                    natures: ['entretien_reparation'],
                                  })
                                }}
                                className="grid h-5 w-5 shrink-0 place-items-center rounded border-2 border-slate-300 bg-white disabled:opacity-40"
                                title={
                                  eqFluide
                                    ? 'Choisir le type d’intervention / CERFA'
                                    : 'Équipement standard — pas de CERFA'
                                }
                                aria-label="Choisir intervention"
                              />
                              <button
                                type="button"
                                disabled={!eqFluide}
                                onClick={() => {
                                  if (!eqFluide) return
                                  setEquipWork({
                                    site: c,
                                    equipementId: eq.id,
                                    natures: ['entretien_reparation'],
                                  })
                                }}
                                className="min-w-0 flex-1 text-left disabled:opacity-70"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-semibold text-ink">
                                    {eq.nom?.trim() || eq.type || 'Sans libellé'}
                                  </span>
                                  <span
                                    className={[
                                      'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                      eqFluide ? 'bg-accent-soft text-slate' : 'bg-mist text-muted',
                                    ].join(' ')}
                                  >
                                    {eqFluide ? 'Fluide' : 'Standard'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-muted">
                                  {[
                                    eq.type && eq.nom ? eq.type : null,
                                    eq.marque,
                                    eq.modele,
                                    eqFluide ? eq.fluideType : null,
                                    eq.numeroSerie ? `SN ${eq.numeroSerie}` : '',
                                  ]
                                    .filter(Boolean)
                                    .join(' · ') || '—'}
                                </div>
                              </button>
                              <button
                                type="button"
                                onClick={() => startEditEquip(c, eq.id)}
                                className="rounded-full border border-accent bg-accent-soft px-3 py-1.5 text-xs font-semibold text-slate hover:bg-accent"
                              >
                                Modifier
                              </button>
                              <button
                                type="button"
                                onClick={() => removeEquipement(c, eq.id)}
                                className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-danger hover:bg-red-50"
                              >
                                Supprimer
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  navigate(
                                    `/app/fiche-maintenance-clim?chantier=${encodeURIComponent(c.id)}&equipement=${encodeURIComponent(eq.id)}`,
                                  )
                                }
                                className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-mist"
                                title="Checklist maintenance climatisation / PAC"
                              >
                                Fiche clim
                              </button>
                              {eqFluide && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEquipWork({
                                      site: c,
                                      equipementId: eq.id,
                                      natures: ['entretien_reparation'],
                                    })
                                  }
                                  className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-ink hover:bg-accent-hover"
                                >
                                  Intervention
                                </button>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                  {c.derniereMaintenanceDate && (
                    <p className="mt-1.5 text-xs text-accent">
                      Dernière maintenance validée : {c.derniereMaintenanceDate}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {canBatch && (
                    <button
                      type="button"
                      disabled={batchBusy === c.id}
                      onClick={() => openPicker(c, 'maintenance')}
                      className="inline-flex items-center gap-1.5 rounded-full border border-accent bg-accent-soft px-3.5 py-2 text-xs font-semibold text-slate hover:bg-accent disabled:opacity-60"
                      title="Choisir les équipements traités aujourd’hui"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      {batchBusy === c.id ? 'Génération…' : 'Valider maintenance'}
                    </button>
                  )}
                  {fluide ? (
                    <button
                      type="button"
                      onClick={() => openPicker(c, 'intervention')}
                      className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-2 text-xs font-semibold text-ink hover:bg-accent-hover"
                    >
                      <FileCheck2 className="h-3.5 w-3.5" />
                      CERFA sur un équipement
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-foam px-3.5 py-2 text-xs font-medium text-muted">
                      <Wrench className="h-3.5 w-3.5" />
                      Info travaux
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => addEquipementToSite(c)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-2 text-xs font-semibold text-ink hover:bg-mist"
                    title="Ajouter un équipement sur ce site (sans ressaisir l’adresse)"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Ajouter équipement
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(c)}
                    className="rounded-lg p-2 text-accent hover:bg-accent-soft"
                    title="Modifier les travaux"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Supprimer ces travaux ?')) deleteChantier(c.id)
                    }}
                    className="rounded-lg p-2 text-danger hover:bg-red-50"
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
        {filteredChantiers.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-muted">
            {data.chantiers.length === 0
              ? 'Aucun travaux enregistré. Créez d’abord un client, puis des travaux.'
              : 'Aucun résultat pour cette recherche.'}
          </div>
        )}
      </div>
      )}

      {picker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-white p-5 shadow-xl">
            <h2 className="font-display text-lg font-semibold">
              {picker.mode === 'maintenance'
                ? 'Quels équipements avez-vous traités ?'
                : 'Quel équipement pour ce CERFA ?'}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {picker.site.nom} — équipements déjà enregistrés, sans resaisie.
            </p>

            {picker.mode === 'intervention' && (
              <div className="mt-3">
                <p className="mb-2 text-xs font-semibold text-muted">Type d’intervention (prérempli sur le CERFA)</p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ['depanage', 'Entretien / réparation'],
                      ['controle', 'Contrôle étanchéité'],
                      ['maintenance', 'Maintenance + contrôle'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPicker({ ...picker, nature: id })}
                      className={[
                        'rounded-full px-3 py-1.5 text-xs font-semibold',
                        picker.nature === id
                          ? 'bg-accent text-ink'
                          : 'border border-line text-muted hover:bg-mist',
                      ].join(' ')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted">
                  Ou ouvrez l’équipement pour choisir démantèlement, charge, récupération…
                </p>
              </div>
            )}

            {picker.mode === 'maintenance' && (
              <div className="mt-3 flex flex-wrap gap-2">
                {(
                  [
                    ['maintenance', 'Maintenance'],
                    ['depanage', 'Dépannage'],
                    ['controle', 'Contrôle étanchéité'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPicker({ ...picker, nature: id })}
                    className={[
                      'rounded-full px-3 py-1.5 text-xs font-semibold',
                      picker.nature === id
                        ? 'bg-accent text-ink'
                        : 'border border-line text-muted hover:bg-mist',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {equipementsForCerfa(picker.site).length > 5 && (
              <div className="mt-3">
                <SearchField
                  value={picker.filter}
                  onChange={(v) => setPicker({ ...picker, filter: v })}
                  placeholder="Filtrer les équipements…"
                  testId="picker-equip-filter"
                />
              </div>
            )}

            <ul className="mt-4 space-y-2">
              {equipementsForCerfa(picker.site)
                .filter((eq) =>
                  matchesQuery(
                    [eq.nom, eq.type, eq.marque, eq.modele, eq.fluideType, eq.numeroSerie]
                      .filter(Boolean)
                      .join(' '),
                    picker.filter,
                  ),
                )
                .map((eq) => {
                const checked = picker.selected.includes(eq.id)
                const libelle = eq.nom?.trim() || eq.type || 'Sans libellé'
                return (
                  <li
                    key={eq.id}
                    className={[
                      'rounded-xl border px-3 py-3 transition',
                      checked ? 'border-accent bg-accent-soft/40' : 'border-line bg-white',
                    ].join(' ')}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (picker.mode === 'intervention') {
                            setPicker({ ...picker, selected: [eq.id] })
                            return
                          }
                          setPicker({
                            ...picker,
                            selected: checked
                              ? picker.selected.filter((id) => id !== eq.id)
                              : [...picker.selected, eq.id],
                          })
                        }}
                        className={[
                          'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded border-2',
                          checked
                            ? 'border-accent bg-accent text-ink'
                            : 'border-slate-300 bg-white',
                        ].join(' ')}
                        aria-pressed={checked}
                        aria-label={checked ? `Désélectionner ${libelle}` : `Sélectionner ${libelle}`}
                      >
                        {checked ? (
                          <span className="text-sm font-bold leading-none">✓</span>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => {
                          if (picker.mode === 'intervention') {
                            setPicker({ ...picker, selected: [eq.id] })
                            return
                          }
                          setPicker({
                            ...picker,
                            selected: checked
                              ? picker.selected.filter((id) => id !== eq.id)
                              : [...picker.selected, eq.id],
                          })
                        }}
                      >
                        <span className="block text-sm font-semibold text-ink">{libelle}</span>
                        <span className="mt-0.5 block text-xs text-muted">
                          {[eq.type && eq.nom ? eq.type : null, eq.marque, eq.modele, eq.fluideType, eq.chargeNominaleKg ? `${eq.chargeNominaleKg} kg` : '', eq.numeroSerie ? `SN ${eq.numeroSerie}` : '']
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </span>
                      </button>
                      <div className="flex shrink-0 flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => startEditEquip(picker.site, eq.id)}
                          className="rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-accent hover:bg-mist"
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => removeEquipement(picker.site, eq.id)}
                          className="rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-danger hover:bg-red-50"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>

            {picker.mode === 'maintenance' && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  className="font-semibold text-accent hover:underline"
                  onClick={() =>
                    setPicker({
                      ...picker,
                      selected: equipementsForCerfa(picker.site).map((e) => e.id),
                    })
                  }
                >
                  Tout cocher
                </button>
                <button
                  type="button"
                  className="font-semibold text-muted hover:underline"
                  onClick={() => setPicker({ ...picker, selected: [] })}
                >
                  Tout décocher
                </button>
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={batchBusy === picker.site.id}
                onClick={() => void onConfirmPicker()}
                className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink hover:bg-accent-hover disabled:opacity-60"
              >
                {picker.mode === 'maintenance'
                  ? `Générer ${picker.selected.length || 0} CERFA`
                  : 'Choisir le type d’intervention'}
              </button>
              <button
                type="button"
                onClick={() => setPicker(null)}
                className="rounded-full border border-line px-5 py-2.5 text-sm"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {equipWork && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-white p-5 shadow-xl">
            <h2 className="font-display text-lg font-semibold">Type d’intervention</h2>
            <p className="mt-1 text-sm text-muted">
              {equipWork.site.nom} —{' '}
              {allEquipements(equipWork.site).find((e) => e.id === equipWork.equipementId)?.nom ||
                'équipement'}
              . Cochez la nature des travaux (cadre CERFA [4]).
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {ALL_NATURES.map((n) => {
                const on = equipWork.natures.includes(n)
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setEquipWork({
                        ...equipWork,
                        natures: on
                          ? equipWork.natures.filter((x) => x !== n)
                          : [...equipWork.natures, n],
                      })
                    }}
                    className={[
                      'rounded-full px-3 py-1.5 text-xs font-semibold',
                      on ? 'bg-accent text-ink' : 'border border-line text-muted hover:bg-mist',
                    ].join(' ')}
                  >
                    {NATURE_LABELS[n]}
                  </button>
                )
              })}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={equipWork.natures.length === 0}
                onClick={() => {
                  const natures = encodeURIComponent(equipWork.natures.join(','))
                  const url = `/app/interventions/new?chantier=${encodeURIComponent(equipWork.site.id)}&equipement=${encodeURIComponent(equipWork.equipementId)}&natures=${natures}`
                  setEquipWork(null)
                  navigate(url)
                }}
                className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink hover:bg-accent-hover disabled:opacity-60"
              >
                Ouvrir le CERFA
              </button>
              <button
                type="button"
                onClick={() => {
                  const url = `/app/fiche-maintenance-clim?chantier=${encodeURIComponent(equipWork.site.id)}&equipement=${encodeURIComponent(equipWork.equipementId)}`
                  setEquipWork(null)
                  navigate(url)
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-line px-5 py-2.5 text-sm font-semibold hover:bg-mist"
              >
                <ClipboardList className="h-4 w-4" />
                Fiche maintenance clim
              </button>
              <button
                type="button"
                onClick={() => setEquipWork(null)}
                className="rounded-full border border-line px-5 py-2.5 text-sm"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
