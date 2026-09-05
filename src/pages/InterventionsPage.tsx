import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckSquare,
  Download,
  Eye,
  FileArchive,
  FileCheck2,
  Loader2,
  Mail,
  Pencil,
  Share2,
  Square,
  Trash2,
  X,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import { createPdfObjectUrl } from '../lib/cerfaPdf'
import { loadCerfaPdf, pdfCtxFromData } from '../lib/pdfStore'
import { PdfViewerModal } from '../components/PdfViewerModal'
import { SearchField, matchesQuery } from '../components/SearchField'
import { MobileFab } from '../components/MobileFab'
import { Cerfa3dIcon } from '../components/Cerfa3dIcon'
import { cerfaLabelFor, type CerfaDraft } from '../lib/types'
import { isOtCloture, otBaseNumero, sameOtNumero, formatOtNumero } from '../lib/ordreTravail'
import { findEquipement } from '../lib/migrate'
import {
  annuelMailtoForPack,
  collectCerfaAnnuelPack,
  downloadDocsPack,
  packAnnuelZipFileName,
  shareDocsPack,
  type PackDoc,
} from '../lib/docsPack'

export function InterventionsPage() {
  const { data, deleteIntervention, upsertIntervention } = useStore()
  const { user } = useAuth()
  const [viewer, setViewer] = useState<{ url: string; title: string } | null>(null)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<'tous' | 'brouillon' | 'signe' | 'envoye'>('tous')
  const currentYear = new Date().getFullYear()
  const [yearFilter, setYearFilter] = useState<number | 'tous'>(currentYear)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [packOpen, setPackOpen] = useState(false)
  const [packDocs, setPackDocs] = useState<PackDoc[]>([])
  const [packLoading, setPackLoading] = useState(false)
  const [packBusy, setPackBusy] = useState<'save' | 'send' | null>(null)
  const [includeRapport, setIncludeRapport] = useState(true)
  const [packHint, setPackHint] = useState('')
  const [packError, setPackError] = useState('')

  const effectiveStatus = (i: CerfaDraft) => {
    if (i.status === 'envoye') return 'envoye' as const
    if (i.status === 'signe') return 'signe' as const
    const ot = (data.ordresTravail || []).find(
      (o) =>
        o.id === i.ordreTravailId ||
        sameOtNumero(o.numero, i.numeroIntervention),
    )
    if (ot && isOtCloture(ot.statut) && (i.hasCerfaPdf || i.signatureOperateurImage)) {
      return 'signe' as const
    }
    return i.status
  }

  const yearOptions = useMemo(() => {
    const years = new Set<number>()
    for (const i of data.interventions) {
      const y = Number((i.dateIntervention || '').slice(0, 4))
      if (y >= 2000 && y <= 2100) years.add(y)
    }
    years.add(currentYear)
    return [...years].sort((a, b) => b - a)
  }, [data.interventions, currentYear])

  const filtered = useMemo(() => {
    return [...data.interventions]
      .filter((i) => (statusFilter === 'tous' ? true : effectiveStatus(i) === statusFilter))
      .filter((i) => {
        if (yearFilter === 'tous') return true
        return (i.dateIntervention || '').startsWith(String(yearFilter))
      })
      .filter((i) => {
        const client = data.clients.find((c) => c.id === i.clientId)
        const chantier = data.chantiers.find((c) => c.id === i.chantierId)
        return matchesQuery(
          [
            chantier?.nom,
            client?.raisonSociale,
            i.fluideType,
            i.dateIntervention,
            i.status,
            i.createdByName,
            i.numeroIntervention,
            cerfaLabelFor(i),
          ]
            .filter(Boolean)
            .join(' '),
          q,
        )
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [
    data.interventions,
    data.ordresTravail,
    data.clients,
    data.chantiers,
    q,
    statusFilter,
    yearFilter,
  ])

  // Nettoyer la sélection quand le filtre change
  useEffect(() => {
    const visible = new Set(filtered.map((i) => i.id))
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => visible.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [filtered])

  const selectedDrafts = useMemo(
    () => filtered.filter((i) => selectedIds.has(i.id)),
    [filtered, selectedIds],
  )

  const selectableIds = useMemo(
    () => filtered.filter((i) => i.hasCerfaPdf || i.signatureOperateurImage || i.status !== 'brouillon').map((i) => i.id),
    [filtered],
  )

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllVisible = () => {
    if (selectableIds.length === 0) return
    const allOn = selectableIds.every((id) => selectedIds.has(id))
    if (allOn) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const id of selectableIds) next.delete(id)
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const id of selectableIds) next.add(id)
        return next
      })
    }
  }

  const openCerfa = async (id: string, label: string) => {
    const pdf = await loadCerfaPdf(id, user?.organizationId, pdfCtxFromData(data))
    if (!pdf) {
      alert('CERFA pas encore généré — ouvrez la fiche et enregistrez : le PDF s’ouvre depuis l’app (coffre hors site).')
      return
    }
    if (viewer?.url) URL.revokeObjectURL(viewer.url)
    setViewer({
      url: createPdfObjectUrl(pdf.blob),
      title: `CERFA — ${label}`,
    })
  }

  const packYear =
    yearFilter === 'tous'
      ? currentYear
      : yearFilter

  const zipName = packAnnuelZipFileName(
    packYear,
    data.operateur?.raisonSociale || user?.organizationId || '',
  )

  const openPack = async () => {
    if (selectedDrafts.length === 0) {
      alert('Sélectionnez au moins un CERFA pour le lot annuel.')
      return
    }
    setPackOpen(true)
    setPackLoading(true)
    setPackError('')
    setPackHint('')
    try {
      const docs = await collectCerfaAnnuelPack({
        drafts: selectedDrafts,
        data,
        organizationId: user?.organizationId,
        year: packYear,
        includeRapportAnnuel: includeRapport,
      })
      setPackDocs(docs)
      if (docs.length === 0) {
        setPackError(
          'Aucun PDF prêt. Ouvrez chaque CERFA et générez-le avant l’envoi annuel.',
        )
      }
    } catch (err) {
      console.error(err)
      setPackError('Impossible de préparer le lot annuel.')
    } finally {
      setPackLoading(false)
    }
  }

  // Recharger le pack si on bascule le rapport annuel
  useEffect(() => {
    if (!packOpen || selectedDrafts.length === 0) return
    let cancelled = false
    setPackLoading(true)
    void collectCerfaAnnuelPack({
      drafts: selectedDrafts,
      data,
      organizationId: user?.organizationId,
      year: packYear,
      includeRapportAnnuel: includeRapport,
    })
      .then((docs) => {
        if (!cancelled) setPackDocs(docs)
      })
      .finally(() => {
        if (!cancelled) setPackLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeRapport])

  const markEnvoyes = () => {
    for (const d of selectedDrafts) {
      upsertIntervention({ ...d, status: 'envoye' })
    }
  }

  const onSavePack = async () => {
    if (packDocs.length === 0) return
    setPackBusy('save')
    setPackError('')
    try {
      await downloadDocsPack(packDocs, zipName)
      markEnvoyes()
      setPackHint(
        packDocs.length === 1
          ? 'PDF enregistré — CERFA marqués « Envoyé ».'
          : `ZIP enregistré (${packDocs.length} docs) — CERFA marqués « Envoyé ».`,
      )
    } catch (err) {
      console.error(err)
      setPackError('Échec de l’enregistrement.')
    } finally {
      setPackBusy(null)
    }
  }

  const onSendPack = async () => {
    if (packDocs.length === 0) return
    setPackBusy('send')
    setPackError('')
    setPackHint('')
    try {
      const shareResult = await shareDocsPack({
        docs: packDocs,
        title: `Lot annuel CERFA ${packYear}`,
        text: `ClimaZEN — lot annuel ${packYear} pour contrôle / attestation`,
        zipName,
      })
      if (shareResult === 'shared') {
        markEnvoyes()
        setPackHint('Partage ouvert — CERFA marqués « Envoyé ».')
        return
      }
      if (shareResult === 'cancelled') {
        setPackHint('Partage annulé.')
        return
      }
      await downloadDocsPack(packDocs, zipName)
      markEnvoyes()
      const mail = annuelMailtoForPack({
        email: data.operateur?.email,
        year: packYear,
        docCount: packDocs.length,
        zipName,
        orgName: data.operateur?.raisonSociale,
      })
      if (mail) {
        window.location.href = mail
        setPackHint(
          'ZIP téléchargé + e-mail ouvert. Joignez le fichier (le navigateur ne peut pas attacher automatiquement). CERFA marqués « Envoyé ».',
        )
      } else {
        setPackHint(
          'ZIP téléchargé. Ajoutez l’e-mail société (Entreprise) pour ouvrir Mail, ou joignez le ZIP manuellement. CERFA marqués « Envoyé ».',
        )
      }
    } catch (err) {
      console.error(err)
      setPackError('Échec de l’envoi.')
    } finally {
      setPackBusy(null)
    }
  }

  const allSelectableOn =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id))

  return (
    <div className="space-y-6 pb-28">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Cerfa3dIcon size={56} float delay="0.2s" className="shrink-0" />
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-bold tracking-tight">CERFA / Interventions</h1>
            <p className="mt-1 text-muted">
              Historique pour le bureau de contrôle — sélectionnez les CERFA d’une année et envoyez
              le lot annuel.
            </p>
          </div>
        </div>
        <Link
          to="/app/interventions/new"
          className="hidden min-h-12 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-ink hover:bg-accent-hover md:inline-flex"
        >
          Nouvelle fiche
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchField
          value={q}
          onChange={setQ}
          placeholder="Rechercher chantier, client, fluide…"
          testId="interventions-search"
        />
        <select
          value={yearFilter === 'tous' ? 'tous' : String(yearFilter)}
          onChange={(e) => {
            const v = e.target.value
            setYearFilter(v === 'tous' ? 'tous' : Number(v))
          }}
          className="h-12 w-full rounded-xl border border-line bg-white px-3 text-base sm:w-auto md:h-11 md:text-sm"
          aria-label="Année"
        >
          <option value="tous">Toutes les années</option>
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              Année {y}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="h-12 w-full rounded-xl border border-line bg-white px-3 text-base sm:w-auto md:h-11 md:text-sm"
        >
          <option value="tous">Tous les statuts</option>
          <option value="brouillon">Brouillons</option>
          <option value="signe">Signés</option>
          <option value="envoye">Envoyés</option>
        </select>
      </div>

      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleAllVisible}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent"
          >
            {allSelectableOn ? (
              <CheckSquare className="h-3.5 w-3.5" />
            ) : (
              <Square className="h-3.5 w-3.5" />
            )}
            {allSelectableOn ? 'Tout désélectionner' : 'Tout sélectionner (filtre)'}
          </button>
          <span className="text-xs text-muted">
            {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
          </span>
        </div>
      )}

      <div className="grid gap-3">
        {filtered.map((i) => {
          const client = data.clients.find((c) => c.id === i.clientId)
          const chantier = data.chantiers.find((c) => c.id === i.chantierId)
          const label = chantier?.nom || 'Intervention'
          const st = effectiveStatus(i)
          const otNum = otBaseNumero(i.numeroIntervention)
          const eq = findEquipement(chantier, i.equipementId)
          const eqLabel = eq?.nom || eq?.type || eq?.numeroSerie || ''
          const on = selectedIds.has(i.id)
          return (
            <div
              key={i.id}
              className={[
                'rounded-2xl border bg-white p-4 shadow-sm',
                on ? 'border-accent/50 bg-accent-soft/20' : 'border-[#E5E7EB]',
              ].join(' ')}
            >
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => toggleOne(i.id)}
                  className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                  aria-pressed={on}
                  title={on ? 'Retirer du lot annuel' : 'Ajouter au lot annuel'}
                >
                  {on ? (
                    <CheckSquare className="h-5 w-5 text-accent" />
                  ) : (
                    <Square className="h-5 w-5 text-muted" />
                  )}
                </button>
                <Link to={`/app/interventions/${i.id}`} className="min-w-0 flex-1 hover:text-accent">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-display text-base font-semibold">{label}</div>
                    {otNum ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                        {formatOtNumero(otNum)}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-sm text-muted">
                    {client?.raisonSociale || '—'}
                    {eqLabel ? ` · ${eqLabel}` : ''}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <span>
                      {i.dateIntervention} · {i.fluideType || '—'}
                      {i.createdByName ? ` · par ${i.createdByName}` : ''}
                    </span>
                    <span
                      className={[
                        'rounded-full px-2 py-0.5 text-[11px] font-bold',
                        st === 'brouillon'
                          ? 'bg-amber-50 text-amber-900'
                          : st === 'signe'
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-sky-50 text-sky-900',
                      ].join(' ')}
                    >
                      {st === 'brouillon'
                        ? 'Brouillon — à reprendre'
                        : st === 'signe'
                          ? 'Signé / clôturé'
                          : 'Envoyé'}
                    </span>
                  </div>
                  {i.hasCerfaPdf && (
                    <div className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent">
                      <FileCheck2 className="h-3.5 w-3.5" />
                      CERFA dans l’app
                      {i.cerfaPdfSavedAt
                        ? ` · ${new Date(i.cerfaPdfSavedAt).toLocaleString('fr-FR')}`
                        : ''}
                    </div>
                  )}
                </Link>
              </div>
              <div className="mt-3 flex flex-wrap gap-1 border-t border-line pt-3">
                <Link
                  to={`/app/interventions/${i.id}`}
                  title={st === 'signe' ? 'Voir / corriger une erreur' : 'Ouvrir / régénérer le CERFA'}
                  className="touch-target inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-3 text-xs font-semibold text-ink active:bg-mist sm:flex-none"
                >
                  <Pencil className="h-4 w-4 text-accent" />
                  {st === 'brouillon' ? 'Reprendre' : 'Ouvrir'}
                </Link>
                <button
                  type="button"
                  title="Voir le CERFA"
                  className="touch-target inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-3 text-xs font-semibold text-ink active:bg-mist sm:flex-none"
                  onClick={() => void openCerfa(i.id, label)}
                >
                  <Eye className="h-4 w-4 text-accent" />
                  PDF
                </button>
                <button
                  type="button"
                  className="touch-target grid place-items-center rounded-xl text-danger hover:bg-red-50"
                  onClick={() => {
                    if (confirm('Supprimer cette fiche et son CERFA ?')) deleteIntervention(i.id)
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-muted">
            {data.interventions.length === 0
              ? 'Aucune intervention pour le moment.'
              : 'Aucun résultat pour cette recherche / année.'}
          </p>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur md:left-64"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-ink">
              {selectedIds.size} CERFA · lot annuel{' '}
              {yearFilter === 'tous' ? packYear : yearFilter}
            </p>
            <button
              type="button"
              onClick={() => void openPack()}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#0f766e] px-5 text-sm font-bold text-white"
            >
              <FileArchive className="h-4 w-4" />
              Envoyer / enregistrer le lot
            </button>
          </div>
        </div>
      )}

      <MobileFab label="Créer CERFA" to="/app/interventions/new" />

      {viewer && (
        <PdfViewerModal
          url={viewer.url}
          title={viewer.title}
          onClose={() => {
            URL.revokeObjectURL(viewer.url)
            setViewer(null)
          }}
        />
      )}

      {packOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-3 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">
                  Envoi annuel
                </p>
                <h3 className="font-display text-base font-bold text-ink">
                  Lot CERFA {packYear} · bureau de contrôle
                </h3>
                <p className="mt-0.5 text-xs text-muted">
                  ZIP des CERFA sélectionnés
                  {includeRapport ? ' + rapport annuel fluides' : ''}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPackOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-mist/40 px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                checked={includeRapport}
                onChange={(e) => setIncludeRapport(e.target.checked)}
                className="h-4 w-4 rounded border-line"
              />
              <span className="font-medium text-ink">
                Inclure le rapport annuel fluides {packYear}
              </span>
            </label>

            {packLoading ? (
              <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Préparation des PDF…
              </p>
            ) : (
              <ul className="mt-3 max-h-56 space-y-1.5 overflow-y-auto">
                {packDocs.map((d) => (
                  <li
                    key={d.id}
                    className="rounded-xl border border-line bg-white px-3 py-2 text-sm"
                  >
                    <span className="block font-semibold text-ink">{d.label}</span>
                    <span className="block truncate text-[11px] text-muted">{d.fileName}</span>
                  </li>
                ))}
              </ul>
            )}

            {packError ? <p className="mt-2 text-sm font-medium text-danger">{packError}</p> : null}
            {packHint ? <p className="mt-2 text-xs font-medium text-emerald-800">{packHint}</p> : null}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={packLoading || packDocs.length === 0 || packBusy !== null}
                onClick={() => void onSavePack()}
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-bold disabled:opacity-50"
              >
                {packBusy === 'save' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : packDocs.length > 1 ? (
                  <FileArchive className="h-4 w-4" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Enregistrer sur l’ordi
              </button>
              <button
                type="button"
                disabled={packLoading || packDocs.length === 0 || packBusy !== null}
                onClick={() => void onSendPack()}
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#0f766e] px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                {packBusy === 'send' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? (
                  <Share2 className="h-4 w-4" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                Envoyer le lot annuel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
