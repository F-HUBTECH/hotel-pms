/**
 * Unit tests for input validation schemas (Zod)
 */
import { describe, it, expect } from 'vitest'
import { paymentSchema } from '../validators/payment'
import { ratePlanSchema, seasonalRateSchema, weekdayRateSchema } from '../validators/rate-plan'
import { housekeepingTaskSchema } from '../validators/housekeeping'
import { roomTypeSchema } from '../validations/room-types'

// Valid RFC 4122 UUID v4 for Zod v4 compatibility
const UUID = '550e8400-e29b-41d4-a716-446655440000'

// ─────────────────────────────────────────────
// paymentSchema
// ─────────────────────────────────────────────

describe('paymentSchema', () => {
    it('accepts a valid payment', () => {
        const result = paymentSchema.safeParse({
            reservation_id: UUID,
            amount: 1000,
            payment_method: 'credit_card',
            reference_number: 'REF-001',
            notes: 'Payment for room',
        })
        expect(result.success).toBe(true)
    })

    it('accepts payment with only required fields', () => {
        const result = paymentSchema.safeParse({
            reservation_id: UUID,
            amount: 500,
            payment_method: 'cash',
        })
        expect(result.success).toBe(true)
    })

    it('rejects amount of 0', () => {
        const result = paymentSchema.safeParse({
            reservation_id: UUID,
            amount: 0,
            payment_method: 'cash',
        })
        expect(result.success).toBe(false)
    })

    it('rejects negative amount', () => {
        const result = paymentSchema.safeParse({
            reservation_id: UUID,
            amount: -500,
            payment_method: 'cash',
        })
        expect(result.success).toBe(false)
    })

    it('rejects missing reservation_id', () => {
        const result = paymentSchema.safeParse({
            amount: 1000,
            payment_method: 'cash',
        })
        expect(result.success).toBe(false)
    })

    it('rejects invalid payment_method', () => {
        const result = paymentSchema.safeParse({
            reservation_id: UUID,
            amount: 1000,
            payment_method: 'bitcoin',
        })
        expect(result.success).toBe(false)
    })

    it('coerces string amount to number', () => {
        const result = paymentSchema.safeParse({
            reservation_id: UUID,
            amount: '1500',
            payment_method: 'transfer',
        })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.amount).toBe(1500)
        }
    })
})

// ─────────────────────────────────────────────
// ratePlanSchema
// ─────────────────────────────────────────────

describe('ratePlanSchema', () => {
    it('accepts a valid rate plan', () => {
        const result = ratePlanSchema.safeParse({
            name: 'Standard Rate',
            room_type_id: UUID,
            base_price: '2000',
        })
        expect(result.success).toBe(true)
    })

    it('rejects name shorter than 2 characters', () => {
        const result = ratePlanSchema.safeParse({
            name: 'A',
            room_type_id: UUID,
            base_price: '2000',
        })
        expect(result.success).toBe(false)
    })

    it('rejects negative base price', () => {
        const result = ratePlanSchema.safeParse({
            name: 'Standard Rate',
            room_type_id: UUID,
            base_price: '-500',
        })
        expect(result.success).toBe(false)
    })

    it('rejects missing room_type_id', () => {
        const result = ratePlanSchema.safeParse({
            name: 'Standard Rate',
            base_price: '2000',
        })
        expect(result.success).toBe(false)
    })

    it('defaults refundable to true', () => {
        const result = ratePlanSchema.safeParse({
            name: 'Standard Rate',
            room_type_id: UUID,
            base_price: '2000',
        })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.refundable).toBe(true)
            expect(result.data.is_active).toBe(true)
        }
    })
})

// ─────────────────────────────────────────────
// seasonalRateSchema
// ─────────────────────────────────────────────

describe('seasonalRateSchema', () => {
    it('accepts valid seasonal rate', () => {
        const result = seasonalRateSchema.safeParse({
            rate_plan_id: UUID,
            start_date: '2026-06-01',
            end_date: '2026-06-30',
            price: '2500',
        })
        expect(result.success).toBe(true)
    })

    it('rejects end date before start date (refine)', () => {
        const result = seasonalRateSchema.safeParse({
            rate_plan_id: UUID,
            start_date: '2026-06-30',
            end_date: '2026-06-01',
            price: '2500',
        })
        expect(result.success).toBe(false)
    })

    it('accepts same start and end date', () => {
        const result = seasonalRateSchema.safeParse({
            rate_plan_id: UUID,
            start_date: '2026-06-01',
            end_date: '2026-06-01',
            price: '2500',
        })
        expect(result.success).toBe(true)
    })

    it('rejects missing rate_plan_id', () => {
        const result = seasonalRateSchema.safeParse({
            start_date: '2026-06-01',
            end_date: '2026-06-30',
            price: '2500',
        })
        expect(result.success).toBe(false)
    })

    it('rejects negative price', () => {
        const result = seasonalRateSchema.safeParse({
            rate_plan_id: UUID,
            start_date: '2026-06-01',
            end_date: '2026-06-30',
            price: '-100',
        })
        expect(result.success).toBe(false)
    })
})

