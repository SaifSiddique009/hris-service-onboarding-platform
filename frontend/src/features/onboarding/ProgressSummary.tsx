import type { Progress } from '../../api/types'

function Counter({ text, value, alert }: { text: string; value: number; alert?: boolean }) {
  const tone = alert && value > 0 ? 'bg-red-50 text-red-700 ring-1 ring-red-200' : 'bg-slate-50 text-slate-600'
  return (
    <div className={`rounded-md px-3 py-1.5 text-center ${tone}`}>
      <p className="text-lg font-semibold leading-tight">{value}</p>
      <p className="text-xs">{text}</p>
    </div>
  )
}

export function ProgressSummary({ progress: p }: { progress: Progress }) {
  const percent = p.total ? Math.round((p.completed / p.total) * 100) : 0
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-slate-500">
        <span>
          {p.completed} of {p.total} tasks completed
        </span>
        <span>{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={p.total}
        aria-valuenow={p.completed}
        className="h-2 overflow-hidden rounded-full bg-slate-200"
      >
        <div className="h-full bg-indigo-600" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        <Counter text="Done" value={p.completed} />
        <Counter text="Pending" value={p.in_progress + p.not_started} />
        <Counter text="Overdue" value={p.overdue} alert />
        <Counter text="Blocked" value={p.blocked} alert />
      </div>
    </div>
  )
}
