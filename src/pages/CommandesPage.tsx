import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams, Navigate } from 'react-router-dom'
import { ArrowLeft, Download, Eye, FileText, Plus, Trash2, Truck } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import { SearchField, matchesQuery } from '../components/SearchField'
import { MobileFab } from '../components/MobileFab'
import { PdfViewerModal } from '../components/PdfViewerModal'
import { Field } from './ClientsPage'
import {
  STATUT_COMMANDE_FOURNISSEUR_LABELS,
  type CommandeFournisseur,
  type StatutCommandeFournisseur,
} from '../lib/chaineCommerciale'
import { editionHasFeature } from '../lib/appEdition'
import { formatOtNumero } from '../lib/ordreTravail'
import {
  buildCommandePdf,
  buildDemandeDevisFournisseurPdf,
  fileNameCommande,
  fileNameDemandeDevisFournisseur,
} from '../lib/commercialPdf'
import {
  createPdfPreviewUrl,
  saveGeneratedDocument,
} from '../lib/docStockage'
import { loadCompanyLogoLocal } from '../lib/companyLogo'
import { buildMemoirePieces, type PieceMemoireItem } from '../lib/piecesFrequentes'
import { parsePieceCategorie } from '../lib/piecesDetachees'

function blankCommande(opts?: {
  clientId?: string
  chantierId?: string
  otId?: string
  libelle?: string
  destination?: 'ot' | 'stock'
  statut?: CommandeFournisseur['statut']
  referencePiece?: string
  quantite?: number
  unite?: string
  categorie?: string
  fournisseur?: string
  seuilAlerte?: number
}): Omit<CommandeFournisseur, 'id' | 'createdAt' | 'updatedAt' | 'numero'> {
  const destination = opts?.destination || (opts?.otId ? 'ot' : 'stock')
  return {
    fournisseur: opts?.fournisseur || '',
    libelle: opts?.libelle || '',
    statut: opts?.statut || (destination === 'stock' ? 'demande_devis' : 'commandee'),
    clientId: opts?.clientId,
    chantierId: opts?.chantierId,
    otId: destination === 'ot' ? opts?.otId : undefined,
    destination,
    referencePiece: opts?.referencePiece,
    quantite: opts?.quantite ?? 1,
    unite: opts?.unite,
    categorie: opts?.categorie,
    seuilAlerte: opts?.seuilAlerte,
  }
}

