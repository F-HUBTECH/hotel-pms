/**
 * Unit tests for Forecast business rule validators
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
    validateRateChange,
    checkRoomStatusOverlap,
    validateForecastDateRange,
    forecastAdjustmentSchema,
    forecastGenerationSchema,
    roomStatusSchema,
} from '../validators/forecast-validators'

// Valid RFC 4122 UUID v4 for Zod v4 compatibility
const UUID_A = '550e8400-e29b-41d4-a716-446655440000'
const UUID_B = '550e8400-e29b-41d4-a716-446655440001'
const UUID_C = '550e8400-e29b-41d4-a716-446655440002'

// ─────────────────────────────────────────────
// validateRateChange
// ─────────────────────────────────────────────

describe('validateRateChange', () => {
    it('accepts small rate increase (< 20%)', () => {
        const result = validateRateChange(1000, 1100)
        expect(result.valid).toBe(true)
        expect(result.changePercent).toBeCloseTo(10)
        expect(result.warning).toBeUndefined()
    })

    it('accepts small rate decrease (< 20%)', () => {
        const result = validateRateChange(1000, 900)
        expect(result.valid).toBe(true)
        expect(result.changePercent).toBeCloseTo(-10)
        expect(result.warning).toBeUndefined()
    })

    it('warns for moderate rate increase (20-50%)', () => {
        const result = validateRateChange(1000, 1250)
        expect(result.valid).toBe(true)
        expect(result.changePercent).toBeCloseTo(25)
        expect(result.warning).toBeDefined()
        expect(result.warning).toContain('Large rate change')
    })

    it('warns for moderate rate decrease (20-50%)', () => {
        const result = validateRateChange(1000, 700)
        expect(result.valid).toBe(true)
        expect(result.changePercent).toBeCloseTo(-30)
        expect(result.warning).toBeDefined()
    })

    it('rejects rate change over 50%', () => {
        const result = validateRateChange(1000, 1600)
        expect(result.valid).toBe(false)
        expect(result.changePercent).toBeCloseTo(60)
        expect(result.warning).toContain('Manager approval required')
    })

    it('rejects rate decrease over 50%', () => {
        const result = validateRateChange(1000, 400)
        expect(result.valid).toBe(false)
        expect(result.changePercent).toBeCloseTo(-60)
    })

    it('handles exact 20% boundary (no warning)', () => {
        const result = validateRateChange(1000, 1200)
        expect(result.valid).toBe(true)
        expect(result.changePercent).toBeCloseTo(20)
        expect(result.warning).toBeUndefined()
    })

    it('handles exact 50% boundary (not rejected — must exceed 50%)', () => {
        const result = validateRateChange(1000, 1500)
        expect(result.valid).toBe(true)
        expect(result.changePercent).toBeCloseTo(50)
        expect(result.warning).toBeDefined()
    })

    it('rejects rate change just over 50%', () => {
        const result = validateRateChange(1000, 1501)
        expect(result.valid).toBe(false)
    })
})

// ─────────────────────────────────────────────
// checkRoomStatusOverlap
// ─────────────────────────────────────────────

describe('checkRoomStatusOverlap', () => {
    const existingStatuses = [
        {
            id: 'status-1',
            roomId: 'room-a',
            statusType: 'OO',
            fromDate: '2026-06-01',
            toDate: '2026-06-05',
        },
        {
            id: 'status-2',
            roomId: 'room-b',
            statusType: 'OO',
            fromDate: '2026-06-01',
            toDate: '2026-06-05',
        },
    ]

    it('returns no overlap for different room', () => {
        const result = checkRoomStatusOverlap(
            'room-c',
            'OO',
            new Date('2026-06-01'),
            new Date('2026-06-05'),
            existingStatuses,
        )
        expect(result.overlaps).toBe(false)
    })

    it('returns no overlap for different status type', () => {
        const result = checkRoomStatusOverlap(
            'room-a',
            'OI',
            new Date('2026-06-01'),
            new Date('2026-06-05'),
            existingStatuses,
        )
        expect(result.overlaps).toBe(false)
    })

    it('returns no overlap for non-overlapping dates', () => {
        const result = checkRoomStatusOverlap(
            'room-a',
            'OO',
            new Date('2026-06-06'),
            new Date('2026-06-10'),
            existingStatuses,
        )
        expect(result.overlaps).toBe(false)
    })

    it('detects overlap for same room, same status, overlapping dates', () => {
        const result = checkRoomStatusOverlap(
            'room-a',
            'OO',
            new Date('2026-06-03'),
            new Date('2026-06-08'),
            existingStatuses,
        )
        expect(result.overlaps).toBe(true)
        expect(result.conflictingId).toBe('status-1')
    })

    it('returns no overlap when existing statuses array is empty', () => {
        const result = checkRoomStatusOverlap(
            'room-a',
            'OO',
            new Date('2026-06-01'),
            new Date('2026-06-05'),
            [],
        )
        expect(result.overlaps).toBe(false)
    })
})

// ─────────────────────────────────────────────
// validateForecastDateRange
// ─────────────────────────────────────────────

describe('validateForecastDateRange', () => {
    let today: Date

    beforeEach(() => {
        today = new Date()
        today.setHours(0, 0, 0, 0)
    })

    it('rejects past-only date ranges', () => {
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 2)
        const dayBeforeYesterday = new Date(today)
        dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 3)

        const result = validateForecastDateRange(
            dayBeforeYesterday,
            yesterday,
            [],
        )
        expect(result.valid).toBe(false)
        expect(result.warning).toContain('past dates')
    })

    it('rejects dates more than 1 year ahead', () => {
        const farFuture = new Date(today)
        farFuture.setFullYear(farFuture.getFullYear() + 2)

        const result = validateForecastDateRange(farFuture, farFuture, [])
        expect(result.valid).toBe(false)
        expect(result.warning).toContain('more than 1 year')
    })

    it('accepts future dates within 1 year', () => {
        const nextMonth = new Date(today)
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        const twoMonthsLater = new Date(today)
        twoMonthsLater.setMonth(twoMonthsLater.getMonth() + 2)

        const result = validateForecastDateRange(
            nextMonth,
            twoMonthsLater,
            [],
        )
        expect(result.valid).toBe(true)
        expect(result.warning).toBeUndefined()
    })

    it('warns when forecasts already exist', () => {
        const startDate = new Date(today)
        startDate.setMonth(startDate.getMonth() + 1)
        const endDate = new Date(today)
        endDate.setMonth(endDate.getMonth() + 2)

        const midDate = new Date(startDate)
        midDate.setDate(midDate.getDate() + 5)
        const midDateStr = midDate.toISOString().split('T')[0]

        const result = validateForecastDateRange(startDate, endDate, [
            { forecast_date: midDateStr },
        ])
        expect(result.valid).toBe(true)
        expect(result.warning).toContain('already exist')
    })
})

// ─────────────────────────────────────────────
// forecastAdjustmentSchema
// ─────────────────────────────────────────────

describe('forecastAdjustmentSchema', () => {
    it('accepts valid adjustment', () => {
        const result = forecastAdjustmentSchema.safeParse({
            itemId: '550e8400-e29b-41d4-a716-446655440000',
            newRate: 500,
            overrideReason: 'Market demand increase',
            userId: '550e8400-e29b-41d4-a716-446655440001',
        })
        expect(result.success).toBe(true)
    })

    it('rejects rate below 100 THB', () => {
        const result = forecastAdjustmentSchema.safeParse({
            itemId: '550e8400-e29b-41d4-a716-446655440000',
            newRate: 50,
            overrideReason: 'Too cheap',
        })
        expect(result.success).toBe(false)
    })

    it('rejects negative rate', () => {
        const result = forecastAdjustmentSchema.safeParse({
            itemId: '550e8400-e29b-41d4-a716-446655440000',
            newRate: -100,
            overrideReason: 'Negative rate test',
        })
        expect(result.success).toBe(false)
    })

    it('rejects reason shorter than 3 characters', () => {
        const result = forecastAdjustmentSchema.safeParse({
            itemId: '550e8400-e29b-41d4-a716-446655440000',
            newRate: 500,
            overrideReason: 'ab',
        })
        expect(result.success).toBe(false)
    })

    it('rejects missing reason', () => {
        const result = forecastAdjustmentSchema.safeParse({
            itemId: '550e8400-e29b-41d4-a716-446655440000',
            newRate: 500,
        })
        expect(result.success).toBe(false)
    })
})

// ─────────────────────────────────────────────
// forecastGenerationSchema
// ─────────────────────────────────────────────

describe('forecastGenerationSchema', () => {
    it('accepts valid date range within 365 days', () => {
        const result = forecastGenerationSchema.safeParse({
            startDate: '2026-01-01',
            endDate: '2026-06-30',
        })
        expect(result.success).toBe(true)
    })

    it('rejects date range exceeding 365 days', () => {
        const result = forecastGenerationSchema.safeParse({
            startDate: '2026-01-01',
            endDate: '2027-03-01',
        })
        expect(result.success).toBe(false)
    })

    it('rejects end date before start date', () => {
        const result = forecastGenerationSchema.safeParse({
            startDate: '2026-06-01',
            endDate: '2026-01-01',
        })
        expect(result.success).toBe(false)
    })
})

// ─────────────────────────────────────────────
// roomStatusSchema
// ─────────────────────────────────────────────

describe('roomStatusSchema', () => {
    it('accepts valid room status with date range', () => {
        const result = roomStatusSchema.safeParse({
            roomId: '550e8400-e29b-41d4-a716-446655440000',
            statusType: 'OO',
            fromDate: '2026-06-01',
            toDate: '2026-06-05',
            reason: 'Renovation',
        })
        expect(result.success).toBe(true)
    })

    it('rejects invalid status type', () => {
        const result = roomStatusSchema.safeParse({
            roomId: '550e8400-e29b-41d4-a716-446655440000',
            statusType: 'INVALID',
            fromDate: '2026-06-01',
            toDate: '2026-06-05',
        })
        expect(result.success).toBe(false)
    })

    it('rejects invalid date format', () => {
        const result = roomStatusSchema.safeParse({
            roomId: '550e8400-e29b-41d4-a716-446655440000',
            statusType: 'OO',
            fromDate: '01-06-2026',
            toDate: '2026-06-05',
        })
        expect(result.success).toBe(false)
    })

    it('rejects end date before start date', () => {
        const result = roomStatusSchema.safeParse({
            roomId: '550e8400-e29b-41d4-a716-446655440000',
            statusType: 'OO',
            fromDate: '2026-06-05',
            toDate: '2026-06-01',
        })
        expect(result.success).toBe(false)
    })
})
