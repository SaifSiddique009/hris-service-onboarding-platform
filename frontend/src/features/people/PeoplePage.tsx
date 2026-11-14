import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import type { Page, Role, User, UserUpdated } from '../../api/types'
import { Badge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Input, Select } from '../../components/Fields'
import { PageHeader } from '../../components/PageHeader'
import { Spinner } from '../../components/Spinner'
import { employmentStatuses, formatDay, label, roleLabel, roles } from '../../lib/format'
import { useCountries, useDepartments } from '../requests/queries'
import { UserDialog } from './UserDialog'

const PAGE_SIZE = 20
const filterKeys = ['country', 'department_id', 'role', 'status', 'search']
const headings = ['Name', 'Job title', 'Department', 'Country', 'Role', 'Status', 'Manager', 'Joined', '']
const tight = '!mt-0'

const roleTone: Record<Role, string> = {
  EMPLOYEE: 'bg-slate-100 text-slate-700',
  MANAGER: 'bg-blue-50 text-blue-700',
  HR_ADMIN: 'bg-indigo-50 text-indigo-700',
}
const statusTone: Record<User['status'], string> = {
  ACTIVE: 'bg-green-50 text-green-700',
  ON_PROBATION: 'bg-amber-50 text-amber-800',
  ON_NOTICE: 'bg-red-50 text-red-700',
}

const Badges = ({ u }: { u: User }) => (
  <>
    <Badge tone={roleTone[u.role]}>{roleLabel(u.role)}</Badge>
    <Badge tone={statusTone[u.status]}>{label(u.status)}</Badge>
    {!u.is_active && <Badge tone="bg-slate-200 text-slate-800">Inactive</Badge>}
  </>
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

  const filterSelect = (key: string, name: string, options: { value: string; text: string }[]) => (
    <Select aria-label={name} value={params.get(key) ?? ''} onChange={(e) => update({ [key]: e.target.value })} className={tight}>
      <option value="">All {name.toLowerCase()}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.text}
        </option>
      ))}
    </Select>
  )

  const data = list.data
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="People" subtitle="Everyone on the platform, with their role and reporting line." />
        <Button className="shrink-0" onClick={() => setDialog({})}>
          Add employee
        </Button>
      </div>

      {notice && (
        <Card className="mb-4 flex items-start justify-between gap-3 !border-amber-200 !bg-amber-50 !p-4 text-sm text-amber-900">
          <p>{notice}</p>
          <button onClick={() => setNotice('')} className="font-medium underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
            Dismiss
          </button>
        </Card>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Input
          type="search"
          placeholder="Search by name or email"
          aria-label="Search by name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={tight}
        />
        {filterSelect('department_id', 'Departments', (departments.data ?? []).map((d) => ({ value: String(d.id), text: d.name })))}
        {filterSelect('country', 'Countries', (countries.data ?? []).map((c) => ({ value: c.code, text: c.name })))}
        {filterSelect('role', 'Roles', roles.map((r) => ({ value: r, text: roleLabel(r) })))}
        {filterSelect('status', 'Statuses', employmentStatuses.map((s) => ({ value: s, text: label(s) })))}
      </div>

      {list.isPending ? (
        <div className="flex justify-center py-16 text-indigo-600">
          <Spinner />
        </div>
      ) : list.isError || !data ? (
        <Card>
          <p role="alert" className="text-sm text-red-600">
            {list.error?.message}
          </p>
          <Button variant="secondary" className="mt-3" onClick={() => list.refetch()}>
            Try again
          </Button>
        </Card>
      ) : data.items.length === 0 ? (
        <Card className="py-12 text-center text-sm text-slate-500">No people match these filters.</Card>
      ) : (
        <>
          <ul className="space-y-3 md:hidden">
            {data.items.map((u) => (
              <li key={u.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{u.full_name}</p>
                    <p className="text-sm text-slate-600">{u.job_title}</p>
                  </div>
                  <Button variant="secondary" onClick={() => setDialog({ user: u })}>
                    Edit
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badges u={u} />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {u.department.name} · {u.country.name} · Joined {formatDay(u.joining_date)}
                </p>
                <p className="text-xs text-slate-500">Manager: {u.manager?.full_name ?? 'None'}</p>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {headings.map((h) => (
                    <th key={h} className="px-4 py-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3 font-medium">
                      {u.full_name}
                      {!u.is_active && (
                        <span className="ml-2 align-middle">
                          <Badge tone="bg-slate-200 text-slate-800">Inactive</Badge>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{u.job_title}</td>
                    <td className="px-4 py-3">{u.department.name}</td>
                    <td className="px-4 py-3">{u.country.name}</td>
                    <td className="px-4 py-3">
                      <Badge tone={roleTone[u.role]}>{roleLabel(u.role)}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone[u.status]}>{label(u.status)}</Badge>
                    </td>
                    <td className="px-4 py-3">{u.manager?.full_name ?? <span className="text-slate-400">None</span>}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatDay(u.joining_date)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="secondary" onClick={() => setDialog({ user: u })}>
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
            <span>
              Page {data.page} of {pages} · {data.total} people
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>
                Previous
              </Button>
              <Button variant="secondary" disabled={page >= pages} onClick={() => update({ page: String(page + 1) })}>
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
