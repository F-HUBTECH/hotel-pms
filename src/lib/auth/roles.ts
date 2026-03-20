import type { UserRole } from '@/lib/types/database'

export const ROLES: Record<UserRole, { label: string; level: number }> = {
    super_admin: { label: 'Super Admin', level: 4 },
    admin: { label: 'Admin', level: 3 },
    manager: { label: 'Manager', level: 2 },
    staff: { label: 'Staff', level: 1 },
}

export function canWrite(role: UserRole): boolean {
    return role === 'super_admin' || role === 'admin'
}

export function canManage(role: UserRole): boolean {
    return role === 'super_admin' || role === 'admin' || role === 'manager'
}

export function hasMinRole(userRole: UserRole, minRole: UserRole): boolean {
    return ROLES[userRole].level >= ROLES[minRole].level
}
