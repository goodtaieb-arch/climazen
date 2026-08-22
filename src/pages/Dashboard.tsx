import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Building2,
  CheckCircle2,
  ClipboardList,
  Mail,
  MapPin,
  Package,
  PenLine,
  Phone,
  QrCode,
  Search,
  X,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { allEquipements } from '../lib/cerfaBatch'
import { matchesQuery } from '../components/SearchField'
import { isBouteilleRetournee } from '../lib/types'
import { APP_BUILD, APP_VERSION } from '../lib/buildStamp'
import { ICON3D } from '../lib/icons3d'
import {
  agendaSortDate,
  isAgendaDueSoon,
  isAgendaOverdue,
  telHref,
  mailtoHref,
} from '../lib/agenda'
import { formatOtNumero } from '../lib/ordreTravail'

const ONBOARDING_KEY = 'climazen_onboarding_dismissed'

const QUICK_START = [
  {
    n: 1,
    title: 'Créer l’OT',
    hint: 'Dès l’appel client — décrire la panne',
    img: ICON3D.cerfa,
    alt: 'OT 3D',
    delay: '0s',
    to: '/app/appel',
  },
  {
    n: 2,
    title: 'Client & site',
    hint: 'Puis équipements sur place',
    img: ICON3D.sites,
    alt: 'Site 3D',
    delay: '0.5s',
    to: '/app/appel',
  },
  {
    n: 3,
    title: 'CERFA ou fiche',
    hint: 'Signer technicien + client',
    img: ICON3D.signature,
    alt: 'Signature 3D',
    delay: '1s',
    to: '/app/appel',
  },
] as const

