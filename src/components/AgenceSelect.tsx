import {
  DEPARTEMENTS_FR,
  labelAgence,
  parseAgenceCode,
  parseAgencesCouvertes,
} from '../lib/agences'

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

/** Responsable qui gère plusieurs départements. */
export function AgencesCouvertesFields({
  value,
  onChange,
  compact,
  className = '',
}: {
  value?: string[]
  onChange: (next: string[]) => void
  compact?: boolean
  className?: string
}) {
  const selected = parseAgencesCouvertes(value)
  return (
    <div className={`block text-sm ${className}`}>
      <span className={`${compact ? 'mb-0.5 text-xs' : 'mb-1'} block font-semibold text-ink`}>
        Régions couvertes (responsable)
      </span>
      <p className="mb-1 text-[11px] text-muted">
        Cochez 06 + 13 si vous pilotez plusieurs agences. L’agenda se filtre dessus.
      </p>
      <div
        className={
          compact
            ? 'max-h-28 overflow-auto rounded-lg border border-line bg-white p-1.5'
            : 'max-h-40 overflow-auto rounded-xl border border-line bg-white p-2'
        }
      >
        {DEPARTEMENTS_FR.map((d) => {
          const on = selected.includes(d.code)
          return (
            <label key={d.code} className="flex items-center gap-2 px-1 py-0.5 text-xs">
              <input
                type="checkbox"
                checked={on}
                onChange={() =>
                  onChange(
                    on ? selected.filter((c) => c !== d.code) : [...selected, d.code],
                  )
                }
              />
              {d.code} · {d.nom}
            </label>
          )
        })}
      </div>
    </div>
  )
}

/** Pastilles pour filtrer agenda / liste INT par une ou plusieurs régions. */
export function AgenceFilterChips({
  selected,
  onChange,
  codes,
  className = '',
}: {
  selected: string[]
  onChange: (next: string[]) => void
  codes: string[]
  className?: string
}) {
  const unique = parseAgencesCouvertes(codes)
  const on = parseAgencesCouvertes(selected)
  const toutes = on.length === 0
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      <span className="text-xs font-bold uppercase text-muted">Région</span>
      <button
        type="button"
        onClick={() => onChange([])}
        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
          toutes ? 'border-ink bg-ink text-white' : 'border-line bg-white text-muted'
        }`}
      >
        Toutes
      </button>
      {unique.map((code) => {
        const active = on.includes(code)
        return (
          <button
            key={code}
            type="button"
            onClick={() =>
              onChange(active ? on.filter((c) => c !== code) : [...on, code])
            }
            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
              active
                ? 'border-teal-700 bg-teal-700 text-white'
                : 'border-line bg-white text-ink'
            }`}
          >
            {code}
          </button>
        )
      })}
    </div>
  )
}
