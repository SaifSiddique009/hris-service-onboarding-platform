import { CornerUpLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { OnboardingTask } from '../../api/types'
import { OverdueMark, StatusBadge } from '../../components/RequestBadges'
import { cn } from '../../lib/cn'
import { formatDay } from '../../lib/format'
import { TaskActionButtons } from './TaskActions'
import { useTaskAction } from './useTaskAction'

export function TaskRow({ task, canOpen }: { task: OnboardingTask; canOpen: boolean }) {
  const act = useTaskAction(task)
  const name = task.employee.full_name
  const blocked = task.effective_status === 'BLOCKED'
  return (
    <li className={cn('border-b border-l-3 border-line border-l-transparent py-4 pl-3.5 pr-3', (blocked || task.is_overdue) && 'border-l-danger bg-danger-wash')}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-60">
          <h3 className="text-[15.5px] font-semibold">{task.title}</h3>
          <p className="mt-0.5 text-[13.5px] text-muted">
            For {canOpen ? <Link to={`/onboarding/checklists/${task.checklist_id}`}>{name}</Link> : name} ·{' '}
            <span className={cn('whitespace-nowrap tabular-nums', task.is_overdue && 'font-semibold text-danger')}>Due {formatDay(task.due_date)}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {task.is_overdue && <OverdueMark />}
          <StatusBadge status={task.effective_status} />
          <TaskActionButtons task={task} act={act} />
        </div>
      </div>
      {blocked && task.depends_on && (
        <p className="mt-2 flex items-center gap-2 text-[13.5px] text-danger">
          <CornerUpLeft aria-hidden size={16} strokeWidth={1.8} className="shrink-0" />
          <span>
            Waiting for: <b className="font-semibold">{task.depends_on.title}</b>
          </span>
        </p>
      )}
      {act.isError && (
        <p role="alert" className="mt-2 text-[13px] font-medium text-danger">
          {act.error.message}
        </p>
      )}
    </li>
  )
}