// ─────────────────────────────────────────────
// weekdayRateSchema
// ─────────────────────────────────────────────

describe('weekdayRateSchema', () => {
    it('accepts valid weekday rate (Monday=0)', () => {
        const result = weekdayRateSchema.safeParse({
            rate_plan_id: UUID,
            weekday: '1',
            price: '1800',
        })
        expect(result.success).toBe(true)
    })

    it('accepts Sunday (6)', () => {
        const result = weekdayRateSchema.safeParse({
            rate_plan_id: UUID,
            weekday: '6',
            price: '2200',
        })
        expect(result.success).toBe(true)
    })

    it('rejects weekday 7 (out of range)', () => {
        const result = weekdayRateSchema.safeParse({
            rate_plan_id: UUID,
            weekday: '7',
            price: '2000',
        })
        expect(result.success).toBe(false)
    })

    it('rejects negative weekday', () => {
        const result = weekdayRateSchema.safeParse({
            rate_plan_id: UUID,
            weekday: '-1',
            price: '2000',
        })
        expect(result.success).toBe(false)
    })

    it('rejects negative price', () => {
        const result = weekdayRateSchema.safeParse({
            rate_plan_id: UUID,
            weekday: '3',
            price: '-500',
        })
        expect(result.success).toBe(false)
    })
})

// ─────────────────────────────────────────────
// housekeepingTaskSchema
// ─────────────────────────────────────────────

describe('housekeepingTaskSchema', () => {
    it('accepts valid housekeeping task', () => {
        const result = housekeepingTaskSchema.safeParse({
            room_id: UUID,
            status: 'pending',
            priority: 'normal',
            task_type: 'cleaning',
            scheduled_date: '2026-06-06',
        })
        expect(result.success).toBe(true)
    })

    it('has correct defaults', () => {
        const result = housekeepingTaskSchema.safeParse({
            room_id: UUID,
            scheduled_date: '2026-06-06',
        })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.status).toBe('pending')
            expect(result.data.priority).toBe('normal')
            expect(result.data.task_type).toBe('cleaning')
        }
    })

    it('rejects invalid status', () => {
        const result = housekeepingTaskSchema.safeParse({
            room_id: UUID,
            status: 'invalid_status',
            scheduled_date: '2026-06-06',
        })
        expect(result.success).toBe(false)
    })

    it('rejects invalid priority', () => {
        const result = housekeepingTaskSchema.safeParse({
            room_id: UUID,
            priority: 'critical',
            scheduled_date: '2026-06-06',
        })
        expect(result.success).toBe(false)
    })

    it('rejects invalid task_type', () => {
        const result = housekeepingTaskSchema.safeParse({
            room_id: UUID,
            task_type: 'painting',
            scheduled_date: '2026-06-06',
        })
        expect(result.success).toBe(false)
    })
})

// ─────────────────────────────────────────────
// roomTypeSchema
// ─────────────────────────────────────────────

describe('roomTypeSchema', () => {
    it('accepts valid room type', () => {
        const result = roomTypeSchema.safeParse({
            code: 'DLX',
            name: 'Deluxe Room',
            description: 'A spacious deluxe room',
            base_price: 3500,
        })
        expect(result.success).toBe(true)
    })

    it('rejects code with lowercase letters', () => {
        const result = roomTypeSchema.safeParse({
            code: 'dlx',
            name: 'Deluxe Room',
            base_price: 3500,
        })
        expect(result.success).toBe(false)
    })

    it('rejects code with special characters', () => {
        const result = roomTypeSchema.safeParse({
            code: 'DLX-01',
            name: 'Deluxe Room',
            base_price: 3500,
        })
        expect(result.success).toBe(false)
    })

    it('rejects code longer than 10 characters', () => {
        const result = roomTypeSchema.safeParse({
            code: 'DELUXEROOM1',
            name: 'Deluxe Room',
            base_price: 3500,
        })
        expect(result.success).toBe(false)
    })

    it('rejects empty code', () => {
        const result = roomTypeSchema.safeParse({
            code: '',
            name: 'Deluxe Room',
            base_price: 3500,
        })
        expect(result.success).toBe(false)
    })

    it('rejects price exceeding max', () => {
        const result = roomTypeSchema.safeParse({
            code: 'DLX',
            name: 'Deluxe Room',
            base_price: 1_000_000,
        })
        expect(result.success).toBe(false)
    })

    it('rejects empty name', () => {
        const result = roomTypeSchema.safeParse({
            code: 'DLX',
            name: '',
            base_price: 3500,
        })
        expect(result.success).toBe(false)
    })
})
