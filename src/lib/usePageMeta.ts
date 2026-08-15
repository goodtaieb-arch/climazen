import { useEffect } from 'react'

/** Met à jour title / description / canonical pour les pages publiques (SEO SPA). */
export function usePageMeta(opts: {
  title: string
  description: string
  path: string
}) {
  const { title, description, path } = opts
  const url = `https://climazen.fr${path.startsWith('/') ? path : `/${path}`}`

  useEffect(() => {
    const prevTitle = document.title
    document.title = title

    const ensureMeta = (attr: 'name' | 'property', key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attr, key)
        document.head.appendChild(el)
      }
      el.content = content
    }

    ensureMeta('name', 'description', description)
    ensureMeta('property', 'og:title', title)
    ensureMeta('property', 'og:description', description)
    ensureMeta('property', 'og:url', url)
    ensureMeta('name', 'twitter:title', title)
    ensureMeta('name', 'twitter:description', description)

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = url

    return () => {
      document.title = prevTitle
    }
  }, [title, description, url])
}
