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

export type TaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
export type TaskAction = 'start' | 'complete' | 'put_back' | 'reopen'
export type TaskOwnerKind = 'DEPARTMENT' | 'LINE_MANAGER'
export type DeadlineUnit = 'DAY' | 'WEEK'

export interface Progress {
  total: number
  completed: number
  in_progress: number
  not_started: number
  blocked: number
  overdue: number
}

export interface TaskEvent {
  from_status: TaskStatus | null
  to_status: TaskStatus
  actor: UserSummary
  note: string | null
  created_at: string
}

export interface OnboardingTask {
  id: number
  checklist_id: number
  employee: UserSummary
  title: string
  description: string
  owner_kind: TaskOwnerKind
  owner_department: Department | null
  assignee: UserSummary
  due_date: string
  status: TaskStatus
  effective_status: TaskStatus | 'BLOCKED'
  is_overdue: boolean
  depends_on: { id: number; title: string; status: TaskStatus } | null
  completed_at: string | null
  allowed_actions: TaskAction[]
}

export interface OnboardingTaskDetail extends OnboardingTask {
  history: TaskEvent[]
}

export interface ChecklistSummary {
  id: number
  employee: UserSummary
  template: { id: number; name: string }
  start_date: string
  progress: Progress
}

export interface ChecklistDetail extends ChecklistSummary {
  tasks: OnboardingTaskDetail[]
}

export interface ChecklistCreated extends ChecklistDetail {
  warnings: string[]
}

export interface ChecklistCreate {
  employee_id: number
  template_id: number
  start_date: string | null
}

export interface TaskUpdate {
  assignee_id?: number
  due_date?: string
}

export interface TemplateTask {
  id: number
  title: string
  description: string
  owner_kind: TaskOwnerKind
  owner_department: Department | null
  deadline_unit: DeadlineUnit
  deadline_value: number
  deadline_label: string
  depends_on_task_id: number | null
  sort_order: number
}

export interface Template {
  id: number
  name: string
  description: string
  is_active: boolean
  task_count: number
  updated_at: string
}

export interface TemplateDetail extends Template {
  tasks: TemplateTask[]
}

export interface TemplateTaskInput {
  title: string
  description: string
  owner_kind: TaskOwnerKind
  owner_department_id: number | null
  deadline_unit: DeadlineUnit
  deadline_value: number
  depends_on_task_id: number | null
}
