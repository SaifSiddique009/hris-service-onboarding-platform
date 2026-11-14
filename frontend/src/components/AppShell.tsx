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
import { Link, Outlet, useLocation } from 'react-router-dom'
import type { Role, User } from '../api/types'
import { useAuth } from '../features/auth/AuthContext'
import { roleLabel } from '../lib/format'
import { Avatar } from './Avatar'
import { RoleBadge } from './Badge'
import { Brand } from './Brand'
import { Button } from './Button'

const links: { to: string; label: string; icon: LucideIcon; match: RegExp; roles?: Role[] }[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, match: /^\/dashboard/, roles: ['HR_ADMIN'] },
  { to: '/requests', label: 'Requests', icon: Inbox, match: /^\/requests/ },
  { to: '/onboarding/me', label: 'My onboarding', icon: UserCheck, match: /^\/onboarding\/me$/ },
  { to: '/onboarding/tasks', label: 'My tasks', icon: ListChecks, match: /^\/onboarding\/tasks$/ },
  {
    to: '/onboarding',
    label: 'Team onboarding',
    icon: Users,
    match: /^\/onboarding(\/checklists\/.*)?$/,
    roles: ['MANAGER', 'HR_ADMIN'],
  },
  { to: '/onboarding/templates', label: 'Templates', icon: FileText, match: /^\/onboarding\/templates/, roles: ['HR_ADMIN'] },
  { to: '/people', label: 'People', icon: IdCard, match: /^\/people/, roles: ['HR_ADMIN'] },
  { to: '/assistant', label: 'Assistant', icon: Sparkles, match: /^\/assistant/, roles: ['HR_ADMIN'] },
]

function AccountLink({ user, onNavigate }: { user: User; onNavigate?: () => void }) {
  const { pathname } = useLocation()
  return (
    <Link
      to="/account"
      aria-current={pathname === '/account' ? 'page' : undefined}
      onClick={onNavigate}
      className="group mt-auto flex items-center gap-2.5 border-t border-line px-[9px] pb-1 pt-4 text-ink no-underline hover:text-ink"
    >
      <Avatar name={user.full_name} active />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold group-hover:underline group-aria-[current=page]:underline">{user.full_name}</span>
        <span className="block truncate text-xs text-muted">{user.job_title}</span>
      </span>
    </Link>
  )
}

function Nav({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const { pathname } = useLocation()
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {links
        .filter((link) => !link.roles || link.roles.includes(role))
        .map(({ to, label, icon: Icon, match }) => (
          <Link
            key={to}
            to={to}
            aria-current={match.test(pathname) ? 'page' : undefined}
            onClick={onNavigate}
            className="flex min-h-[38px] items-center gap-[11px] rounded-xs border-l-3 border-transparent pl-[9px] pr-3 text-sm font-medium text-n-600 no-underline hover:bg-[#e4e9df] hover:text-n-600 aria-[current=page]:border-accent aria-[current=page]:font-semibold aria-[current=page]:text-ink max-md:min-h-11"
          >
            <Icon aria-hidden size={16} strokeWidth={1.8} />
            {label}
          </Link>
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
        <AccountLink user={user} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-(--header-h) items-center gap-3 border-b border-line bg-page/95 px-14 backdrop-blur max-md:gap-1 max-md:px-1">
          <Button variant="ghost" size="icon" aria-label="Open menu" className="md:hidden" onClick={() => setOpen(true)}>
            <Menu aria-hidden size={18} strokeWidth={1.8} />
          </Button>
          <span className="min-w-0 md:hidden">
            <Brand />
          </span>
          <Link
            to="/account"
            className="ml-auto hidden rounded-xs text-sm font-medium text-ink no-underline hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus md:inline"
          >
            {user.full_name}
          </Link>
          <span className="shrink-0 max-md:ml-auto">
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
            <AccountLink user={user} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
