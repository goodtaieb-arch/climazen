import { FilePlus2, Package, Receipt, Shield } from 'lucide-react'
import {
  ORIGINE_OT_LABELS,
  STATUT_FACTURATION_OT_LABELS,
  type CommandeFournisseur,
  type Devis,
  type OrigineOt,
  type StatutFacturationOt,
} from '../lib/chaineCommerciale'
import type { ContratMaintenance } from '../lib/contratMaintenance'
import type { Client } from '../lib/types'
import type { LienCommandeType, OrdreTravail } from '../lib/ordreTravail'
import { LIEN_COMMANDE_LABELS } from '../lib/ordreTravail'

export type OtCommercialPatch = Partial<
  Pick<
    OrdreTravail,
    | 'lienCommandeType'
    | 'lienCommandeRef'
    | 'contratId'
    | 'devisId'
    | 'commandeFournisseurId'
    | 'origineOt'
    | 'statutFacturation'
    | 'sousGarantie'
    | 'clientPayeurId'
    | 'mainOeuvreIncluseContrat'
    | 'statut'
  >
>

type Props = {
  value: OtCommercialPatch & {
    clientId?: string
    chantierId?: string
    signatureClientImage?: string
    signatureTechnicienImage?: string
    id?: string
  }
  contrats: ContratMaintenance[]
  devisList: Devis[]
  commandes: CommandeFournisseur[]
  clients: Client[]
  devisLienClient?: string
  onChange: (patch: OtCommercialPatch) => void
  onGenererDevisRegule?: () => void
  onGenererFacture?: () => void
  onCreerCommandePiece?: () => void
  /** Compact = étape appel ; full = fiche OT */
  compact?: boolean
}

/**
 * Bloc liaison commerciale OT — 6 origines CVC + actions régule / facture / pièce.
 */
