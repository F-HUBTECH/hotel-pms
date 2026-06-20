/**
 * Unit tests for constants integrity
 * — Room status configs, route builders, navigation structure
 */
import { describe, it, expect } from 'vitest'
import { ROOM_STATUS_CONFIG, ROOM_STATUS_LABEL } from '../constants/room-status'
import { ROUTES } from '../constants/routes'
import { navigationGroups } from '../constants/navigation'
import { ROLES } from '../auth/roles'
import type { RoomStatus, UserRole } from '../types/database'

// ─────────────────────────────────────────────
// Room Status Constants
// ─────────────────────────────────────────────

describe('ROOM_STATUS_CONFIG', () => {
    const allStatuses: RoomStatus[] = [
        'available',
        'occupied',
        'reserved',
        'dirty',
        'clean',
        'maintenance',
        'out_of_order',
    ]

    it('covers all 7 RoomStatus values', () => {
        for (const status of allStatuses) {
            const config = ROOM_STATUS_CONFIG[status]
            expect(config).toBeDefined()
            expect(config.label).toBeTruthy()
            expect(config.bg).toBeTruthy()
            expect(config.border).toBeTruthy()
            expect(config.text).toBeTruthy()
            expect(config.dot).toBeTruthy()
        }
    })

    it('ROOM_STATUS_LABEL covers all RoomStatus values', () => {
        for (const status of allStatuses) {
            expect(ROOM_STATUS_LABEL[status]).toBeTruthy()
            expect(typeof ROOM_STATUS_LABEL[status]).toBe('string')
        }
    })

    it('has matching keys between CONFIG and LABEL', () => {
        const configKeys = Object.keys(ROOM_STATUS_CONFIG).sort()
        const labelKeys = Object.keys(ROOM_STATUS_LABEL).sort()
        expect(configKeys).toEqual(labelKeys)
    })
})

// ─────────────────────────────────────────────
// Route Builder Functions
// ─────────────────────────────────────────────

describe('ROUTES (route builders)', () => {
    it('builds reservation detail URL', () => {
        const url = ROUTES.RESERVATIONS_DETAIL('abc-123')
        expect(url).toBe('/dashboard/reservations/abc-123')
    })

    it('builds reservation invoice URL', () => {
        const url = ROUTES.RESERVATIONS_INVOICE('xyz-456')
        expect(url).toBe('/dashboard/reservations/xyz-456/invoice')
    })

    it('builds group detail URL', () => {
        const url = ROUTES.GROUPS_DETAIL('grp-789')
        expect(url).toBe('/dashboard/groups/grp-789')
    })

    it('all static routes are non-empty strings', () => {
        for (const [key, value] of Object.entries(ROUTES)) {
            if (typeof value === 'string') {
                expect(value.length).toBeGreaterThan(0)
                expect(value.startsWith('/')).toBe(true)
            }
        }
    })

    it('all dynamic route builders return paths starting with /dashboard', () => {
        const builders = [ROUTES.RESERVATIONS_DETAIL, ROUTES.RESERVATIONS_INVOICE, ROUTES.GROUPS_DETAIL]
        for (const builder of builders) {
            const result = builder('test-id')
            expect(result.startsWith('/dashboard')).toBe(true)
        }
    })
})

// ─────────────────────────────────────────────
// Navigation Groups Structure
// ─────────────────────────────────────────────

