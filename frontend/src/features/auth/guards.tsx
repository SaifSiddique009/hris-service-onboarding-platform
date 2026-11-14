import { Navigate, Outlet } from 'react-router-dom'
import type { Role } from '../../api/types'
import { Spinner } from '../../components/Spinner'
import { useAuth } from './AuthContext'

export function RequireAuth() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-indigo-600">
        <Spinner className="size-8" />
      </div>
    )
  }
  return user ? <Outlet /> : <Navigate to="/login" replace />
}

export function RequireRole({ roles }: { roles: Role[] }) {
  const { user } = useAuth()
  if (user && roles.includes(user.role)) return <Outlet />
  return (
    <div className="py-16 text-center">
      <h1 className="text-xl font-semibold">Not allowed</h1>
      <p className="mt-1 text-sm text-slate-500">Your role cannot view this page.</p>
    </div>
  )
}
