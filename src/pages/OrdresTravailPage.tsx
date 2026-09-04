import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { formatHeure } from '../lib/agenda'
import { ArrowLeft, ClipboardList, FileText, Package, Plus, Trash2, Truck } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import { SearchField, matchesQuery } from '../components/SearchField'
import { MobileFab } from '../components/MobileFab'
import { ClientSiteSignature } from '../components/ClientSiteSignature'
import { IntervenantSignature } from '../components/IntervenantSignature'
import { VoiceDictationButton } from '../components/VoiceDictationButton'
import { Cerfa3dIcon } from '../components/Cerfa3dIcon'
import { DocsPackButton, DocsPackPanel } from '../components/DocsPackPanel'
import {
  TYPE_OT_LABELS,
  STATUT_OT_LABELS,
  blankOrdreTravail,
  nextNumeroOt,
  isOtCloture,
  formatOtNumero,
  otBaseNumero,
  OT_LABEL,
  formatLienCommande,
  formatOtAvancement,
  techIdsOt,
  clampAvancementPct,
  lastVisitePresence,
  upsertVisitePresence,
  type TypeOt,
  type StatutOt,
} from '../lib/ordreTravail'
import { formatOtCommercialBadge } from '../lib/chaineCommerciale'
import { contratsActifsForClient, contratsActifsForSite } from '../lib/contratMaintenance'
import { NIVEAU_VISITE_LABELS, parseNiveauVisite } from '../lib/contratOtAuto'
import { OtCommandeLinkFields } from '../components/OtCommandeLinkFields'
import { TechnicienAssignField } from '../components/TechnicienAssignField'
import { SecteurOtSelect } from '../components/PostePersonnelSelect'
import { OtAvancementFields } from '../components/OtAvancementFields'
import { allEquipements } from '../lib/cerfaBatch'
import { dossierForUser } from '../lib/rhDocuments'
import { labelSecteurCourt, secteurOtDepuisPoste, secteursOt, secteurCouleurMembre } from '../lib/postePersonnel'
import { couleurPlanning } from '../lib/agendaPlanning'
import { AgenceFilterChips, AgenceSelect } from '../components/AgenceSelect'
import { agenceEffective, agencesDuMembre, labelAgence, matchAgenceFilter } from '../lib/agences'
import { isBureauUi } from '../lib/uiMode'
import { editionHasFeature } from '../lib/appEdition'

