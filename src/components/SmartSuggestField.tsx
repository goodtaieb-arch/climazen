import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { matchesQuery } from './SearchField'

export type SmartSuggestion = {
  id: string
  label: string
  hint?: string
}

type Props = {
  label: string
  value: string
  onChange: (v: string) => void
  suggestions: SmartSuggestion[]
  /** Called when user picks a suggestion (Enter / click). */
  onPick?: (s: SmartSuggestion) => void
  placeholder?: string
  required?: boolean
  className?: string
  /** Max suggestions shown (default 8). */
  limit?: number
  /** Show list even when value is empty (useful for client picker). */
  showWhenEmpty?: boolean
  inputMode?: 'search' | 'text' | 'numeric' | 'tel' | 'email' | 'url'
  autoComplete?: string
}

export function SmartSuggestField({
  label,
  value,
  onChange,
  suggestions,
  onPick,
  placeholder,
  required,
  className = '',
  limit = 8,
  showWhenEmpty = false,
  inputMode,
  autoComplete = 'off',
}: Props) {
  const listId = useId()
  const rootRef = useRef<HTMLLabelElement>(null)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)

  const filtered = useMemo(() => {
    const q = value.trim()
    const base = !q
      ? showWhenEmpty
        ? suggestions
        : []
      : suggestions.filter(
          (s) =>
            matchesQuery(s.label, q) ||
            (s.hint ? matchesQuery(s.hint, q) : false),
        )
    // Prefer exact-ish starts, then includes (already filtered)
    const scored = [...base].sort((a, b) => {
      const qa = q.toLowerCase()
      const al = a.label.toLowerCase()
      const bl = b.label.toLowerCase()
      const as = al.startsWith(qa) ? 0 : 1
      const bs = bl.startsWith(qa) ? 0 : 1
      if (as !== bs) return as - bs
      return al.localeCompare(bl, 'fr')
    })
    return scored.slice(0, limit)
  }, [suggestions, value, limit, showWhenEmpty])

  useEffect(() => {
    setHighlight(0)
  }, [value, open])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const pick = (s: SmartSuggestion) => {
    onChange(s.label)
    onPick?.(s)
    setOpen(false)
  }

  const showList = open && filtered.length > 0

  return (
    <label ref={rootRef} className={`relative block text-sm ${className}`}>
      <span className="mb-1 block font-semibold text-ink">{label}</span>
      <input
        type="text"
        required={required}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (!showList) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHighlight((h) => Math.min(h + 1, filtered.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlight((h) => Math.max(h - 1, 0))
          } else if (e.key === 'Enter' && filtered[highlight]) {
            e.preventDefault()
            pick(filtered[highlight])
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        className="h-11 w-full rounded-xl border border-line bg-white px-3 outline-none focus:border-accent"
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-40 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-line bg-white py-1 shadow-lg"
        >
          {filtered.map((s, i) => (
            <li key={s.id} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                className={[
                  'flex w-full flex-col items-start px-3 py-2 text-left text-sm',
                  i === highlight ? 'bg-accent-soft' : 'hover:bg-mist',
                ].join(' ')}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(s)
                }}
              >
                <span className="font-medium text-ink">{s.label}</span>
                {s.hint ? <span className="text-xs text-muted">{s.hint}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </label>
  )
}
