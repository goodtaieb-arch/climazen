import { postesParFamille, parsePostePersonnel, secteursOt, labelSecteurCourt, type PostePersonnelId } from '../lib/postePersonnel'
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
