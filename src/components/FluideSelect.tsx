import { fluidesByFamille, findFluide, formatGwp } from '../lib/fluides'

type Props = {
  label?: string
  value: string
  onChange: (code: string) => void
  required?: boolean
  className?: string
  /** Afficher aussi les fluides interdits (défaut : oui, marqués) */
  includeInterdits?: boolean
  showMeta?: boolean
}

export function FluideSelect({
  label = 'Fluide',
  value,
  onChange,
  required,
  className = '',
  includeInterdits = true,
  showMeta = true,
}: Props) {
  const groups = fluidesByFamille().map((g) => ({
    ...g,
    items: includeInterdits ? g.items : g.items.filter((f) => !f.interdit),
  }))
  const known = findFluide(value)
  const custom = value && !known

  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block text-muted">{label}{required ? ' *' : ''}</span>
      <select
        required={required}
        value={known ? known.code : custom ? '__custom__' : ''}
        onChange={(e) => {
          const v = e.target.value
          if (v === '__custom__') return
          onChange(v)
        }}
        className="h-11 w-full rounded-xl border border-line bg-white px-3"
      >
        <option value="">— Choisir un fluide —</option>
        {groups.map((g) =>
          g.items.length === 0 ? null : (
            <optgroup key={g.famille} label={g.label}>
              {g.items.map((f) => (
                <option key={f.code} value={f.code}>
                  {f.code} · GWP {formatGwp(f)}
                  {f.interdit ? ' · INTERDIT' : ''}
                </option>
              ))}
            </optgroup>
          ),
        )}
        {custom && <option value="__custom__">{value} (hors liste)</option>}
      </select>
      {showMeta && known && (
        <p className="mt-1.5 text-xs text-muted">
          <span className="font-medium text-ink">
            GWP {formatGwp(known)}
          </span>
          {' · '}
          {known.familleDetail}
          {known.interdit ? (
            <span className="ml-1 font-semibold text-danger"> — manipulation interdite</span>
          ) : null}
          <br />
          {known.applications}
        </p>
      )}
    </label>
  )
}
