import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { AssistantPage } from './features/assistant/AssistantPage'
import { useAuth } from './features/auth/AuthContext'
import { RequireAuth, RequireRole } from './features/auth/guards'
import { LoginPage } from './features/auth/LoginPage'
import { homePath } from './features/auth/roles'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { MyOnboardingPage } from './features/onboarding/MyOnboardingPage'
import { MyTasksPage } from './features/onboarding/MyTasksPage'
import { TeamOnboardingPage } from './features/onboarding/TeamOnboardingPage'
import { TemplatesPage } from './features/onboarding/TemplatesPage'
import { PeoplePage } from './features/people/PeoplePage'
import { NewRequestPage } from './features/requests/NewRequestPage'
import { RequestDetailPage } from './features/requests/RequestDetailPage'
import { RequestsPage } from './features/requests/RequestsPage'

export default function App() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/requests" element={<RequestsPage />} />
          <Route path="/requests/new" element={<NewRequestPage />} />
          <Route path="/requests/:id" element={<RequestDetailPage />} />
          <Route path="/onboarding/me" element={<MyOnboardingPage />} />
          <Route path="/onboarding/tasks" element={<MyTasksPage />} />
          <Route element={<RequireRole roles={['MANAGER', 'HR_ADMIN']} />}>
            <Route path="/onboarding" element={<TeamOnboardingPage />} />
          </Route>
          <Route element={<RequireRole roles={['HR_ADMIN']} />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/onboarding/templates" element={<TemplatesPage />} />
            <Route path="/people" element={<PeoplePage />} />
            <Route path="/assistant" element={<AssistantPage />} />
          </Route>
          <Route path="*" element={user && <Navigate to={homePath(user.role)} replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
