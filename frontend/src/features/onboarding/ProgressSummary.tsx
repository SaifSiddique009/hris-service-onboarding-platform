import { Clock } from 'lucide-react'
import type { Progress } from '../../api/types'
import { cn } from '../../lib/cn'

export type TaskFilter = 'blocked' | 'overdue'

const pill = 'inline-flex min-h-8 items-center gap-1.5 rounded-sm px-2.5 py-0.5 text-[13px]'
const pressedPill = 'aria-pressed:ring-2 aria-pressed:ring-danger aria-pressed:ring-offset-1'

function Counter({ text, value, blocked, onClick, pressed }: { text: string; value: number; blocked?: boolean; onClick?: () => void; pressed?: boolean }) {
  const hot = blocked && value > 0
  const body = (
    <>
      {hot && <span aria-hidden className="size-[7px] shrink-0 rotate-45 self-center bg-current" />}
      <b className="text-[15px] font-bold tabular-nums">{value}</b>
      {text}
    </>
  )
  const tone = cn(pill, 'items-baseline', hot && 'bg-danger-soft font-semibold text-danger')
  if (!onClick || value === 0) return <div className={tone}>{body}</div>
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick} className={cn(tone, pressedPill, 'cursor-pointer hover:bg-danger-soft')}>
      {body}
    </button>
  )
}

export function ProgressSummary({ progress: p, filter, onFilter }: { progress: Progress; filter?: TaskFilter; onFilter?: (f: TaskFilter | undefined) => void }) {
  const toggle = (f: TaskFilter) => onFilter && (() => onFilter(filter === f ? undefined : f))
  const percent = p.total ? Math.round((p.completed / p.total) * 100) : 0
  return (
    <div>
      <div className="flex items-baseline gap-3">
        <span className="font-serif text-[40px] leading-none tabular-nums">{percent}%</span>
        <span className="text-[13px] text-muted">
          {p.completed} of {p.total} done
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Tasks completed"
        aria-valuemin={0}
        aria-valuemax={p.total}
        aria-valuenow={p.completed}
        className="mt-3 h-1.5 rounded-xs bg-line"
      >
        <div
          className="h-full rounded-xs bg-accent transition-[width] duration-500 ease-out-soft"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="-ml-2.5 mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Counter text="Completed" value={p.completed} />
        <Counter text="In Progress" value={p.in_progress} />
        <Counter text="Not Started" value={p.not_started} />
        <Counter text="Blocked" value={p.blocked} blocked onClick={toggle('blocked')} pressed={filter === 'blocked'} />
        {p.overdue > 0 && (
          <>
            <span aria-hidden className="mx-1 h-4 w-px bg-control" />
            <OverduePill count={p.overdue} onClick={toggle('overdue')} pressed={filter === 'overdue'} />
          </>
        )}
      </div>
    </div>
  )
}

function OverduePill({ count, onClick, pressed }: { count: number; onClick?: () => void; pressed: boolean }) {
  const body = (
    <>
      <Clock aria-hidden size={14} strokeWidth={1.8} />
      {count} overdue
    </>
  )
  const tone = cn(pill, 'bg-danger-soft font-semibold text-danger')
  if (!onClick) return <span className={tone}>{body}</span>
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick} className={cn(tone, pressedPill, 'cursor-pointer hover:bg-danger-soft/70')}>
      {body}
    </button>
  )
}
