'use client'

import type { UserRole } from '@/lib/types/database'
import { hasMinRole } from '@/lib/auth/roles'

interface RoleGuardProps {
    children: React.ReactNode
    userRole: UserRole
    minRole: UserRole
    fallback?: React.ReactNode
}

export function RoleGuard({ children, userRole, minRole, fallback }: RoleGuardProps) {
    if (!hasMinRole(userRole, minRole)) {
        return fallback ? <>{fallback}</> : null
    }
    return <>{children}</>
}
