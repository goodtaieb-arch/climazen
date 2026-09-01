import { postesParFamille, parsePostePersonnel, type PostePersonnelId } from '../lib/postePersonnel'

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
