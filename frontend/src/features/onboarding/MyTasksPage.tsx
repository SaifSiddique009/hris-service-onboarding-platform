import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import type { OnboardingTask } from '../../api/types'
import { Card } from '../../components/Card'
import { PageHeader } from '../../components/PageHeader'
import { QueryBoundary } from '../../components/QueryBoundary'
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
    <div className="mx-auto max-w-4xl">
      <PageHeader title="My tasks" subtitle="Onboarding tasks you own, soonest due date first." />
      <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.state}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setParams({ state: t.state })}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              tab === t ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.text}
          </button>
        ))}
      </div>
      <QueryBoundary query={query}>
        {(tasks) =>
          tasks.length === 0 ? (
            <Card className="py-12 text-center text-sm text-slate-500">{tab.empty}</Card>
          ) : (
            <ul className="space-y-3">
              {tasks.map((t) => (
                <TaskCard key={t.id} task={t} showEmployee />
              ))}
            </ul>
          )
        }
      </QueryBoundary>
    </div>
  )
}
