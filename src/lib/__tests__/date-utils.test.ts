/**
 * Unit tests for date utility functions
 */
import { describe, it, expect } from 'vitest'
import { calculateNights, formatDisplayDate, formatDisplayDateEN, generateDateRange } from '../utils/date'

describe('calculateNights', () => {
    it('calculates 2 nights between consecutive dates', () => {
        expect(calculateNights('2026-01-01', '2026-01-03')).toBe(2)
    })

    it('returns 1 for a single night stay', () => {
        expect(calculateNights('2026-06-01', '2026-06-02')).toBe(1)
    })

    it('returns minimum 1 for same check-in and check-out', () => {
        expect(calculateNights('2026-06-01', '2026-06-01')).toBe(1)
    })

    it('calculates long stays correctly', () => {
        expect(calculateNights('2026-01-01', '2026-01-31')).toBe(30)
    })

    it('handles end-of-month boundaries', () => {
        expect(calculateNights('2026-02-28', '2026-03-01')).toBe(1)
    })

    it('handles leap year dates', () => {
        // 2024 is a leap year
        expect(calculateNights('2024-02-28', '2024-03-01')).toBe(2)
    })

    it('handles year boundary', () => {
        expect(calculateNights('2025-12-31', '2026-01-02')).toBe(2)
    })

    it('returns <= 0 for reversed dates (edge case)', () => {
        const result = calculateNights('2026-06-05', '2026-06-01')
        // Negative nights get clamped to 1
        expect(result).toBeLessThanOrEqual(1)
    })
})

describe('formatDisplayDate', () => {
    it('formats date in Thai locale', () => {
        const result = formatDisplayDate('2026-06-06')
        expect(result).toBeTruthy()
        expect(typeof result).toBe('string')
    })
})

describe('formatDisplayDateEN', () => {
    it('formats date in English locale', () => {
        const result = formatDisplayDateEN('2026-06-06')
        expect(result).toBeTruthy()
        expect(typeof result).toBe('string')
        expect(result).toContain('2026')
    })
})

// ─────────────────────────────────────────────
// generateDateRange
// ─────────────────────────────────────────────

describe('generateDateRange', () => {
    it('generates single day range', () => {
        const dates = generateDateRange('2026-06-01', '2026-06-01')
        expect(dates).toEqual(['2026-06-01'])
        expect(dates).toHaveLength(1)
    })

    it('generates multi-day range', () => {
        const dates = generateDateRange('2026-06-01', '2026-06-05')
        expect(dates).toEqual([
            '2026-06-01',
            '2026-06-02',
            '2026-06-03',
            '2026-06-04',
            '2026-06-05',
        ])
        expect(dates).toHaveLength(5)
    })

    it('generates 3-day range', () => {
        const dates = generateDateRange('2026-06-01', '2026-06-03')
        expect(dates).toEqual(['2026-06-01', '2026-06-02', '2026-06-03'])
    })

    it('returns empty array when from > to', () => {
        const dates = generateDateRange('2026-06-05', '2026-06-01')
        expect(dates).toEqual([])
    })

    it('returns empty array for invalid date strings', () => {
        const dates = generateDateRange('invalid', '2026-06-01')
        expect(dates).toEqual([])
    })

    it('handles month boundary', () => {
        const dates = generateDateRange('2026-01-31', '2026-02-02')
        expect(dates).toEqual(['2026-01-31', '2026-02-01', '2026-02-02'])
    })
})
