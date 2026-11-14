import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, CornerUpLeft } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { api } from '../../api/client'
import type { OnboardingTask, TaskAction, TaskEvent } from '../../api/types'
import { Button } from '../../components/Button'
import { eyebrowClass } from '../../components/PageHeader'
import { OverdueMark, StatusBadge } from '../../components/RequestBadges'
import { cn } from '../../lib/cn'
import { formatDateTime, formatDay, label } from '../../lib/format'

const actionText: Record<TaskAction, string> = { start: 'Start', complete: 'Complete', put_back: 'Put back', reopen: 'Reopen' }

interface Props {
  task: OnboardingTask
  number?: number
  showEmployee?: boolean
  history?: TaskEvent[]
  // Task id to number for every task on the page, so a waited-for task can be jumped to.
  numbers?: Map<number, number>
  children?: ReactNode
}

function jumpTo(id: number) {
  const el = document.getElementById(`task-${id}`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.style.backgroundColor = '#fbf3d9'
  setTimeout(() => (el.style.backgroundColor = ''), 1200)
}

export function TaskCard({ task, number, showEmployee, history, numbers, children }: Props) {
  const queryClient = useQueryClient()
  const [showHistory, setShowHistory] = useState(false)
  const act = useMutation({
    mutationFn: (action: TaskAction) =>
      api(`/onboarding/tasks/${task.id}/transitions`, { method: 'POST', body: JSON.stringify({ action }) }),
    // Refetch on failure too: the task may have changed since it was loaded.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['onboarding'] }),
  })
  const { employee } = task
  const blocked = task.effective_status === 'BLOCKED'
  const attention = blocked || task.is_overdue
  const waitingFor = blocked ? task.depends_on : null
  const waitingNumber = waitingFor && numbers?.get(waitingFor.id)

  return (
    <li
      id={`task-${task.id}`}
      className={cn(
        'grid gap-4 border-b border-l-3 border-line border-l-transparent py-6 pl-3.5 pr-5 transition-colors duration-[1800ms] max-md:gap-2.5 max-md:pr-3',
        number ? 'grid-cols-[44px_1fr] max-md:grid-cols-[28px_1fr]' : 'grid-cols-1',
        attention && 'border-l-danger bg-danger-wash',
      )}
    >
      {number && <span className="font-serif text-xl tabular-nums text-muted">{String(number).padStart(2, '0')}</span>}
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            {showEmployee && (
              <p className={eyebrowClass}>
                {employee.full_name} · {employee.department.name} · {employee.country.name}
              </p>
            )}
            <h3 className={cn('text-[15.5px] font-semibold', task.effective_status === 'COMPLETED' && 'text-muted')}>
              {task.title}
            </h3>
            <p className="mt-1 text-[13.5px] text-muted">{task.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {task.is_overdue && <OverdueMark />}
            <StatusBadge status={task.effective_status} />
          </div>
        </div>

        {waitingFor &&
          (waitingNumber ? (
            <button
              type="button"
              onClick={() => jumpTo(waitingFor.id)}
              className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-sm border border-dashed border-danger bg-paper px-3 text-left text-[13.5px] text-danger hover:bg-danger-soft max-md:min-h-11"
            >
              <CornerUpLeft aria-hidden size={16} strokeWidth={1.8} className="shrink-0" />
              <span>
                Waiting for:{' '}
                <b className="font-semibold">
                  {waitingNumber}. {waitingFor.title}
                </b>
              </span>
            </button>
          ) : (
            <p className="mt-3 text-[13.5px] text-danger">
              Waiting for: <b className="font-semibold">{waitingFor.title}</b>
            </p>
          ))}

        <dl className="mt-3 flex flex-wrap gap-x-7 gap-y-1.5 text-[13px]">
          <div className="flex gap-1.5">
            <dt className="text-muted">Owner</dt>
            <dd>{task.owner_department?.name ?? 'Line manager'}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-muted">Assignee</dt>
            <dd>{task.assignee.full_name}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-muted">Due</dt>
            <dd className={cn('tabular-nums', task.is_overdue && 'font-semibold text-danger')}>{formatDay(task.due_date)}</dd>
          </div>
        </dl>

        {act.isError && (
          <p role="alert" className="mt-2 text-[13px] font-medium text-danger">
            {act.error.message}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {task.allowed_actions.map((a) => (
            <Button
              key={a}
              size="sm"
              variant={a === 'complete' || a === 'start' ? 'primary' : 'secondary'}
              loading={act.isPending && act.variables === a}
              disabled={act.isPending}
              onClick={() => act.mutate(a)}
            >
              {actionText[a]}
            </Button>
          ))}
          {history && (
            <Button
              size="sm"
              variant="ghost"
              aria-expanded={showHistory}
              aria-controls={`history-${task.id}`}
              onClick={() => setShowHistory(!showHistory)}
            >
              History ({history.length})
              <ChevronDown
                aria-hidden
                size={16}
                strokeWidth={1.8}
                className={cn('transition-transform', showHistory && 'rotate-180')}
              />
            </Button>
          )}
          {children}
        </div>
        {history && showHistory && (
          <ol id={`history-${task.id}`} className="mt-3 animate-rise space-y-2 border-l border-control pl-3.5 text-[13px]">
            {history.map((e, i) => (
              <li key={i}>
                {e.note ?? (e.from_status ? `${label(e.from_status)} to ${label(e.to_status)}` : 'Created')}
                <span className="block text-muted">
                  {e.actor.full_name} · {formatDateTime(e.created_at)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </li>
  )
}
