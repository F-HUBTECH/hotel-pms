/**
 * Unit tests for RBAC (Role-Based Access Control)
 */
import { describe, it, expect } from 'vitest'
import { canWrite, canManage, hasMinRole, ROLES } from '../auth/roles'
import type { UserRole } from '../types/database'

describe('canWrite', () => {
    it('allows super_admin to write', () => {
        expect(canWrite('super_admin')).toBe(true)
    })

    it('allows admin to write', () => {
        expect(canWrite('admin')).toBe(true)
    })

    it('denies manager from writing', () => {
        expect(canWrite('manager')).toBe(false)
    })

    it('denies staff from writing', () => {
        expect(canWrite('staff')).toBe(false)
    })
})

describe('canManage', () => {
    it('allows super_admin to manage', () => {
        expect(canManage('super_admin')).toBe(true)
    })

    it('allows admin to manage', () => {
        expect(canManage('admin')).toBe(true)
    })

    it('allows manager to manage', () => {
        expect(canManage('manager')).toBe(true)
    })

    it('denies staff from managing', () => {
        expect(canManage('staff')).toBe(false)
    })
})

describe('hasMinRole', () => {
    it('returns true when user role is higher than minimum', () => {
        expect(hasMinRole('admin', 'staff')).toBe(true)
        expect(hasMinRole('super_admin', 'manager')).toBe(true)
        expect(hasMinRole('manager', 'staff')).toBe(true)
    })

    it('returns false when user role is lower than minimum', () => {
        expect(hasMinRole('staff', 'admin')).toBe(false)
        expect(hasMinRole('manager', 'super_admin')).toBe(false)
        expect(hasMinRole('staff', 'manager')).toBe(false)
    })

    it('returns true for equal roles', () => {
        expect(hasMinRole('admin', 'admin')).toBe(true)
        expect(hasMinRole('manager', 'manager')).toBe(true)
        expect(hasMinRole('staff', 'staff')).toBe(true)
        expect(hasMinRole('super_admin', 'super_admin')).toBe(true)
    })

    it('maintains correct role hierarchy', () => {
        const roles: UserRole[] = ['staff', 'manager', 'admin', 'super_admin']
        for (let i = 0; i < roles.length; i++) {
            for (let j = 0; j < roles.length; j++) {
                if (i >= j) {
                    expect(hasMinRole(roles[i], roles[j])).toBe(true)
                } else {
                    expect(hasMinRole(roles[i], roles[j])).toBe(false)
                }
            }
        }
    })
})

describe('ROLES config integrity', () => {
    it('has all 4 roles defined', () => {
        const roleKeys = Object.keys(ROLES)
        expect(roleKeys).toHaveLength(4)
        expect(roleKeys).toContain('super_admin')
        expect(roleKeys).toContain('admin')
        expect(roleKeys).toContain('manager')
        expect(roleKeys).toContain('staff')
    })

    it('has correct level hierarchy', () => {
        expect(ROLES.super_admin.level).toBeGreaterThan(ROLES.admin.level)
        expect(ROLES.admin.level).toBeGreaterThan(ROLES.manager.level)
        expect(ROLES.manager.level).toBeGreaterThan(ROLES.staff.level)
    })

    it('each role has a label and level', () => {
        for (const [key, config] of Object.entries(ROLES)) {
            expect(config.label).toBeTruthy()
            expect(typeof config.label).toBe('string')
            expect(typeof config.level).toBe('number')
            expect(config.level).toBeGreaterThanOrEqual(1)
            expect(config.level).toBeLessThanOrEqual(4)
        }
    })
})
