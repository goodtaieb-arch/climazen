import { BrowserRouter, Navigate, Route, Routes, useParams, useSearchParams } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext'
import { StoreProvider } from './lib/store'
import { RequireAuth } from './components/RequireAuth'
import { RequireEdition } from './components/RequireEdition'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AppLayout } from './components/AppLayout'
import { PublicLayout } from './components/PublicLayout'
import { Landing } from './pages/Landing'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { Dashboard } from './pages/Dashboard'
import { ClientsPage } from './pages/ClientsPage'
import { ChantiersPage } from './pages/ChantiersPage'
import { StockPage } from './pages/StockPage'
import { StockPiecesPage } from './pages/StockPiecesPage'
import { InterventionsPage } from './pages/InterventionsPage'
import { InterventionFormPage } from './pages/InterventionFormPage'
import { OperateurPage } from './pages/OperateurPage'
import { ProfilPage } from './pages/ProfilPage'
import { EquipePage } from './pages/EquipePage'
import { TechnicienDossierPage } from './pages/TechnicienDossierPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { FicheMaintenanceClimPage } from './pages/FicheMaintenanceClimPage'
import { FicheMaintenanceChaufferiePage } from './pages/FicheMaintenanceChaufferiePage'
import { FicheMaintenanceCtaVmcPage } from './pages/FicheMaintenanceCtaVmcPage'
import { ScanEquipementPage } from './pages/ScanEquipementPage'
import { OrdresTravailPage } from './pages/OrdresTravailPage'
import { AppelOtPage } from './pages/AppelOtPage'
import { ContratsMaintenancePage } from './pages/ContratsMaintenancePage'
import { AgendaPage } from './pages/AgendaPage'
import { PointagePage } from './pages/PointagePage'
import { ContactPage } from './pages/ContactPage'
import { AvisGooglePage } from './pages/AvisGooglePage'
import { SignerPage } from './pages/SignerPage'
import { CguPage, ConfidentialitePage, MentionsLegalesPage } from './pages/LegalPages'
import { Cerfa15497Page, FGasHorsLignePage, LogicielCerfaClimPage } from './pages/SeoPages'

/** Remonte le formulaire à chaque CERFA (Page 1/2 ↔ 2/2) pour recharger les données. */
function InterventionFormRoute() {
  const { id } = useParams()
  return <InterventionFormPage key={id || 'new'} />
}

/** Remonte la fiche maintenance à chaque id (multi-équipements). */
function FicheMaintenanceClimRoute() {
  const [params] = useSearchParams()
  const id = params.get('id') || 'new'
  const batch = params.get('batch') || ''
  // key force le remount à chaque fiche du lot multi-équipements
  return <FicheMaintenanceClimPage key={`${id}::${batch}`} />
}

function FicheMaintenanceChaufferieRoute() {
  const [params] = useSearchParams()
  const id = params.get('id') || 'new'
  const periode = params.get('periode') || ''
  return <FicheMaintenanceChaufferiePage key={`${id}::${periode}`} />
}

function FicheMaintenanceCtaVmcRoute() {
  const [params] = useSearchParams()
  const id = params.get('id') || 'new'
  const periode = params.get('periode') || ''
  return <FicheMaintenanceCtaVmcPage key={`${id}::${periode}`} />
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <StoreProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<PublicLayout />}>
                <Route path="/" element={<Landing />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/avis" element={<AvisGooglePage />} />
                <Route path="/cerfa-15497" element={<Cerfa15497Page />} />
                <Route path="/f-gas-hors-ligne" element={<FGasHorsLignePage />} />
                <Route path="/logiciel-cerfa-clim" element={<LogicielCerfaClimPage />} />
                <Route path="/mentions-legales" element={<MentionsLegalesPage />} />
                <Route path="/cgu" element={<CguPage />} />
                <Route path="/confidentialite" element={<ConfidentialitePage />} />
              </Route>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/signer/:token" element={<SignerPage />} />
              <Route
                path="/app"
                element={
                  <RequireAuth>
                    <AppLayout />
                  </RequireAuth>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="clients" element={<ClientsPage />} />
                <Route path="chantiers" element={<ChantiersPage />} />
                <Route path="stock" element={<StockPage />} />
                <Route
                  path="stock-pieces"
                  element={
                    <RequireEdition>
                      <StockPiecesPage />
                    </RequireEdition>
                  }
                />
                <Route path="interventions" element={<InterventionsPage />} />
                <Route path="interventions/:id" element={<InterventionFormRoute />} />
                <Route
                  path="ot"
                  element={
                    <RequireEdition>
                      <OrdresTravailPage />
                    </RequireEdition>
                  }
                />
                <Route path="appel" element={<AppelOtPage />} />
                <Route path="contrats" element={<ContratsMaintenancePage />} />
                <Route
                  path="agenda"
                  element={
                    <RequireEdition>
                      <AgendaPage />
                    </RequireEdition>
                  }
                />
                <Route
                  path="pointage"
                  element={
                    <RequireEdition>
                      <PointagePage />
                    </RequireEdition>
                  }
                />
                <Route path="fiche-maintenance-clim" element={<FicheMaintenanceClimRoute />} />
                <Route
                  path="fiche-maintenance-chaufferie"
                  element={<FicheMaintenanceChaufferieRoute />}
                />
                <Route
                  path="fiche-maintenance-cta-vmc"
                  element={<FicheMaintenanceCtaVmcRoute />}
                />
                <Route path="scan-equip" element={<ScanEquipementPage />} />
                <Route
                  path="equipe"
                  element={
                    <RequireEdition>
                      <EquipePage />
                    </RequireEdition>
                  }
                />
                <Route
                  path="equipe/:userId"
                  element={
                    <RequireEdition>
                      <TechnicienDossierPage />
                    </RequireEdition>
                  }
                />
                <Route path="operateur" element={<OperateurPage />} />
                <Route path="profil" element={<ProfilPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </StoreProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
