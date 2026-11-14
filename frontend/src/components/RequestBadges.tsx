import { Clock } from 'lucide-react'
import { cn } from '../lib/cn'
import { label } from '../lib/format'
import { Badge } from './Badge'

const ring = 'rounded-full border-[1.5px] border-current'
const dot = 'rounded-full bg-current'

// Every status has a colour, a shape and a word, so it never depends on colour alone.
const statuses: Record<string, { tone: string; shape: string }> = {
  SUBMITTED: { tone: 'bg-blue-soft text-blue', shape: ring },
  ASSIGNED: { tone: 'bg-plum-soft text-plum', shape: `${ring} bg-[radial-gradient(currentColor_38%,transparent_42%)]` },
  IN_PROGRESS: { tone: 'bg-amber-soft text-amber', shape: `${ring} bg-[linear-gradient(90deg,currentColor_50%,transparent_50%)]` },
  RESOLVED: { tone: 'bg-accent-soft text-accent', shape: dot },
  COMPLETED: { tone: 'bg-accent-soft text-accent', shape: dot },
  ACTIVE: { tone: 'bg-accent-soft text-accent', shape: dot },
  CLOSED: { tone: 'bg-grey-soft text-grey', shape: 'bg-current' },
  NOT_STARTED: { tone: 'bg-grey-soft text-grey', shape: ring },
  INACTIVE: { tone: 'bg-grey-soft text-grey', shape: ring },
  BLOCKED: { tone: 'bg-danger-soft text-danger', shape: 'size-[7px] rotate-45 bg-current' },
}

export function StatusBadge({ status, children }: { status: string; children?: string }) {
  const { tone, shape } = statuses[status] ?? statuses.NOT_STARTED
  return (
    <Badge tone={tone}>
      <span aria-hidden className={cn('size-2 shrink-0', shape)} />
      {children ?? label(status)}
    </Badge>
  )
}

const filled = { LOW: 1, MEDIUM: 2, HIGH: 3, URGENT: 3 }
const heights = ['h-[5px]', 'h-2', 'h-[11px]']

export function PriorityBadge({ priority }: { priority: keyof typeof filled }) {
  const urgent = priority === 'URGENT'
  const colour = urgent ? 'bg-danger' : priority === 'HIGH' ? 'bg-amber' : 'bg-ink'
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]', urgent && 'font-bold text-danger')}>
      <span aria-hidden className="flex items-end gap-0.5">
        {heights.map((height, bar) => (
          <span key={height} className={cn('w-[3px] rounded-[1px]', height, bar < filled[priority] ? colour : 'bg-n-300')} />
        ))}
      </span>
      {label(priority)}
    </span>
  )
}

export const OverdueMark = () => (
  <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12.5px] font-bold text-danger">
    <Clock aria-hidden size={14} strokeWidth={1.8} />
    Overdue
  </span>
)
