import { type FormEvent, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  ClipboardList,
  Package,
  Pencil,
  Plus,
  Trash2,
  Truck,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import { SearchField, matchesQuery } from '../components/SearchField'
import { MobileFab } from '../components/MobileFab'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Field } from '../pages/ClientsPage'
import { STATUT_COMMANDE_FOURNISSEUR_LABELS } from '../lib/chaineCommerciale'
import { isOtCloture } from '../lib/ordreTravail'
import { editionHasFeature } from '../lib/appEdition'
import {
  PIECE_CATEGORIE_LABELS,
  PIECE_EMPLACEMENT_LABELS,
  PIECE_MOUVEMENT_KIND_LABELS,
  blankPiece,
  labelGestionnairePieces,
  mouvementsPourPiece,
  parsePieceCategorie,
  parsePieceEmplacement,
  pieceLabel,
  pieceStockBas,
  resumeStockPieces,
  type PieceCategorie,
  type PieceDetachee,
  type PieceEmplacement,
  type PieceMouvementKind,
} from '../lib/piecesDetachees'
import { mergeTeamMembers, extraAssigneesFromData } from '../lib/teamMembers'

type FiltreEmplacement = 'tous' | PieceEmplacement
type FiltreCategorie = 'toutes' | PieceCategorie

export function StockPiecesPage() {
  const {
    data,
    appEdition,
    peutGererPiecesDetachees,
    upsertPieceDetachee,
    deletePieceDetachee,
    enregistrerMouvementPiece,
    marquerCommandeRecue,
  } = useStore()
  const { user, isOwner } = useAuth()

  const [q, setQ] = useState('')
  const [filtreCat, setFiltreCat] = useState<FiltreCategorie>('toutes')
  const [filtreEmp, setFiltreEmp] = useState<FiltreEmplacement>('tous')
  const [alertesSeulement, setAlertesSeulement] = useState(false)
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(blankPiece())
  const [pendingDelete, setPendingDelete] = useState<{ id: string; label: string } | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [mouvementOpen, setMouvementOpen] = useState(false)
  const [mouvementKind, setMouvementKind] = useState<PieceMouvementKind>('sortie_ot')
  const [mouvementQty, setMouvementQty] = useState('1')
  const [mouvementMotif, setMouvementMotif] = useState('')
  const [mouvementOtId, setMouvementOtId] = useState('')
  const [mouvementEmp, setMouvementEmp] = useState<PieceEmplacement>('atelier')
  const [mouvementTechId, setMouvementTechId] = useState('')
  const [msg, setMsg] = useState('')

  if (!editionHasFeature(appEdition, 'stock_pieces')) {
    return <Navigate to="/app" replace state={{ editionBlocked: true }} />
  }

  const pieces = data.piecesDetachees || []
  const kpis = resumeStockPieces(pieces)
  const magasinier = data.operateur.magasinierUserId
    ? mergeTeamMembers({
        user,
        dossiers: data.personnelDossiers,
        extraAssignees: extraAssigneesFromData(data),
        retiredIds: data.personnelRetiresUserIds,
        orgId: user?.organizationId,
      }).find((m) => m.id === data.operateur.magasinierUserId)
    : undefined

  const commandesAttente = useMemo(
    () =>
      (data.commandesFournisseur || []).filter(
        (c) => c.statut === 'commandee' || c.statut === 'brouillon',
      ),
    [data.commandesFournisseur],
  )

  const filtered = useMemo(() => {
    return pieces.filter((p) => {
      if (alertesSeulement && !pieceStockBas(p)) return false
      if (filtreCat !== 'toutes' && p.categorie !== filtreCat) return false
      if (filtreEmp !== 'tous' && p.emplacement !== filtreEmp) return false
      return matchesQuery(
        [
          p.reference,
          p.designation,
          p.marque,
          p.fournisseur,
          p.rayon,
          p.codeBarres,
          p.notes,
          p.assigneeName,
        ]
          .filter(Boolean)
          .join(' '),
        q,
      )
    })
  }, [pieces, q, filtreCat, filtreEmp, alertesSeulement])

  const detailPiece = detailId ? pieces.find((p) => p.id === detailId) : undefined
  const detailMvts = detailPiece
    ? mouvementsPourPiece(data.piecesMouvements, detailPiece.id).slice(0, 20)
    : []

  const otsOuverts = useMemo(
    () =>
      (data.ordresTravail || []).filter((o) => !isOtCloture(o.statut)),
    [data.ordresTravail],
  )

  const team = useMemo(
    () =>
      mergeTeamMembers({
        user,
        dossiers: data.personnelDossiers,
        extraAssignees: extraAssigneesFromData(data),
        retiredIds: data.personnelRetiresUserIds,
        orgId: user?.organizationId,
      }),
    [user, data.personnelDossiers, data.personnelRetiresUserIds, data, user?.organizationId],
  )

  const openCreate = () => {
    setEditId(null)
    setForm(blankPiece())
    setOpen(true)
  }

  const openEdit = (p: PieceDetachee) => {
    setEditId(p.id)
    setForm({
      reference: p.reference,
      designation: p.designation,
      categorie: p.categorie || 'autre',
      marque: p.marque || '',
      fournisseur: p.fournisseur || '',
      quantite: p.quantite,
      unite: p.unite,
      seuilAlerte: p.seuilAlerte,
      prixUnitaireHt: p.prixUnitaireHt,
      emplacement: p.emplacement,
      rayon: p.rayon || '',
      assigneeUserId: p.assigneeUserId,
      assigneeName: p.assigneeName,
      codeBarres: p.codeBarres || '',
      notes: p.notes || '',
    })
    setOpen(true)
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!peutGererPiecesDetachees) return
    if (!form.reference.trim() || !form.designation.trim()) {
      alert('Référence et désignation obligatoires.')
      return
    }
    upsertPieceDetachee({
      ...form,
      id: editId || undefined,
      categorie: parsePieceCategorie(form.categorie) || 'autre',
      emplacement: parsePieceEmplacement(form.emplacement),
    })
    setOpen(false)
    setMsg(editId ? 'Article mis à jour.' : 'Article créé.')
    setTimeout(() => setMsg(''), 2500)
  }

  const openMouvement = (p: PieceDetachee, kind: PieceMouvementKind) => {
    setDetailId(p.id)
    setMouvementKind(kind)
    setMouvementQty(kind === 'inventaire' ? String(p.quantite) : '1')
    setMouvementMotif('')
    setMouvementOtId('')
    setMouvementEmp(p.emplacement)
    setMouvementTechId(p.assigneeUserId || '')
    setMouvementOpen(true)
  }

  const submitMouvement = (e: FormEvent) => {
    e.preventDefault()
    if (!peutGererPiecesDetachees || !detailId) return
    const piece = pieces.find((p) => p.id === detailId)
    if (!piece) return
    const qty = Number(mouvementQty.replace(',', '.'))
    const ot = otsOuverts.find((o) => o.id === mouvementOtId)
    const tech = team.find((m) => m.id === mouvementTechId)
    try {
      enregistrerMouvementPiece({
        pieceId: detailId,
        kind: mouvementKind,
        quantite: qty,
        otId: ot?.id,
        otNumero: ot?.numero,
        clientId: ot?.clientId,
        chantierId: ot?.chantierId,
        emplacementApres: mouvementKind === 'transfert' ? mouvementEmp : undefined,
        assigneeUserId: mouvementEmp === 'vehicule' ? mouvementTechId : undefined,
        assigneeName: tech?.fullName,
        motif: mouvementMotif.trim() || undefined,
      })
      setMouvementOpen(false)
      setMsg('Mouvement enregistré.')
      setTimeout(() => setMsg(''), 2500)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Mouvement impossible')
    }
  }

  const recevoirCommande = (commandeId: string) => {
    if (!peutGererPiecesDetachees) return
    marquerCommandeRecue(commandeId)
    setMsg('Commande reçue — stock mis à jour, OT débloqué si lié.')
    setTimeout(() => setMsg(''), 3000)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 pb-24 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Pièces détachées</h1>
          <p className="mt-1 text-sm text-muted">
            Stock GMAO — entrées, sorties OT, inventaire, alertes seuil.
          </p>
          <p className="mt-1 text-xs font-semibold text-sky-800">
            {labelGestionnairePieces({
              magasinierUserId: data.operateur.magasinierUserId,
              magasinierName: magasinier?.fullName,
            })}
            {!magasinier && isOwner ? (
              <>
                {' '}
                ·{' '}
                <Link to="/app/operateur" className="underline">
                  Désigner un magasinier
                </Link>
              </>
            ) : null}
          </p>
        </div>
        {peutGererPiecesDetachees ? (
          <button
            type="button"
            onClick={openCreate}
            className="hidden rounded-full bg-accent px-4 py-2 text-sm font-semibold text-ink hover:bg-accent-hover md:inline-flex md:items-center md:gap-2"
          >
            <Plus className="h-4 w-4" />
            Nouvel article
          </button>
        ) : null}
      </div>

      {!peutGererPiecesDetachees ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Consultation seule — seuls le gérant, le bureau ou le magasinier désigné peuvent modifier
          le stock.
        </p>
      ) : null}

      {msg ? (
        <p className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-900">
          {msg}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-4">
          <div className="text-xs font-bold uppercase text-muted">Articles</div>
          <div className="mt-1 font-display text-2xl font-bold">{kpis.totalArticles}</div>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <div className="text-xs font-bold uppercase text-muted">Alertes stock bas</div>
          <div
            className={`mt-1 font-display text-2xl font-bold ${kpis.alertes ? 'text-amber-700' : ''}`}
          >
            {kpis.alertes}
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <div className="text-xs font-bold uppercase text-muted">Valeur stock HT</div>
          <div className="mt-1 font-display text-2xl font-bold">
            {kpis.valeurHt.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
          </div>
        </div>
      </div>

      {commandesAttente.length > 0 && peutGererPiecesDetachees ? (
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-indigo-950">
            <Truck className="h-4 w-4" />
            Commandes fournisseur en attente de réception
          </h2>
          <ul className="mt-3 space-y-2">
            {commandesAttente.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-100 bg-white px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <span className="font-semibold">{c.numero}</span>
                  <span className="text-muted"> · {c.libelle}</span>
                  {c.referencePiece ? (
                    <span className="block text-xs text-muted">Réf. {c.referencePiece}</span>
                  ) : null}
                  <span className="text-xs text-muted">
                    {STATUT_COMMANDE_FOURNISSEUR_LABELS[c.statut]}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => recevoirCommande(c.id)}
                  className="shrink-0 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700"
                >
                  Réceptionner → stock
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem] flex-1">
          <SearchField value={q} onChange={setQ} placeholder="Référence, désignation, fournisseur…" />
        </div>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-muted">Catégorie</span>
          <select
            value={filtreCat}
            onChange={(e) => setFiltreCat(e.target.value as FiltreCategorie)}
            className="rounded-xl border border-line bg-white px-3 py-2 text-sm"
          >
            <option value="toutes">Toutes</option>
            {(Object.keys(PIECE_CATEGORIE_LABELS) as PieceCategorie[]).map((k) => (
              <option key={k} value={k}>
                {PIECE_CATEGORIE_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-muted">Emplacement</span>
          <select
            value={filtreEmp}
            onChange={(e) => setFiltreEmp(e.target.value as FiltreEmplacement)}
            className="rounded-xl border border-line bg-white px-3 py-2 text-sm"
          >
            <option value="tous">Tous</option>
            {(Object.keys(PIECE_EMPLACEMENT_LABELS) as PieceEmplacement[]).map((k) => (
              <option key={k} value={k}>
                {PIECE_EMPLACEMENT_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={alertesSeulement}
            onChange={(e) => setAlertesSeulement(e.target.checked)}
          />
          Stock bas seulement
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">
            Aucun article — créez votre catalogue pièces ou réceptionnez une commande fournisseur.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {filtered.map((p) => {
              const bas = pieceStockBas(p)
              const openDetail = detailId === p.id
              return (
                <li key={p.id}>
                  <div className="flex flex-wrap items-start gap-2 px-4 py-3">
                    <Package className="mt-0.5 h-5 w-5 shrink-0 text-muted" />
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => setDetailId(openDetail ? null : p.id)}
                        className="text-left"
                      >
                        <div className="font-semibold text-ink">{pieceLabel(p)}</div>
                        <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted">
                          <span>
                            {p.quantite} {p.unite}
                          </span>
                          <span>{PIECE_EMPLACEMENT_LABELS[p.emplacement]}</span>
                          {p.categorie ? (
                            <span>{PIECE_CATEGORIE_LABELS[p.categorie]}</span>
                          ) : null}
                          {p.rayon ? <span>Rayon {p.rayon}</span> : null}
                          {p.assigneeName ? <span>Véh. {p.assigneeName}</span> : null}
                        </div>
                      </button>
                      {bas ? (
                        <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-amber-800">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Stock ≤ seuil ({p.seuilAlerte} {p.unite})
                        </p>
                      ) : null}
                    </div>
                    {peutGererPiecesDetachees ? (
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          title="Entrée"
                          onClick={() => openMouvement(p, 'entree_achat')}
                          className="rounded-lg border border-line p-2 hover:bg-mist"
                        >
                          <ArrowDownCircle className="h-4 w-4 text-teal-700" />
                        </button>
                        <button
                          type="button"
                          title="Sortie OT"
                          onClick={() => openMouvement(p, 'sortie_ot')}
                          className="rounded-lg border border-line p-2 hover:bg-mist"
                        >
                          <ArrowUpCircle className="h-4 w-4 text-rose-700" />
                        </button>
                        <button
                          type="button"
                          title="Inventaire"
                          onClick={() => openMouvement(p, 'inventaire')}
                          className="rounded-lg border border-line p-2 hover:bg-mist"
                        >
                          <ClipboardList className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          className="rounded-lg border border-line p-2 hover:bg-mist"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPendingDelete({ id: p.id, label: pieceLabel(p) })
                          }
                          className="rounded-lg border border-line p-2 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4 text-danger" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {openDetail && detailMvts.length > 0 ? (
                    <div className="border-t border-line bg-mist/40 px-4 py-3">
                      <div className="text-xs font-bold uppercase text-muted">
                        Derniers mouvements
                      </div>
                      <ul className="mt-2 space-y-1 text-xs">
                        {detailMvts.map((m) => (
                          <li key={m.id} className="flex flex-wrap gap-2">
                            <span className="text-muted">
                              {new Date(m.createdAt).toLocaleString('fr-FR')}
                            </span>
                            <span className="font-semibold">
                              {PIECE_MOUVEMENT_KIND_LABELS[m.kind]}
                            </span>
                            <span>
                              {m.sens === 'entree' ? '+' : '−'}
                              {m.quantite} → {m.quantiteApres}
                            </span>
                            {m.otNumero ? <span>OT {m.otNumero}</span> : null}
                            {m.motif ? <span className="text-muted">{m.motif}</span> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <form
            onSubmit={onSubmit}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-line bg-white p-5 sm:rounded-2xl"
          >
            <h2 className="font-display text-lg font-semibold">
              {editId ? 'Modifier l’article' : 'Nouvel article'}
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field
                label="Référence *"
                value={form.reference}
                onChange={(v) => setForm((f) => ({ ...f, reference: v }))}
                required
              />
              <Field
                label="Désignation *"
                value={form.designation}
                onChange={(v) => setForm((f) => ({ ...f, designation: v }))}
                required
                className="sm:col-span-2"
              />
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-muted">Catégorie</span>
                <select
                  value={form.categorie || 'autre'}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      categorie: parsePieceCategorie(e.target.value) || 'autre',
                    }))
                  }
                  className="w-full rounded-xl border border-line px-3 py-2 text-sm"
                >
                  {(Object.keys(PIECE_CATEGORIE_LABELS) as PieceCategorie[]).map((k) => (
                    <option key={k} value={k}>
                      {PIECE_CATEGORIE_LABELS[k]}
                    </option>
                  ))}
                </select>
              </label>
              <Field label="Marque" value={form.marque || ''} onChange={(v) => setForm((f) => ({ ...f, marque: v }))} />
              <Field
                label="Fournisseur"
                value={form.fournisseur || ''}
                onChange={(v) => setForm((f) => ({ ...f, fournisseur: v }))}
              />
              <Field
                label="Quantité"
                value={String(form.quantite ?? 0)}
                onChange={(v) => setForm((f) => ({ ...f, quantite: Number(v.replace(',', '.')) || 0 }))}
              />
              <Field label="Unité" value={form.unite} onChange={(v) => setForm((f) => ({ ...f, unite: v }))} />
              <Field
                label="Seuil alerte"
                value={form.seuilAlerte != null ? String(form.seuilAlerte) : ''}
                onChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    seuilAlerte: v.trim() ? Number(v.replace(',', '.')) : undefined,
                  }))
                }
              />
              <Field
                label="Prix unitaire HT €"
                value={form.prixUnitaireHt != null ? String(form.prixUnitaireHt) : ''}
                onChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    prixUnitaireHt: v.trim() ? Number(v.replace(',', '.')) : undefined,
                  }))
                }
              />
              <label className="text-sm">
                <span className="mb-1 block text-xs font-semibold text-muted">Emplacement</span>
                <select
                  value={form.emplacement}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      emplacement: parsePieceEmplacement(e.target.value),
                    }))
                  }
                  className="w-full rounded-xl border border-line px-3 py-2 text-sm"
                >
                  {(Object.keys(PIECE_EMPLACEMENT_LABELS) as PieceEmplacement[]).map((k) => (
                    <option key={k} value={k}>
                      {PIECE_EMPLACEMENT_LABELS[k]}
                    </option>
                  ))}
                </select>
              </label>
              <Field label="Rayon / casier" value={form.rayon || ''} onChange={(v) => setForm((f) => ({ ...f, rayon: v }))} />
              <Field
                label="Code-barres"
                value={form.codeBarres || ''}
                onChange={(v) => setForm((f) => ({ ...f, codeBarres: v }))}
                className="sm:col-span-2"
              />
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-muted">Notes</span>
                <textarea
                  rows={2}
                  value={form.notes || ''}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-xl border border-line px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-line px-4 py-2 text-sm"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-ink"
              >
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {mouvementOpen && detailPiece ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <form
            onSubmit={submitMouvement}
            className="w-full max-w-md rounded-t-2xl border border-line bg-white p-5 sm:rounded-2xl"
          >
            <h2 className="font-display text-lg font-semibold">
              {PIECE_MOUVEMENT_KIND_LABELS[mouvementKind]}
            </h2>
            <p className="mt-1 text-sm text-muted">{pieceLabel(detailPiece)}</p>
            <p className="text-sm">
              Stock actuel :{' '}
              <strong>
                {detailPiece.quantite} {detailPiece.unite}
              </strong>
            </p>
            <div className="mt-4 grid gap-3">
              <label className="text-sm">
                <span className="mb-1 block text-xs font-semibold text-muted">Type</span>
                <select
                  value={mouvementKind}
                  onChange={(e) => setMouvementKind(e.target.value as PieceMouvementKind)}
                  className="w-full rounded-xl border border-line px-3 py-2 text-sm"
                >
                  {(Object.keys(PIECE_MOUVEMENT_KIND_LABELS) as PieceMouvementKind[]).map(
                    (k) => (
                      <option key={k} value={k}>
                        {PIECE_MOUVEMENT_KIND_LABELS[k]}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <Field
                label={mouvementKind === 'inventaire' ? 'Quantité comptée' : 'Quantité'}
                value={mouvementQty}
                onChange={setMouvementQty}
                required
              />
              {mouvementKind === 'sortie_ot' ? (
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-semibold text-muted">OT lié</span>
                  <select
                    value={mouvementOtId}
                    onChange={(e) => setMouvementOtId(e.target.value)}
                    className="w-full rounded-xl border border-line px-3 py-2 text-sm"
                  >
                    <option value="">— Optionnel —</option>
                    {otsOuverts.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.numero} — {o.observations?.slice(0, 40) || o.typeOt}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {mouvementKind === 'transfert' ? (
                <>
                  <label className="text-sm">
                    <span className="mb-1 block text-xs font-semibold text-muted">
                      Nouvel emplacement
                    </span>
                    <select
                      value={mouvementEmp}
                      onChange={(e) => setMouvementEmp(parsePieceEmplacement(e.target.value))}
                      className="w-full rounded-xl border border-line px-3 py-2 text-sm"
                    >
                      {(Object.keys(PIECE_EMPLACEMENT_LABELS) as PieceEmplacement[]).map((k) => (
                        <option key={k} value={k}>
                          {PIECE_EMPLACEMENT_LABELS[k]}
                        </option>
                      ))}
                    </select>
                  </label>
                  {mouvementEmp === 'vehicule' ? (
                    <label className="text-sm">
                      <span className="mb-1 block text-xs font-semibold text-muted">Technicien</span>
                      <select
                        value={mouvementTechId}
                        onChange={(e) => setMouvementTechId(e.target.value)}
                        className="w-full rounded-xl border border-line px-3 py-2 text-sm"
                      >
                        <option value="">Choisir…</option>
                        {team.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.fullName}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </>
              ) : null}
              <Field label="Motif / commentaire" value={mouvementMotif} onChange={setMouvementMotif} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMouvementOpen(false)}
                className="rounded-full border border-line px-4 py-2 text-sm"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-ink"
              >
                Valider
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Supprimer l’article ?"
        message={`${pendingDelete?.label || ''} — l’historique des mouvements reste en base.`}
        confirmLabel="Supprimer"
        onConfirm={() => {
          if (pendingDelete) deletePieceDetachee(pendingDelete.id)
          setPendingDelete(null)
        }}
        onCancel={() => setPendingDelete(null)}
      />

      {peutGererPiecesDetachees ? <MobileFab onClick={openCreate} label="Nouvel article" /> : null}
    </div>
  )
}
