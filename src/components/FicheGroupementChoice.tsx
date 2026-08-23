import { useEffect, useState } from 'react'
import {
  EQUIPEMENTS_PAR_FICHE_OPTIONS,
  groupementSummary,
  normalizeEquipementsParFiche,
  type EquipementsParFiche,
} from '../lib/ficheGroupement'

type Props = {
  value?: number | null
  onChange: (v: EquipementsParFiche) => void
  equipementCount: number
  /** Ex. annuel CTA : on précise le format paysage. */
  noteAnnuel?: boolean
}

/**
 * Choix d’impression : 1 fiche par équipement, ou regroupement 2/3 pour limiter le papier.
 * Le remplissage reste un équipement à la fois (relevés / n° de série distincts).
 */
export function FicheGroupementChoice({
  value,
  onChange,
  equipementCount,
  noteAnnuel,
}: Props) {
  if (equipementCount < 2) return null
  const current = normalizeEquipementsParFiche(value)

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4">
      <p className="text-sm font-semibold text-ink">Impression — souhait du client</p>
      <p className="mt-0.5 text-xs text-muted">
        Vous remplissez toujours une machine à la fois. Ce choix ne change que le PDF imprimé
        (en-tête et signatures communs, colonnes par équipement).
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {EQUIPEMENTS_PAR_FICHE_OPTIONS.map((opt) => {
          const active = current === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={[
                'rounded-xl border px-3 py-2.5 text-left transition',
                active
                  ? 'border-sky-500 bg-white shadow-sm ring-2 ring-sky-200'
                  : 'border-line bg-white hover:border-sky-300',
              ].join(' ')}
            >
              <span className="block text-sm font-bold text-ink">{opt.label}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-muted">{opt.hint}</span>
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-xs font-semibold text-sky-800">
        {groupementSummary(equipementCount, current)}
        {noteAnnuel && current === 3 ? ' Format paysage pour l’annuel.' : ''}
      </p>
    </div>
  )
}

type ModalProps = {
  open: boolean
  title: string
  equipementCount: number
  initial?: EquipementsParFiche
  onConfirm: (v: EquipementsParFiche) => void
  onCancel: () => void
}

/** Modale au lancement OT : le client veut-il regrouper ? */
export function FicheGroupementModal({
  open,
  title,
  equipementCount,
  initial = 1,
  onConfirm,
  onCancel,
}: ModalProps) {
  const [choice, setChoice] = useState<EquipementsParFiche>(initial)

  useEffect(() => {
    if (open) setChoice(initial)
  }, [open, initial])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fiche-groupement-title"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-line bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="fiche-groupement-title" className="font-display text-lg font-bold text-ink">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {equipementCount} équipements sélectionnés. Choisissez selon ce que le client veut
          imprimer.
        </p>
        <div className="mt-4">
          <FicheGroupementChoice
            value={choice}
            onChange={setChoice}
            equipementCount={equipementCount}
          />
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-12 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => onConfirm(choice)}
            className="min-h-12 rounded-xl bg-sky-500 px-4 text-sm font-bold text-white"
          >
            Continuer
          </button>
        </div>
      </div>
    </div>
  )
}
