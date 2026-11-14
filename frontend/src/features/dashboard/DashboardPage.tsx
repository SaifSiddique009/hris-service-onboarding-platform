import { useQuery } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, LabelList, XAxis, YAxis } from 'recharts'
import { api } from '../../api/client'
import type { HeadcountReport, InsightsReport, OnboardingReport, RequestStatus, RequestsReport } from '../../api/types'
import { Avatar } from '../../components/Avatar'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { PageHeader, eyebrowClass } from '../../components/PageHeader'
import { QueryBoundary } from '../../components/QueryBoundary'
import { StatusBadge } from '../../components/RequestBadges'
import { cn } from '../../lib/cn'
import { useAuth } from '../auth/AuthContext'
import { ChartCard, animate } from './ChartCard'

const openStatuses: RequestStatus[] = ['SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED']
const statusColor: Record<string, string> = {
  SUBMITTED: 'var(--color-blue)',
  ASSIGNED: 'var(--color-plum)',
  IN_PROGRESS: 'var(--color-amber)',
  RESOLVED: 'var(--color-accent)',
}
const tick = { fontSize: 13.5, fill: 'var(--color-ink)' }
const barLabel = { className: 'font-semibold tabular-nums', fontSize: 13.5, fill: 'var(--color-ink)' }

const useReport = <T,>(name: string) => useQuery({ queryKey: ['dashboard', name], queryFn: () => api<T>(`/dashboard/${name}`) })
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

const today = () => new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

function greeting(name: string) {
  const hour = new Date().getHours()
  return `Good ${hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'}, ${name.split(' ')[0]}.`
}

function Metric({ title, value, note, alert }: { title: string; value: number; note?: string; alert?: boolean }) {
  const hot = alert && value > 0
  return (
    <Card variant={hot ? 'attention' : 'emphasis'}>
      <p className={eyebrowClass}>{title}</p>
      <p className={cn('mt-2 font-serif text-[52px] leading-none tabular-nums max-md:text-[40px]', hot && 'text-danger')}>{value}</p>
      <p className="mt-2 min-h-5 text-[13px] text-muted">{note}</p>
    </Card>
  )
}

function Metrics() {
  const headcount = useReport<HeadcountReport>('headcount')
  const requests = useReport<RequestsReport>('requests')
  const onboarding = useReport<OnboardingReport>('onboarding')
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-5">
      <Metric title="Headcount" value={headcount.data?.total ?? 0} />
      <Metric
        title="Open requests"
        value={requests.data?.open_total ?? 0}
        note={requests.data && `${requests.data.unresolved_total} unresolved, ${requests.data.awaiting_confirmation_total} awaiting confirmation`}
      />
      <Metric
        title="In onboarding"
        value={onboarding.data?.active_new_hires ?? 0}
        note={onboarding.data && `${onboarding.data.completed_new_hires} completed`}
      />
      <Metric title="Overdue tasks" value={onboarding.data?.overdue_tasks ?? 0} alert />
      <Metric title="Blocked tasks" value={onboarding.data?.blocked_tasks ?? 0} alert />
    </div>
  )
}