export function Dashboard() {
  const { data } = useStore()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [showOnboarding, setShowOnboarding] = useState(false)

  const brouillons = data.interventions.filter((i) => i.status === 'brouillon')
  const signes = data.interventions.filter((i) => i.status === 'signe' || i.status === 'envoye')
  const actifs = data.chantiers.filter((c) => c.statut === 'actif')
  const stockKg = data.stock.reduce((s, i) => s + i.quantiteKg, 0)
  const stockCount = data.stock.filter((s) => !isBouteilleRetournee(s)).length

  const aReprendre = useMemo(() => {
    return [...brouillons]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 5)
  }, [brouillons])

  const otAReprendre = useMemo(() => {
    return [...(data.ordresTravail || [])]
      .filter((o) => o.statut === 'brouillon' || o.statut === 'en_cours')
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 5)
  }, [data.ordresTravail])

  const agendaAContacter = useMemo(() => {
    return [...(data.agendaEvents || [])]
      .filter(
        (e) =>
          (e.statut === 'a_faire' || e.statut === 'contacte') &&
          (isAgendaOverdue(e) || isAgendaDueSoon(e, 14)),
      )
      .sort((a, b) => agendaSortDate(a).localeCompare(agendaSortDate(b)))
      .slice(0, 5)
  }, [data.agendaEvents])

  const steps = [
    {
      id: 'client',
      done: data.clients.length > 0,
      label: 'Ajouter un client / détenteur',
      to: '/app/clients',
      icon: Building2,
    },
    {
      id: 'chantier',
      done: data.chantiers.length > 0,
      label: 'Créer un site / parc équipements',
      to: '/app/chantiers',
      icon: MapPin,
    },
    {
      id: 'stock',
      done: data.stock.length > 0,
      label: 'Enregistrer une bouteille de stock',
      to: '/app/stock',
      icon: Package,
    },
    {
      id: 'cerfa',
      done: data.interventions.length > 0,
      label: 'Créer une fiche CERFA',
      to: '/app/chantiers',
      icon: ClipboardList,
    },
  ]
  const allDone = steps.every((s) => s.done)
  const progress = steps.filter((s) => s.done).length

  useEffect(() => {
    if (allDone) {
      setShowOnboarding(false)
      return
    }
    try {
      if (localStorage.getItem(ONBOARDING_KEY) === '1') {
        setShowOnboarding(false)
        return
      }
    } catch {
      /* ignore */
    }
    setShowOnboarding(true)
  }, [allDone])

  const dismissOnboarding = () => {
    try {
      localStorage.setItem(ONBOARDING_KEY, '1')
    } catch {
      /* ignore */
    }
    setShowOnboarding(false)
  }

  const searchHits = useMemo(() => {
    if (!q.trim()) return []
    return data.chantiers
      .map((c) => {
        const client = data.clients.find((cl) => cl.id === c.clientId)
        const eqs = allEquipements(c)
        const hay = [
          c.nom,
          c.ville,
          c.adresse,
          client?.raisonSociale,
          ...eqs.map((e) => [e.nom, e.type, e.marque, e.modele, e.numeroSerie].join(' ')),
        ]
          .filter(Boolean)
          .join(' ')
        return { c, client, eqs, ok: matchesQuery(hay, q) }
      })
      .filter((x) => x.ok)
      .slice(0, 8)
  }, [data.chantiers, data.clients, q])

  const recentSites = useMemo(() => {
    return [...data.chantiers]
      .sort((a, b) =>
        (b.derniereMaintenanceDate || b.createdAt || '').localeCompare(
          a.derniereMaintenanceDate || a.createdAt || '',
        ),
      )
      .slice(0, 6)
  }, [data.chantiers])

  const goTravaux = (search?: string) => {
    navigate('/app/chantiers', {
      state: search?.trim() ? { search: search.trim() } : { travauxList: Date.now() },
    })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 lg:max-w-none lg:space-y-8">
      <section className="space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
              Accueil
            </h1>
            <p className="mt-1 hidden text-sm font-medium text-muted sm:block sm:text-base">
              OT &amp; CERFA partagés dans la société — tech en astreinte : bouton « Client appelle ».
            </p>
            <p className="mt-1 text-[11px] font-extrabold tracking-wide text-[#0f766e]">
              Version {APP_VERSION}
              <span className="ml-2 font-semibold text-muted">({APP_BUILD})</span>
            </p>
          </div>
          <label className="relative block w-full md:w-80">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  goTravaux(q)
                }
              }}
              placeholder="Rechercher un site, client…"
              className="h-12 w-full rounded-2xl border border-line bg-white py-3 pl-10 pr-4 text-sm font-medium shadow-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30 md:h-12"
              autoComplete="off"
              inputMode="search"
            />
          </label>
        </div>

        {/* Bandeau guide 3D — Quick Start */}
        {!q.trim() && (
          <nav
            aria-label="Mode d’emploi rapide"
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-teal-600 to-slate-800 p-4 text-white shadow-xl sm:p-6"
          >
            <div
              className="pointer-events-none absolute -bottom-10 -right-10 h-60 w-60 rounded-full bg-white/5 blur-2xl"
              aria-hidden
            />
            <div className="relative mb-3 hidden items-center justify-between gap-3 sm:mb-5 sm:flex">
              <span className="rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white backdrop-blur-md">
                Mode d’emploi rapide
              </span>
              <span className="hidden text-xs font-medium text-emerald-100 sm:inline">
                Appel client → OT → site → docs
              </span>
            </div>
            <div className="relative mb-0 md:mb-4">
              <Link
                to="/app/appel"
                className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 text-base font-bold text-emerald-800 shadow-md transition hover:bg-emerald-50 active:scale-[0.99]"
              >
                <Phone className="h-5 w-5" /> Client appelle — créer l’OT
              </Link>
            </div>
            <ol className="relative mt-4 hidden grid-cols-1 gap-3 md:grid md:grid-cols-3 md:gap-4">
              {QUICK_START.map((step) => (
                <li key={step.n}>
                  <Link
                    to={step.to}
                    className="group flex items-center gap-4 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md transition-all hover:bg-white/20 active:scale-[0.99]"
                  >
                    <span
                      className="float-3d flex h-16 w-16 shrink-0 items-center justify-center"
                      style={{ animationDelay: step.delay }}
                    >
                      <img
                        src={step.img}
                        alt={step.alt}
                        width={56}
                        height={56}
                        className="h-14 w-14 object-contain drop-shadow-md transition-transform group-hover:scale-110"
                        loading="eager"
                        decoding="async"
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[10px] font-extrabold uppercase tracking-widest text-emerald-200">
                        Étape {step.n}
                      </span>
                      <span className="mt-0.5 block text-base font-bold text-white">{step.title}</span>
                      <span className="mt-0.5 block text-xs text-emerald-100/80">{step.hint}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
        )}

        {q.trim() && (
          <ul className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
            {searchHits.length === 0 ? (
              <li className="px-4 py-4 text-sm text-muted">Aucun site trouvé.</li>
            ) : (
              searchHits.map(({ c, client, eqs }) => (
                <li key={c.id} className="border-b border-line last:border-0">
                  <button
                    type="button"
                    onClick={() => goTravaux(c.nom)}
                    className="flex min-h-14 w-full flex-col gap-0.5 px-4 py-3.5 text-left active:bg-mist"
                  >
                    <span className="font-semibold text-ink">{c.nom}</span>
                    <span className="text-sm text-muted">
                      {client?.raisonSociale || '—'}
                      {c.ville ? ` · ${c.ville}` : ''}
                      {eqs.length ? ` · ${eqs.length} équip.` : ''}
                    </span>
                  </button>
                </li>
              ))
            )}
            <li>
              <button
                type="button"
                onClick={() => goTravaux(q)}
                className="min-h-12 w-full px-4 py-3 text-left text-sm font-semibold text-accent active:bg-mist"
              >
                Voir tous les résultats dans Sites →
              </button>
            </li>
          </ul>
        )}

        {/* Menu portable — cercles (mobile) / liste (desktop) */}
        {!q.trim() && (
          <>
            <nav
              className="grid grid-cols-2 gap-x-4 gap-y-6 px-2 py-2 md:hidden"
              aria-label="Actions terrain"
            >
              <CircleHomeTile
                title="Sites & Parc"
                img={ICON3D.sites}
                onClick={() => goTravaux()}
                delay="0s"
              />
              <CircleHomeTile
                title="Scanner QR"
                img={ICON3D.search}
                to="/app/scan-equip?camera=1"
                delay="0.08s"
              />
              <CircleHomeTile
                title="Agenda"
                img={ICON3D.search}
                to="/app/agenda"
                badge={agendaAContacter.length || undefined}
                delay="0.15s"
              />
              <CircleHomeTile
                title="CERFA"
                img={ICON3D.cerfa}
                to="/app/interventions"
                badge={brouillons.length || undefined}
                delay="0.3s"
              />
              <CircleHomeTile
                title="Stock fluides"
                img={ICON3D.bottle}
                to="/app/stock"
                delay="0.45s"
              />
              <CircleHomeTile
                title="Clients"
                img={ICON3D.clients}
                to="/app/clients"
                delay="0.6s"
              />
              <CircleHomeTile
                title="OT / Demandes"
                img={ICON3D.maintenance}
                to="/app/ot"
                badge={otAReprendre.length || undefined}
                delay="0.75s"
              />
              <CircleHomeTile
                title="Client appelle"
                img={ICON3D.accueil}
                to="/app/appel"
                delay="0.9s"
              />
              <CircleHomeTile
                title="Ma signature"
                img={ICON3D.signaturePad}
                to="/app/profil"
                delay="1.05s"
              />
            </nav>

            <nav className="hidden space-y-3 md:block" aria-label="Actions terrain">
              <TerrainAction
                icon={MapPin}
                img3d={ICON3D.sites}
                title="Sites & Parc"
                subtitle={
                  actifs.length
                    ? `${actifs.length} site${actifs.length > 1 ? 's' : ''} · parc & équipements`
                    : 'Sites, équipements, créer un CERFA'
                }
                color="sites"
                onClick={() => goTravaux()}
              />
              <TerrainAction
                icon={QrCode}
                img3d={ICON3D.search}
                title="Scanner équipement"
                subtitle="QR sur place → ouvre l’OT à remplir"
                color="sites"
                to="/app/scan-equip?camera=1"
              />
              <TerrainAction
                icon={ClipboardList}
                img3d={ICON3D.search}
                title="Agenda"
                subtitle={
                  agendaAContacter.length
                    ? `${agendaAContacter.length} rappel${agendaAContacter.length > 1 ? 's' : ''} à contacter`
                    : 'Rappels maintenance & RDV'
                }
                color="sites"
                to="/app/agenda"
                badge={agendaAContacter.length || undefined}
              />
              <TerrainAction
                icon={ClipboardList}
                img3d={ICON3D.cerfa}
                title="CERFA / Interventions"
                subtitle={
                  brouillons.length
                    ? `${brouillons.length} brouillon${brouillons.length > 1 ? 's' : ''} à terminer`
                    : 'Fiches CERFA & historique'
                }
                badge={brouillons.length || undefined}
                color="cerfa"
                to="/app/interventions"
              />
              <TerrainAction
                icon={Package}
                img3d={ICON3D.bottle}
                title="Stock fluides"
                subtitle={
                  stockCount
                    ? `${stockCount} bouteille${stockCount > 1 ? 's' : ''} · ${stockKg.toFixed(1)} kg`
                    : 'Bouteilles & mouvements'
                }
                color="stock"
                to="/app/stock"
              />
              <TerrainAction
                icon={Building2}
                img3d={ICON3D.clients}
                title="Clients"
                subtitle={
                  data.clients.length
                    ? `${data.clients.length} détenteur${data.clients.length > 1 ? 's' : ''}`
                    : 'Clients / détenteurs'
                }
                color="clients"
                to="/app/clients"
              />
            </nav>
          </>
        )}
      </section>

      {/* Rappels agenda — à contacter */}
      {!q.trim() && agendaAContacter.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">À contacter (agenda)</h2>
            <Link to="/app/agenda" className="text-sm font-semibold text-accent hover:underline">
              Voir l’agenda
            </Link>
          </div>
          <ul className="space-y-2">
            {agendaAContacter.map((ev) => {
              const client = data.clients.find((c) => c.id === ev.clientId)
              const tel = telHref(client?.telephone)
              const mail = mailtoHref(client?.email, `RDV maintenance`)
              return (
                <li
                  key={ev.id}
                  className="flex flex-col gap-3 rounded-2xl border border-teal-200/80 bg-teal-50 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-display text-base font-bold text-ink">{ev.title}</p>
                    <p className="text-sm text-muted">
                      {client?.raisonSociale || '—'} · rappel {ev.dateRappel || ev.date}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tel ? (
                      <a
                        href={tel}
                        className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white"
                      >
                        <Phone className="h-4 w-4" /> Appeler
                      </a>
                    ) : null}
                    {mail ? (
                      <a
                        href={mail}
                        className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-bold"
                      >
                        <Mail className="h-4 w-4" /> Mail
                      </a>
                    ) : null}
                    <Link
                      to="/app/agenda"
                      className="inline-flex min-h-12 items-center rounded-xl border border-line bg-white px-4 text-sm font-semibold"
                    >
                      Agenda
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* À reprendre — OT en cours */}
      {!q.trim() && otAReprendre.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">OT à reprendre</h2>
            <Link to="/app/ot" className="text-sm font-semibold text-accent hover:underline">
              Voir tout
            </Link>
          </div>
          <ul className="space-y-2">
            {otAReprendre.map((o) => {
              const client = data.clients.find((c) => c.id === o.clientId)
              const chantier = data.chantiers.find((c) => c.id === o.chantierId)
              return (
                <li
                  key={o.id}
                  className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-teal-200/80 bg-teal-50 p-4 shadow-sm sm:flex-row sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                        {formatOtNumero(o.numero)}
                      </span>
                      <span className="font-display text-base font-bold text-ink">
                        {o.action || 'OT en cours'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 sm:text-sm">
                      {client?.raisonSociale || 'Client à renseigner'}
                      {chantier?.nom ? ` · ${chantier.nom}` : ''}
                      {o.date ? ` · ${o.date}` : ''}
                    </p>
                  </div>
                  <Link
                    to={`/app/appel?ot=${encodeURIComponent(o.id)}`}
                    className="inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 text-xs font-bold text-white shadow-md sm:w-auto sm:text-sm"
                  >
                    <Phone className="h-4 w-4" /> Reprendre
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* À reprendre — brouillons CERFA */}
      {!q.trim() && aReprendre.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">À reprendre</h2>
            <Link
              to="/app/interventions"
              className="text-sm font-semibold text-accent hover:underline"
            >
              Voir tout
            </Link>
          </div>
          <ul className="space-y-2">
            {aReprendre.map((i) => {
              const client = data.clients.find((c) => c.id === i.clientId)
              const chantier = data.chantiers.find((c) => c.id === i.chantierId)
              const readyToSign =
                !!i.signatureOperateurImage && !i.signatureDetenteurImage
              const actionLabel = readyToSign ? 'Signer' : 'Reprendre la saisie'
              const ActionIcon = readyToSign ? PenLine : ClipboardList
              return (
                <li
                  key={i.id}
                  className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-amber-200/80 bg-amber-50 p-4 shadow-sm sm:flex-row sm:items-center sm:p-5"
                >
                  <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
                    <img
                      src={ICON3D.cerfa}
                      alt=""
                      width={48}
                      height={48}
                      className="float-3d h-12 w-12 shrink-0 object-contain"
                      style={{ animationDelay: '0.3s' }}
                      loading="lazy"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-base font-bold text-ink">
                          {chantier?.nom || 'Intervention'}
                        </span>
                        {i.numeroIntervention ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                            {formatOtNumero(i.numeroIntervention)}
                          </span>
                        ) : null}
                        <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-900">
                          Brouillon en attente
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600 sm:text-sm">
                        {client?.raisonSociale || '—'}
                        {i.fluideType ? ` · Fluide ${i.fluideType}` : ''}
                        {i.dateIntervention ? ` · ${i.dateIntervention}` : ''}
                      </p>
                    </div>
                  </div>
                  <Link
                    to={`/app/interventions/${i.id}`}
                    className="inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 text-xs font-bold text-white shadow-md transition active:scale-95 hover:bg-amber-600 sm:w-auto sm:text-sm"
                  >
                    <ActionIcon className="h-4 w-4" strokeWidth={2.25} />
                    {actionLabel}
                    <span aria-hidden>→</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {!q.trim() && recentSites.length > 0 && (
        <section className="hidden md:block">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">Sites récents</h2>
            <button
              type="button"
              onClick={() => goTravaux()}
              className="text-sm font-semibold text-accent hover:underline"
            >
              Voir tout
            </button>
          </div>
          <ul className="mt-2 space-y-2">
            {recentSites.map((c) => {
              const client = data.clients.find((cl) => cl.id === c.clientId)
              const nEq = allEquipements(c).length
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => goTravaux(c.nom)}
                    className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3.5 text-left active:bg-mist"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{c.nom}</span>
                      <span className="block truncate text-sm text-muted">
                        {client?.raisonSociale || '—'}
                        {c.ville ? ` · ${c.ville}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-mist px-3 py-1 text-xs font-semibold text-muted">
                      {nEq} équip.
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {showOnboarding && (
        <section className="rounded-2xl border border-accent/30 bg-accent-soft/50 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-slate sm:text-lg">
                Premiers pas ({progress}/{steps.length})
              </h2>
              <p className="mt-1 text-sm text-muted">
                Une fois → Client + site. Sur le terrain → Accueil.
              </p>
            </div>
            <button
              type="button"
              onClick={dismissOnboarding}
              className="touch-target grid place-items-center rounded-lg text-muted hover:bg-white/70"
              aria-label="Masquer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {steps.map(({ id, done, label, to, icon: Icon }) => (
              <li key={id}>
                <Link
                  to={to}
                  className={[
                    'flex min-h-12 items-center gap-3 rounded-xl border px-3 py-3 text-sm',
                    done
                      ? 'border-line/60 bg-white/60 text-ink/45'
                      : 'border-line bg-white text-ink',
                  ].join(' ')}
                >
                  {done ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-accent/70" />
                  ) : (
                    <Icon className="h-5 w-5 shrink-0 text-accent" />
                  )}
                  <span className="font-medium">{label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Raccourcis stats 3D — desktop / tablette (mobile = grille cercles) */}
      <div className="hidden grid-cols-2 gap-3 md:grid md:grid-cols-4 md:gap-4">
        <Stat3d
          img={ICON3D.sites}
          alt="Sites"
          label="Sites & Parc"
          value={String(actifs.length)}
          to="/app/chantiers"
          float
          floatDelay="0.2s"
        />
        <Stat3d
          img={ICON3D.bottle}
          alt="Stock fluides ClimaZEN"
          label="Stock fluides"
          value={`${stockKg.toFixed(1)}`}
          unit="kg"
          to="/app/stock"
          float
          floatDelay="0.5s"
        />
        <Stat3d
          img={ICON3D.clients}
          alt="Clients"
          label="Clients / Détenteurs"
          value={String(data.clients.length)}
          to="/app/clients"
          float
          floatDelay="0.7s"
        />
        <Stat3d
          img={ICON3D.cerfa}
          alt="CERFA"
          label={brouillons.length > 0 ? 'CERFA brouillons' : 'CERFA validés'}
          value={String(brouillons.length > 0 ? brouillons.length : signes.length)}
          to="/app/interventions"
          alert={brouillons.length > 0}
          float
          floatDelay="0.9s"
        />
      </div>
    </div>
  )
}

/** Tuile circulaire mobile — icônes 3D ClimaZEN dans un cercle fin (style grille terrain). */
function CircleHomeTile({
  title,
  img,
  to,
  onClick,
  badge,
  delay = '0s',
}: {
  title: string
  img: string
  to?: string
  onClick?: () => void
  badge?: number
  delay?: string
}) {
  const inner = (
    <>
      <span className="relative mx-auto grid h-[7.25rem] w-[7.25rem] place-items-center rounded-full border-[1.5px] border-ink/85 bg-white transition active:scale-[0.97] active:bg-mist sm:h-32 sm:w-32">
        <span className="float-3d" style={{ animationDelay: delay }}>
          <img
            src={img}
            alt=""
            width={72}
            height={72}
            className="h-[4.25rem] w-[4.25rem] object-contain drop-shadow-md sm:h-20 sm:w-20"
            draggable={false}
            loading="eager"
            decoding="async"
          />
        </span>
        {badge != null && badge > 0 ? (
          <span className="absolute right-1 top-1 grid h-6 min-w-6 place-items-center rounded-full bg-orange-500 px-1.5 text-[11px] font-bold text-white">
            {badge > 99 ? '99+' : badge}
          </span>
        ) : null}
      </span>
      <span className="mt-2.5 block px-1 text-center text-[13px] font-semibold leading-tight text-ink">
        {title}
      </span>
    </>
  )

  const className =
    'flex flex-col items-center justify-start outline-none focus-visible:ring-2 focus-visible:ring-accent/40'

  if (to) {
    return (
      <Link to={to} className={className}>
        {inner}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  )
}

const MENU_COLORS = {
  sites: {
    band: 'rgba(249, 115, 22, 0.14)',
    icon: '#ea580c',
    border: 'rgba(249, 115, 22, 0.35)',
  },
  cerfa: {
    band: 'rgba(34, 197, 94, 0.14)',
    icon: '#16a34a',
    border: 'rgba(34, 197, 94, 0.35)',
  },
  stock: {
    band: 'rgba(234, 179, 8, 0.16)',
    icon: '#ca8a04',
    border: 'rgba(234, 179, 8, 0.4)',
  },
  clients: {
    band: 'rgba(168, 85, 247, 0.14)',
    icon: '#9333ea',
    border: 'rgba(168, 85, 247, 0.35)',
  },
} as const

function TerrainAction({
  icon: Icon,
  img3d,
  title,
  subtitle,
  to,
  onClick,
  badge,
  color,
}: {
  icon: typeof Building2
  img3d?: string
  title: string
  subtitle: string
  to?: string
  onClick?: () => void
  badge?: number
  color: keyof typeof MENU_COLORS
}) {
  const c = MENU_COLORS[color]
  const className =
    'relative flex min-h-[4.75rem] w-full items-center gap-4 rounded-2xl border-2 bg-white px-4 py-3.5 text-left text-ink shadow-sm transition active:scale-[0.99] active:bg-mist'

  const body = (
    <>
      <span
        className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl"
        style={{ backgroundColor: c.band, color: c.icon }}
      >
        {img3d ? (
          <span className="float-3d" style={{ animationDelay: '0.35s' }}>
            <img
              src={img3d}
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 object-contain drop-shadow-md"
              draggable={false}
            />
          </span>
        ) : (
          <Icon className="h-7 w-7" strokeWidth={1.9} />
        )}
        {badge != null && badge > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-orange-500 px-1.5 text-[11px] font-bold text-white">
            {badge > 99 ? '99+' : badge}
          </span>
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-base font-bold tracking-tight sm:text-lg">
          {title}
        </span>
        <span className="mt-0.5 block text-sm text-muted">{subtitle}</span>
      </span>
    </>
  )

  const style = { borderColor: c.border }

  if (to) {
    return (
      <Link to={to} className={className} style={style}>
        {body}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className={className} style={style}>
      {body}
    </button>
  )
}

function Stat3d({
  img,
  alt,
  label,
  value,
  unit,
  to,
  alert,
  float,
  floatDelay = '0.5s',
}: {
  img: string
  alt: string
  label: string
  value: string
  unit?: string
  to: string
  alert?: boolean
  float?: boolean
  floatDelay?: string
}) {
  return (
    <Link
      to={to}
      className={[
        'group rounded-2xl border p-4 shadow-sm transition-all hover:shadow-md sm:p-5',
        alert
          ? 'border-amber-300 bg-amber-50 hover:border-amber-400'
          : 'border-slate-200/80 bg-white hover:border-emerald-500',
      ].join(' ')}
    >
      <span
        className={float ? 'float-3d mb-2 inline-flex' : 'mb-2 inline-flex'}
        style={float ? { animationDelay: floatDelay } : undefined}
      >
        <img
          src={img}
          alt={alt}
          width={40}
          height={40}
          className="h-10 w-10 object-contain transition-transform group-hover:scale-110"
          loading="lazy"
          decoding="async"
        />
      </span>
      <p className="font-display text-2xl font-black text-ink">
        {value}
        {unit ? <span className="ml-1 text-xs font-normal text-muted">{unit}</span> : null}
      </p>
      <p className="mt-0.5 text-xs font-semibold text-muted">{label}</p>
    </Link>
  )
}