export function OrdresTravailPage() {
  const {
    data,
    upsertOrdreTravail,
    deleteOrdreTravail,
    genererDevisReguleDepuisOt,
    genererFactureDepuisOt,
    peutVoirIdentitesRh,
    appEdition,
  } = useStore()
  const multiTechOt = editionHasFeature(appEdition, 'multi_tech_ot')
  const chaineCommerciale = editionHasFeature(appEdition, 'chaine_commerciale')
  const { user, isOwner } = useAuth()
  const bureau = isBureauUi({ isOwner: Boolean(isOwner), peutVoirIdentitesRh })
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const editId = params.get('id') || ''
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState<'tous' | TypeOt>('tous')
  const [statutFilter, setStatutFilter] = useState<
    'ouverts' | 'attente_piece' | 'clotures' | 'tous'
  >('ouverts')
  const [assigneeFilter, setAssigneeFilter] = useState<'tous' | 'moi'>('tous')
  const [secteurFilter, setSecteurFilter] = useState<string>('tous')
  const [agenceFilter, setAgenceFilter] = useState<string[]>([])
  const [agenceFilterReady, setAgenceFilterReady] = useState(false)
  const [clientFilter, setClientFilter] = useState('')
  const [siteFilter, setSiteFilter] = useState('')

  const existing = useMemo(
    () => (data.ordresTravail || []).find((o) => o.id === editId) || null,
    [data.ordresTravail, editId],
  )

  const [form, setForm] = useState(() => {
    if (existing) {
      const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = existing
      return rest
    }
    return {
      ...blankOrdreTravail(),
      numero: nextNumeroOt(data),
      technicien: user?.signataireNom || user?.fullName || user?.email || '',
      technicienUserId: user?.id,
      technicienUserIds: user?.id ? [user.id] : [],
      clientId: params.get('client') || '',
      chantierId: params.get('chantier') || '',
      equipementId: params.get('equipement') || '',
      typeOt: (params.get('type') as TypeOt) || 'entretien',
      action: params.get('action') || '',
      signatureTechnicienImage: user?.signatureImage || '',
    }
  })

  useEffect(() => {
    if (!existing) return
    const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = existing
    setForm(rest)
  }, [existing?.id, existing?.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  // Si on ouvre un OT clôturé via ?id=, basculer le filtre pour le voir dans la liste
  useEffect(() => {
    if (existing && isOtCloture(existing.statut)) setStatutFilter('clotures')
  }, [existing?.id, existing?.statut])

  const mesAgences = useMemo(
    () =>
      agencesDuMembre({
        agenceCode: dossierForUser(data.personnelDossiers, user?.id)?.agenceCode,
        agencesCouvertes: dossierForUser(data.personnelDossiers, user?.id)
          ?.agencesCouvertes,
      }),
    [data.personnelDossiers, user?.id],
  )

  useEffect(() => {
    if (agenceFilterReady) return
    if (bureau && mesAgences.length) setAgenceFilter(mesAgences)
    setAgenceFilterReady(true)
  }, [bureau, mesAgences, agenceFilterReady])

  const agencesDispo = useMemo(() => {
    const set = new Set<string>(mesAgences)
    for (const o of data.ordresTravail || []) {
      const client = data.clients.find((c) => c.id === o.clientId)
      const site = data.chantiers.find((c) => c.id === o.chantierId)
      const ag = agenceEffective({
        agenceCode: o.agenceCode || site?.agenceCode || client?.agenceCode,
        codePostal: site?.codePostal || client?.codePostal,
      })
      if (ag) set.add(ag)
    }
    return [...set].sort()
  }, [data.ordresTravail, data.clients, data.chantiers, mesAgences])

  const list = useMemo(() => {
    return [...(data.ordresTravail || [])]
      .filter((o) => (typeFilter === 'tous' ? true : o.typeOt === typeFilter))
      .filter((o) => {
        if (statutFilter === 'tous') return true
        if (statutFilter === 'clotures') return isOtCloture(o.statut)
        if (statutFilter === 'attente_piece') return o.statut === 'en_attente_piece'
        return !isOtCloture(o.statut)
      })
      .filter((o) => {
        if (assigneeFilter !== 'moi' || !user?.id) return true
        return techIdsOt(o).includes(user.id)
      })
      .filter((o) => {
        if (secteurFilter === 'tous') return true
        const poste = dossierForUser(data.personnelDossiers, o.technicienUserId)?.poste
        const secteur = o.secteur || secteurOtDepuisPoste(poste)
        return secteur === secteurFilter
      })
      .filter((o) => {
        if (!clientFilter) return true
        return o.clientId === clientFilter
      })
      .filter((o) => {
        if (!siteFilter) return true
        return o.chantierId === siteFilter
      })
      .filter((o) => {
        const client = data.clients.find((c) => c.id === o.clientId)
        const site = data.chantiers.find((c) => c.id === o.chantierId)
        const ag = agenceEffective({
          agenceCode: o.agenceCode || site?.agenceCode || client?.agenceCode,
          codePostal: site?.codePostal || client?.codePostal,
        })
        return matchAgenceFilter(ag, agenceFilter)
      })
      .filter((o) => {
        const client = data.clients.find((c) => c.id === o.clientId)
        const site = data.chantiers.find((c) => c.id === o.chantierId)
        return matchesQuery(
          [
            o.numero,
            formatOtNumero(o.numero),
            otBaseNumero(o.numero),
            o.action,
            o.typeOt,
            TYPE_OT_LABELS[o.typeOt],
            o.technicien,
            client?.raisonSociale,
            client?.nomContact,
            client?.ville,
            site?.nom,
            site?.ville,
            site?.adresse,
            o.statut,
            STATUT_OT_LABELS[o.statut],
            o.lienCommandeRef,
            o.lienCommandeType,
            labelSecteurCourt(o.secteur),
            o.visiteNiveau,
            labelAgence(o.agenceCode || site?.agenceCode || client?.agenceCode),
            o.observations,
          ]
            .filter(Boolean)
            .join(' '),
          q,
        )
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [
    data.ordresTravail,
    data.clients,
    data.chantiers,
    data.personnelDossiers,
    q,
    typeFilter,
    statutFilter,
    assigneeFilter,
    secteurFilter,
    agenceFilter,
    clientFilter,
    siteFilter,
    user?.id,
  ])

  const countAttentePiece = useMemo(
    () => (data.ordresTravail || []).filter((o) => o.statut === 'en_attente_piece').length,
    [data.ordresTravail],
  )

  const sitesForClientFilter = useMemo(() => {
    if (!clientFilter) return data.chantiers
    return data.chantiers.filter((s) => s.clientId === clientFilter)
  }, [data.chantiers, clientFilter])

  const site = data.chantiers.find((c) => c.id === form.chantierId)
  const eqs = site ? allEquipements(site) : []
  const [clientSignNom, setClientSignNom] = useState('')
  const [clientSignQualite, setClientSignQualite] = useState('Représentant client')

  useEffect(() => {
    if (!site) return
    const client = data.clients.find((c) => c.id === site.clientId)
    setClientSignNom((n) => {
      if (n.trim() && n.trim() !== 'Signataire site') return n
      if (n === '') return n
      const fromSite = site.signatureDetenteurNom?.trim() || ''
      if (fromSite && fromSite !== 'Signataire site') return fromSite
      return client?.nomContact?.trim() || ''
    })
    setClientSignQualite((q) =>
      q && q !== 'Représentant client' ? q : site.signatureDetenteurQualite || 'Représentant client',
    )
    // Ne pas préremplir signatureClientImage — signature à chaque OT
  }, [site?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const onSave = (e: FormEvent) => {
    e.preventDefault()
    if (!form.action.trim()) {
      alert('Indiquez l’action / mission de l’OT.')
      return
    }
    const siteRow = data.chantiers.find((c) => c.id === form.chantierId)
    const clientRow = data.clients.find((c) => c.id === (form.clientId || siteRow?.clientId))
    upsertOrdreTravail({
      ...form,
      id: existing?.id,
      agenceCode:
        form.agenceCode ||
        agenceEffective({
          agenceCode: siteRow?.agenceCode || clientRow?.agenceCode,
          codePostal: siteRow?.codePostal || clientRow?.codePostal,
        }),
      signatureTechnicienImage:
        form.signatureTechnicienImage || user?.signatureImage || '',
      signatureClientImage: form.signatureClientImage || '',
    })
    navigate('/app', { replace: true })
  }

  const onValiderPresence = () => {
    if (isOtCloture(form.statut)) {
      alert('OT déjà clôturé.')
      return
    }
    if (!form.signatureTechnicienImage) {
      alert('Signature technicien requise pour valider la présence.')
      return
    }
    if (!form.signatureClientImage) {
      alert(
        'Le client doit signer pour valider sa présence, même si l’intervention n’est pas terminée.',
      )
      return
    }
    const dateJour = form.date || new Date().toISOString().slice(0, 10)
    const last = lastVisitePresence(form)
    if (
      last &&
      last.date !== dateJour &&
      last.signatureClientImage &&
      last.signatureClientImage === form.signatureClientImage
    ) {
      alert(
        'Pour valider la présence d’aujourd’hui, le client doit signer à nouveau (nouvelle signature).',
      )
      return
    }
    const pct = clampAvancementPct(form.avancementPct)
    if (pct <= 0) {
      alert('Indiquez le pourcentage d’avancement avant de valider la présence.')
      return
    }
    const visites = upsertVisitePresence(form.visitesPresence, {
      date: dateJour,
      avancementPct: pct,
      note: form.rapportAction,
      signatureClientImage: form.signatureClientImage,
      signatureTechnicienImage: form.signatureTechnicienImage,
    })
    upsertOrdreTravail({
      ...form,
      id: existing?.id,
      statut: 'en_cours',
      interventionPartielle: pct < 100,
      avancementPct: pct,
      visitesPresence: visites,
      signatureTechnicienImage: form.signatureTechnicienImage || user?.signatureImage || '',
      signatureClientImage: form.signatureClientImage || '',
    })
    navigate('/app', { replace: true })
  }

  const openNew = () => {
    navigate('/app/appel')
  }

  const showForm = !!editId || params.get('new') === '1'

  if (showForm) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/app/ot')}
            className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line bg-white px-3 text-sm font-semibold"
          >
            <ArrowLeft className="h-4 w-4" /> Liste OT
          </button>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-800">
            {form.numero ? formatOtNumero(form.numero) : OT_LABEL.newItem}
          </span>
        </div>

        <form onSubmit={onSave} className="space-y-4 rounded-2xl border border-line bg-white p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-ink">N° OT</span>
              <div className="flex h-11 overflow-hidden rounded-xl border border-line bg-white">
                <span className="grid shrink-0 place-items-center bg-emerald-50 px-2.5 text-sm font-extrabold text-emerald-800">
                  OT
                </span>
                <input
                  value={otBaseNumero(form.numero) || form.numero}
                  onChange={(e) =>
                    setForm({ ...form, numero: e.target.value.replace(/^OT\s*/i, '').trim() })
                  }
                  className="h-full min-w-0 flex-1 border-0 px-3 font-bold tracking-wide outline-none"
                  placeholder="26081702"
                />
              </div>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-ink">Date</span>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="h-11 w-full rounded-xl border border-line px-3"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-ink">Heure planning</span>
              <input
                type="time"
                value={formatHeure(form.heure)}
                onChange={(e) => setForm({ ...form, heure: e.target.value || undefined })}
                className="h-11 w-full rounded-xl border border-line px-3"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-ink">Type d’OT</span>
              <select
                value={form.typeOt}
                onChange={(e) => setForm({ ...form, typeOt: e.target.value as TypeOt })}
                className="h-11 w-full rounded-xl border border-line bg-white px-3"
              >
                {(Object.keys(TYPE_OT_LABELS) as TypeOt[]).map((t) => (
                  <option key={t} value={t}>
                    {TYPE_OT_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-ink">Site</span>
              <select
                value={form.chantierId || ''}
                onChange={(e) => {
                  const chantierId = e.target.value
                  const s = data.chantiers.find((c) => c.id === chantierId)
                  setForm({
                    ...form,
                    chantierId,
                    clientId: s?.clientId || form.clientId,
                    equipementId: '',
                    // Nouveau site = pad signature client vide (pas de réutilisation)
                    signatureClientImage: '',
                  })
                }}
                className="h-11 w-full rounded-xl border border-line bg-white px-3"
              >
                <option value="">— Choisir —</option>
                {data.chantiers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-ink">Équipement</span>
              <select
                value={form.equipementId || ''}
                onChange={(e) => setForm({ ...form, equipementId: e.target.value })}
                className="h-11 w-full rounded-xl border border-line bg-white px-3"
                disabled={!site}
              >
                <option value="">— Choisir —</option>
                {eqs.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.nom || eq.type || 'Équipement'}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {multiTechOt ? (
            <>
              <SecteurOtSelect
                required
                value={form.secteur || ''}
                onChange={(secteur) => setForm({ ...form, secteur })}
              />
              <AgenceSelect
                value={form.agenceCode}
                onChange={(agenceCode) => setForm({ ...form, agenceCode })}
              />
              <TechnicienAssignField
                multi
                highlightAgence={form.agenceCode}
                label="Techniciens (plusieurs possibles)"
                technicien={form.technicien}
                technicienUserId={form.technicienUserId}
                technicienUserIds={form.technicienUserIds}
                onChange={(next) => {
                  const poste = dossierForUser(data.personnelDossiers, next.technicienUserId)?.poste
                  const auto = secteurOtDepuisPoste(poste)
                  setForm({
                    ...form,
                    ...next,
                    secteur: form.secteur || auto,
                  })
                }}
              />
            </>
          ) : null}

          <label className="block text-sm">
            <span className="mb-1 flex items-center justify-between gap-2 font-semibold text-ink">
              <span>Action / mission *</span>
              <VoiceDictationButton
                value={form.action}
                onChange={(v) => setForm({ ...form, action: v })}
              />
            </span>
            <textarea
              required
              rows={2}
              value={form.action}
              onChange={(e) => setForm({ ...form, action: e.target.value })}
              className="w-full rounded-xl border border-line px-3 py-2"
              placeholder="Ex. Contrôle étanchéité groupe froid cuisine…"
            />
          </label>

          <OtCommandeLinkFields
            value={{ ...form, id: existing?.id }}
            contrats={
              site
                ? contratsActifsForSite(data.contratsMaintenance, site)
                : form.clientId
                  ? contratsActifsForClient(data.contratsMaintenance, form.clientId)
                  : []
            }
            devisList={(data.devis || []).filter(
              (d) => !form.clientId || d.clientId === form.clientId,
            )}
            commandes={(data.commandesFournisseur || []).filter(
              (c) => !form.clientId || !c.clientId || c.clientId === form.clientId,
            )}
            clients={data.clients}
            devisLienClient={
              data.clients.find((c) => c.id === (form.clientId || site?.clientId))?.devisLien
            }
            onChange={(patch) => setForm({ ...form, ...patch })}
            onGenererDevisRegule={() => {
              if (!existing?.id) {
                alert('Enregistrez d’abord l’OT.')
                return
              }
              try {
                const id = genererDevisReguleDepuisOt(existing.id)
                const dv = (data.devis || []).find((x) => x.id === id)
                alert(`Devis de régularisation créé${dv ? ` — ${dv.numero}` : ''}.`)
                const ot = (data.ordresTravail || []).find((o) => o.id === existing.id)
                // refresh form from store after setState — use next tick via existing effect
                if (ot) {
                  /* effect on existing.updatedAt will reload */
                }
              } catch (err) {
                alert(err instanceof Error ? err.message : 'Impossible de créer le devis.')
              }
            }}
            onGenererFacture={() => {
              if (!existing?.id) {
                alert('Enregistrez d’abord l’OT.')
                return
              }
              try {
                const id = genererFactureDepuisOt(existing.id)
                alert(`Facture créée — id ${id.slice(0, 8)}…`)
              } catch (err) {
                alert(err instanceof Error ? err.message : 'Impossible de créer la facture.')
              }
            }}
            onCreerCommandePiece={() => {
              if (!existing?.id) {
                alert('Enregistrez d’abord l’OT.')
                return
              }
              const qs = new URLSearchParams({
                new: '1',
                ot: existing.id,
              })
              if (form.clientId) qs.set('client', form.clientId)
              if (form.chantierId) qs.set('chantier', form.chantierId)
              navigate(`/app/commandes?${qs.toString()}`)
            }}
          />

          <label className="block text-sm">
            <span className="mb-1 flex items-center justify-between gap-2 font-semibold text-ink">
              <span>Rapport d’action</span>
              <VoiceDictationButton
                value={form.rapportAction}
                onChange={(v) => setForm({ ...form, rapportAction: v })}
              />
            </span>
            <textarea
              rows={4}
              value={form.rapportAction}
              onChange={(e) => setForm({ ...form, rapportAction: e.target.value })}
              className="w-full rounded-xl border border-line px-3 py-2"
              placeholder="Ce qui a été fait sur place…"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 flex items-center justify-between gap-2 font-semibold text-ink">
              <span>Observations</span>
              <VoiceDictationButton
                value={form.observations}
                onChange={(v) => setForm({ ...form, observations: v })}
              />
            </span>
            <textarea
              rows={3}
              value={form.observations}
              onChange={(e) => setForm({ ...form, observations: e.target.value })}
              className="w-full rounded-xl border border-line px-3 py-2"
              placeholder="Remarques, réserves, pièces à commander…"
            />
          </label>

          <OtAvancementFields
            form={form}
            disabled={isOtCloture(form.statut)}
            onChange={(patch) => setForm({ ...form, ...patch })}
          />

          <label className="block text-sm sm:w-56">
            <span className="mb-1 block font-semibold text-ink">Statut</span>
            <select
              value={form.statut}
              onChange={(e) => setForm({ ...form, statut: e.target.value as StatutOt })}
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            >
              {(Object.keys(STATUT_OT_LABELS) as StatutOt[]).map((s) => (
                <option key={s} value={s}>
                  {STATUT_OT_LABELS[s]}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-4">
            <IntervenantSignature
              label="Signature technicien"
              nom={form.technicien}
              qualite="Opérateur attesté"
              image={form.signatureTechnicienImage || ''}
              onNomChange={(v) => setForm({ ...form, technicien: v })}
              onQualiteChange={() => {}}
              onImageChange={(v) => setForm({ ...form, signatureTechnicienImage: v })}
              height={140}
            />
            <ClientSiteSignature
              siteId={form.chantierId || undefined}
              otId={existing?.id}
              nom={clientSignNom}
              qualite={clientSignQualite}
              image={form.signatureClientImage || ''}
              onNomChange={setClientSignNom}
              onQualiteChange={setClientSignQualite}
              onImageChange={(v) => setForm({ ...form, signatureClientImage: v })}
              height={140}
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="submit"
              className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#0f766e] px-5 text-sm font-bold text-white"
            >
              Enregistrer l’OT
            </button>
            {!isOtCloture(form.statut) && (
              <button
                type="button"
                onClick={onValiderPresence}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-amber-400 bg-amber-50 px-4 text-sm font-bold text-amber-950"
              >
                Valider la présence du jour
              </button>
            )}
            {form.chantierId && (
              <Link
                to={`/app/interventions/new?chantier=${encodeURIComponent(form.chantierId)}${
                  form.equipementId
                    ? `&equipement=${encodeURIComponent(form.equipementId)}`
                    : ''
                }&ot=${encodeURIComponent(existing?.id || '')}&numero=${encodeURIComponent(form.numero)}`}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold"
              >
                + CERFA lié
              </Link>
            )}
            {form.chantierId && (
              <Link
                to={`/app/fiche-maintenance-clim?chantier=${encodeURIComponent(form.chantierId)}${
                  form.equipementId
                    ? `&equipement=${encodeURIComponent(form.equipementId)}`
                    : ''
                }&numero=${encodeURIComponent(form.numero)}`}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold"
              >
                + Fiche checklist (optionnel)
              </Link>
            )}
          </div>

          {existing ? (
            <div className="pt-2">
              <DocsPackPanel ot={existing} />
            </div>
          ) : null}
        </form>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Cerfa3dIcon size={52} float delay="0.1s" className="shrink-0" />
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-bold tracking-tight">{OT_LABEL.title}</h1>
            <p className="mt-0.5 text-sm font-medium text-accent">{OT_LABEL.alsoCalled}</p>
            <p className="mt-1 text-sm text-muted">{OT_LABEL.hint}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="hidden min-h-12 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-ink hover:bg-accent-hover md:inline-flex"
        >
          <Plus className="h-4 w-4" /> Client appelle
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        <SearchField
          value={q}
          onChange={setQ}
          placeholder="N° OT, client, site, ville, tech, action…"
          testId="ot-search"
        />
        <select
          value={clientFilter}
          onChange={(e) => {
            setClientFilter(e.target.value)
            setSiteFilter('')
          }}
          className="h-12 w-full rounded-xl border border-line bg-white px-3 text-base sm:w-auto md:h-11 md:text-sm"
        >
          <option value="">Tous les clients</option>
          {[...data.clients]
            .sort((a, b) => a.raisonSociale.localeCompare(b.raisonSociale, 'fr'))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.raisonSociale}
              </option>
            ))}
        </select>
        <select
          value={siteFilter}
          onChange={(e) => setSiteFilter(e.target.value)}
          className="h-12 w-full rounded-xl border border-line bg-white px-3 text-base sm:w-auto md:h-11 md:text-sm"
        >
          <option value="">Tous les sites</option>
          {[...sitesForClientFilter]
            .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.nom}
              </option>
            ))}
        </select>
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value as typeof assigneeFilter)}
          className="h-12 w-full rounded-xl border border-line bg-white px-3 text-base sm:w-auto md:h-11 md:text-sm"
        >
          <option value="tous">Toute l’équipe</option>
          <option value="moi">Mes OT (affectés à moi)</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
          className="h-12 w-full rounded-xl border border-line bg-white px-3 text-base sm:w-auto md:h-11 md:text-sm"
        >
          <option value="tous">Tous les types</option>
          {(Object.keys(TYPE_OT_LABELS) as TypeOt[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_OT_LABELS[t]}
            </option>
          ))}
        </select>
        {multiTechOt ? (
          <select
            value={secteurFilter}
            onChange={(e) => setSecteurFilter(e.target.value)}
            className="h-12 w-full rounded-xl border border-line bg-white px-3 text-base sm:w-auto md:h-11 md:text-sm"
          >
            <option value="tous">Tous les métiers</option>
            {secteursOt().map((s) => (
              <option key={s.id} value={s.id}>
                {labelSecteurCourt(s.id)}
              </option>
            ))}
          </select>
        ) : null}
        {multiTechOt ? (
          <AgenceFilterChips
            selected={agenceFilter}
            onChange={setAgenceFilter}
            codes={agencesDispo}
          />
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'ouverts' as const, label: 'Ouverts' },
            {
              id: 'attente_piece' as const,
              label: countAttentePiece
                ? `Attente pièce (${countAttentePiece})`
                : 'Attente pièce',
            },
            { id: 'clotures' as const, label: 'Clôturés' },
            { id: 'tous' as const, label: 'Tous' },
          ] as const
        ).map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setStatutFilter(chip.id)}
            className={[
              'rounded-full border px-3 py-1.5 text-xs font-bold',
              statutFilter === chip.id
                ? chip.id === 'attente_piece'
                  ? 'border-sky-500 bg-sky-100 text-sky-950'
                  : 'border-accent bg-accent/20 text-ink'
                : 'border-line bg-white text-muted',
            ].join(' ')}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3">
        {list.map((o) => {
          const client = data.clients.find((c) => c.id === o.clientId)
          const siteRow = data.chantiers.find((c) => c.id === o.chantierId)
          const cloture = isOtCloture(o.statut)
          const poste = dossierForUser(data.personnelDossiers, o.technicienUserId)?.poste
          const secteur =
            o.secteur ||
            secteurOtDepuisPoste(poste) ||
            secteurCouleurMembre({ poste })
          const col = couleurPlanning({ secteur, technicienUserId: o.technicienUserId })
          const agence = agenceEffective({
            agenceCode: o.agenceCode || siteRow?.agenceCode || client?.agenceCode,
            codePostal: siteRow?.codePostal || client?.codePostal,
          })
          const commandeLiee = (data.commandesFournisseur || []).find((c) => c.otId === o.id)
          const devisLies = (data.devis || []).filter(
            (d) => d.id === o.devisId || d.otOrigineId === o.id,
          )
          const devisAccepte = devisLies.find(
            (d) => d.statut === 'accepte' || d.statut === 'execute',
          )
          const attentePiece = o.statut === 'en_attente_piece'
          const qsCommercial = new URLSearchParams()
          if (o.clientId) qsCommercial.set('client', o.clientId)
          if (o.chantierId) qsCommercial.set('chantier', o.chantierId)
          qsCommercial.set('ot', o.id)
          return (
            <div
              key={o.id}
              className={[
                'rounded-2xl border p-4 shadow-sm',
                cloture ? `${col.border} opacity-80` : `${col.border} ${col.bg}`,
              ].join(' ')}
            >
              <Link to={`/app/ot?id=${encodeURIComponent(o.id)}`} className="block min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${col.badge}`}>
                    {formatOtNumero(o.numero)}
                  </span>
                  <span className="font-display text-base font-semibold">
                    {TYPE_OT_LABELS[o.typeOt]}
                  </span>
                  <span
                    className={[
                      'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                      cloture
                        ? 'bg-emerald-100 text-emerald-900'
                        : attentePiece
                          ? 'bg-sky-100 text-sky-950'
                          : o.statut === 'en_deplacement'
                            ? 'bg-violet-100 text-violet-950'
                            : 'bg-mist text-muted',
                    ].join(' ')}
                  >
                    {STATUT_OT_LABELS[o.statut]}
                  </span>
                  {o.ticketClient ? (
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-900">
                      Ticket client
                      {o.localisationClient ? ` · ${o.localisationClient}` : ''}
                    </span>
                  ) : null}
                  {formatOtAvancement(o) ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-950">
                      Partiel {formatOtAvancement(o)}
                    </span>
                  ) : null}
                  {parseNiveauVisite(o.visiteNiveau) ? (
                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase text-ink">
                      {NIVEAU_VISITE_LABELS[parseNiveauVisite(o.visiteNiveau)!]}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-ink">{o.action || '—'}</p>
                {(formatOtCommercialBadge(o) || formatLienCommande(o)) ? (
                  <p className="mt-1 text-xs font-semibold text-emerald-800">
                    {formatOtCommercialBadge(o) || formatLienCommande(o)}
                  </p>
                ) : null}
                <p className="mt-0.5 text-xs text-muted">
                  {siteRow?.nom || '—'} · {client?.raisonSociale || '—'} · {o.date}
                  {o.heure ? ` ${o.heure.slice(0, 5)}` : ''}
                  {labelSecteurCourt(secteur) ? ` · ${labelSecteurCourt(secteur)}` : ''}
                  {agence ? ` · ${labelAgence(agence)}` : ''}
                  {o.technicien ? ` · ${o.technicien}` : ''}
                </p>
              </Link>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                {cloture ? (
                  <Link
                    to={`/app/appel?ot=${encodeURIComponent(o.id)}`}
                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-3 text-xs font-semibold text-muted sm:flex-none"
                    title="Uniquement si erreur à corriger"
                  >
                    Modifier (erreur)
                  </Link>
                ) : (
                  <Link
                    to={`/app/appel?ot=${encodeURIComponent(o.id)}`}
                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-900 sm:flex-none"
                  >
                    <ClipboardList className="h-4 w-4" /> Reprendre parcours
                  </Link>
                )}
                {chaineCommerciale && attentePiece && !devisAccepte ? (
                  <Link
                    to={`/app/devis?new=1&${qsCommercial.toString()}`}
                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-sky-300 bg-sky-50 px-3 text-xs font-bold text-sky-950 sm:flex-none"
                  >
                    <FileText className="h-4 w-4" /> Créer devis
                  </Link>
                ) : null}
                {chaineCommerciale &&
                devisAccepte &&
                (!commandeLiee || commandeLiee.statut === 'annulee') ? (
                  <Link
                    to={`/app/commandes?new=1&${qsCommercial.toString()}`}
                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 text-xs font-bold text-amber-950 sm:flex-none"
                  >
                    <Truck className="h-4 w-4" /> Lancer commande
                  </Link>
                ) : null}
                {chaineCommerciale && commandeLiee && commandeLiee.statut !== 'annulee' ? (
                  <Link
                    to={`/app/commandes?id=${encodeURIComponent(commandeLiee.id)}`}
                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-3 text-xs font-semibold sm:flex-none"
                  >
                    <Package className="h-4 w-4" /> Voir commande
                  </Link>
                ) : null}
                <DocsPackButton ot={o} className="flex-1 sm:flex-none" />
                <Link
                  to={`/app/ot?id=${encodeURIComponent(o.id)}`}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line px-3 text-xs font-semibold sm:flex-none"
                >
                  {cloture ? 'Voir' : 'Ouvrir'}
                </Link>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const label = formatOtNumero(o.numero)
                    if (
                      !window.confirm(
                        `Supprimer ${label} ?\n\nL’OT sera effacé définitivement (sync PC ↔ téléphone).`,
                      )
                    ) {
                      return
                    }
                    deleteOrdreTravail(o.id)
                  }}
                  aria-label={`Supprimer ${formatOtNumero(o.numero)}`}
                  title="Supprimer cet OT"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          )
        })}
        {list.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line bg-white px-4 py-10 text-center text-sm text-muted">
            {statutFilter === 'clotures'
              ? 'Aucun OT / demande clôturé pour l’instant.'
              : statutFilter === 'attente_piece'
                ? 'Aucun OT en attente de pièce.'
              : statutFilter === 'ouverts'
                ? 'Aucun OT / demande ouvert. Créez-en un depuis Sites & Parc ou « Client appelle ».'
                : 'Aucun OT / demande. Créez-en un depuis Sites & Parc ou ici.'}
          </div>
        )}
      </div>

      <MobileFab label="Client appelle" onClick={openNew} />
    </div>
  )
}
