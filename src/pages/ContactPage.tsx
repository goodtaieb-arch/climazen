import { type FormEvent, useState } from 'react'
import { CONTACT_EMAIL } from '../components/PublicLayout'

export function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const subject = encodeURIComponent(`Contact ClimaZEN — ${name.trim() || 'Demande'}`)
    const body = encodeURIComponent(
      `Nom : ${name.trim()}\nEmail : ${email.trim()}\n\n${message.trim()}`,
    )
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`
  }

  return (
    <div className="bg-foam px-4 py-14 text-ink sm:px-6 sm:py-16">
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Contact</h1>
        <p className="mt-3 text-muted">
          Une question sur ClimaZEN, une démo, ou l’accès société ? Écrivez-nous.
        </p>
        <p className="mt-2 text-sm">
          Email direct :{' '}
          <a className="font-semibold text-accent hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-2xl border border-line bg-white p-5 sm:p-6">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink">Nom</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 w-full rounded-xl border border-line bg-foam px-3 outline-none focus:border-accent"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink">Email</span>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 w-full rounded-xl border border-line bg-foam px-3 outline-none focus:border-accent"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink">Message</span>
            <textarea
              required
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-xl border border-line bg-foam px-3 py-2 outline-none focus:border-accent"
            />
          </label>
          <button
            type="submit"
            className="rounded-full bg-accent px-6 py-3 text-sm font-bold text-ink hover:bg-accent-hover"
          >
            Ouvrir l’e-mail
          </button>
          <p className="text-xs text-muted">
            Cela ouvre votre application mail avec le message prêt à envoyer.
          </p>
        </form>
      </div>
    </div>
  )
}
