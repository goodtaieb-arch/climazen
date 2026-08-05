import { useId, useState, type ReactNode } from 'react'
import { CircleHelp } from 'lucide-react'

type Props = {
  label: string
  children: ReactNode
  /** Affiché au survol / au tap */
  tip: ReactNode
  className?: string
}

/** Label avec petite bulle d’explication au survol (et tap mobile). */
export function LabelHint({ label, tip, children, className = '' }: Props) {
  const id = useId()
  const [open, setOpen] = useState(false)

  return (
    <label className={`relative block text-sm ${className}`}>
      <span className="mb-1 flex items-center gap-1.5 text-muted">
        <span>{label}</span>
        <button
          type="button"
          className="group relative inline-flex shrink-0 rounded-full text-accent outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-describedby={id}
          aria-expanded={open}
          onClick={(e) => {
            e.preventDefault()
            setOpen((v) => !v)
          }}
          onBlur={() => setOpen(false)}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          <CircleHelp className="h-4 w-4" aria-hidden />
          <span className="sr-only">Aide : {label}</span>
          {(open) && (
            <span
              id={id}
              role="tooltip"
              className="absolute bottom-full left-1/2 z-50 mb-2 w-72 -translate-x-1/2 rounded-xl border border-line bg-ink px-3 py-2.5 text-left text-xs leading-relaxed font-normal text-white shadow-lg sm:w-80"
            >
              {tip}
              <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-ink" />
            </span>
          )}
        </button>
      </span>
      {children}
    </label>
  )
}
