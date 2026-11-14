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
  status: string
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
