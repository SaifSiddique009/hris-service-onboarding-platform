import type { RequestPriority, RequestStatus } from '../api/types'
import { label } from '../lib/format'
import { Badge } from './Badge'

const statusTone: Record<RequestStatus, string> = {
  SUBMITTED: 'bg-slate-100 text-slate-700',
  ASSIGNED: 'bg-blue-50 text-blue-700',
  IN_PROGRESS: 'bg-amber-50 text-amber-800',
  RESOLVED: 'bg-green-50 text-green-700',
  CLOSED: 'bg-slate-200 text-slate-800',
}

const priorityTone: Record<RequestPriority, string> = {
  LOW: 'bg-slate-100 text-slate-700',
  MEDIUM: 'bg-blue-50 text-blue-700',
  HIGH: 'bg-amber-50 text-amber-800',
  URGENT: 'bg-red-50 text-red-700',
}

export const StatusBadge = ({ status }: { status: RequestStatus }) => (
  <Badge tone={statusTone[status]}>{label(status)}</Badge>
)

export const PriorityBadge = ({ priority }: { priority: RequestPriority }) => (
  <Badge tone={priorityTone[priority]}>{label(priority)}</Badge>
)
