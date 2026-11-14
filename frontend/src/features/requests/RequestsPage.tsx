import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import type { Page, RequestSummary, Role } from '../../api/types'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Input, Select } from '../../components/Fields'
import { PageHeader } from '../../components/PageHeader'
import { PriorityBadge, StatusBadge } from '../../components/RequestBadges'
import { Spinner } from '../../components/Spinner'
import { formatDate, label, priorities, statuses } from '../../lib/format'
import { useAuth } from '../auth/AuthContext'
import { useCategories, useCountries } from './queries'

const PAGE_SIZE = 20
const mine = { view: 'mine', text: 'My requests' }
const assigned = { view: 'assigned', text: 'Assigned to me' }
const team = { view: 'team', text: 'My team' }
const queue = { view: 'queue', text: 'Department queue' }

const tabsByRole: Record<Role, { view: string; text: string }[]> = {
  EMPLOYEE: [mine, assigned],
  MANAGER: [mine, assigned, team, queue],
  HR_ADMIN: [{ view: 'all', text: 'All requests' }, mine, assigned, team, queue],
}

const filterKeys = ['status', 'category_id', 'priority', 'country', 'search']
const headings = ['Reference', 'Title', 'Category', 'Priority', 'Status', 'Requester', 'Assignee', 'Created']
const tight = '!mt-0'

export function RequestsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('search') ?? '')
  const categories = useCategories()
  const isAdmin = user?.role === 'HR_ADMIN'
  const countries = useCountries(isAdmin)

  const tabs = tabsByRole[user?.role ?? 'EMPLOYEE']
  const view = tabs.find((t) => t.view === params.get('view'))?.view ?? tabs[0].view
  const page = Number(params.get('page')) || 1

  const query = new URLSearchParams({ view, page: String(page), page_size: String(PAGE_SIZE) })
  for (const key of filterKeys) if (params.get(key)) query.set(key, params.get(key)!)

  const list = useQuery({
    queryKey: ['requests', query.toString()],
    queryFn: () => api<Page<RequestSummary>>(`/requests?${query}`),
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
        <PageHeader title="Requests" subtitle="Ask for help and follow it through to the end." />
        <Button onClick={() => navigate('/requests/new')} className="shrink-0">
          New request
        </Button>
      </div>

      <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.view}
            role="tab"
            aria-selected={view === t.view}
            onClick={() => update({ view: t.view })}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              view === t.view ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.text}
          </button>
        ))}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Input
          type="search"
          placeholder="Search by title"
          aria-label="Search by title"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={tight}
        />
        {filterSelect('status', 'Statuses', statuses.map((s) => ({ value: s, text: label(s) })))}
        {filterSelect('category_id', 'Categories', (categories.data ?? []).map((c) => ({ value: String(c.id), text: c.name })))}
        {filterSelect('priority', 'Priorities', priorities.map((p) => ({ value: p, text: label(p) })))}
        {isAdmin && filterSelect('country', 'Countries', (countries.data ?? []).map((c) => ({ value: c.code, text: c.name })))}
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
        <Card className="py-12 text-center text-sm text-slate-500">No requests match these filters.</Card>
      ) : (
        <>
          <ul className="space-y-3 md:hidden">
            {data.items.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/requests/${r.id}`}
                  className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="font-mono">{r.reference}</span>
                    <span>{formatDate(r.created_at)}</span>
                  </div>
                  <p className="mt-1 font-medium">{r.title}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <StatusBadge status={r.status} />
                    <PriorityBadge priority={r.priority} />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {r.category.name} · {r.requester.full_name} · {r.assignee?.full_name ?? 'Unassigned'}
                  </p>
                </Link>
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
                {data.items.map((r) => (
                  <tr key={r.id} onClick={() => navigate(`/requests/${r.id}`)} className="cursor-pointer hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link
                        to={`/requests/${r.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-indigo-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                      >
                        {r.reference}
                      </Link>
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 font-medium">{r.title}</td>
                    <td className="px-4 py-3">{r.category.name}</td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={r.priority} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3">{r.requester.full_name}</td>
                    <td className="px-4 py-3">{r.assignee?.full_name ?? <span className="text-slate-400">Unassigned</span>}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
            <span>
              Page {data.page} of {pages} · {data.total} requests
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
    </div>
  )
}