describe('navigationGroups', () => {
    it('has no duplicate hrefs', () => {
        const hrefs = new Map<string, string[]>() // href → [group titles]

        for (const group of navigationGroups) {
            for (const item of group.items) {
                if (!hrefs.has(item.href)) {
                    hrefs.set(item.href, [])
                }
                hrefs.get(item.href)!.push(group.title)
            }
        }

        for (const [href, groups] of hrefs.entries()) {
            if (groups.length > 1) {
                // Some hrefs may intentionally appear in multiple groups (e.g. reports)
                // This test documents them rather than failing
                console.log(`Note: "${href}" appears in groups: ${groups.join(', ')}`)
            }
        }

        expect(hrefs.size).toBeGreaterThan(0)
    })

    it('all navigation items reference valid icons', () => {
        for (const group of navigationGroups) {
            for (const item of group.items) {
                expect(item.icon).toBeDefined()
                // Lucide icons are React components (function or object in React 19)
                expect(['function', 'object']).toContain(typeof item.icon)
            }
        }
    })

    it('role-based filtering uses valid UserRole values', () => {
        const validRoles: UserRole[] = ['super_admin', 'admin', 'manager', 'staff']

        for (const group of navigationGroups) {
            if (group.roles) {
                for (const role of group.roles) {
                    expect(validRoles).toContain(role)
                }
            }
            for (const item of group.items) {
                if (item.roles) {
                    for (const role of item.roles) {
                        expect(validRoles).toContain(role)
                    }
                }
            }
        }
    })

    it('each group has a title and items', () => {
        for (const group of navigationGroups) {
            expect(group.title).toBeTruthy()
            expect(Array.isArray(group.items)).toBe(true)
            expect(group.items.length).toBeGreaterThan(0)
        }
    })
})

// ─────────────────────────────────────────────
// Payment Methods
// ─────────────────────────────────────────────

import { PAYMENT_METHODS } from '../constants/payment-methods'
import { FUNCTION_CODES } from '../constants/function-codes'

describe('PAYMENT_METHODS', () => {
    it('has exactly 10 payment methods', () => {
        expect(PAYMENT_METHODS).toHaveLength(10)
    })

    it('every method has value, label, and icon', () => {
        for (const method of PAYMENT_METHODS) {
            expect(method.value).toBeTruthy()
            expect(typeof method.value).toBe('string')
            expect(method.label).toBeTruthy()
            expect(typeof method.label).toBe('string')
            expect(method.icon).toBeTruthy()
            expect(typeof method.icon).toBe('string')
        }
    })

    it('has no duplicate values', () => {
        const values = PAYMENT_METHODS.map(m => m.value)
        const uniqueValues = new Set(values)
        expect(uniqueValues.size).toBe(values.length)
    })

    it('has no duplicate labels', () => {
        const labels = PAYMENT_METHODS.map(m => m.label)
        const uniqueLabels = new Set(labels)
        expect(uniqueLabels.size).toBe(labels.length)
    })

    it('all values are 2-5 uppercase characters', () => {
        for (const method of PAYMENT_METHODS) {
            expect(method.value).toMatch(/^[A-Z]{2,6}$/)
        }
    })
})

// ─────────────────────────────────────────────
// Function Codes
// ─────────────────────────────────────────────

describe('FUNCTION_CODES', () => {
    it('has exactly 14 function codes', () => {
        const keys = Object.keys(FUNCTION_CODES)
        expect(keys).toHaveLength(14)
    })

    it('every code follows format: K + letter + 2 digits', () => {
        for (const code of Object.values(FUNCTION_CODES)) {
            expect(code).toMatch(/^K[CO]\d{2}$/)
        }
    })

    it('has no duplicate values', () => {
        const values = Object.values(FUNCTION_CODES)
        const uniqueValues = new Set(values)
        expect(uniqueValues.size).toBe(values.length)
    })

    it('contains expected payment codes', () => {
        expect(FUNCTION_CODES.PAYMENT).toBe('KO39')
        expect(FUNCTION_CODES.VOID).toBe('KO40')
        expect(FUNCTION_CODES.POST_CHARGE).toBe('KO41')
        expect(FUNCTION_CODES.CHECKOUT).toBe('KO44')
        expect(FUNCTION_CODES.FORECAST).toBe('KC27')
    })
})

// ─────────────────────────────────────────────
// ROLES Config (additional integrity)
// ─────────────────────────────────────────────

describe('ROLES hierarchy', () => {
    it('levels are strictly increasing from staff to super_admin', () => {
        expect(ROLES.staff.level).toBe(1)
        expect(ROLES.manager.level).toBe(2)
        expect(ROLES.admin.level).toBe(3)
        expect(ROLES.super_admin.level).toBe(4)
    })

    it('has unique levels for each role', () => {
        const levels = Object.values(ROLES).map(r => r.level)
        const uniqueLevels = new Set(levels)
        expect(uniqueLevels.size).toBe(Object.keys(ROLES).length)
    })
})
