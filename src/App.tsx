import { BrowserRouter, Navigate, Route, Routes, useParams, useSearchParams } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext'
import { StoreProvider } from './lib/store'
import { RequireAuth } from './components/RequireAuth'
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
import { InterventionsPage } from './pages/InterventionsPage'
import { InterventionFormPage } from './pages/InterventionFormPage'
import { OperateurPage } from './pages/OperateurPage'
import { ProfilPage } from './pages/ProfilPage'
import { EquipePage } from './pages/EquipePage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { FicheMaintenanceClimPage } from './pages/FicheMaintenanceClimPage'
import { OrdresTravailPage } from './pages/OrdresTravailPage'
import { AppelOtPage } from './pages/AppelOtPage'
import { ContratsMaintenancePage } from './pages/ContratsMaintenancePage'
import { AgendaPage } from './pages/AgendaPage'
import { ContactPage } from './pages/ContactPage'
import { CguPage, ConfidentialitePage, MentionsLegalesPage } from './pages/LegalPages'

/** Remonte le formulaire à chaque CERFA (Page 1/2 ↔ 2/2) pour recharger les données. */
function InterventionFormRoute() {
  const { id } = useParams()
  return <InterventionFormPage key={id || 'new'} />
}

/** Remonte la fiche maintenance à chaque id (multi-équipements). */
function FicheMaintenanceClimRoute() {
  const [params] = useSearchParams()
  const id = params.get('id') || 'new'
  return <FicheMaintenanceClimPage key={id} />
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
                <Route path="/mentions-legales" element={<MentionsLegalesPage />} />
                <Route path="/cgu" element={<CguPage />} />
                <Route path="/confidentialite" element={<ConfidentialitePage />} />
              </Route>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
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
                <Route path="interventions" element={<InterventionsPage />} />
                <Route path="interventions/:id" element={<InterventionFormRoute />} />
                <Route path="ot" element={<OrdresTravailPage />} />
                <Route path="appel" element={<AppelOtPage />} />
                <Route path="contrats" element={<ContratsMaintenancePage />} />
                <Route path="agenda" element={<AgendaPage />} />
                <Route path="fiche-maintenance-clim" element={<FicheMaintenanceClimRoute />} />
                <Route path="equipe" element={<EquipePage />} />
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
