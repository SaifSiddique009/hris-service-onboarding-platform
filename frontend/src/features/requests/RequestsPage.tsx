import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import type { Page, RequestSummary, Role } from '../../api/types'
import { Button } from '../../components/Button'
import { SearchInput } from '../../components/Fields'
import { FilterMenu } from '../../components/FilterMenu'
import { PageHeader } from '../../components/PageHeader'
import { PriorityBadge, StatusBadge } from '../../components/RequestBadges'
import { EmptyState, ErrorState, LoadingState } from '../../components/States'
import { RowLink, Table, Td, Th } from '../../components/Table'
import { Tabs } from '../../components/Tabs'
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

  const filter = (key: string, name: string, options: { value: string; label: string }[]) => (
    <FilterMenu label={name} value={params.get(key) ?? ''} options={options} onChange={(value) => update({ [key]: value })} />
  )

  const newRequest = (
    <Button onClick={() => navigate('/requests/new')}>
      <Plus aria-hidden size={16} strokeWidth={1.8} />
      New request
    </Button>
  )

  const data = list.data
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1

  return (
    <div>
      <PageHeader
        eyebrow="Service requests"
        title="Requests"
        subtitle="Ask for help and follow it through to the end."
        actions={newRequest}
      />

      <Tabs
        label="Request views"
        value={view}
        onChange={(value) => update({ view: value })}
        tabs={tabs.map((t) => ({ value: t.view, label: t.text }))}
      />

      <div className="my-5 flex flex-wrap items-center gap-2">
        <div className="w-full md:w-64">
          <SearchInput
            placeholder="Search by title"
            aria-label="Search by title"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {filter('status', 'Status', statuses.map((s) => ({ value: s, label: label(s) })))}
        {filter('category_id', 'Category', (categories.data ?? []).map((c) => ({ value: String(c.id), label: c.name })))}
        {filter('priority', 'Priority', priorities.map((p) => ({ value: p, label: label(p) })))}
        {isAdmin && filter('country', 'Country', (countries.data ?? []).map((c) => ({ value: c.code, label: c.name })))}
      </div>

      {list.isPending ? (
        <LoadingState />
      ) : list.isError || !data ? (
        <ErrorState message={list.error?.message ?? 'Something went wrong'} onRetry={() => list.refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState title="No requests match" help="Try clearing a filter or switching to another view." action={newRequest} />
      ) : (
        <>
          <ul className="border-t border-ink md:hidden">
            {data.items.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/requests/${r.id}`)}
                  className="flex w-full flex-col gap-2 border-b border-line py-4 text-left"
                >
                  <span className="flex items-center justify-between gap-2 text-[13px] text-muted">
                    <span>
                      <span className="font-semibold tabular-nums">{r.reference}</span> ·{' '}
                      <span className="tabular-nums">{formatDate(r.created_at)}</span>
                    </span>
                    <StatusBadge status={r.status} />
                  </span>
                  <span className="text-base font-semibold">{r.title}</span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <PriorityBadge priority={r.priority} />
                    <span className="text-[13px] text-muted">{r.category.name}</span>
                  </span>
                  <span className="text-[13px] text-muted">
                    {r.requester.full_name} → {r.assignee ? r.assignee.full_name : <span className="italic">Unassigned</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="hidden md:block">
            <Table>
              <thead>
                <tr>
                  {headings.map((h) => (
                    <Th key={h} className={h === 'Created' ? 'text-right' : undefined}>
                      {h}
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((r) => (
                  <RowLink key={r.id} onOpen={() => navigate(`/requests/${r.id}`)}>
                    <Td className="w-24 text-[13px] font-semibold tabular-nums text-muted">{r.reference}</Td>
                    <Td className="font-semibold">{r.title}</Td>
                    <Td>{r.category.name}</Td>
                    <Td>
                      <PriorityBadge priority={r.priority} />
                    </Td>
                    <Td>
                      <StatusBadge status={r.status} />
                    </Td>
                    <Td>{r.requester.full_name}</Td>
                    <Td>{r.assignee?.full_name ?? <span className="italic text-muted">Unassigned</span>}</Td>
                    <Td className="whitespace-nowrap text-right tabular-nums">{formatDate(r.created_at)}</Td>
                  </RowLink>
                ))}
              </tbody>
            </Table>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 text-[13px] text-muted">
            <span className="tabular-nums">
              Page {data.page} of {pages} · {data.total} requests
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
    </div>
  )
}
