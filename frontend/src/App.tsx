import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { EmptyState } from './components/States'
import { Toaster } from './components/Toast'
import { AccountPage } from './features/account/AccountPage'
import { AssistantPage } from './features/assistant/AssistantPage'
import { useAuth } from './features/auth/AuthContext'
import { RequireAuth, RequireRole } from './features/auth/guards'
import { LoginPage } from './features/auth/LoginPage'
import { homePath } from './features/auth/roles'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { ChecklistPage } from './features/onboarding/ChecklistPage'
import { MyOnboardingPage } from './features/onboarding/MyOnboardingPage'
import { MyTasksPage } from './features/onboarding/MyTasksPage'
import { TeamOnboardingPage } from './features/onboarding/TeamOnboardingPage'
import { TemplateDetailPage } from './features/onboarding/TemplateDetailPage'
import { TemplatesPage } from './features/onboarding/TemplatesPage'
import { PeoplePage } from './features/people/PeoplePage'
import { NewRequestPage } from './features/requests/NewRequestPage'
import { RequestDetailPage } from './features/requests/RequestDetailPage'
import { RequestsPage } from './features/requests/RequestsPage'

function Home() {
  const { user } = useAuth()
  return user && <Navigate to={homePath(user.role)} replace />
}

function NotFoundPage() {
  const { user } = useAuth()
  return (
    <EmptyState
      title="Page not found"
      help="This address does not match any page in PeopleDesk."
      action={user && <Link to={homePath(user.role)}>Go to the home page</Link>}
    />
  )
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="/account" element={<AccountPage />} />
            <Route path="/requests" element={<RequestsPage />} />
            <Route path="/requests/new" element={<NewRequestPage />} />
            <Route path="/requests/:id" element={<RequestDetailPage />} />
            <Route path="/onboarding/me" element={<MyOnboardingPage />} />
            <Route path="/onboarding/tasks" element={<MyTasksPage />} />
            <Route element={<RequireRole roles={['MANAGER', 'HR_ADMIN']} />}>
              <Route path="/onboarding" element={<TeamOnboardingPage />} />
              <Route path="/onboarding/checklists/:id" element={<ChecklistPage />} />
            </Route>
            <Route element={<RequireRole roles={['HR_ADMIN']} />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/onboarding/templates" element={<TemplatesPage />} />
              <Route path="/onboarding/templates/:id" element={<TemplateDetailPage />} />
              <Route path="/people" element={<PeoplePage />} />
              <Route path="/assistant" element={<AssistantPage />} />
            </Route>
            <Route path="/" element={<Home />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
      <Toaster />
    </>
  )
}
