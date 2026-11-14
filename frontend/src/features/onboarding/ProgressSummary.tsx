import { Clock } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Progress } from '../../api/types'
import { cn } from '../../lib/cn'

function Counter({ text, value, icon, alert }: { text: string; value: number; icon?: ReactNode; alert?: boolean }) {
  const hot = alert && value > 0
  return (
    <div
      className={cn(
        'inline-flex items-baseline gap-1.5 rounded-sm px-2.5 py-0.5 text-[13px]',
        hot ? 'bg-danger-soft font-semibold text-danger' : alert && 'text-muted',
      )}
    >
      {hot && <span className="self-center">{icon}</span>}
      <b className="text-[15px] font-bold tabular-nums">{value}</b>
      {text}
    </div>
  )
}

export function ProgressSummary({ progress: p }: { progress: Progress }) {
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
      <div className="-ml-2.5 mt-3 flex flex-wrap gap-x-3 gap-y-1">
        <Counter text="Done" value={p.completed} />
        <Counter text="Pending" value={p.in_progress + p.not_started} />
        <Counter text="Overdue" value={p.overdue} alert icon={<Clock aria-hidden size={14} strokeWidth={1.8} />} />
        <Counter
          text="Blocked"
          value={p.blocked}
          alert
          icon={<span aria-hidden className="block size-[7px] rotate-45 bg-current" />}
        />
      </div>
    </div>
  )
}
