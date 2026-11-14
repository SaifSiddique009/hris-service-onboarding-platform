import { useQuery } from '@tanstack/react-query'
import { Pencil, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
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
import { employmentStatuses, formatDay, label, roleLabel, roles } from '../../lib/format'
import { useCountries, useDepartments } from '../requests/queries'
import { UserDialog } from './UserDialog'

const PAGE_SIZE = 20
const filterKeys = ['country', 'department_id', 'role', 'status', 'search']
const headings = ['Name', 'Department', 'Country', 'Role', 'Status', 'Manager', 'Joined', '']

const Who = ({ u }: { u: User }) => (
  <div className="flex items-center gap-3">
    <Avatar name={u.full_name} active={u.is_active} />
    <div className="min-w-0">
      <p className="font-semibold">{u.full_name}</p>
      <p className="text-[13px] text-muted">{u.job_title}</p>
    </div>
  </div>
)

export function PeoplePage() {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('search') ?? '')
  const [dialog, setDialog] = useState<{ user?: User } | null>(null)
  const [notice, setNotice] = useState('')
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
    setNotice(
      !u.is_active && u.open_items > 0
        ? `Deactivated. ${u.open_items} open requests or onboarding tasks are still assigned to this person and need reassigning.`
        : '',
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

      {notice && (
        <div role="status" className="mb-5 flex items-start justify-between gap-3 rounded-md border border-amber/30 bg-amber-soft px-4 py-3 text-sm text-amber">
          <p>{notice}</p>
          <button onClick={() => setNotice('')} className="min-h-6 font-semibold underline max-md:min-h-11">
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
              <li key={u.id} className="flex flex-col gap-2 border-b border-line py-4">
                <div className="flex items-start justify-between gap-2">
                  <Who u={u} />
                  <Button variant="ghost" size="sm" aria-label={`Edit ${u.full_name}`} onClick={() => setDialog({ user: u })}>
                    <Pencil aria-hidden size={16} strokeWidth={1.8} />
                    Edit
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <RoleBadge>{roleLabel(u.role)}</RoleBadge>
                  <span className="text-[13px]">{label(u.status)}</span>
                  {!u.is_active && <StatusBadge status="INACTIVE">Inactive</StatusBadge>}
                </div>
                <p className="text-[13px] text-muted">
                  {u.department.name} · {u.country.name} · Joined {formatDay(u.joining_date)}
                </p>
                <p className="text-[13px] text-muted">Manager: {u.manager?.full_name ?? 'None'}</p>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto md:block">
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
                  <tr key={u.id}>
                    <Td>
                      <Who u={u} />
                    </Td>
                    <Td>{u.department.name}</Td>
                    <Td>{u.country.name}</Td>
                    <Td>
                      <RoleBadge>{roleLabel(u.role)}</RoleBadge>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{label(u.status)}</span>
                        {!u.is_active && <StatusBadge status="INACTIVE">Inactive</StatusBadge>}
                      </div>
                    </Td>
                    <Td>{u.manager?.full_name ?? <span className="italic text-muted">None</span>}</Td>
                    <Td className="whitespace-nowrap tabular-nums">{formatDay(u.joining_date)}</Td>
                    <Td className="text-right">
                      <Button variant="ghost" size="sm" aria-label={`Edit ${u.full_name}`} onClick={() => setDialog({ user: u })}>
                        <Pencil aria-hidden size={16} strokeWidth={1.8} />
                        Edit
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted">
            <span className="tabular-nums">
              Page {data.page} of {pages} · {data.total} people
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
