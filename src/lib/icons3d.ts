/** Icônes 3D — import Vite (URL hashée) pour éviter le cache PWA cassé. */
import sites from '../assets/icons3d/climazen-sites.png'
import cerfa from '../assets/icons3d/climazen-cerfa.png'
import bottle from '../assets/icons3d/climazen-bottle.png'
import clients from '../assets/icons3d/climazen-clients.png'
import accueil from '../assets/icons3d/climazen-accueil.png'
import equipe from '../assets/icons3d/climazen-equipe.png'
import entreprise from '../assets/icons3d/climazen-entreprise.png'
import signaturePad from '../assets/icons3d/climazen-signature.png'
import search from '../assets/icons3d/search.png'
import maintenance from '../assets/icons3d/maintenance.png'
import signatureQuick from '../assets/icons3d/signature.png'

export const ICON3D = {
  sites,
  cerfa,
  bottle,
  clients,
  accueil,
  equipe,
  entreprise,
  signaturePad,
  search,
  maintenance,
  signature: signatureQuick,
} as const

/** Icône 3D pour une route de navigation (sidebar / bottom). */
export function icon3dForRoute(to: string): string | null {
  if (to === '/app' || to === '/app/') return ICON3D.accueil
  if (to === '/app/clients') return ICON3D.clients
  if (to === '/app/chantiers') return ICON3D.sites
  if (to === '/app/stock') return ICON3D.bottle
  if (to === '/app/ot') return ICON3D.maintenance
  if (to === '/app/contrats') return ICON3D.maintenance
  if (to === '/app/agenda') return ICON3D.search
  if (to === '/app/interventions') return ICON3D.cerfa
  if (to === '/app/equipe' || to.startsWith('/app/equipe/')) return ICON3D.equipe
  if (to === '/app/operateur') return ICON3D.entreprise
  if (to === '/app/profil') return ICON3D.signaturePad
  return null
}
