import {
  FileText,
  IdCard,
  Inbox,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Sparkles,
  UserCheck,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import type { Role } from '../api/types'
import { useAuth } from '../features/auth/AuthContext'
import { roleLabel } from '../lib/format'
import { RoleBadge } from './Badge'
import { Button } from './Button'

const links: { to: string; label: string; icon: LucideIcon; roles?: Role[] }[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['HR_ADMIN'] },
  { to: '/requests', label: 'Requests', icon: Inbox },
  { to: '/onboarding/me', label: 'My onboarding', icon: UserCheck },
  { to: '/onboarding/tasks', label: 'My tasks', icon: ListChecks },
  { to: '/onboarding', label: 'Team onboarding', icon: Users, roles: ['MANAGER', 'HR_ADMIN'] },
  { to: '/onboarding/templates', label: 'Templates', icon: FileText, roles: ['HR_ADMIN'] },
  { to: '/people', label: 'People', icon: IdCard, roles: ['HR_ADMIN'] },
  { to: '/assistant', label: 'Assistant', icon: Sparkles, roles: ['HR_ADMIN'] },
]

const Brand = () => (
  <span className="flex items-center gap-2.5">
    <span className="grid size-[30px] place-items-center rounded-xs bg-ink font-serif text-[17px] text-paper">p.</span>
    <span className="font-serif text-xl">PeopleDesk</span>
  </span>
)

function Nav({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {links
        .filter((link) => !link.roles || link.roles.includes(role))
        .map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            // Only "Team onboarding" needs an exact match: its child pages have their own items.
            end={to === '/onboarding'}
            onClick={onNavigate}
            className="flex min-h-[38px] items-center gap-[11px] rounded-xs border-l-3 border-transparent pl-[9px] pr-3 text-sm font-medium text-n-600 no-underline hover:bg-[#e4e9df] hover:text-n-600 aria-[current=page]:border-accent aria-[current=page]:font-semibold aria-[current=page]:text-ink max-md:min-h-11"
          >
            <Icon aria-hidden size={16} strokeWidth={1.8} />
            {label}
          </NavLink>
        ))}
    </nav>
  )
}

export function AppShell() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  if (!user) return null

  return (
    <div className="flex min-h-screen [--header-h:4rem] max-md:[--header-h:3.5rem]">
      <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-line bg-n-100 px-4 pb-6 pt-7 md:flex">
        <div className="mb-9 pl-[9px]">
          <Brand />
        </div>
        <Nav role={user.role} />
        <p className="mt-auto pl-[9px] text-xs leading-relaxed text-muted">
          Northbridge
          <br />
          Dhaka · Kuala Lumpur · Colombo · Limassol
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-(--header-h) items-center gap-3 border-b border-line bg-page/95 px-14 backdrop-blur max-md:px-1">
          <Button variant="ghost" size="icon" aria-label="Open menu" className="md:hidden" onClick={() => setOpen(true)}>
            <Menu aria-hidden size={18} strokeWidth={1.8} />
          </Button>
          <span className="md:hidden">
            <Brand />
          </span>
          <span className="ml-auto hidden text-sm font-medium md:inline">{user.full_name}</span>
          <span className="max-md:ml-auto">
            <RoleBadge>{roleLabel(user.role)}</RoleBadge>
          </span>
          <Button variant="ghost" onClick={logout} aria-label="Log out">
            <LogOut aria-hidden size={16} strokeWidth={1.8} />
            <span className="max-md:hidden">Log out</span>
          </Button>
        </header>
        <main className="min-w-0 flex-1 px-14 pb-24 pt-12 max-md:px-4 max-md:pt-6">
          <div className="mx-auto max-w-[1100px]">
            <Outlet />
          </div>
        </main>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-[rgb(18_36_33/.45)]"
            onClick={() => setOpen(false)}
          />
          <div className="relative flex h-full w-[284px] animate-rise flex-col bg-n-100 px-4 pb-6 pt-5">
            <div className="mb-6 flex items-center justify-between pl-[9px]">
              <Brand />
              <Button variant="ghost" size="icon" aria-label="Close menu" onClick={() => setOpen(false)}>
                <X aria-hidden size={18} strokeWidth={1.8} />
              </Button>
            </div>
            <Nav role={user.role} onNavigate={() => setOpen(false)} />
            <p className="mt-auto pl-[9px] text-[13px] text-muted">{user.full_name}</p>
          </div>
        </div>
      )}
    </div>
  )
}
