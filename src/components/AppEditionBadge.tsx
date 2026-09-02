import type { AppEdition } from '../lib/appEdition'
import { APP_EDITION_LABELS, APP_EDITION_TAGLINES } from '../lib/appEdition'

type Props = {
  edition: AppEdition
  className?: string
  size?: 'sm' | 'md'
}

export function AppEditionBadge({ edition, className = '', size = 'md' }: Props) {
  const light = edition === 'light'
  return (
    <span
      className={[
        'inline-flex items-center rounded-full font-bold uppercase tracking-wide',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]',
        light
          ? 'border border-teal-200 bg-teal-50 text-teal-900'
          : 'border border-indigo-200 bg-indigo-50 text-indigo-900',
        className,
      ].join(' ')}
      title={APP_EDITION_TAGLINES[edition]}
    >
      {APP_EDITION_LABELS[edition]}
    </span>
  )
}
