import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext'
import { StoreProvider } from './lib/store'
import { RequireAuth } from './components/RequireAuth'
import { AppLayout } from './components/AppLayout'
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

export default function App() {
  return (
    <AuthProvider>
      <StoreProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
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
