import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import type { OnboardingTask } from '../../api/types'
import { PageHeader } from '../../components/PageHeader'
import { QueryBoundary } from '../../components/QueryBoundary'
import { EmptyState } from '../../components/States'
import { Tabs } from '../../components/Tabs'
import { TaskCard } from './TaskCard'

const tabs = [
  { state: 'open', text: 'Open', empty: 'You have no open onboarding tasks.' },
  { state: 'overdue', text: 'Overdue', empty: 'Nothing is overdue.' },
  { state: 'blocked', text: 'Blocked', empty: 'None of your tasks are waiting on another task.' },
  { state: 'completed', text: 'Completed', empty: 'You have not completed any onboarding tasks yet.' },
]

export function MyTasksPage() {
  const [params, setParams] = useSearchParams()
  const tab = tabs.find((t) => t.state === params.get('state')) ?? tabs[0]
  const query = useQuery({
    queryKey: ['onboarding', 'tasks', tab.state],
    queryFn: () => api<OnboardingTask[]>(`/onboarding/tasks/mine?state=${tab.state}`),
  })

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
          count: t === tab ? query.data?.length : undefined,
          hot: t.state === 'overdue' || t.state === 'blocked',
        }))}
      />
      <div className="mt-6">
        <QueryBoundary query={query}>
          {(tasks) =>
            tasks.length === 0 ? (
              <EmptyState
                title={tab.empty}
                help="Tasks appear here when a checklist assigns them to you."
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
                  <TaskCard key={t.id} task={t} showEmployee />
                ))}
              </ul>
            )
          }
        </QueryBoundary>
      </div>
    </>
  )
}
