import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../../api/client'
import type { HeadcountReport, InsightsReport, OnboardingReport, RequestStatus, RequestsReport } from '../../api/types'
import { Card } from '../../components/Card'
import { PageHeader } from '../../components/PageHeader'
import { QueryBoundary } from '../../components/QueryBoundary'
import { StatusBadge } from '../../components/RequestBadges'
import { label } from '../../lib/format'
import { ChartCard } from './ChartCard'

const INDIGO = '#4f46e5'
const axis = { fontSize: 12, fill: '#475569' }
const openStatuses: RequestStatus[] = ['SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED']
const statusColor: Record<string, string> = {
  SUBMITTED: '#94a3b8',
  ASSIGNED: '#3b82f6',
  IN_PROGRESS: '#f59e0b',
  RESOLVED: '#22c55e',
}

const useReport = <T,>(name: string) => useQuery({ queryKey: ['dashboard', name], queryFn: () => api<T>(`/dashboard/${name}`) })

function Tile({ title, value, note, alert }: { title: string; value: number; note?: string; alert?: boolean }) {
  return (
    <Card className={`!p-4 ${alert ? '!border-red-200 !bg-red-50' : ''}`}>
      <p className="text-xs font-medium text-slate-500">{title}</p>
      <p className={`mt-1 text-3xl font-semibold ${alert ? 'text-red-700' : ''}`}>{value}</p>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </Card>
  )
}

function Kpis() {
  const headcount = useReport<HeadcountReport>('headcount')
  const requests = useReport<RequestsReport>('requests')
  const onboarding = useReport<OnboardingReport>('onboarding')
  const overdue = onboarding.data?.overdue_tasks ?? 0
  const blocked = onboarding.data?.blocked_tasks ?? 0
  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <Tile title="Total headcount" value={headcount.data?.total ?? 0} />
      <Tile
        title="Open requests"
        value={requests.data?.open_total ?? 0}
        note={requests.data && `${requests.data.unresolved_total} unresolved · ${requests.data.awaiting_confirmation_total} awaiting confirmation`}
      />
      <Tile
        title="New hires in onboarding"
        value={onboarding.data?.active_new_hires ?? 0}
        note={onboarding.data && `${onboarding.data.completed_new_hires} completed`}
      />
      <Tile title="Overdue onboarding tasks" value={overdue} alert={overdue > 0} />
      <Tile title="Blocked onboarding tasks" value={blocked} alert={blocked > 0} />
    </div>
  )
}

const grid = <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
const tip = <Tooltip cursor={{ fill: '#f1f5f9' }} />

function HeadcountCharts() {
  const headcount = useReport<HeadcountReport>('headcount')
  return (
    <QueryBoundary query={headcount}>
      {(h) => (
        <>
          <ChartCard title="Headcount by country">
            <BarChart data={h.by_country}>
              {grid}
              <XAxis dataKey="label" tick={axis} />
              <YAxis allowDecimals={false} tick={axis} width={32} />
              {tip}
              <Bar dataKey="count" name="People" fill={INDIGO} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartCard>
          <ChartCard title="Headcount by department">
            <BarChart data={h.by_department} layout="vertical">
              {grid}
              <XAxis type="number" allowDecimals={false} tick={axis} />
              <YAxis type="category" dataKey="label" tick={axis} width={110} />
              {tip}
              <Bar dataKey="count" name="People" fill={INDIGO} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartCard>
        </>
      )}
    </QueryBoundary>
  )
}

function RequestCharts() {
  const requests = useReport<RequestsReport>('requests')
  return (
    <QueryBoundary query={requests}>
      {(r) => (
        <>
          <ChartCard title="Open requests by status">
            <BarChart data={openStatuses.map((s) => ({ label: label(s), count: r.by_status.find((g) => g.label === s)?.count ?? 0 }))}>
              {grid}
              <XAxis dataKey="label" tick={axis} />
              <YAxis allowDecimals={false} tick={axis} width={32} />
              {tip}
              <Bar dataKey="count" name="Requests" radius={[4, 4, 0, 0]}>
                {openStatuses.map((s) => (
                  <Cell key={s} fill={statusColor[s]} />
                ))}
              </Bar>
            </BarChart>
          </ChartCard>
          <ChartCard title="Open requests by category">
            <BarChart data={r.by_category} layout="vertical">
              {grid}
              <XAxis type="number" allowDecimals={false} tick={axis} />
              <YAxis type="category" dataKey="label" tick={axis} width={110} />
              {tip}
              <Bar dataKey="count" name="Requests" fill={INDIGO} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartCard>
        </>
      )}
    </QueryBoundary>
  )
}

function Insights() {
  const insights = useReport<InsightsReport>('insights')
  return (
    <QueryBoundary query={insights}>
      {({ onboarding_completion_by_country: completion, new_hires_with_open_requests: hires, work_held_by_inactive_users: held }) => (
        <>
          <ChartCard title="Onboarding completion by country">
            <BarChart data={completion.map((c) => ({ ...c, percent: Math.round(c.rate * 100) }))}>
              {grid}
              <XAxis dataKey="country" tick={axis} />
              <YAxis domain={[0, 100]} unit="%" tick={axis} width={40} />
              <Tooltip
                cursor={{ fill: '#f1f5f9' }}
                formatter={(value, _name, item) => `${value}% (${item.payload.completed_tasks} / ${item.payload.total_tasks} tasks)`}
              />
              <Bar dataKey="percent" name="Completed" fill={INDIGO} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartCard>

          <Card className="lg:col-span-2">
            <h2 className="mb-4 text-sm font-semibold">New hires waiting on requests</h2>
            {hires.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No new hire is waiting on a request.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      {['New hire', 'Country', 'Request', 'Category', 'Status', 'Title'].map((h) => (
                        <th key={h} className="px-3 py-2 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {hires.flatMap((h) =>
                      h.open_requests.map((r, i) => (
                        <tr key={r.reference}>
                          <td className="whitespace-nowrap px-3 py-2 font-medium">{i === 0 && h.new_hire}</td>
                          <td className="whitespace-nowrap px-3 py-2">{i === 0 && h.country}</td>
                          <td className="px-3 py-2 font-mono text-xs">
                            <Link
                              to={`/requests/${Number(r.reference.slice(4))}`}
                              className="text-indigo-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                            >
                              {r.reference}
                            </Link>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2">{r.category}</td>
                          <td className="px-3 py-2">
                            <StatusBadge status={r.status} />
                          </td>
                          <td className="px-3 py-2">{r.title ?? <span className="italic text-slate-400">Confidential request</span>}</td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {(held.requests > 0 || held.onboarding_tasks > 0) && (
            <Card className="!border-amber-200 !bg-amber-50 lg:col-span-2">
              <h2 className="text-sm font-semibold text-amber-900">Work held by inactive users</h2>
              <p className="mt-1 text-sm text-amber-900">
                {held.requests} open requests and {held.onboarding_tasks} onboarding tasks are assigned to people who can no longer log in.
                Reassign them.
              </p>
            </Card>
          )}
        </>
      )}
    </QueryBoundary>
  )
}

export function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Dashboard"
        subtitle="Open means every request that is not closed. Unresolved means submitted, assigned or in progress."
      />
      <Kpis />
      <div className="grid gap-4 lg:grid-cols-2">
        <HeadcountCharts />
        <RequestCharts />
        <Insights />
      </div>
    </div>
  )
}