export function OtCommandeLinkFields({
  value,
  contrats,
  devisList,
  commandes,
  clients,
  devisLienClient,
  onChange,
  onGenererDevisRegule,
  onGenererFacture,
  onCreerCommandePiece,
  compact,
}: Props) {
  const origine = (value.origineOt || 'depannage_urgence') as OrigineOt
  const factu = (value.statutFacturation || 'non_facture') as StatutFacturationOt
  const lienType = (value.lienCommandeType || 'aucun') as LienCommandeType

  const applyOrigine = (next: OrigineOt) => {
    const patch: OtCommercialPatch = { origineOt: next }
    if (next === 'maintenance_contrat') {
      patch.lienCommandeType = 'contrat'
      patch.statutFacturation = 'sous_contrat'
      patch.mainOeuvreIncluseContrat = true
      patch.sousGarantie = false
      const first = contrats[0]
      if (first) {
        patch.contratId = first.id
        patch.lienCommandeRef = first.numero
      }
    } else if (next === 'installation_devis') {
      patch.lienCommandeType = 'devis'
      patch.statutFacturation = 'non_facture'
      patch.mainOeuvreIncluseContrat = false
      const first = devisList.find((d) => d.statut === 'accepte') || devisList[0]
      if (first) {
        patch.devisId = first.id
        patch.lienCommandeRef = first.numero
      }
    } else if (next === 'depannage_urgence') {
      patch.lienCommandeType = 'aucun'
      patch.statutFacturation = 'non_facture'
      patch.mainOeuvreIncluseContrat = false
      patch.contratId = undefined
      patch.devisId = undefined
    } else if (next === 'garantie') {
      patch.sousGarantie = true
      patch.statutFacturation = 'garantie_prise_en_charge'
      patch.lienCommandeType = 'aucun'
    } else if (next === 'commande_materiel') {
      patch.lienCommandeType = 'commande'
      patch.statut = 'en_attente_piece'
    } else if (next === 'sous_traitance') {
      patch.lienCommandeType = 'commande'
    }
    onChange(patch)
  }

  return (
    <div className="space-y-3 rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3 sm:p-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-900">
          Chaîne commerciale
        </p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-emerald-950/80">
          Devis, contrat, commande pièce, garantie ou sous-traitance — pour rattacher l’INT à la
          commande métier (1 devis peut couvrir plusieurs INT / jours).
        </p>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-semibold text-ink">Origine de l’INT</span>
        <select
          value={origine}
          onChange={(e) => applyOrigine(e.target.value as OrigineOt)}
          className="h-11 w-full rounded-xl border border-line bg-white px-3"
        >
          {(Object.keys(ORIGINE_OT_LABELS) as OrigineOt[]).map((t) => (
            <option key={t} value={t}>
              {ORIGINE_OT_LABELS[t]}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-ink">Facturation</span>
          <select
            value={factu}
            onChange={(e) =>
              onChange({ statutFacturation: e.target.value as StatutFacturationOt })
            }
            className="h-11 w-full rounded-xl border border-line bg-white px-3"
          >
            {(Object.keys(STATUT_FACTURATION_OT_LABELS) as StatutFacturationOt[]).map((t) => (
              <option key={t} value={t}>
                {STATUT_FACTURATION_OT_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-ink">Lien rapide (compat)</span>
          <select
            value={lienType}
            onChange={(e) => {
              const t = e.target.value as LienCommandeType
              onChange({
                lienCommandeType: t,
                contratId: t === 'contrat' ? value.contratId : undefined,
                devisId: t === 'devis' || t === 'devis_regule' ? value.devisId : undefined,
                lienCommandeRef: t === 'aucun' ? '' : value.lienCommandeRef,
              })
            }}
            className="h-11 w-full rounded-xl border border-line bg-white px-3"
          >
            {(Object.keys(LIEN_COMMANDE_LABELS) as LienCommandeType[]).map((t) => (
              <option key={t} value={t}>
                {LIEN_COMMANDE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {(origine === 'maintenance_contrat' || lienType === 'contrat') && (
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-ink">Contrat N°</span>
          {contrats.length === 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              Aucun contrat actif — créez-en un dans Contrats.
            </p>
          ) : (
            <select
              value={value.contratId || ''}
              onChange={(e) => {
                const c = contrats.find((x) => x.id === e.target.value)
                onChange({
                  contratId: e.target.value || undefined,
                  lienCommandeType: 'contrat',
                  lienCommandeRef: c?.numero || '',
                  origineOt: 'maintenance_contrat',
                  statutFacturation: 'sous_contrat',
                  mainOeuvreIncluseContrat: true,
                })
              }}
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            >
              <option value="">— Choisir —</option>
              {contrats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero}
                  {c.titre ? ` — ${c.titre}` : ''}
                </option>
              ))}
            </select>
          )}
          <label className="mt-2 flex items-center gap-2 text-xs font-medium text-ink">
            <input
              type="checkbox"
              checked={!!value.mainOeuvreIncluseContrat}
              onChange={(e) => onChange({ mainOeuvreIncluseContrat: e.target.checked })}
              className="accent-emerald-700"
            />
            Main-d’œuvre de base incluse contrat (0 €) — pièces/fluides hors contrat → régule
          </label>
        </label>
      )}

      {(origine === 'installation_devis' ||
        lienType === 'devis' ||
        lienType === 'devis_regule') && (
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-ink">Devis (1 devis → plusieurs INT)</span>
          <select
            value={value.devisId || ''}
            onChange={(e) => {
              const dv = devisList.find((x) => x.id === e.target.value)
              onChange({
                devisId: e.target.value || undefined,
                lienCommandeType: dv?.type === 'regularisation' ? 'devis_regule' : 'devis',
                lienCommandeRef: dv?.numero || '',
                origineOt: 'installation_devis',
              })
            }}
            className="h-11 w-full rounded-xl border border-line bg-white px-3"
          >
            <option value="">— Choisir ou créer via actions —</option>
            {devisList.map((dv) => (
              <option key={dv.id} value={dv.id}>
                {dv.numero} · {dv.libelle} ({dv.statut})
              </option>
            ))}
          </select>
          {devisLienClient ? (
            <a
              href={devisLienClient}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-xs font-semibold text-accent underline"
            >
              Ouvrir devis externe client
            </a>
          ) : null}
        </label>
      )}

      {(origine === 'commande_materiel' || lienType === 'commande') && (
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-ink">Commande fournisseur</span>
          <select
            value={value.commandeFournisseurId || ''}
            onChange={(e) => {
              const cmd = commandes.find((x) => x.id === e.target.value)
              onChange({
                commandeFournisseurId: e.target.value || undefined,
                lienCommandeType: 'commande',
                lienCommandeRef: cmd?.numero || '',
                origineOt: 'commande_materiel',
                statut: cmd?.statut === 'recue' ? 'pret_a_planifier' : 'en_attente_piece',
              })
            }}
            className="h-11 w-full rounded-xl border border-line bg-white px-3"
          >
            <option value="">— Aucune / créer ci-dessous —</option>
            {commandes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.numero} · {c.fournisseur || c.libelle} ({c.statut})
              </option>
            ))}
          </select>
        </label>
      )}

      {origine === 'garantie' || value.sousGarantie ? (
        <label className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950">
          <Shield className="h-4 w-4 shrink-0" />
          <input
            type="checkbox"
            checked={!!value.sousGarantie}
            onChange={(e) =>
              onChange({
                sousGarantie: e.target.checked,
                origineOt: e.target.checked ? 'garantie' : value.origineOt,
                statutFacturation: e.target.checked
                  ? 'garantie_prise_en_charge'
                  : value.statutFacturation,
              })
            }
            className="accent-amber-700"
          />
          Sous garantie (constructeur / installateur) — tracer pièces pour avoir fabricant
        </label>
      ) : null}

      {origine === 'sous_traitance' ? (
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-ink">
            Client payeur (donneur d’ordre)
          </span>
          <select
            value={value.clientPayeurId || ''}
            onChange={(e) => onChange({ clientPayeurId: e.target.value || undefined })}
            className="h-11 w-full rounded-xl border border-line bg-white px-3"
          >
            <option value="">— Même que le client site —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.raisonSociale || c.nom || c.id}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-muted">
            Site = client final · Facture → client payeur.
          </p>
        </label>
      ) : null}

      {lienType !== 'aucun' &&
      lienType !== 'contrat' &&
      !value.devisId &&
      !value.commandeFournisseurId ? (
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-ink">Réf. libre (n° externe)</span>
          <input
            value={value.lienCommandeRef || ''}
            onChange={(e) => onChange({ lienCommandeRef: e.target.value })}
            className="h-11 w-full rounded-xl border border-line bg-white px-3"
            placeholder="Ex. Tiime #452 · CMD Daikin…"
          />
        </label>
      ) : null}

      {!compact && value.id ? (
        <div className="flex flex-wrap gap-2 border-t border-emerald-200/80 pt-3">
          {onGenererDevisRegule ? (
            <button
              type="button"
              onClick={onGenererDevisRegule}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3 text-xs font-bold text-emerald-950 sm:flex-none"
            >
              <FilePlus2 className="h-4 w-4" /> Devis de régularisation
            </button>
          ) : null}
          {onGenererFacture ? (
            <button
              type="button"
              onClick={onGenererFacture}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3 text-xs font-bold text-emerald-950 sm:flex-none"
            >
              <Receipt className="h-4 w-4" /> Facture directe
            </button>
          ) : null}
          {onCreerCommandePiece ? (
            <button
              type="button"
              onClick={onCreerCommandePiece}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3 text-xs font-bold text-emerald-950 sm:flex-none"
            >
              <Package className="h-4 w-4" /> Commande pièce
            </button>
          ) : null}
        </div>
      ) : null}

      <p className="text-[10px] leading-relaxed text-muted">
        F-Gas : si fluide manipulé → CERFA 15497 lié à l’INT (stock bouteille décrémenté). Signatures
        tech + client avant facture / régule.
      </p>
    </div>
  )
}
