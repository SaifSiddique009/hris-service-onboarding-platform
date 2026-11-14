import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import type { Role } from '../api/types'
import { roleLabel } from '../lib/format'
import { useAuth } from '../features/auth/AuthContext'
import { Badge } from './Badge'
import { Button } from './Button'

const links: { to: string; label: string; roles?: Role[] }[] = [
  { to: '/dashboard', label: 'Dashboard', roles: ['HR_ADMIN'] },
  { to: '/requests', label: 'Requests' },
  { to: '/onboarding/me', label: 'My onboarding' },
  { to: '/onboarding/tasks', label: 'My tasks' },
  { to: '/onboarding', label: 'Team onboarding', roles: ['MANAGER', 'HR_ADMIN'] },
  { to: '/onboarding/templates', label: 'Templates', roles: ['HR_ADMIN'] },
  { to: '/people', label: 'People', roles: ['HR_ADMIN'] },
  { to: '/assistant', label: 'Assistant', roles: ['HR_ADMIN'] },
]

export function AppShell() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  if (!user) return null

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 md:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="rounded-md p-2 text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 md:hidden"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-lg font-semibold text-indigo-600">PeopleDesk</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm font-medium sm:inline">{user.full_name}</span>
          <Badge>{roleLabel(user.role)}</Badge>
          <Button variant="secondary" onClick={logout}>
            Log out
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        <aside
          className={`${open ? 'block' : 'hidden'} border-b border-slate-200 bg-white md:block md:w-60 md:shrink-0 md:border-b-0 md:border-r`}
        >
          <nav className="flex flex-col gap-1 p-3" aria-label="Main">
            {links
              .filter((l) => !l.roles || l.roles.includes(user.role))
              .map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                      isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
                    }`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
