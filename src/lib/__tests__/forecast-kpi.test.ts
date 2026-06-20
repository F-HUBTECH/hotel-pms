/**
 * Unit tests for Forecast KPI calculations
 * — Occupancy%, ADR, RevPAR with zero-division guards
 */
import { describe, it, expect } from 'vitest'
import {
    calculateOccupancyPercentage,
    calculateADR,
    calculateRevPAR,
} from '../services/forecast-service'

// ─────────────────────────────────────────────
// Occupancy Percentage
// ─────────────────────────────────────────────

describe('calculateOccupancyPercentage', () => {
    it('calculates 50% occupancy', () => {
        expect(calculateOccupancyPercentage(50, 100)).toBe(50)
    })

    it('calculates 100% occupancy', () => {
        expect(calculateOccupancyPercentage(100, 100)).toBe(100)
    })

    it('calculates 0% occupancy', () => {
        expect(calculateOccupancyPercentage(0, 100)).toBe(0)
    })

    it('returns 0 when totalRooms is 0 (zero-division guard)', () => {
        expect(calculateOccupancyPercentage(0, 0)).toBe(0)
        expect(calculateOccupancyPercentage(50, 0)).toBe(0)
    })

    it('rounds to nearest whole number', () => {
        // 75 / 100 = 75%
        expect(calculateOccupancyPercentage(75, 100)).toBe(75)
        // 80 / 150 = 53.33... → 53%
        expect(calculateOccupancyPercentage(80, 150)).toBe(53)
    })
})

// ─────────────────────────────────────────────
// Average Daily Rate
// ─────────────────────────────────────────────

describe('calculateADR', () => {
    it('calculates ADR for normal values', () => {
        expect(calculateADR(10000, 5)).toBe(2000)
    })

    it('calculates ADR for single night', () => {
        expect(calculateADR(3500, 1)).toBe(3500)
    })

    it('returns 0 when expectedOccupancy is 0 (zero-division guard)', () => {
        expect(calculateADR(0, 0)).toBe(0)
        expect(calculateADR(5000, 0)).toBe(0)
    })

    it('rounds to nearest whole number', () => {
        // 10000 / 3 = 3333.33... → 3333
        expect(calculateADR(10000, 3)).toBe(3333)
        // 9999 / 2 = 4999.5 → 5000
        expect(calculateADR(9999, 2)).toBe(5000)
    })
})

// ─────────────────────────────────────────────
// Revenue Per Available Room
// ─────────────────────────────────────────────

describe('calculateRevPAR', () => {
    it('calculates RevPAR for normal values', () => {
        expect(calculateRevPAR(50000, 100)).toBe(500)
    })

    it('calculates RevPAR when no rooms are available', () => {
        expect(calculateRevPAR(0, 100)).toBe(0)
    })

    it('returns 0 when totalRooms is 0 (zero-division guard)', () => {
        expect(calculateRevPAR(0, 0)).toBe(0)
        expect(calculateRevPAR(5000, 0)).toBe(0)
    })

    it('rounds to nearest whole number', () => {
        expect(calculateRevPAR(10000, 3)).toBe(3333)
    })
})

// ─────────────────────────────────────────────
// Cross-validation: KPI relationships
// ─────────────────────────────────────────────

describe('KPI cross-validation', () => {
    it('RevPAR ≤ ADR when occupancy ≤ 100%', () => {
        const revenue = 50000
        const occupancy = 80
        const totalRooms = 100

        const adr = calculateADR(revenue, occupancy)
        const revpar = calculateRevPAR(revenue, totalRooms)
        const occPct = calculateOccupancyPercentage(occupancy, totalRooms)

        // At 80% occupancy, RevPAR should be ~80% of ADR
        expect(revpar).toBeLessThanOrEqual(adr)
        expect(occPct).toBe(80)
    })

    it('RevPAR = ADR when occupancy is 100%', () => {
        const revenue = 100000
        const rooms = 100

        const adr = calculateADR(revenue, rooms)
        const revpar = calculateRevPAR(revenue, rooms)

        // At 100% occupancy, RevPAR should equal ADR
        expect(revpar).toBe(adr)
    })
})
