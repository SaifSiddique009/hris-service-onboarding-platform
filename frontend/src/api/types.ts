export type Role = 'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN'

export interface Country {
  code: string
  name: string
}

export interface UserSummary {
  id: number
  full_name: string
  job_title: string
  department: { id: number; name: string }
  country: Country
  role: Role
}

export interface User extends UserSummary {
  email: string
  status: 'ACTIVE' | 'ON_PROBATION' | 'ON_NOTICE'
  joining_date: string
  manager: UserSummary | null
  is_active: boolean
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export type RequestStatus = 'SUBMITTED' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
export type RequestPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type ClosureReason = 'COMPLETED' | 'REJECTED' | 'WITHDRAWN'
export type RequestAction =
  | 'assign'
  | 'reassign'
  | 'withdraw'
  | 'reject'
  | 'start'
  | 'resolve'
  | 'reopen'
  | 'close'
  | 'comment'

export interface Department {
  id: number
  name: string
}

export interface RequestCategory {
  id: number
  name: string
  description: string
  owning_department: Department | null
  is_confidential: boolean
}

export interface RequestSummary {
  id: number
  reference: string
  title: string
  category: { id: number; name: string }
  priority: RequestPriority
  status: RequestStatus
  closure_reason: ClosureReason | null
  requester: UserSummary
  assignee: UserSummary | null
  created_at: string
  updated_at: string
}

export interface StatusEvent {
  from_status: RequestStatus | null
  to_status: RequestStatus
  actor: UserSummary
  note: string | null
  created_at: string
}

export interface RequestAssignment {
  assignee: UserSummary
  assigned_by: UserSummary
  note: string | null
  created_at: string
}

export interface RequestComment {
  id: number
  author: UserSummary
  body: string
  created_at: string
}

export interface RequestDetail extends RequestSummary {
  description: string
  resolved_at: string | null
  closed_at: string | null
  history: StatusEvent[]
  assignments: RequestAssignment[]
  comments: RequestComment[]
  allowed_actions: RequestAction[]
}

export interface RequestCreate {
  title: string
  description: string
  category_id: number
  priority: RequestPriority
}
