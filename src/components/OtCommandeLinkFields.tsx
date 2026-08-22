import {
  LIEN_COMMANDE_LABELS,
  type LienCommandeType,
} from '../lib/ordreTravail'
import type { ContratMaintenance } from '../lib/contratMaintenance'

type Props = {
  lienCommandeType?: LienCommandeType | string
  lienCommandeRef?: string
  contratId?: string
  contrats: ContratMaintenance[]
  /** Lien devis externe éventuel (Make / Tiime) — aide à remplir la réf. */
  devisLienClient?: string
  onChange: (patch: {
    lienCommandeType: LienCommandeType
    lienCommandeRef: string
    contratId?: string
  }) => void
}

/**
 * Rattache un OT à une commande commerciale (contrat, devis, devis de régule…).
 */
export function OtCommandeLinkFields({
  lienCommandeType = 'aucun',
  lienCommandeRef = '',
  contratId = '',
  contrats,
  devisLienClient,
  onChange,
}: Props) {
  const type = (lienCommandeType || 'aucun') as LienCommandeType

  const setType = (next: LienCommandeType) => {
    if (next === 'contrat') {
      const first = contrats[0]
      onChange({
        lienCommandeType: next,
        lienCommandeRef: first?.numero || lienCommandeRef || '',
        contratId: first?.id,
      })
      return
    }
    onChange({
      lienCommandeType: next,
      lienCommandeRef: next === 'aucun' ? '' : lienCommandeRef,
      contratId: undefined,
    })
  }

  return (
    <div className="space-y-2 rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-emerald-900">
        Lié à une commande
      </p>
      <p className="text-[11px] leading-relaxed text-emerald-950/80">
        Contrat, devis, devis de régule (après urgence) ou n° de commande — pour retrouver
        pourquoi cet OT existe.
      </p>
      <label className="block text-sm">
        <span className="mb-1 block font-semibold text-ink">Type de lien</span>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as LienCommandeType)}
          className="h-11 w-full rounded-xl border border-line bg-white px-3"
        >
          {(Object.keys(LIEN_COMMANDE_LABELS) as LienCommandeType[]).map((t) => (
            <option key={t} value={t}>
              {LIEN_COMMANDE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>

      {type === 'contrat' ? (
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-ink">Contrat</span>
          {contrats.length === 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              Aucun contrat actif pour ce client / site. Créez-en un dans Contrats, ou choisissez
              Devis / Commande.
            </p>
          ) : (
            <select
              value={contratId || ''}
              onChange={(e) => {
                const id = e.target.value
                const c = contrats.find((x) => x.id === id)
                onChange({
                  lienCommandeType: 'contrat',
                  lienCommandeRef: c?.numero || '',
                  contratId: id || undefined,
                })
              }}
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            >
              <option value="">— Choisir un contrat —</option>
              {contrats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero}
                  {c.titre ? ` — ${c.titre}` : ''}
                </option>
              ))}
            </select>
          )}
        </label>
      ) : null}

      {type !== 'aucun' && type !== 'contrat' ? (
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-ink">
            {type === 'devis_regule'
              ? 'N° devis de régule / réf.'
              : type === 'devis'
                ? 'N° devis / réf.'
                : 'N° commande / réf.'}
          </span>
          <input
            value={lienCommandeRef || ''}
            onChange={(e) =>
              onChange({
                lienCommandeType: type,
                lienCommandeRef: e.target.value,
                contratId: undefined,
              })
            }
            className="h-11 w-full rounded-xl border border-line bg-white px-3"
            placeholder={
              type === 'devis_regule'
                ? 'Ex. Régule suite OT urgence 26082201'
                : 'Ex. Devis #452 · CMD-2026-018'
            }
          />
          {devisLienClient && (type === 'devis' || type === 'devis_regule') ? (
            <a
              href={devisLienClient}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-xs font-semibold text-accent underline"
            >
              Ouvrir le devis client (lien externe)
            </a>
          ) : null}
        </label>
      ) : null}

      {type === 'devis_regule' ? (
        <p className="text-[11px] text-muted">
          Cas typique : dépannage d’urgence sans devis → ensuite devis de régule pour les
          travaux / pièces, lié à cet OT.
        </p>
      ) : null}
    </div>
  )
}
