import { Navigate, Outlet } from 'react-router-dom'
import { loginPath } from '../../api/client'
import type { Role } from '../../api/types'
import { EmptyState, LoadingState } from '../../components/States'
import { useAuth } from './AuthContext'

export function RequireAuth() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-24">
        <LoadingState />
      </div>
    )
  }
  return user ? <Outlet /> : <Navigate to={loginPath()} replace />
}

export function RequireRole({ roles }: { roles: Role[] }) {
  const { user } = useAuth()
  if (user && roles.includes(user.role)) return <Outlet />
  return (
    <EmptyState title="Not allowed" help="Your role cannot view this page." />
  )
}
