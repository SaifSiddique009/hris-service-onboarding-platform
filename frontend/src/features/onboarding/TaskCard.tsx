import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { api } from '../../api/client'
import type { OnboardingTask, TaskAction } from '../../api/types'
import { Badge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { formatDay, label } from '../../lib/format'

const actionText: Record<TaskAction, string> = { start: 'Start', complete: 'Complete', put_back: 'Put back', reopen: 'Reopen' }

const statusTone = {
  NOT_STARTED: 'bg-slate-100 text-slate-700',
  IN_PROGRESS: 'bg-amber-50 text-amber-800',
  COMPLETED: 'bg-green-50 text-green-700',
  BLOCKED: 'bg-red-50 text-red-700',
}

interface Props {
  task: OnboardingTask
  showEmployee?: boolean
  children?: ReactNode
}

export function TaskCard({ task, showEmployee, children }: Props) {
  const queryClient = useQueryClient()
  const act = useMutation({
    mutationFn: (action: TaskAction) =>
      api(`/onboarding/tasks/${task.id}/transitions`, { method: 'POST', body: JSON.stringify({ action }) }),
    // Refetch on failure too: the task may have changed since it was loaded.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['onboarding'] }),
  })
  const { employee } = task

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {showEmployee && (
            <p className="text-xs font-medium text-indigo-700">
              {employee.full_name} · {employee.department.name} · {employee.country.name}
            </p>
          )}
          <h3 className="font-medium">{task.title}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={statusTone[task.effective_status]}>{label(task.effective_status)}</Badge>
          {task.is_overdue && <Badge tone="bg-red-600 text-white">Overdue</Badge>}
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-600">{task.description}</p>
      {task.effective_status === 'BLOCKED' && task.depends_on && (
        <p className="mt-2 text-sm font-medium text-red-700">Waiting for: {task.depends_on.title}</p>
      )}
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
        <div>
          Owner: <span className="text-slate-700">{task.owner_department?.name ?? 'Line manager'}</span>
        </div>
        <div>
          Assignee: <span className="text-slate-700">{task.assignee.full_name}</span>
        </div>
        <div>
          Due: <span className={task.is_overdue ? 'font-medium text-red-700' : 'text-slate-700'}>{formatDay(task.due_date)}</span>
        </div>
      </dl>
      {act.isError && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {act.error.message}
        </p>
      )}
      {task.allowed_actions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {task.allowed_actions.map((a) => (
            <Button
              key={a}
              variant={a === 'complete' ? 'primary' : 'secondary'}
              loading={act.isPending && act.variables === a}
              disabled={act.isPending}
              onClick={() => act.mutate(a)}
            >
              {actionText[a]}
            </Button>
          ))}
        </div>
      )}
      {children}
    </li>
  )
}
