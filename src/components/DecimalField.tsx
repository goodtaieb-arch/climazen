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
}: {
  label: string
  value: number
  onChange: (n: number) => void
  className?: string
  required?: boolean
  placeholder?: string
  /** Si true, 0 s’affiche vide pour faciliter la saisie */
  emptyZero?: boolean
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
        placeholder={placeholder}
        value={text}
        onFocus={() => {
          focused.current = true
        }}
        onBlur={() => {
          focused.current = false
          const n = parseDecimalFr(text)
          const final = n ?? 0
          onChange(final)
          setText(toText(final))
        }}
        onChange={(e) => {
          const raw = sanitizeDecimalTyping(e.target.value)
          setText(raw)
          if (raw === '') {
            onChange(0)
            return
          }
          const n = parseDecimalFr(raw)
          if (n !== null) onChange(n)
        }}
        className="h-12 w-full rounded-xl border border-line bg-white px-3 text-base outline-none focus:border-accent md:h-11 md:text-sm"
      />
    </label>
  )
}
