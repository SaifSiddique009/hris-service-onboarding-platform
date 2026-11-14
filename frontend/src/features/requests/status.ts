import type { ClosureReason, RequestStatus } from '../../api/types'
import { label } from '../../lib/format'

// "Closed · Rejected"; undefined keeps the badge's own label.
export const statusText = (r: { status: RequestStatus; closure_reason: ClosureReason | null }) =>
  r.status === 'CLOSED' && r.closure_reason ? `Closed · ${label(r.closure_reason)}` : undefined
