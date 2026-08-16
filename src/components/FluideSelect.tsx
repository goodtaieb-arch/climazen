import {
  fluidesByFamille,
  findFluide,
  formatClasseSecuriteLabel,
  formatGwp,
  isFluideNonAssigne,
} from '../lib/fluides'

const UNASSIGNED = '__unassigned__'

type Props = {
  label?: string
  value: string
  onChange: (code: string) => void
  required?: boolean
  className?: string
  /** Afficher aussi les fluides interdits (défaut : oui, marqués) */
  includeInterdits?: boolean
  showMeta?: boolean
  /**
   * Option « Non assigné (défini lors du 1er CERFA) » —
   * pour bouteilles de récupération vides.
   */
  allowUnassigned?: boolean
  /** Désactive le sélecteur (fluide déjà verrouillé). */
  disabled?: boolean
}

export function FluideSelect({
  label = 'Fluide',
  value,
  onChange,
  required,
  className = '',
  includeInterdits = true,
  showMeta = true,
  allowUnassigned = false,
  disabled = false,
}: Props) {
  const groups = fluidesByFamille().map((g) => ({
    ...g,
    items: includeInterdits ? g.items : g.items.filter((f) => !f.interdit),
  }))
  const known = findFluide(value)
  const unassigned = isFluideNonAssigne(value)
  const custom = Boolean(value && !known && !unassigned)
  const classeLabel = !unassigned && value ? formatClasseSecuriteLabel(value) : null
  const classeWarn =
    known?.classeSecurite === 'A2L' ||
    known?.classeSecurite === 'A2' ||
    known?.classeSecurite === 'A3' ||
    known?.classeSecurite === 'B2L' ||
    known?.classeSecurite === 'B2' ||
    known?.classeSecurite === 'B3'

  const selectValue = known
    ? known.code
    : unassigned && allowUnassigned
      ? UNASSIGNED
      : custom
        ? '__custom__'
        : ''

  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block font-semibold text-ink">
        {label}
        {required && !allowUnassigned ? ' *' : ''}
        {allowUnassigned && !required ? ' (optionnel)' : ''}
      </span>
      <select
        required={required && !allowUnassigned}
        disabled={disabled}
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value
          if (v === '__custom__') return
          if (v === UNASSIGNED) {
            onChange('')
            return
          }
          onChange(v)
        }}
        className={[
          'h-12 w-full rounded-xl border border-line px-3 text-base md:h-11 md:text-sm',
          disabled ? 'cursor-not-allowed bg-mist/70 text-muted' : 'bg-white',
        ].join(' ')}
      >
        {!allowUnassigned && <option value="">— Choisir un fluide —</option>}
        {allowUnassigned && (
          <option value={UNASSIGNED}>Non assigné (défini lors du 1er CERFA)</option>
        )}
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
      {classeLabel && (
        <p
          className={[
            'mt-1.5 text-sm font-semibold',
            classeWarn ? 'text-amber-800' : 'text-ink',
          ].join(' ')}
        >
          {classeLabel}
        </p>
      )}
      {allowUnassigned && unassigned && (
        <p className="mt-1.5 text-xs text-muted">
          La bouteille sera verrouillée sur le fluide du premier CERFA de récupération.
        </p>
      )}
      {showMeta && known && (
        <p className="mt-1 text-xs text-muted">
          <span className="font-medium text-ink">GWP {formatGwp(known)}</span>
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
