import { DEPARTEMENTS_FR, labelAgence, parseAgenceCode } from '../lib/agences'

type Props = {
  value?: string
  onChange: (next: string | undefined) => void
  label?: string
  compact?: boolean
  className?: string
  disabled?: boolean
}

export function AgenceSelect({
  value,
  onChange,
  label = 'Agence (département)',
  compact,
  className = '',
  disabled,
}: Props) {
  return (
    <label className={`block text-sm ${className}`}>
      {label ? (
        <span className={`${compact ? 'mb-0.5 text-xs' : 'mb-1'} block font-semibold text-ink`}>
          {label}
        </span>
      ) : null}
      <select
        disabled={disabled}
        value={parseAgenceCode(value) || ''}
        onChange={(e) => onChange(parseAgenceCode(e.target.value))}
        className={
          compact
            ? 'h-9 w-full rounded-lg border border-line bg-white px-2 text-sm'
            : 'h-11 w-full rounded-xl border border-line bg-white px-3'
        }
      >
        <option value="">— Non classé —</option>
        {DEPARTEMENTS_FR.map((d) => (
          <option key={d.code} value={d.code}>
            {d.code} · {d.nom}
          </option>
        ))}
      </select>
      {value && labelAgence(value) ? (
        <span className="mt-0.5 block text-[11px] text-muted">{labelAgence(value)}</span>
      ) : (
        <span className="mt-0.5 block text-[11px] text-muted">
          Ex. 75 Paris, 06 Alpes-Maritimes, 13 Bouches-du-Rhône
        </span>
      )}
    </label>
  )
}
