import { ApiError } from '../api/client'
import type { RequestPriority, RequestStatus, Role } from '../api/types'

export const label = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')

export const roleLabel = (role: Role) => (role === 'HR_ADMIN' ? 'HR Admin' : label(role))

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' })

export const formatDate = (iso: string) => dateFmt.format(new Date(iso))
// Built from parts so a plain date never shifts across time zones.
export const formatDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return dateFmt.format(new Date(y, m - 1, d))
}
export const formatDateTime = (iso: string) => dateTimeFmt.format(new Date(iso))

export const errorText = (err: Error) => {
  const fields = err instanceof ApiError ? Object.values(err.fields ?? {}) : []
  return fields.length ? fields.join('. ') : err.message
}

export const statuses: RequestStatus[] = ['SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']
export const priorities: RequestPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
