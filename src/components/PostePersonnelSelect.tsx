import {
  postesParFamille,
  parsePostePersonnel,
  secteursOt,
  labelSecteurCourt,
  isPosteBureau,
  ACTIVITE_BUREAU_LABELS,
  parseActiviteBureau,
  parseMetiersCouverts,
  type ActiviteBureau,
  type PostePersonnelId,
} from '../lib/postePersonnel'
import { couleurMetier, COULEUR_NON_AFFECTE } from '../lib/agendaPlanning'

type Props = {
  value?: PostePersonnelId | ''
  onChange: (next: PostePersonnelId | '') => void
  disabled?: boolean
  id?: string
  /** Compact for the expanded member row */
  compact?: boolean
  required?: boolean
  className?: string
}

export function PostePersonnelSelect({
  value,
  onChange,
  disabled,
  id,
  compact,
  required,
  className = '',
}: Props) {
  return (
    <select
      id={id}
      required={required}
      value={value || ''}
      disabled={disabled}
      onChange={(e) => onChange(parsePostePersonnel(e.target.value) || '')}
      className={
        className ||
        (compact
          ? 'h-9 w-full max-w-xs rounded-lg border border-line bg-white px-2 text-sm'
          : 'h-11 w-full rounded-xl border border-line bg-white px-3')
      }
    >
      <option value="">— Choisir le poste —</option>
      <optgroup label="Terrain">
        {postesParFamille('terrain').map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </optgroup>
      <optgroup label="Bureau">
        {postesParFamille('bureau').map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
            {p.couvreTouteLEquipe ? ' — toute l’équipe' : ''}
          </option>
        ))}
      </optgroup>
    </select>
  )
}

type SecteurProps = {
  value?: PostePersonnelId | ''
  onChange: (next: PostePersonnelId | undefined) => void
  disabled?: boolean
  required?: boolean
  label?: string
  className?: string
}

/** Classement OT : CVC, frigoriste, plombier… avec pastille couleur. */
export function SecteurOtSelect({
  value,
  onChange,
  disabled,
  required,
  label = 'Équipe / métier',
  className = '',
}: SecteurProps) {
  const col = couleurMetier(value) || COULEUR_NON_AFFECTE
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 flex items-center gap-2 font-semibold text-ink">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${col.dot}`} />
        {label}
        {required ? ' *' : ''}
      </span>
      <select
        required={required}
        disabled={disabled}
        value={value || ''}
        onChange={(e) => onChange(parsePostePersonnel(e.target.value))}
        className="h-11 w-full rounded-xl border border-line bg-white px-3"
      >
        <option value="">— Choisir (CVC, frigo…) —</option>
        {secteursOt().map((p) => (
          <option key={p.id} value={p.id}>
            {labelSecteurCourt(p.id)} — {p.label}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Responsable / bureau : travaux ou maintenance, et quels métiers. */
export function BureauActiviteFields({
  poste,
  activiteBureau,
  metiersCouverts,
  onChange,
  compact,
}: {
  poste?: PostePersonnelId | ''
  activiteBureau?: ActiviteBureau
  metiersCouverts?: PostePersonnelId[]
  onChange: (next: {
    activiteBureau?: ActiviteBureau
    metiersCouverts?: PostePersonnelId[]
  }) => void
  compact?: boolean
}) {
  if (!isPosteBureau(poste)) return null
  const mets = parseMetiersCouverts(metiersCouverts)
  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <label className="block text-sm">
        <span className={`${compact ? 'mb-0.5 text-xs' : 'mb-1'} block font-semibold text-ink`}>
          Secteur d’activité
        </span>
        <select
          value={activiteBureau || ''}
          onChange={(e) =>
            onChange({
              activiteBureau: parseActiviteBureau(e.target.value),
              metiersCouverts: mets,
            })
          }
          className={
            compact
              ? 'h-9 w-full max-w-xs rounded-lg border border-line bg-white px-2 text-sm'
              : 'h-11 w-full rounded-xl border border-line bg-white px-3'
          }
        >
          <option value="">— Travaux ou maintenance —</option>
          {(Object.keys(ACTIVITE_BUREAU_LABELS) as ActiviteBureau[]).map((k) => (
            <option key={k} value={k}>
              {ACTIVITE_BUREAU_LABELS[k]}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend className={`${compact ? 'mb-0.5 text-xs' : 'mb-1'} block font-semibold text-ink`}>
          Métiers dont il s’occupe
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {secteursOt().map((p) => {
            const on = mets.includes(p.id)
            const col = couleurMetier(p.id) || COULEUR_NON_AFFECTE
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  const next = on ? mets.filter((x) => x !== p.id) : [...mets, p.id]
                  onChange({ activiteBureau, metiersCouverts: next })
                }}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${col.border} ${col.bg} ${col.text} ${
                  on ? 'ring-2 ring-ink/30' : 'opacity-60'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                {labelSecteurCourt(p.id)}
              </button>
            )
          })}
        </div>
      </fieldset>
    </div>
  )
}
