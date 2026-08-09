import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, FileCheck2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import { createPdfObjectUrl } from '../lib/cerfaPdf'
import { loadCerfaPdf } from '../lib/pdfStore'
import { PdfViewerModal } from '../components/PdfViewerModal'
import { SearchField, matchesQuery } from '../components/SearchField'

export function InterventionsPage() {
  const { data, deleteIntervention } = useStore()
  const { user } = useAuth()
  const [viewer, setViewer] = useState<{ url: string; title: string } | null>(null)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<'tous' | 'brouillon' | 'signe' | 'envoye'>('tous')

  const filtered = useMemo(() => {
    return [...data.interventions]
      .filter((i) => (statusFilter === 'tous' ? true : i.status === statusFilter))
      .filter((i) => {
        const client = data.clients.find((c) => c.id === i.clientId)
        const chantier = data.chantiers.find((c) => c.id === i.chantierId)
        return matchesQuery(
          [chantier?.nom, client?.raisonSociale, i.fluideType, i.dateIntervention, i.status, i.createdByName]
            .filter(Boolean)
            .join(' '),
          q,
        )
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [data.interventions, data.clients, data.chantiers, q, statusFilter])

  const openCerfa = async (id: string, label: string) => {
    const pdf = await loadCerfaPdf(id, user?.organizationId)
    if (!pdf) {
      alert('CERFA pas encore généré — ouvrez la fiche et cliquez « Enregistrer dans ClimaZEN ».')
      return
    }
    if (viewer?.url) URL.revokeObjectURL(viewer.url)
    setViewer({
      url: createPdfObjectUrl(pdf.blob),
      title: `CERFA — ${label}`,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">CERFA / Interventions</h1>
          <p className="mt-1 text-muted">
            Fiches de toute l’équipe — CERFA stockés dans ClimaZEN, visibles sur le compte société.
          </p>
        </div>
        <Link
          to="/app/interventions/new"
          className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink hover:bg-accent-hover"
        >
          <Plus className="h-4 w-4" /> Nouvelle fiche
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchField
          value={q}
          onChange={setQ}
          placeholder="Rechercher chantier, client, fluide…"
          testId="interventions-search"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="h-10 rounded-xl border border-line bg-white px-3 text-sm"
        >
          <option value="tous">Tous les statuts</option>
          <option value="brouillon">Brouillons</option>
          <option value="signe">Signés</option>
          <option value="envoye">Envoyés</option>
        </select>
      </div>

      <div className="grid gap-3">
        {filtered.map((i) => {
          const client = data.clients.find((c) => c.id === i.clientId)
          const chantier = data.chantiers.find((c) => c.id === i.chantierId)
          const label = chantier?.nom || 'Intervention'
          return (
            <div
              key={i.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4"
            >
              <Link to={`/app/interventions/${i.id}`} className="min-w-0 flex-1 hover:text-accent">
                <div className="font-display font-semibold">{label}</div>
                <div className="text-sm text-muted">
                  {client?.raisonSociale} · {i.dateIntervention} · {i.fluideType} · {i.status}
                  {i.createdByName ? ` · par ${i.createdByName}` : ''}
                </div>
                {i.hasCerfaPdf && (
                  <div className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-accent">
                    <FileCheck2 className="h-3.5 w-3.5" />
                    CERFA dans l’app
                    {i.cerfaPdfSavedAt
                      ? ` · ${new Date(i.cerfaPdfSavedAt).toLocaleString('fr-FR')}`
                      : ''}
                  </div>
                )}
              </Link>
              <div className="flex gap-1">
                <Link
                  to={`/app/interventions/${i.id}`}
                  title="Ouvrir / régénérer le CERFA"
                  className="rounded-lg p-2 text-accent hover:bg-accent-soft"
                >
                  <Pencil className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  title="Voir le CERFA"
                  className="rounded-lg p-2 text-accent hover:bg-accent-soft"
                  onClick={() => void openCerfa(i.id, label)}
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="rounded-lg p-2 text-danger hover:bg-red-50"
                  onClick={() => {
                    if (confirm('Supprimer cette fiche et son CERFA ?')) deleteIntervention(i.id)
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-muted">
            {data.interventions.length === 0
              ? 'Aucune intervention pour le moment.'
              : 'Aucun résultat pour cette recherche.'}
          </p>
        )}
      </div>

      {viewer && (
        <PdfViewerModal
          url={viewer.url}
          title={viewer.title}
          onClose={() => {
            URL.revokeObjectURL(viewer.url)
            setViewer(null)
          }}
        />
      )}
    </div>
  )
}
