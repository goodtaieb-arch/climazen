import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext'
import { StoreProvider } from './lib/store'
import { RequireAuth } from './components/RequireAuth'
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
import { EquipePage } from './pages/EquipePage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { ContactPage } from './pages/ContactPage'
import { CguPage, ConfidentialitePage, MentionsLegalesPage } from './pages/LegalPages'

export default function App() {
  return (
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
              <Route path="interventions/:id" element={<InterventionFormPage />} />
              <Route path="equipe" element={<EquipePage />} />
              <Route path="operateur" element={<OperateurPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </StoreProvider>
    </AuthProvider>
  )
}