function Attention() {
  const insights = useReport<InsightsReport>('insights')
  return (
    <QueryBoundary query={insights}>
      {({ new_hires_with_open_requests: hires, work_held_by_inactive_users: held }) => (
        <>
          {(held.requests > 0 || held.onboarding_tasks > 0) && (
            <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-md border border-amber/30 bg-amber-soft px-5 py-4 text-amber">
              <p className="flex items-start gap-3 text-[14.5px]">
                <Lock aria-hidden size={16} strokeWidth={1.8} className="mt-1 shrink-0" />
                <span>
                  <b className="font-semibold">Work held by inactive users.</b> {plural(held.requests, 'open request is', 'open requests are')} and{' '}
                  {plural(held.onboarding_tasks, 'onboarding task is', 'onboarding tasks are')} assigned to people who can no longer sign in.
                </span>
              </p>
              <Link to="/people" className="no-underline">
                <Button variant="secondary">Review people</Button>
              </Link>
            </div>
          )}

          <section className="mt-14" aria-labelledby="insight">
            <p className={cn(eyebrowClass, 'text-danger')}>Key insight</p>
            <h2 id="insight" className="mt-1.5 font-serif text-[28px] leading-[1.2]">
              New hires waiting on requests
            </h2>
            {hires.length === 0 ? (
              <p className="mt-4 border-t border-ink pt-4 text-[14.5px] text-muted">No new hire is waiting on a request.</p>
            ) : (
              <ul className="mt-5 grid grid-cols-1 gap-x-10 gap-y-8 md:grid-cols-2">
                {hires.map((h) => (
                  <li key={h.new_hire}>
                    <Card variant="attention">
                      <div className="flex items-center gap-3">
                        <Avatar name={h.new_hire} />
                        <div>
                          <p className="text-[15px] font-semibold">{h.new_hire}</p>
                          <p className="text-[13px] text-muted">{h.country}</p>
                        </div>
                      </div>
                      <ul className="mt-3">
                        {h.open_requests.map((r) => (
                          <li key={r.reference} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line py-2.5 first:border-t-0">
                            <Link
                              to={`/requests/${Number(r.reference.slice(4))}`}
                              className="text-[13px] font-semibold tabular-nums text-muted no-underline hover:text-ink"
                            >
                              {r.reference}
                            </Link>
                            <span className="min-w-0 flex-1 text-sm">
                              {r.title ?? (
                                <span className="inline-flex items-center gap-1.5 italic text-muted">
                                  <Lock aria-hidden size={14} strokeWidth={1.8} />
                                  Confidential request
                                </span>
                              )}
                            </span>
                            <StatusBadge status={r.status} />
                          </li>
                        ))}
                      </ul>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </QueryBoundary>
  )
}

function CountBars({ title, subtitle, data }: { title: string; subtitle: string; data: { label: string; count: number }[] }) {
  return (
    <ChartCard title={title} subtitle={subtitle} rows={Math.max(data.length, 1)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 0 }} barCategoryGap={12}>
        <XAxis hide type="number" />
        <YAxis type="category" dataKey="label" width={128} axisLine={false} tickLine={false} tick={tick} interval={0} />
        <Bar dataKey="count" name="Count" barSize={8} radius={1} fill="var(--color-ink)" isAnimationActive={animate}>
          <LabelList dataKey="count" position="right" {...barLabel} />
        </Bar>
      </BarChart>
    </ChartCard>
  )
}

function StatusBar({ report }: { report: RequestsReport }) {
  const counts = openStatuses.map((s) => ({ s, count: report.by_status.find((g) => g.label === s)?.count ?? 0 }))
  const total = counts.reduce((sum, c) => sum + c.count, 0)
  return (
    <ChartCard title="Open requests by status" subtitle={`${total} requests, in workflow order`}>
      <div aria-hidden className="flex h-3.5 gap-0.5">
        {counts
          .filter((c) => c.count > 0)
          .map((c) => (
            <span key={c.s} style={{ flexGrow: c.count, background: statusColor[c.s] }} className="min-w-1 rounded-[1px]" />
          ))}
      </div>
      <ul className="mt-5 grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2">
        {counts.map((c) => (
          <li key={c.s} className="flex items-center justify-between gap-3 text-sm">
            <StatusBadge status={c.s} />
            <b className="font-semibold tabular-nums">{c.count}</b>
          </li>
        ))}
      </ul>
    </ChartCard>
  )
}

function Charts() {
  const headcount = useReport<HeadcountReport>('headcount')
  const requests = useReport<RequestsReport>('requests')
  const insights = useReport<InsightsReport>('insights')
  return (
    <div className="mt-14 grid grid-cols-1 gap-x-12 gap-y-12 lg:grid-cols-2">
      <QueryBoundary query={headcount}>
        {(h) => (
          <>
            <CountBars title="Headcount by country" subtitle="People per country" data={h.by_country} />
            <CountBars title="Headcount by department" subtitle="People per department" data={h.by_department} />
          </>
        )}
      </QueryBoundary>
      <QueryBoundary query={requests}>
        {(r) => (
          <>
            <StatusBar report={r} />
            <CountBars title="Open requests by category" subtitle="Requests that are not closed" data={r.by_category} />
          </>
        )}
      </QueryBoundary>
      <QueryBoundary query={insights}>
        {({ onboarding_completion_by_country: completion }) => (
          <ChartCard title="Onboarding completion by country" subtitle="Share of onboarding tasks completed" rows={Math.max(completion.length, 1)}>
            <BarChart
              data={completion.map((c) => ({ ...c, percent: Math.round(c.rate * 100) }))}
              layout="vertical"
              margin={{ top: 0, right: 44, bottom: 0, left: 0 }}
              barCategoryGap={12}
            >
              <XAxis hide type="number" domain={[0, 100]} />
              <YAxis type="category" dataKey="country" width={128} axisLine={false} tickLine={false} tick={tick} interval={0} />
              <Bar
                dataKey="percent"
                name="Completed"
                barSize={8}
                radius={1}
                fill="var(--color-accent)"
                background={{ fill: 'var(--color-n-150)', radius: 1 }}
                isAnimationActive={animate}
              >
                <LabelList dataKey="percent" position="right" formatter={(v) => `${v}%`} {...barLabel} />
              </Bar>
            </BarChart>
          </ChartCard>
        )}
      </QueryBoundary>
    </div>
  )
}

export function DashboardPage() {
  const { user } = useAuth()
  const requests = useReport<RequestsReport>('requests')
  const onboarding = useReport<OnboardingReport>('onboarding')
  const insights = useReport<InsightsReport>('insights')

  let lede
  if (requests.data && onboarding.data && insights.data) {
    const overdue = onboarding.data.overdue_tasks
    const waiting = insights.data.new_hires_with_open_requests.length
    const overdueText = overdue === 0 ? 'No onboarding tasks are overdue' : `${plural(overdue, 'onboarding task is', 'onboarding tasks are')} overdue`
    const waitingText = waiting === 0 ? '' : `, and ${plural(waiting, 'new hire is', 'new hires are')} still waiting on requests of their own`
    lede = `${plural(requests.data.open_total, 'request is', 'requests are')} open. ${overdueText}${waitingText}.`
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow={`People operations · ${today()}`} title={greeting(user?.full_name ?? '')} subtitle={lede} />
      <Metrics />
      <Attention />
      <Charts />
    </div>
  )
}
