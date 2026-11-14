import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import type { OnboardingTask } from '../../api/types'
import { PageHeader } from '../../components/PageHeader'
import { QueryBoundary } from '../../components/QueryBoundary'
import { EmptyState } from '../../components/States'
import { Tabs } from '../../components/Tabs'
import { useAuth } from '../auth/AuthContext'
import { TaskRow } from './TaskRow'

const tabs = [
  { state: 'open', text: 'Open', empty: 'You have no open onboarding tasks.' },
  { state: 'overdue', text: 'Overdue', empty: 'Nothing is overdue.' },
  { state: 'blocked', text: 'Blocked', empty: 'None of your tasks are waiting on another task.' },
  { state: 'completed', text: 'Completed', empty: 'You have not completed any onboarding tasks yet.' },
]

export function MyTasksPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = tabs.find((t) => t.state === params.get('state')) ?? tabs[0]
  const query = useQuery({
    queryKey: ['onboarding', 'tasks', 'mine'],
    queryFn: () => api<OnboardingTask[]>('/onboarding/tasks/mine'),
  })
  const matches: Record<string, (t: OnboardingTask) => boolean> = {
    open: (t) => t.effective_status !== 'COMPLETED' && t.effective_status !== 'BLOCKED',
    overdue: (t) => t.is_overdue,
    blocked: (t) => t.effective_status === 'BLOCKED',
    completed: (t) => t.effective_status === 'COMPLETED',
  }
  const count = (state: string) => query.data?.filter(matches[state]).length

  return (
    <>
      <PageHeader title="My tasks" eyebrow="Onboarding" subtitle="Onboarding tasks you own, soonest due date first." />
      <Tabs
        label="Task state"
        value={tab.state}
        onChange={(state) => setParams({ state })}
        tabs={tabs.map((t) => ({
          value: t.state,
          label: t.text,
          count: count(t.state),
          hot: t.state === 'overdue' || t.state === 'blocked',
        }))}
      />
      <div className="mt-6">
        <QueryBoundary query={query}>
          {(all) => {
            const tasks = all.filter(matches[tab.state])
            return tasks.length === 0 ? (
              <EmptyState
                title={tab.empty}
                help="These are tasks you do for a new hire. The tasks of your own onboarding are under My onboarding."
                action={
                  tab.state !== 'open' && (
                    <Link to="?state=open" className="text-sm font-semibold">
                      Show open tasks
                    </Link>
                  )
                }
              />
            ) : (
              <ul className="border-t border-ink">
                {tasks.map((t) => (
                  <TaskRow key={t.id} task={t} canOpen={user?.role !== 'EMPLOYEE'} />
                ))}
              </ul>
            )
          }}
        </QueryBoundary>
      </div>
    </>
  )
}