export function CommandesPage() {
  const {
    data,
    appEdition,
    upsertCommandeFournisseur,
    deleteCommandeFournisseur,
    marquerCommandeRecue,
    upsertDocumentArchive,
  } = useStore()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const editId = params.get('id') || ''
  const newMode = params.get('new') === '1'
  const otFromQuery = params.get('ot') || ''
  const clientFromQuery = params.get('client') || ''
  const chantierFromQuery = params.get('chantier') || ''
  const destFromQuery = params.get('dest') || ''
  const statutFromQuery = params.get('statut') || ''
  const libelleFromQuery = params.get('libelle') || ''
  const refFromQuery = params.get('ref') || ''
  const qteFromQuery = params.get('qte') || ''
  const uniteFromQuery = params.get('unite') || ''
  const catFromQuery = params.get('cat') || ''
  const fournisseurFromQuery = params.get('fournisseur') || ''
  const seuilFromQuery = params.get('seuil') || ''
  const veilleId = params.get('veille') || ''
  const [q, setQ] = useState('')
  const [pdfBusy, setPdfBusy] = useState(false)
  const [preview, setPreview] = useState<{ url: string; fileName: string; title: string } | null>(
    null,
  )
  const [saveMsg, setSaveMsg] = useState('')
  const [veilleMsg] = useState(() =>
    veilleId
      ? 'Veille stock enregistrée — Accueil sera notifié à la réception de la pièce.'
      : '',
  )

  if (!editionHasFeature(appEdition, 'chaine_commerciale')) {
    return <Navigate to="/app" replace state={{ editionBlocked: true }} />
  }

  const existing = useMemo(
    () => (data.commandesFournisseur || []).find((c) => c.id === editId) || null,
    [data.commandesFournisseur, editId],
  )

  const [form, setForm] = useState<Omit<
    CommandeFournisseur,
    'id' | 'createdAt' | 'updatedAt' | 'numero'
  > | null>(null)

  useEffect(() => {
    if (existing) {
      const { id: _i, createdAt: _c, updatedAt: _u, numero: _n, ...rest } = existing
      setForm({
        ...rest,
        destination: rest.destination || (rest.otId ? 'ot' : 'stock'),
      })
      return
    }
    if (newMode || editId) {
      const dest: 'ot' | 'stock' =
        destFromQuery === 'stock'
          ? 'stock'
          : destFromQuery === 'ot' || otFromQuery
            ? 'ot'
            : 'stock'
      const statutRaw = statutFromQuery
      const statut =
        statutRaw === 'demande_devis' ||
        statutRaw === 'brouillon' ||
        statutRaw === 'commandee' ||
        statutRaw === 'recue' ||
        statutRaw === 'annulee'
          ? statutRaw
          : dest === 'stock'
            ? 'demande_devis'
            : 'commandee'
      setForm(
        blankCommande({
          clientId: clientFromQuery || undefined,
          chantierId: chantierFromQuery || undefined,
          otId: otFromQuery || undefined,
          destination: dest,
          statut,
          libelle: libelleFromQuery || undefined,
          referencePiece: refFromQuery || undefined,
          quantite: qteFromQuery ? Math.max(1, Number(qteFromQuery) || 1) : 1,
          unite: uniteFromQuery || undefined,
          categorie: parsePieceCategorie(catFromQuery) || catFromQuery || undefined,
          fournisseur: fournisseurFromQuery || undefined,
          seuilAlerte: seuilFromQuery ? Number(seuilFromQuery) || undefined : undefined,
        }),
      )
    } else {
      setForm(null)
    }
  }, [
    existing,
    newMode,
    editId,
    clientFromQuery,
    chantierFromQuery,
    otFromQuery,
    destFromQuery,
    statutFromQuery,
    libelleFromQuery,
    refFromQuery,
    qteFromQuery,
    uniteFromQuery,
    catFromQuery,
    fournisseurFromQuery,
    seuilFromQuery,
  ])

  const memoirePieces = useMemo(
    () =>
      buildMemoirePieces({
        pieces: data.piecesDetachees,
        commandes: data.commandesFournisseur,
        limit: 12,
      }),
    [data.piecesDetachees, data.commandesFournisseur],
  )

  const applyMemoire = (item: PieceMemoireItem) => {
    if (!form) return
    setForm({
      ...form,
      destination: 'stock',
      otId: undefined,
      libelle: item.designation,
      referencePiece: item.reference || form.referencePiece,
      fournisseur: item.fournisseur || form.fournisseur,
      unite: item.unite || form.unite,
      categorie: item.categorie || form.categorie,
      seuilAlerte: item.seuilAlerte ?? form.seuilAlerte,
      statut: form.statut === 'recue' ? form.statut : 'demande_devis',
      quantite: form.quantite || 1,
    })
  }

  const list = useMemo(() => {
    const items = [...(data.commandesFournisseur || [])].sort((a, b) =>
      (b.updatedAt || '').localeCompare(a.updatedAt || ''),
    )
    if (!q.trim()) return items
    return items.filter((c) => {
      const client = data.clients.find((x) => x.id === c.clientId)
      const site = data.chantiers.find((s) => s.id === c.chantierId)
      return matchesQuery(
        [
          c.numero,
          c.libelle,
          c.fournisseur,
          c.referencePiece,
          c.destination,
          client?.raisonSociale,
          site?.nom,
          STATUT_COMMANDE_FOURNISSEUR_LABELS[c.statut],
        ].join(' '),
        q,
      )
    })
  }, [data.commandesFournisseur, data.clients, data.chantiers, q])

  const listGrouped = useMemo(() => {
    const groups = new Map<
      string,
      { clientNom: string; siteNom: string; items: typeof list }
    >()
    for (const c of list) {
      const client = data.clients.find((x) => x.id === c.clientId)
      const site = data.chantiers.find((s) => s.id === c.chantierId)
      const clientNom = client?.raisonSociale || (c.destination === 'stock' ? 'Stock magasin' : 'Sans client')
      const siteNom = site?.nom || (c.destination === 'stock' ? 'Entrée stock' : 'Sans site')
      const key = `${clientNom}\0${siteNom}`
      const g = groups.get(key) || { clientNom, siteNom, items: [] }
      g.items.push(c)
      groups.set(key, g)
    }
    return [...groups.values()].sort(
      (a, b) =>
        a.clientNom.localeCompare(b.clientNom, 'fr') ||
        a.siteNom.localeCompare(b.siteNom, 'fr'),
    )
  }, [list, data.clients, data.chantiers])

  const company = {
    raisonSociale: data.operateur?.raisonSociale,
    adresse: data.operateur?.adresse,
    telephone: data.operateur?.telephone,
    email: data.operateur?.email,
    siret: data.operateur?.siret,
    logoImage:
      data.operateur?.logoImage || loadCompanyLogoLocal(user?.organizationId) || undefined,
  }

  const pdfCtxFor = (c: Pick<CommandeFournisseur, 'clientId' | 'chantierId' | 'otId'>) => {
    const ot = c.otId ? (data.ordresTravail || []).find((o) => o.id === c.otId) : undefined
    return {
      company,
      clientNom: data.clients.find((x) => x.id === c.clientId)?.raisonSociale,
      siteNom: data.chantiers.find((s) => s.id === c.chantierId)?.nom,
      otNumero: ot?.numero,
    }
  }

  const persistCommandePdf = async (
    cmd: CommandeFournisseur,
    opts?: { mode?: 'commande' | 'demande_devis' },
  ) => {
    const ctx = pdfCtxFor(cmd)
    const isDevis =
      opts?.mode === 'demande_devis' ||
      (opts?.mode !== 'commande' && cmd.statut === 'demande_devis')
    const blob = isDevis
      ? buildDemandeDevisFournisseurPdf(cmd, ctx)
      : buildCommandePdf(cmd, ctx, { mode: 'commande' })
    const fileName = isDevis ? fileNameDemandeDevisFournisseur(cmd) : fileNameCommande(cmd)
    const result = await saveGeneratedDocument({
      blob,
      fileName,
      kind: 'commande',
      clientNom: ctx.clientNom,
      docId: `commande-${cmd.id}${isDevis ? '-devis' : ''}`,
      organizationId: user?.organizationId,
      operateur: data.operateur,
      commandeId: cmd.id,
      onArchived: upsertDocumentArchive,
    })
    setSaveMsg(result.message)
    setTimeout(() => setSaveMsg(''), 6000)
    return { blob, fileName, result, isDevis }
  }

  const openPreview = async (
    cmd: CommandeFournisseur,
    opts?: { mode?: 'commande' | 'demande_devis' },
  ) => {
    setPdfBusy(true)
    try {
      const ctx = pdfCtxFor(cmd)
      const isDevis =
        opts?.mode === 'demande_devis' ||
        (opts?.mode !== 'commande' && cmd.statut === 'demande_devis')
      const blob = isDevis
        ? buildDemandeDevisFournisseurPdf(cmd, ctx)
        : buildCommandePdf(cmd, ctx, { mode: 'commande' })
      const fileName = isDevis ? fileNameDemandeDevisFournisseur(cmd) : fileNameCommande(cmd)
      if (preview?.url) URL.revokeObjectURL(preview.url)
      setPreview({
        url: createPdfPreviewUrl(blob),
        fileName,
        title: isDevis ? `Demande de devis ${cmd.numero}` : `Commande ${cmd.numero}`,
      })
    } finally {
      setPdfBusy(false)
    }
  }

  /** Enregistre + génère le PDF demande de devis à envoyer au fournisseur. */
  const genererDemandeDevisFournisseur = async () => {
    if (!form) return
    if (!(form.fournisseur || '').trim()) {
      alert('Indiquez le fournisseur avant de générer la demande de devis.')
      return
    }
    if (!(form.libelle || '').trim()) {
      alert('Indiquez la pièce / matériel.')
      return
    }
    setPdfBusy(true)
    try {
      const payload = {
        ...form,
        statut: 'demande_devis' as const,
        id: existing?.id,
        numero: existing?.numero,
        otId: form.destination === 'ot' ? form.otId : undefined,
      }
      const { id, numero } = upsertCommandeFournisseur(payload)
      const now = new Date().toISOString()
      const cmd: CommandeFournisseur = {
        ...payload,
        id,
        numero,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      }
      setForm({ ...form, statut: 'demande_devis' })
      const { blob, fileName } = await persistCommandePdf(cmd, { mode: 'demande_devis' })
      if (preview?.url) URL.revokeObjectURL(preview.url)
      setPreview({
        url: createPdfPreviewUrl(blob),
        fileName,
        title: `Demande de devis ${cmd.numero}`,
      })
      navigate(`/app/commandes?id=${encodeURIComponent(id)}`, { replace: true })
      setSaveMsg('Demande de devis PDF prête — à envoyer au fournisseur.')
      setTimeout(() => setSaveMsg(''), 6000)
    } finally {
      setPdfBusy(false)
    }
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!form) return
    if (form.destination === 'ot' && !form.otId) {
      alert('Choisissez une INT, ou basculez la destination sur Stock.')
      return
    }
    setPdfBusy(true)
    try {
      const payload = {
        ...form,
        id: existing?.id,
        numero: existing?.numero,
        otId: form.destination === 'ot' ? form.otId : undefined,
      }
      const { id, numero } = upsertCommandeFournisseur(payload)
      const now = new Date().toISOString()
      const cmd: CommandeFournisseur = {
        ...payload,
        id,
        numero,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      }
      await persistCommandePdf(cmd)
      navigate(`/app/commandes?id=${encodeURIComponent(id)}`, { replace: true })
    } finally {
      setPdfBusy(false)
    }
  }

  if (form) {
    const ot = form.otId
      ? (data.ordresTravail || []).find((o) => o.id === form.otId)
      : null
    const destination = form.destination || (form.otId ? 'ot' : 'stock')

    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <button
          type="button"
          onClick={() => navigate('/app/commandes')}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted"
        >
          <ArrowLeft className="h-4 w-4" /> Liste commandes
        </button>
        <h1 className="font-display text-xl font-bold">
          {existing
            ? `Commande ${existing.numero}`
            : destination === 'stock'
              ? 'Demande de devis / réappro stock'
              : 'Nouvelle commande fournisseur'}
        </h1>
        <form onSubmit={save} className="space-y-4 rounded-2xl border border-line bg-white p-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Destination</legend>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    destination: 'ot',
                    otId: form.otId || otFromQuery || undefined,
                    statut: form.statut === 'demande_devis' ? 'commandee' : form.statut,
                  })
                }
                className={[
                  'rounded-full border px-3 py-1.5 text-xs font-bold',
                  destination === 'ot'
                    ? 'border-accent bg-accent/15 text-ink'
                    : 'border-line bg-white text-muted',
                ].join(' ')}
              >
                Liée à une INT
              </button>
              <button
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    destination: 'stock',
                    otId: undefined,
                    statut:
                      form.statut === 'commandee' || form.statut === 'demande_devis'
                        ? form.statut
                        : 'demande_devis',
                  })
                }
                className={[
                  'rounded-full border px-3 py-1.5 text-xs font-bold',
                  destination === 'stock'
                    ? 'border-accent bg-accent/15 text-ink'
                    : 'border-line bg-white text-muted',
                ].join(' ')}
              >
                Entrée stock / magasin
              </button>
            </div>
            <p className="text-[11px] text-muted">
              {destination === 'ot'
                ? 'La pièce sera réservée à une INT (statut « en attente de pièce »).'
                : 'Demande de devis fournisseur puis commande → réception au magasin pièces.'}
            </p>
          </fieldset>

          {destination === 'stock' && !existing ? (
            <div className="rounded-xl border border-dashed border-line bg-mist/30 p-3">
              <p className="text-xs font-bold uppercase text-muted">
                Mémoire pièces fréquentes
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {memoirePieces.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => applyMemoire(item)}
                    className="rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-semibold hover:border-accent"
                  >
                    {item.favori ? '★ ' : ''}
                    {item.designation}
                    {item.foisCommandee > 0 ? (
                      <span className="text-muted"> · ×{item.foisCommandee}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {destination === 'ot' ? (
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">Intervention</span>
              <select
                value={form.otId || ''}
                onChange={(e) => {
                  const otId = e.target.value || undefined
                  const linked = otId
                    ? (data.ordresTravail || []).find((o) => o.id === otId)
                    : undefined
                  setForm({
                    ...form,
                    otId,
                    clientId: linked?.clientId || form.clientId,
                    chantierId: linked?.chantierId || form.chantierId,
                    destination: 'ot',
                  })
                }}
                className="w-full rounded-xl border border-line px-3 py-2"
                required
              >
                <option value="">— Choisir une INT —</option>
                {(data.ordresTravail || [])
                  .slice()
                  .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {formatOtNumero(o.numero)} · {o.action || o.typeOt || 'INT'}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}

          <Field
            label="Pièce / matériel"
            value={form.libelle}
            onChange={(v) => setForm({ ...form, libelle: v })}
          />
          <Field
            label="Fournisseur"
            value={form.fournisseur}
            onChange={(v) => setForm({ ...form, fournisseur: v })}
          />
          <Field
            label="Référence pièce"
            value={form.referencePiece || ''}
            onChange={(v) => setForm({ ...form, referencePiece: v || undefined })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Quantité"
              value={form.quantite != null ? String(form.quantite) : '1'}
              onChange={(v) =>
                setForm({
                  ...form,
                  quantite: Math.max(1, Number(v.replace(',', '.')) || 1),
                })
              }
            />
            <Field
              label="P.U. HT (€)"
              value={form.prixUnitaireHt != null ? String(form.prixUnitaireHt) : ''}
              onChange={(v) =>
                setForm({
                  ...form,
                  prixUnitaireHt: v ? Number(v.replace(',', '.')) : undefined,
                })
              }
            />
          </div>
          {destination === 'stock' ? (
            <Field
              label="Rayon / emplacement stock"
              value={form.rayonStock || ''}
              onChange={(v) => setForm({ ...form, rayonStock: v || undefined })}
            />
          ) : null}
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Statut</span>
            <select
              value={form.statut}
              onChange={(e) =>
                setForm({ ...form, statut: e.target.value as StatutCommandeFournisseur })
              }
              className="w-full rounded-xl border border-line px-3 py-2"
            >
              {(Object.keys(STATUT_COMMANDE_FOURNISSEUR_LABELS) as StatutCommandeFournisseur[]).map(
                (s) => (
                  <option key={s} value={s}>
                    {STATUT_COMMANDE_FOURNISSEUR_LABELS[s]}
                  </option>
                ),
              )}
            </select>
          </label>
          {ot ? (
            <p className="text-xs text-muted">
              INT liée :{' '}
              <Link to={`/app/ot?id=${ot.id}`} className="font-semibold text-accent underline">
                {formatOtNumero(ot.numero)}
              </Link>
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pdfBusy}
              onClick={() => void genererDemandeDevisFournisseur()}
              className="inline-flex items-center gap-1.5 rounded-full border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-950 disabled:opacity-60"
            >
              <FileText className="h-3.5 w-3.5" />
              {pdfBusy ? 'PDF…' : 'Demande de devis (PDF fournisseur)'}
            </button>
            <button
              type="submit"
              disabled={pdfBusy}
              className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-ink disabled:opacity-60"
            >
              {pdfBusy
                ? 'PDF…'
                : form.statut === 'demande_devis'
                  ? 'Enregistrer demande de devis'
                  : 'Enregistrer + PDF'}
            </button>
            {existing && existing.statut === 'demande_devis' ? (
              <button
                type="button"
                onClick={() => {
                  setForm({ ...form, statut: 'commandee' })
                  const payload = {
                    ...form,
                    statut: 'commandee' as const,
                    id: existing.id,
                    numero: existing.numero,
                    otId: form.destination === 'ot' ? form.otId : undefined,
                  }
                  upsertCommandeFournisseur(payload)
                  setSaveMsg('Passée en commande fournisseur.')
                  setTimeout(() => setSaveMsg(''), 4000)
                }}
                className="rounded-full border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-950"
              >
                Passer en commande
              </button>
            ) : null}
            {existing ? (
              <button
                type="button"
                disabled={pdfBusy}
                onClick={() =>
                  void openPreview(existing, {
                    mode: form.statut === 'demande_devis' ? 'demande_devis' : 'commande',
                  })
                }
                className="inline-flex items-center gap-1 rounded-full border border-line px-4 py-2 text-sm font-semibold"
              >
                <Eye className="h-3.5 w-3.5" /> Prévisualiser
              </button>
            ) : null}
            {existing ? (
              <button
                type="button"
                disabled={pdfBusy}
                onClick={() =>
                  void persistCommandePdf(existing, {
                    mode: form.statut === 'demande_devis' ? 'demande_devis' : 'commande',
                  })
                }
                className="inline-flex items-center gap-1 rounded-full border border-line px-4 py-2 text-sm font-semibold"
              >
                <Download className="h-3.5 w-3.5" /> PDF
              </button>
            ) : null}
            {existing && existing.statut !== 'recue' ? (
              <button
                type="button"
                onClick={() => {
                  marquerCommandeRecue(existing.id)
                  setForm({ ...form, statut: 'recue' })
                  alert('Commande reçue — stock mis à jour si configuré.')
                }}
                className="rounded-full border border-line px-4 py-2 text-sm font-semibold"
              >
                Marquer reçue
              </button>
            ) : null}
            {existing ? (
              <button
                type="button"
                onClick={() => {
                  if (!confirm('Supprimer cette commande ?')) return
                  deleteCommandeFournisseur(existing.id)
                  navigate('/app/commandes')
                }}
                className="inline-flex items-center gap-1 rounded-full border border-danger/30 px-4 py-2 text-sm font-semibold text-danger"
              >
                <Trash2 className="h-3.5 w-3.5" /> Supprimer
              </button>
            ) : null}
          </div>
        </form>
        {saveMsg ? (
          <p className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-medium text-teal-950">
            {saveMsg}
          </p>
        ) : null}
        {preview ? (
          <PdfViewerModal
            url={preview.url}
            title={preview.title}
            fileName={preview.fileName}
            onClose={() => {
              URL.revokeObjectURL(preview.url)
              setPreview(null)
            }}
            saveDestinationBusy={pdfBusy}
            onSaveDestination={async () => {
              if (!existing) return
              setPdfBusy(true)
              try {
                await persistCommandePdf(existing)
              } finally {
                setPdfBusy(false)
              }
            }}
          />
        ) : null}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-xl font-bold">Commandes fournisseur</h1>
        <Link
          to="/app/commandes?new=1&dest=stock&statut=demande_devis"
          className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-2 text-xs font-bold text-ink"
        >
          <Plus className="h-4 w-4" /> Nouvelle
        </Link>
      </div>
      {veilleMsg ? (
        <p className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-950">
          {veilleMsg}
        </p>
      ) : null}
      <SearchField value={q} onChange={setQ} placeholder="Client, site, n° commande…" />
      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
          <Truck className="mx-auto mb-2 h-8 w-8 opacity-40" />
          Aucune commande — créez-en depuis une INT ou ici.
        </p>
      ) : (
        <div className="space-y-4">
          {listGrouped.map((g) => (
            <div key={`${g.clientNom}|${g.siteNom}`} className="overflow-hidden rounded-xl border border-line bg-white">
              <div className="border-b border-line bg-mist/50 px-4 py-2">
                <p className="text-sm font-bold text-ink">{g.clientNom}</p>
                <p className="text-xs text-muted">{g.siteNom}</p>
              </div>
              <ul className="divide-y divide-line">
                {g.items.map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/app/commandes?id=${c.id}`}
                      className="flex items-center gap-3 px-4 py-3 active:bg-mist"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-ink">
                          {c.numero} · {c.libelle}
                        </p>
                        <p className="text-xs text-muted">
                          {c.fournisseur || '—'} · {STATUT_COMMANDE_FOURNISSEUR_LABELS[c.statut]}
                          {' · '}
                          {c.destination === 'ot' || c.otId ? 'INT' : 'Stock'}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <MobileFab to="/app/commandes?new=1" label="Nouvelle commande" />
    </div>
  )
}
