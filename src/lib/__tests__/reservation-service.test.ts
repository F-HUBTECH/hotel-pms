/**
 * Unit tests for Reservation Service — pure calculations
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calculateAverageDailyRate, ReservationService } from '../services/reservation-service'
import { ReservationRepository } from '../repositories/reservation-repo'
import { RateEngineService } from '../services/rate-engine'
import type { RatePlan } from '../types/database'

// ─────────────────────────────────────────────
// calculateAverageDailyRate (pure function)
// ─────────────────────────────────────────────

describe('calculateAverageDailyRate', () => {
    it('calculates ADR for 3-night stay', () => {
        // 6000 / 3 = 2000
        expect(calculateAverageDailyRate(6000, 3)).toBe(2000)
    })

    it('calculates ADR for single night', () => {
        expect(calculateAverageDailyRate(3500, 1)).toBe(3500)
    })

    it('rounds to nearest whole number', () => {
        // 10000 / 3 = 3333.33... → 3333
        expect(calculateAverageDailyRate(10000, 3)).toBe(3333)
        // 9999 / 2 = 4999.5 → 5000
        expect(calculateAverageDailyRate(9999, 2)).toBe(5000)
    })

    it('returns totalPrice when nights is 0 (edge case guard)', () => {
        expect(calculateAverageDailyRate(5000, 0)).toBe(5000)
    })

    it('returns totalPrice when nights is negative (edge case)', () => {
        expect(calculateAverageDailyRate(5000, -1)).toBe(5000)
    })

    it('handles zero total price', () => {
        expect(calculateAverageDailyRate(0, 5)).toBe(0)
    })

    it('handles 7-night weekly stay', () => {
        expect(calculateAverageDailyRate(14000, 7)).toBe(2000)
    })

    it('handles large amounts', () => {
        // 1,000,000 / 30 = 33333
        expect(calculateAverageDailyRate(1_000_000, 30)).toBe(33333)
    })
})

// ─────────────────────────────────────────────
// ReservationService.bookReservation (with mocks)
// ─────────────────────────────────────────────

vi.mock('../repositories/reservation-repo', () => ({
    ReservationRepository: {
        createReservationWithTransaction: vi.fn(),
        getReservationById: vi.fn(),
    },
}))

vi.mock('../services/rate-engine', () => ({
    RateEngineService: {
        calculateStayPrice: vi.fn(),
    },
}))

const MOCK_RATE_PLAN: RatePlan = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    property_id: 'prop-1',
    name: 'Standard',
    room_type_id: 'rt-1',
    base_price: 2000,
    refundable: true,
    cancellation_policy: null,
    is_active: true,
    deleted_at: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
}

const BASE_DTO = {
    property_id: 'prop-1',
    guest_id: '550e8400-e29b-41d4-a716-446655440001',
    room_type_id: 'rt-1',
    check_in_date: '2026-06-01',
    check_out_date: '2026-06-04',
    adults: 2,
    children: 0,
    rate: 0, // trigger rate calculation
}

describe('ReservationService.bookReservation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('uses RateEngine for dynamic rate when ratePlan provided and rate=0', async () => {
        vi.mocked(RateEngineService.calculateStayPrice).mockResolvedValue(6000)
        vi.mocked(ReservationRepository.createReservationWithTransaction).mockResolvedValue({ id: 'res-1' })

        const result = await ReservationService.bookReservation(BASE_DTO, MOCK_RATE_PLAN)

        expect(RateEngineService.calculateStayPrice).toHaveBeenCalledWith(
            MOCK_RATE_PLAN,
            '2026-06-01',
            '2026-06-04',
        )
        expect(ReservationRepository.createReservationWithTransaction).toHaveBeenCalledWith(
            expect.objectContaining({ rate: 2000 }), // 6000 / 3 nights = 2000 ADR
        )
        expect(result.success).toBe(true)
        expect(result.reservationId).toBe('res-1')
    })

    it('uses static rate when ratePlan is not provided', async () => {
        vi.mocked(ReservationRepository.createReservationWithTransaction).mockResolvedValue({ id: 'res-2' })

        const dto = { ...BASE_DTO, rate: 2500 }
        const result = await ReservationService.bookReservation(dto) // no ratePlan

        expect(RateEngineService.calculateStayPrice).not.toHaveBeenCalled()
        expect(ReservationRepository.createReservationWithTransaction).toHaveBeenCalledWith(
            expect.objectContaining({ rate: 2500 }),
        )
        expect(result.success).toBe(true)
    })

    it('returns error when repository fails', async () => {
        vi.mocked(RateEngineService.calculateStayPrice).mockResolvedValue(6000)
        vi.mocked(ReservationRepository.createReservationWithTransaction).mockResolvedValue({ error: 'DB error' })

        const result = await ReservationService.bookReservation(BASE_DTO, MOCK_RATE_PLAN)

        expect(result.success).toBe(false)
        expect(result.error).toBe('DB error')
    })

    it('returns error on unexpected exception', async () => {
        vi.mocked(RateEngineService.calculateStayPrice).mockRejectedValue(new Error('Network failure'))

        const result = await ReservationService.bookReservation(BASE_DTO, MOCK_RATE_PLAN)

        expect(result.success).toBe(false)
        expect(result.error).toContain('Network failure')
    })
})
