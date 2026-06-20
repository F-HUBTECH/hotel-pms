/**
 * Unit tests for Hotel PMS forecast validation helpers
 */
import { describe, it, expect } from 'vitest'
import {
    validateRevenueCalculation,
    validateOccupancyCalculation,
    validateHotelPMSColorParity,
    generateMockRoomData,
} from '../tests/forecast-test-runner'
import { calculateOccupancyPercentage } from '../services/forecast-service'

// ─────────────────────────────────────────────
// validateRevenueCalculation
// ─────────────────────────────────────────────

describe('validateRevenueCalculation', () => {
    it('validates when room + extra = expected', () => {
        const result = validateRevenueCalculation(1000, 200, 1200)
        expect(result.valid).toBe(true)
        expect(result.variance).toBe(0)
        expect(result.withinThreshold).toBe(true)
    })

    it('validates within 0.01 threshold', () => {
        const result = validateRevenueCalculation(1000.005, 200, 1200.005)
        expect(result.valid).toBe(true)
    })

    it('rejects when variance exceeds 0.01', () => {
        const result = validateRevenueCalculation(1000, 200, 1300)
        expect(result.valid).toBe(false)
        expect(result.variance).toBe(100)
    })

    it('handles zero values', () => {
        const result = validateRevenueCalculation(0, 0, 0)
        expect(result.valid).toBe(true)
    })
})

// ─────────────────────────────────────────────
// validateOccupancyCalculation
// ─────────────────────────────────────────────

describe('validateOccupancyCalculation', () => {
    it('validates correct occupancy calculation', () => {
        const result = validateOccupancyCalculation(50, 100, 50)
        expect(result.valid).toBe(true)
    })

    it('rejects incorrect occupancy', () => {
        const result = validateOccupancyCalculation(50, 100, 75)
        expect(result.valid).toBe(false)
    })

    it('handles zero total rooms (zero-division guard)', () => {
        const result = validateOccupancyCalculation(0, 0, 0)
        expect(result.valid).toBe(true)
        expect(result.expected).toBe(0)
    })

    it('allows 0.1% tolerance', () => {
        // 50/100 = 50%, passed value is 50.05% — within 0.1% tolerance
        const result = validateOccupancyCalculation(50, 100, 50.05)
        expect(result.valid).toBe(true)
    })

    it('cross-validates with calculateOccupancyPercentage', () => {
        const occ = calculateOccupancyPercentage(75, 100)
        const result = validateOccupancyCalculation(75, 100, occ)
        expect(result.valid).toBe(true)
    })
})

// ─────────────────────────────────────────────
// validateHotelPMSColorParity
// ─────────────────────────────────────────────

describe('validateHotelPMSColorParity', () => {
    it('returns match info for known status', () => {
        // matches when either string contains the other as substring
        const matchResult = validateHotelPMSColorParity('oo', 'gray')
        expect(matchResult.matches).toBe(false) // exact strings don't overlap as substrings
        expect(matchResult.expected).toBe('gray')
        expect(matchResult.actual).toBe('gray')
    })

    it('returns expected Hotel PMS color for each status', () => {
        expect(validateHotelPMSColorParity('available', 'any').expected).toBe('white with green border')
        expect(validateHotelPMSColorParity('occupied_fit', 'any').expected).toBe('blue')
        expect(validateHotelPMSColorParity('occupied_grp', 'any').expected).toBe('purple')
        expect(validateHotelPMSColorParity('oo', 'any').expected).toBe('gray')
        expect(validateHotelPMSColorParity('override', 'any').expected).toBe('yellow')
    })

    it('matches when status is part of color description', () => {
        // If the kfoColor contains the status string, it should match
        const result = validateHotelPMSColorParity('occupied', 'blue occupied_fit')
        expect(result.matches).toBe(true)
    })

    it('has expected color for all known statuses', () => {
        const statuses = ['available', 'occupied_fit', 'occupied_grp', 'occupied_house', 'oo', 'oi', 'hu', 'override']
        for (const status of statuses) {
            const result = validateHotelPMSColorParity(status, 'any')
            expect(result.expected).toBeTruthy()
            expect(result.expected).not.toBe('unknown')
        }
    })
})

// ─────────────────────────────────────────────
// generateMockRoomData
// ─────────────────────────────────────────────

describe('generateMockRoomData', () => {
    it('generates default 10 rooms', () => {
        const rooms = generateMockRoomData()
        expect(rooms).toHaveLength(10)
    })

    it('generates specified number of rooms', () => {
        expect(generateMockRoomData(5)).toHaveLength(5)
        expect(generateMockRoomData(20)).toHaveLength(20)
    })

    it('generates rooms with expected structure', () => {
        const rooms = generateMockRoomData(3)
        for (const room of rooms) {
            expect(room.room_number).toBeTruthy()
            expect(typeof room.room_number).toBe('string')
            expect(room.room_type).toBeTruthy()
            expect(['Suite', 'Deluxe', 'Standard']).toContain(room.room_type)
            expect(room.building_id).toBe('1')
            expect(typeof room.floor).toBe('number')
        }
    })

    it('generates zero rooms when count is 0', () => {
        expect(generateMockRoomData(0)).toHaveLength(0)
    })
})
