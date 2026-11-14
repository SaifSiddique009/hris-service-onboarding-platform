import type { Role } from '../../api/types'

export const homePath = (role: Role) => (role === 'HR_ADMIN' ? '/dashboard' : '/requests')
