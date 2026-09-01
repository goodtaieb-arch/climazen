import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  OUTILLAGE_CATALOG,
  outillageCatalogParGroupe,
  outillageCatalogParGroupeFiltre,
  type OutillageTypeId,
} from '../lib/outillageCatalog'

type Props = {
  value: OutillageTypeId
  onChange: (next: OutillageTypeId) => void
}

function optionLabel(id: OutillageTypeId) {
  const def = OUTILLAGE_CATALOG[id]
  return def.needsControleDate ? `${def.label} · étalonnage` : def.label
}

/**
 * Liste longue : écrire le début du nom → suggestions du catalogue,
 * ou 2 flèches → liste complète groupée (comme l’ancien select).
 */
export function OutillageTypeCombobox({ value, onChange }: Props) {
  const listId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [typing, setTyping] = useState(false)

  const groups = typing
    ? outillageCatalogParGroupeFiltre(query)
    : outillageCatalogParGroupe()

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setTyping(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const pick = (id: OutillageTypeId) => {
    onChange(id)
    setOpen(false)
    setTyping(false)
    setQuery('')
  }

  const openFullList = () => {
    setTyping(false)
    setQuery('')
    setOpen((was) => {
      const next = !was
      if (next) setTimeout(() => inputRef.current?.focus(), 0)
      return next
    })
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex h-12 overflow-hidden rounded-xl border border-line bg-white md:h-11">
        <input
          ref={inputRef}
          type="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          placeholder="Écrire le début (ex. cam, pompe…) ou ouvrir la liste"
          value={typing ? query : optionLabel(value)}
          onChange={(e) => {
            setTyping(true)
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={(e) => {
            setOpen(true)
            e.currentTarget.select()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false)
              setTyping(false)
              setQuery('')
              inputRef.current?.blur()
            }
            if (e.key === 'Enter') {
              e.preventDefault()
              const first = groups[0]?.items[0]
              if (open && first) pick(first.id)
            }
          }}
          className="min-w-0 flex-1 bg-transparent px-3 text-base outline-none md:text-sm"
        />
        <button
          type="button"
          aria-label={open && !typing ? 'Fermer la liste' : 'Ouvrir toute la liste'}
          title="Liste complète"
          onClick={openFullList}
          className="grid w-12 shrink-0 place-items-center border-l border-line text-muted hover:bg-mist hover:text-ink md:w-11"
        >
          <ChevronDown className={['h-5 w-5', open && !query.trim() ? 'rotate-180' : ''].join(' ')} />
        </button>
      </div>

      {open ? (
        <div
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-line bg-white py-1 shadow-lg"
        >
          {groups.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted">
              Aucun type ne correspond — uniquement notre catalogue.
            </p>
          ) : (
            groups.map((g) => (
              <div key={g.id}>
                <p className="sticky top-0 bg-mist/95 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-muted">
                  {g.label}
                </p>
                {g.items.map((t) => {
                  const active = t.id === value
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => pick(t.id)}
                      className={[
                        'flex w-full flex-col items-start px-3 py-2 text-left text-sm',
                        active ? 'bg-accent-soft font-semibold text-ink' : 'text-ink hover:bg-mist',
                      ].join(' ')}
                    >
                      <span>
                        {t.label}
                        {t.needsControleDate ? (
                          <span className="ml-1 text-xs font-semibold text-sky-800">· étalonnage</span>
                        ) : null}
                      </span>
                      {t.hint ? <span className="text-xs font-normal text-muted">{t.hint}</span> : null}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
