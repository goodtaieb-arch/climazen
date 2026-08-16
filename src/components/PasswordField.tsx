import { useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string
  /** Style formulaire sombre (login / register) */
  dark?: boolean
}

/** Champ mot de passe avec œil pour afficher / masquer. */
export function PasswordField({ label, dark, className = '', id, ...inputProps }: Props) {
  const [visible, setVisible] = useState(false)
  const inputId = id || `pwd-${label.replace(/\s+/g, '-').toLowerCase()}`

  const labelCls = dark ? 'mb-1 block text-white/70' : 'mb-1 block font-semibold text-ink'
  const inputCls = dark
    ? 'h-11 w-full rounded-xl border border-white/15 bg-ink/40 py-2 pl-3 pr-11 text-white outline-none focus:border-accent'
    : 'h-11 w-full rounded-xl border border-line bg-white py-2 pl-3 pr-11 outline-none focus:border-accent'
  const btnCls = dark
    ? 'absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-white/55 hover:bg-white/10 hover:text-white'
    : 'absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:bg-mist hover:text-ink'

  return (
    <label className={`block text-sm ${className}`} htmlFor={inputId}>
      <span className={labelCls}>{label}</span>
      <span className="relative block">
        <input
          {...inputProps}
          id={inputId}
          type={visible ? 'text' : 'password'}
          className={inputCls}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          className={btnCls}
          aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          title={visible ? 'Masquer' : 'Afficher'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </span>
    </label>
  )
}
