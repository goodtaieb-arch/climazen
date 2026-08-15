import { useEffect, useRef, useState } from 'react'
import { formatDecimalFr, parseDecimalFr, sanitizeDecimalTyping } from '../lib/decimal'

/**
 * Champ kg / décimal adapté clavier FR (virgule).
 * Pas de type="number" → la virgule n’efface plus le champ, et le 0 initial disparaît.
 */
export function DecimalField({
  label,
  value,
  onChange,
  className = '',
  required,
  placeholder = 'ex. 2,2',
  emptyZero = true,
  disabled = false,
  hint,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  className?: string
  required?: boolean
  placeholder?: string
  /** Si true, 0 s’affiche vide pour faciliter la saisie */
  emptyZero?: boolean
  disabled?: boolean
  hint?: string
}) {
  const focused = useRef(false)
  const toText = (n: number) => (emptyZero && (!n || n === 0) ? '' : formatDecimalFr(n))
  const [text, setText] = useState(() => toText(value))

  useEffect(() => {
    if (focused.current) return
    setText(toText(value))
  }, [value, emptyZero]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block text-muted">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        required={required}
        disabled={disabled}
        readOnly={disabled}
        placeholder={placeholder}
        value={disabled && (!value || value === 0) ? '0' : text}
        onFocus={() => {
          if (disabled) return
          focused.current = true
        }}
        onBlur={() => {
          if (disabled) return
          focused.current = false
          const n = parseDecimalFr(text)
          const final = n ?? 0
          onChange(final)
          setText(toText(final))
        }}
        onChange={(e) => {
          if (disabled) return
          const raw = sanitizeDecimalTyping(e.target.value)
          setText(raw)
          if (raw === '') {
            onChange(0)
            return
          }
          const n = parseDecimalFr(raw)
          if (n !== null) onChange(n)
        }}
        className={[
          'h-12 w-full rounded-xl border border-line px-3 text-base outline-none md:h-11 md:text-sm',
          disabled
            ? 'cursor-not-allowed bg-mist/70 text-muted'
            : 'bg-white focus:border-accent',
        ].join(' ')}
      />
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </label>
  )
}
