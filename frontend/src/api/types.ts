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

export type EmploymentStatus = User['status']

export interface UserWrite {
  full_name: string
  email: string
  password: string
  job_title: string
  role: Role
  country: string
  department_id: number
  manager_id: number | null
  status: EmploymentStatus
  joining_date: string
}

export type UserUpdate = Partial<Omit<UserWrite, 'email' | 'password' | 'full_name'>> & { is_active?: boolean }

export interface UserUpdated extends User {
  open_items: number
}

export interface Group {
  label: string
  count: number
}

export interface HeadcountReport {
  total: number
  by_country: Group[]
  by_department: Group[]
  by_status: Group[]
}

export interface RequestsReport {
  open_total: number
  unresolved_total: number
  awaiting_confirmation_total: number
  by_status: Group[]
  by_category: Group[]
  by_priority: Group[]
}

export interface OnboardingReport {
  active_new_hires: number
  completed_new_hires: number
  overdue_tasks: number
  blocked_tasks: number
}

export interface OpenRequestRow {
  reference: string
  title: string | null
  category: string
  status: RequestStatus
  priority: RequestPriority
}

export interface InsightsReport {
  new_hires_with_open_requests: { new_hire: string; country: string; open_requests: OpenRequestRow[] }[]
  onboarding_completion_by_country: { country: string; total_tasks: number; completed_tasks: number; rate: number }[]
  work_held_by_inactive_users: { requests: number; onboarding_tasks: number }
}

export interface ToolUse {
  name: string
  arguments: Record<string, unknown>
  row_count: number
  rows: Record<string, unknown>[]
}

export interface AiAnswer {
  answer: string
  tools_used: ToolUse[]
}
