import { ApiError } from '../api/client'
import type { EmploymentStatus, RequestPriority, RequestStatus, Role } from '../api/types'

export const label = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')

export const roleLabel = (role: Role) => (role === 'HR_ADMIN' ? 'HR Admin' : label(role))

// plural(1, 'request') -> "1 request"; plural(3, 'person', 'people') -> "3 people".
export const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`

// Three-letter months everywhere; the browser's own short form mixes "Sept" with "Aug".
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const day = (date: Date) => `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })

export const formatDate = (iso: string) => day(new Date(iso))
// Built from parts so a plain date never shifts across time zones.
export const formatDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return day(new Date(y, m - 1, d))
}
export const formatDateTime = (iso: string) => `${day(new Date(iso))}, ${time.format(new Date(iso))}`

export function timeAgo(iso: string) {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000
  const ago = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'} ago`
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return ago(Math.floor(seconds / 60), 'minute')
  if (seconds < 86400) return ago(Math.floor(seconds / 3600), 'hour')
  const days = Math.floor(seconds / 86400)
  if (days === 1) return 'yesterday'
  return days <= 7 ? ago(days, 'day') : formatDate(iso)
}

export const errorText = (err: Error) => {
  const fields = err instanceof ApiError ? Object.values(err.fields ?? {}) : []
  return fields.length ? fields.join('. ') : err.message
}

export const statuses: RequestStatus[] = ['SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']
export const priorities: RequestPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
export const roles: Role[] = ['EMPLOYEE', 'MANAGER', 'HR_ADMIN']
export const employmentStatuses: EmploymentStatus[] = ['ACTIVE', 'ON_PROBATION', 'ON_NOTICE']
