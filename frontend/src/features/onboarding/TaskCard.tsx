import { ChevronDown, CornerUpLeft } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { OnboardingTask, TaskEvent } from '../../api/types'
import { OverdueMark, StatusBadge } from '../../components/RequestBadges'
import { cn } from '../../lib/cn'
import { formatDateTime, formatDay, label } from '../../lib/format'
import { jumpTo } from './jumpTo'
import { TaskActionButtons } from './TaskActions'
import { useTaskAction } from './useTaskAction'

interface Props {
  task: OnboardingTask
  number?: number
  history?: TaskEvent[]
  // Task id to number for every task on the page, so a waited-for task can be jumped to.
  numbers?: Map<number, number>
  onJump?: (id: number) => void
  children?: ReactNode
}

export function TaskCard({ task, number, history, numbers, onJump = jumpTo, children }: Props) {
  const [open, setOpen] = useState(false)
  const act = useTaskAction(task)
  const blocked = task.effective_status === 'BLOCKED'
  const waitingFor = blocked ? task.depends_on : null
  const waitingNumber = waitingFor && numbers?.get(waitingFor.id)

  return (
    <li
      id={`task-${task.id}`}
      tabIndex={-1}
      className={cn(
        'border-b border-l-3 border-line border-l-transparent py-2.5 pl-3.5 pr-3 outline-none transition-colors duration-[1800ms]',
        (blocked || task.is_overdue) && 'border-l-danger bg-danger-wash',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`details-${task.id}`}
          onClick={() => setOpen(!open)}
          className="flex min-h-11 min-w-0 flex-1 basis-60 cursor-pointer items-center gap-3 text-left"
        >
          {number && <span className="w-7 shrink-0 font-serif text-lg tabular-nums text-muted">{String(number).padStart(2, '0')}</span>}
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold leading-snug">{task.title}</span>
            <span className="block text-[13px] text-muted">
              {task.owner_department?.name ?? 'Line manager'} · {task.assignee.full_name} ·{' '}
              <span className={cn('whitespace-nowrap tabular-nums', task.is_overdue && 'font-semibold text-danger')}>Due {formatDay(task.due_date)}</span>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-[13px] tabular-nums text-muted">
            {history && (
              <>
                {history.length}
                <span className="sr-only"> {history.length === 1 ? 'history entry' : 'history entries'}</span>
              </>
            )}
            <ChevronDown aria-hidden size={16} strokeWidth={1.8} className={cn('transition-transform', open && 'rotate-180')} />
          </span>
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {task.is_overdue && <OverdueMark />}
          <StatusBadge status={task.effective_status} />
          <TaskActionButtons task={task} act={act} />
          {children}
        </div>
      </div>

      {waitingFor &&
        (waitingNumber ? (
          <button
            type="button"
            onClick={() => onJump(waitingFor.id)}
            className="mt-1 inline-flex min-h-9 items-center gap-1.5 text-left text-[13px] text-danger hover:underline max-md:min-h-11"
          >
            <CornerUpLeft aria-hidden size={14} strokeWidth={1.8} className="shrink-0" />
            <span>
              Waiting for:{' '}
              <b className="font-semibold">
                {waitingNumber}. {waitingFor.title}
              </b>
            </span>
          </button>
        ) : (
          <p className="mt-1 text-[13px] text-danger">
            Waiting for: <b className="font-semibold">{waitingFor.title}</b>
          </p>
        ))}

      {act.isError && (
        <p role="alert" className="mt-1 text-[13px] font-medium text-danger">
          {act.error.message}
        </p>
      )}
      {open && (
        <div id={`details-${task.id}`} className="mt-2 animate-rise pb-2 pl-10 text-[13px] max-md:pl-0">
          <p className="text-muted">{task.description}</p>
          {history && history.length > 0 && (
            <ol aria-label="History" className="mt-3 space-y-2 border-l border-control pl-3.5">
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
      )}
    </li>
  )
}
