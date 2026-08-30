import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Car, Download, Mail, Phone, Smartphone, Wrench } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { useStore } from '../lib/store'
import { dossierForUser } from '../lib/rhDocuments'
import { telHref } from '../lib/agenda'
import {
  documentsEcart,
  formatDateFrCourt,
  formatResumeEtatLieux,
  voitureDocumentLabel,
  voitureTitreCourt,
} from '../lib/voitures'
import { ReceptionMaterielBlock } from './ReceptionMaterielBlock'
import { VoitureConstatSchema } from './VoitureConstatSchema'
import { Field } from '../pages/ClientsPage'
import { outillageTypeLabel } from '../lib/outillageCatalog'
import type { Outillage, Voiture } from '../lib/types'

type Props = {
  userId: string
  displayName: string
  email?: string
}

function BadgeReception({ at }: { at?: string }) {
  if (at) {
    return (
      <span className="font-semibold text-emerald-800">
        Pris / réceptionné le {formatDateFrCourt(at)}
      </span>
    )
  }
  return <span className="font-semibold text-amber-800">Attribué — pas encore pris (réception en attente)</span>
}

function VoitureInventaire({ v }: { v: Voiture }) {
  const etat = v.etatReception
  const recus = etat?.documentsRecus || []
  const fournis = v.documentsFournis || []
  const ecart = documentsEcart(fournis, recus)
  return (
    <div className="space-y-1.5">
      <div className="font-medium">{voitureTitreCourt(v)}</div>
      <BadgeReception at={v.receptionAt} />
      {fournis.length > 0 ? (
        <div className="text-xs text-muted">
          Remis par la société : {fournis.map(voitureDocumentLabel).join(', ')}
        </div>
      ) : (
        <div className="text-xs text-muted">Aucun document coché à la remise (carte grise, clés…).</div>
      )}
      {v.receptionAt && etat ? (
        <>
          {recus.length > 0 ? (
            <div className="text-xs font-medium text-ink">
              Pris par l’opérateur : {recus.map(voitureDocumentLabel).join(', ')}
              {etat.documentsAutre ? ` (${etat.documentsAutre})` : ''}
            </div>
          ) : (
            <div className="text-xs text-muted">L’opérateur n’a déclaré aucun document pris.</div>
          )}
          {ecart.manquants.length > 0 ? (
            <div className="text-xs font-semibold text-amber-800">
              Non pris : {ecart.manquants.map(voitureDocumentLabel).join(', ')}
            </div>
          ) : null}
          {formatResumeEtatLieux(etat) ? (
            <div className="text-xs text-muted">{formatResumeEtatLieux(etat)}</div>
          ) : null}
          {etat.marquesCarrosserie?.length ? (
            <div className="mt-2">
              <VoitureConstatSchema marques={etat.marquesCarrosserie} readOnly />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function OutilInventaire({ o }: { o: Outillage }) {
  return (
    <div>
      <div className="font-medium">
        {o.identification}
        {o.marque || o.modele ? ` · ${[o.marque, o.modele].filter(Boolean).join(' ')}` : ''}
      </div>
      {o.notes ? <div className="text-xs text-muted">{o.notes}</div> : null}
      <div className="mt-1 text-xs">
        <BadgeReception at={o.receptionAt} />
      </div>
    </div>
  )
}

export function MaterielConfieDossier({ userId, displayName, email }: Props) {
  const { data, telechargerBonRemise, upsertOutillage } = useStore()
  const { user, isOwner } = useAuth()
  const dossier = dossierForUser(data.personnelDossiers, userId)
  const voitures = (data.voitures || []).filter((v) => v.assigneeUserId === userId)
  const outillages = (data.outillages || []).filter((o) => o.assigneeUserId === userId)
  const telephones = outillages.filter((o) => o.type === 'telephone_pro')
  const autresOutils = outillages.filter((o) => o.type !== 'telephone_pro')
  const bons = (data.bonsRemiseMateriel || [])
    .filter((b) => b.userId === userId)
    .slice()
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  const canDownload = Boolean(isOwner || user?.id === userId)
  const nAttrib = voitures.length + outillages.length
  const nPris = voitures.filter((v) => v.receptionAt).length + outillages.filter((o) => o.receptionAt).length
  const nAttente = nAttrib - nPris
  const telEnCours = telephones[0]

  const [telLigne, setTelLigne] = useState('')
  const [telMarque, setTelMarque] = useState('')
  const [telModele, setTelModele] = useState('')
  const [telNotes, setTelNotes] = useState('')
  const [telError, setTelError] = useState('')
  const [telBusy, setTelBusy] = useState(false)
  const [telOk, setTelOk] = useState('')

  useEffect(() => {
    if (!telEnCours) return
    setTelLigne(telEnCours.identification || '')
    setTelMarque(telEnCours.marque || '')
    setTelModele(telEnCours.modele || '')
    setTelNotes(telEnCours.notes || '')
  }, [telEnCours?.id])

  const onDonnerTelephone = async (e: FormEvent) => {
    e.preventDefault()
    setTelError('')
    const idTrim = telLigne.trim()
    if (!idTrim) {
      setTelError('Indiquez le n° de ligne, l’IMEI ou l’étiquette du téléphone.')
      return
    }
    setTelBusy(true)
    try {
      await upsertOutillage({
        id: telEnCours?.id,
        type: 'telephone_pro',
        identification: idTrim,
        marque: telMarque.trim() || undefined,
        modele: telModele.trim() || undefined,
        notes: telNotes.trim() || undefined,
        assigneeUserId: userId,
        assigneeName: displayName,
      })
      setTelLigne('')
      setTelMarque('')
      setTelModele('')
      setTelNotes('')
      setTelOk('Téléphone attribué — l’opérateur doit encore valider la réception.')
      setTimeout(() => setTelOk(''), 4000)
    } catch (err) {
      setTelError(err instanceof Error ? err.message : 'Attribution impossible')
    } finally {
      setTelBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-white p-4">
        <h2 className="font-display text-lg font-semibold text-ink">Matériel donné par la société</h2>
        <p className="mt-1 text-sm text-muted">
          Inventaire de ce que {displayName} a en main : véhicule, téléphone pro, outillage. Le
          gérant voit ici ce qui a été donné et ce que l’opérateur a réellement pris (réception).
        </p>
        <div className="mt-2 text-xs font-semibold text-ink">
          {nAttrib === 0
            ? 'Rien d’attribué pour le moment'
            : `${nAttrib} pièce${nAttrib > 1 ? 's' : ''} attribuée${nAttrib > 1 ? 's' : ''} · ${nPris} prise${nPris > 1 ? 's' : ''} · ${nAttente} en attente`}
        </div>

        <div className="mt-4 rounded-xl border border-line bg-mist/40 px-3 py-3">
          <div className="text-xs font-bold uppercase tracking-wide text-muted">Coordonnées (pour le joindre)</div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {email ? (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-muted" />
                {email}
              </span>
            ) : (
              <span className="text-xs text-muted">E-mail non chargé</span>
            )}
            {dossier?.telephone ? (
              <a
                href={telHref(dossier.telephone) || undefined}
                className="inline-flex items-center gap-1.5 font-medium text-accent hover:underline"
              >
                <Phone className="h-3.5 w-3.5" />
                {dossier.telephone}
                <span className="font-normal text-muted">(perso / RH)</span>
              </a>
            ) : (
              <span className="text-xs text-muted">Téléphone perso non renseigné (fiche équipe / activité du poste)</span>
            )}
          </div>
        </div>

        <section className="mt-4 overflow-hidden rounded-xl border border-line">
          <header className="flex items-center gap-2 border-b border-line bg-mist/60 px-3 py-2">
            <Car className="h-4 w-4 text-accent" />
            <span className="text-sm font-semibold">Véhicule société</span>
            <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-muted">
              {voitures.length}
            </span>
          </header>
          {voitures.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted">
              Aucun véhicule attribué.
              {isOwner ? (
                <>
                  {' '}
                  Pour en donner un :{' '}
                  <Link to="/app/profil" className="font-semibold text-accent underline">
                    Mon profil → Flotte véhicules
                  </Link>
                  , puis affectez-le à {displayName}.
                </>
              ) : null}
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {voitures.map((v) => (
                <li key={v.id} className="px-3 py-2.5 text-sm">
                  <VoitureInventaire v={v} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-3 overflow-hidden rounded-xl border border-line">
          <header className="flex items-center gap-2 border-b border-line bg-mist/60 px-3 py-2">
            <Smartphone className="h-4 w-4 text-accent" />
            <span className="text-sm font-semibold">Téléphone professionnel</span>
            <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-muted">
              {telephones.length}
            </span>
          </header>
          {telephones.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted">
              Aucun téléphone de société attribué — ce n’est pas le n° perso ci-dessus. Le gérant
              le donne ici (n° de ligne / IMEI), l’opérateur confirme la réception.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {telephones.map((o) => (
                <li key={o.id} className="px-3 py-2.5 text-sm">
                  <OutilInventaire o={o} />
                </li>
              ))}
            </ul>
          )}
          {isOwner ? (
            <form
              onSubmit={(e) => void onDonnerTelephone(e)}
              className="grid gap-2 border-t border-line bg-white px-3 py-3 sm:grid-cols-2"
            >
              <p className="text-xs text-muted sm:col-span-2">
                {telephones.length
                  ? 'Modifier le téléphone déjà attribué (n° de ligne, IMEI, marque…).'
                  : 'Donner un téléphone de société à cet opérateur :'}
              </p>
              <Field
                label="N° de ligne / IMEI *"
                value={telLigne}
                onChange={setTelLigne}
                required
              />
              <Field label="Marque" value={telMarque} onChange={setTelMarque} />
              <Field label="Modèle" value={telModele} onChange={setTelModele} />
              <Field
                label="Notes (SIM, chargeur, coque…)"
                value={telNotes}
                onChange={setTelNotes}
              />
              {telError ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger sm:col-span-2">
                  {telError}
                </p>
              ) : null}
              {telOk ? (
                <p className="text-sm font-semibold text-emerald-800 sm:col-span-2">{telOk}</p>
              ) : null}
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={telBusy}
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-ink hover:bg-accent-hover disabled:opacity-60"
                >
                  {telBusy
                    ? 'Enregistrement…'
                    : telephones.length
                      ? 'Mettre à jour le téléphone'
                      : 'Donner ce téléphone'}
                </button>
              </div>
            </form>
          ) : null}
        </section>

        <section className="mt-3 overflow-hidden rounded-xl border border-line">
          <header className="flex items-center gap-2 border-b border-line bg-mist/60 px-3 py-2">
            <Wrench className="h-4 w-4 text-accent" />
            <span className="text-sm font-semibold">Outillage / EPI</span>
            <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-muted">
              {autresOutils.length}
            </span>
          </header>
          {autresOutils.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted">
              Aucun outillage attribué.
              {isOwner ? (
                <>
                  {' '}
                  Pour en donner :{' '}
                  <Link to="/app/profil" className="font-semibold text-accent underline">
                    Mon profil → Parc outillage
                  </Link>
                  .
                </>
              ) : null}
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {autresOutils.map((o) => (
                <li key={o.id} className="px-3 py-2.5 text-sm">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-muted">
                    {outillageTypeLabel(o.type)}
                  </div>
                  <OutilInventaire o={o} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <ReceptionMaterielBlock userId={userId} />

      {bons.length > 0 && canDownload ? (
        <div className="rounded-2xl border border-line bg-white p-4">
          <h3 className="font-display text-sm font-semibold">PDF officiels (gérant)</h3>
          <p className="mt-1 text-xs text-muted">
            Preuve de ce que l’opérateur a pris : états des lieux et bons de remise.
          </p>
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
            {bons.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0 text-sm">
                  <div className="font-medium">
                    {b.kind === 'vehicule' ? 'État des lieux véhicule' : 'Bon de remise matériel'}
                  </div>
                  <div className="text-xs text-muted">
                    {formatDateFrCourt(b.createdAt)}
                    {b.kind === 'vehicule'
                      ? ` · ${b.items[0]?.label || 'véhicule'}`
                      : ` · ${b.items.length} pièce${b.items.length > 1 ? 's' : ''}`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void telechargerBonRemise(b.id)}
                  className="inline-flex min-h-10 items-center gap-1 rounded-full border border-line px-3 py-1 text-xs font-semibold hover:bg-mist"
                >
                  <Download className="h-3.5 w-3.5" /> Télécharger
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
