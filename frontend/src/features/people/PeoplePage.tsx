import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useEffect, useState, type KeyboardEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import type { Page, User, UserUpdated } from '../../api/types'
import { Avatar } from '../../components/Avatar'
import { RoleBadge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { SearchInput } from '../../components/Fields'
import { FilterMenu } from '../../components/FilterMenu'
import { PageHeader } from '../../components/PageHeader'
import { StatusBadge } from '../../components/RequestBadges'
import { EmptyState, ErrorState, LoadingState } from '../../components/States'
import { Table, Td, Th } from '../../components/Table'
import { employmentStatuses, label, plural, roleLabel, roles } from '../../lib/format'
import { useCountries, useDepartments } from '../requests/queries'
import { UserDialog } from './UserDialog'

const PAGE_SIZE = 20
const filterKeys = ['country', 'department_id', 'role', 'status', 'is_active', 'search']
const headings = ['Name', 'Job title', 'Department', 'Country', 'Role', 'Status']

const Who = ({ u }: { u: User }) => (
  <div className="flex items-center gap-3">
    <Avatar name={u.full_name} active={u.is_active} />
    <div className="min-w-0">
      <p className="font-semibold">{u.full_name}</p>
      <p className="text-[13px] text-muted [overflow-wrap:anywhere]">{u.email.split('@')[0]}<wbr />@{u.email.split('@')[1]}</p>
    </div>
  </div>
)

const rowProps = (open: () => void) => ({
  tabIndex: 0,
  onClick: open,
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return
    e.preventDefault()
    open()
  },
})

const Status = ({ u }: { u: User }) => (
  <div className="flex flex-wrap items-center gap-2">
    <span>{label(u.status)}</span>
    {!u.is_active && <StatusBadge status="INACTIVE">Sign-in disabled</StatusBadge>}
  </div>
)

export function PeoplePage() {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('search') ?? '')
  const [dialog, setDialog] = useState<{ user?: User } | null>(null)
  const [notice, setNotice] = useState<string[]>([])
  const departments = useDepartments()
  const countries = useCountries(true)
  const page = Number(params.get('page')) || 1

  const query = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) })
  for (const key of filterKeys) if (params.get(key)) query.set(key, params.get(key)!)

  const list = useQuery({
    queryKey: ['users', query.toString()],
    queryFn: () => api<Page<User>>(`/users?${query}`),
    placeholderData: (prev) => prev,
  })

  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    if (!('page' in changes)) next.delete('page')
    setParams(next)
  }

  useEffect(() => {
    if (search === (params.get('search') ?? '')) return
    const id = setTimeout(() => update({ search }), 300)
    return () => clearTimeout(id)
  })

  function saved(u: UserUpdated) {
    setDialog(null)
    const open = u.open_items > 0
    const reports = u.direct_reports > 0
    setNotice(
      u.is_active || (!open && !reports)
        ? []
        : [
            open
              ? `Sign-in disabled. ${plural(u.open_items, 'open request', 'open requests')} or onboarding ${u.open_items === 1 ? 'task is' : 'tasks are'} still assigned to this person.`
              : 'Sign-in disabled.',
            ...(reports ? [`${plural(u.direct_reports, 'person', 'people')} still ${u.direct_reports === 1 ? 'reports' : 'report'} to this person; give them a new manager.`] : []),
          ],
    )
  }

  const filter = (key: string, name: string, options: { value: string; label: string }[]) => (
    <FilterMenu
      label={name}
      value={params.get(key) ?? ''}
      options={options}
      onChange={(value) => update({ [key]: value })}
    />
  )

  const data = list.data
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Directory"
        title="People"
        subtitle="Everyone on the platform, with their role and reporting line."
        actions={
          <Button onClick={() => setDialog({})}>
            <Plus aria-hidden size={16} strokeWidth={1.8} />
            Add employee
          </Button>
        }
      />

      {notice.length > 0 && (
        <div role="status" className="mb-5 flex items-start justify-between gap-3 rounded-md border border-amber/30 bg-amber-soft px-4 py-3 text-sm text-amber">
          <div className="space-y-1">
            {notice.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <button onClick={() => setNotice([])} className="min-h-6 font-semibold underline max-md:min-h-11">
            Dismiss
          </button>
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="w-full md:w-72">
          <SearchInput
            placeholder="Search by name or email"
            aria-label="Search by name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {filter('country', 'Country', (countries.data ?? []).map((c) => ({ value: c.code, label: c.name })))}
        {filter('department_id', 'Department', (departments.data ?? []).map((d) => ({ value: String(d.id), label: d.name })))}
        {filter('role', 'Role', roles.map((r) => ({ value: r, label: roleLabel(r) })))}
        {filter('status', 'Status', employmentStatuses.map((s) => ({ value: s, label: label(s) })))}
        {filter('is_active', 'Account', [
          { value: 'true', label: 'Enabled' },
          { value: 'false', label: 'Disabled' },
        ])}
        {data && <span className="ml-auto text-[13px] tabular-nums text-muted">{plural(data.total, 'person', 'people')}</span>}
      </div>

      {list.isPending ? (
        <LoadingState />
      ) : list.isError || !data ? (
        <ErrorState message={list.error?.message ?? 'Something went wrong'} onRetry={() => list.refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState
          title="No people match these filters"
          help="Clear a filter or try a different search."
          action={
            <Button variant="secondary" onClick={() => setParams(new URLSearchParams())}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          <ul className="border-t border-ink md:hidden">
            {data.items.map((u) => (
              <li
                key={u.id}
                {...rowProps(() => setDialog({ user: u }))}
                className="flex cursor-pointer flex-col gap-2 border-b border-line py-4 hover:bg-n-100"
              >
                <Who u={u} />
                <p className="text-[13px] text-muted">{u.job_title}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <RoleBadge>{roleLabel(u.role)}</RoleBadge>
                  <Status u={u} />
                </div>
                <p className="text-[13px] text-muted">
                  {u.department.name} · {u.country.name}
                </p>
              </li>
            ))}
          </ul>

          <div className="hidden md:block">
            <Table>
              <thead>
                <tr>
                  {headings.map((h) => (
                    <Th key={h}>{h}</Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u.id} {...rowProps(() => setDialog({ user: u }))} className="cursor-pointer hover:bg-n-100">
                    <Td>
                      <Who u={u} />
                    </Td>
                    <Td>{u.job_title}</Td>
                    <Td>{u.department.name}</Td>
                    <Td>{u.country.name}</Td>
                    <Td>
                      <RoleBadge>{roleLabel(u.role)}</RoleBadge>
                    </Td>
                    <Td>
                      <Status u={u} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted">
            <span className="tabular-nums">
              Page {data.page} of {pages}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>
                Previous
              </Button>
              <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => update({ page: String(page + 1) })}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      {dialog && <UserDialog user={dialog.user} onClose={() => setDialog(null)} onSaved={saved} />}
    </div>
  )
}
