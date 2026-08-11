import { Search } from 'lucide-react'

export function SearchField({
  value,
  onChange,
  placeholder = 'Rechercher…',
  testId,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  testId?: string
}) {
  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input
        data-testid={testId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-line bg-white ps-9 pe-3 text-sm outline-none focus:border-accent"
      />
    </div>
  )
}

export function matchesQuery(haystack: string, q: string) {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  return haystack.toLowerCase().includes(needle)
}
