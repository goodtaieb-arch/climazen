import { useMemo, useState } from 'react'
import { Package, Plus } from 'lucide-react'
import { useStore } from '../lib/store'
import { pieceLabel, pieceStockBas, type PieceDetachee } from '../lib/piecesDetachees'

type Props = {
  otId: string
  otNumero?: string
  clientId?: string
  chantierId?: string
  readOnly?: boolean
}

export function OtPiecesPanel({ otId, otNumero, clientId, chantierId, readOnly }: Props) {
  const { data, enregistrerMouvementPiece, peutGererPiecesDetachees } = useStore()
  const [pieceId, setPieceId] = useState('')
  const [qty, setQty] = useState('1')
  const [motif, setMotif] = useState('')

  const pieces = data.piecesDetachees || []
  const mvts = useMemo(
    () => (data.piecesMouvements || []).filter((m) => m.otId === otId),
    [data.piecesMouvements, otId],
  )

  const canEdit = !readOnly && peutGererPiecesDetachees

  const consommer = () => {
    if (!canEdit || !pieceId) return
    const q = Number(qty.replace(',', '.'))
    if (!(q > 0)) {
      alert('Quantité invalide.')
      return
    }
    try {
      enregistrerMouvementPiece({
        pieceId,
        kind: 'sortie_ot',
        quantite: q,
        otId,
        otNumero,
        clientId,
        chantierId,
        motif: motif.trim() || `INT ${otNumero || otId}`,
      })
      setPieceId('')
      setQty('1')
      setMotif('')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Sortie impossible')
    }
  }

  if (!pieces.length && !mvts.length) {
    return (
      <p className="rounded-xl border border-line bg-mist/50 px-3 py-2 text-xs text-muted">
        Aucune pièce en stock —{' '}
        <a href="/app/stock-pieces" className="font-semibold text-accent underline">
          Magasin pièces
        </a>
      </p>
    )
  }

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-white p-4">
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-muted" />
        <h3 className="font-display text-sm font-bold">Pièces consommées</h3>
      </div>

      {mvts.length ? (
        <ul className="space-y-1 text-sm">
          {mvts.map((m) => {
            const p = pieces.find((x) => x.id === m.pieceId)
            return (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-mist/30 px-3 py-2"
              >
                <span>{p ? pieceLabel(p) : m.pieceId}</span>
                <span className="text-xs text-muted">
                  −{m.quantite} {p?.unite || 'u'} · reste {m.quantiteApres}
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted">Aucune pièce sortie sur cette INT.</p>
      )}

      {canEdit ? (
        <div className="grid gap-2 border-t border-line pt-3 sm:grid-cols-[1fr_auto_auto]">
          <select
            value={pieceId}
            onChange={(e) => setPieceId(e.target.value)}
            className="rounded-xl border border-line px-3 py-2 text-sm"
          >
            <option value="">Choisir une pièce…</option>
            {pieces
              .filter((p) => (Number(p.quantite) || 0) > 0)
              .map((p: PieceDetachee) => (
                <option key={p.id} value={p.id}>
                  {pieceLabel(p)} — {p.quantite} {p.unite}
                  {pieceStockBas(p) ? ' ⚠' : ''}
                </option>
              ))}
          </select>
          <input
            type="text"
            inputMode="decimal"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-20 rounded-xl border border-line px-3 py-2 text-sm"
            placeholder="Qté"
          />
          <button
            type="button"
            onClick={consommer}
            className="inline-flex items-center justify-center gap-1 rounded-full bg-accent px-3 py-2 text-xs font-bold text-ink"
          >
            <Plus className="h-3.5 w-3.5" />
            Sortir
          </button>
          <input
            type="text"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Motif (optionnel)"
            className="sm:col-span-3 rounded-xl border border-line px-3 py-2 text-sm"
          />
        </div>
      ) : null}
    </div>
  )
}
