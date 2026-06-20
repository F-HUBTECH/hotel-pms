/**
 * Unit tests for Rate Engine Service — daily rate calculation with overrides
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RateEngineService } from '../services/rate-engine'
import { RateRepository } from '../repositories/rate-repo'
import type { RatePlan, SeasonalRate, WeekdayRate } from '../types/database'

// Mock the repository methods
vi.mock('../repositories/rate-repo', () => ({
    RateRepository: {
        getSeasonalRates: vi.fn(),
        getWeekdayRates: vi.fn(),
    },
}))

const BASE_RATE_PLAN: RatePlan = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    property_id: 'property-1',
    name: 'Standard Rate',
    room_type_id: 'room-type-1',
    base_price: 2000,
    refundable: true,
    cancellation_policy: 'Free cancellation 24h before check-in',
    is_active: true,
    deleted_at: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
}

describe('RateEngineService.calculateStayPrice', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('uses base price for all nights when no overrides exist', async () => {
        vi.mocked(RateRepository.getSeasonalRates).mockResolvedValue([])
        vi.mocked(RateRepository.getWeekdayRates).mockResolvedValue([])

        const total = await RateEngineService.calculateStayPrice(
            BASE_RATE_PLAN,
            '2026-06-01',
            '2026-06-04', // 3 nights
        )

        expect(total).toBe(6000) // 3 × 2000
    })

    it('applies seasonal rate override when matching date', async () => {
        vi.mocked(RateRepository.getSeasonalRates).mockResolvedValue([
            {
                id: 'sr-1',
                rate_plan_id: BASE_RATE_PLAN.id,
                start_date: '2026-06-01',
                end_date: '2026-06-02',
                price: 3500,
                created_at: '2026-01-01',
            } as SeasonalRate,
        ])
        vi.mocked(RateRepository.getWeekdayRates).mockResolvedValue([])

        const total = await RateEngineService.calculateStayPrice(
            BASE_RATE_PLAN,
            '2026-06-01',
            '2026-06-03', // 2 nights
        )

        expect(total).toBe(7000) // 2 × 3500
    })

    it('applies weekday rate when no seasonal and weekday matches', async () => {
        // 2026-06-01 is a Monday (weekday=1)
        vi.mocked(RateRepository.getSeasonalRates).mockResolvedValue([])
        vi.mocked(RateRepository.getWeekdayRates).mockResolvedValue([
            {
                id: 'wr-1',
                rate_plan_id: BASE_RATE_PLAN.id,
                weekday: 1, // Monday
                price: 1800,
                created_at: '2026-01-01',
            } as WeekdayRate,
        ])

        const total = await RateEngineService.calculateStayPrice(
            BASE_RATE_PLAN,
            '2026-06-01',
            '2026-06-02', // 1 night, Monday
        )

        expect(total).toBe(1800)
    })

    it('gives seasonal rate priority over weekday rate', async () => {
        vi.mocked(RateRepository.getSeasonalRates).mockResolvedValue([
            {
                id: 'sr-1',
                rate_plan_id: BASE_RATE_PLAN.id,
                start_date: '2026-06-01',
                end_date: '2026-06-01',
                price: 5000,
                created_at: '2026-01-01',
            } as SeasonalRate,
        ])
        vi.mocked(RateRepository.getWeekdayRates).mockResolvedValue([
            {
                id: 'wr-1',
                rate_plan_id: BASE_RATE_PLAN.id,
                weekday: 1, // Monday (June 1 is Monday)
                price: 2500,
                created_at: '2026-01-01',
            } as WeekdayRate,
        ])

        const total = await RateEngineService.calculateStayPrice(
            BASE_RATE_PLAN,
            '2026-06-01',
            '2026-06-02', // 1 night, Monday
        )

        // Seasonal (5000) takes priority over weekday (2500)
        expect(total).toBe(5000)
    })

    it('handles multi-night stay with mixed rates', async () => {
        // Night 1: seasonal override
        // Night 2: weekday override
        // Night 3: base price fallback
        vi.mocked(RateRepository.getSeasonalRates).mockResolvedValue([
            {
                id: 'sr-1',
                rate_plan_id: BASE_RATE_PLAN.id,
                start_date: '2026-06-01',
                end_date: '2026-06-01',
                price: 4000,
                created_at: '2026-01-01',
            } as SeasonalRate,
        ])
        vi.mocked(RateRepository.getWeekdayRates).mockResolvedValue([
            {
                id: 'wr-1',
                rate_plan_id: BASE_RATE_PLAN.id,
                weekday: 2, // Tuesday
                price: 1800,
                created_at: '2026-01-01',
            } as WeekdayRate,
        ])

        const total = await RateEngineService.calculateStayPrice(
            BASE_RATE_PLAN,
            '2026-06-01', // Monday — seasonal 4000
            '2026-06-04', // 3 nights: Mon(Jun1), Tue(Jun2), Wed(Jun3)
        )

        // Night 1 (Mon Jun 1): seasonal 4000
        // Night 2 (Tue Jun 2): weekday 1800
        // Night 3 (Wed Jun 3): base 2000
        expect(total).toBe(7800)
    })

    it('returns 0 for a same-day stay (zero nights)', async () => {
        vi.mocked(RateRepository.getSeasonalRates).mockResolvedValue([])
        vi.mocked(RateRepository.getWeekdayRates).mockResolvedValue([])

        const total = await RateEngineService.calculateStayPrice(
            BASE_RATE_PLAN,
            '2026-06-01',
            '2026-06-01',
        )

        expect(total).toBe(0)
    })

    it('handles rate plan with zero base price', async () => {
        vi.mocked(RateRepository.getSeasonalRates).mockResolvedValue([])
        vi.mocked(RateRepository.getWeekdayRates).mockResolvedValue([])

        const freePlan = { ...BASE_RATE_PLAN, base_price: 0 }
        const total = await RateEngineService.calculateStayPrice(
            freePlan,
            '2026-06-01',
            '2026-06-04',
        )

        expect(total).toBe(0)
    })

    it('uses base price for dates outside seasonal range', async () => {
        vi.mocked(RateRepository.getSeasonalRates).mockResolvedValue([
            {
                id: 'sr-1',
                rate_plan_id: BASE_RATE_PLAN.id,
                start_date: '2026-12-01',
                end_date: '2026-12-31',
                price: 5000,
                created_at: '2026-01-01',
            } as SeasonalRate,
        ])
        vi.mocked(RateRepository.getWeekdayRates).mockResolvedValue([])

        const total = await RateEngineService.calculateStayPrice(
            BASE_RATE_PLAN,
            '2026-06-01',
            '2026-06-03', // 2 nights, not in December
        )

        expect(total).toBe(4000) // 2 × 2000 base
    })

    it('aggregates nightly prices correctly for all 7 weekdays', async () => {
        // One rate for each weekday
        vi.mocked(RateRepository.getSeasonalRates).mockResolvedValue([])
        vi.mocked(RateRepository.getWeekdayRates).mockResolvedValue(
            [0, 1, 2, 3, 4, 5, 6].map((day) => ({
                id: `wr-${day}`,
                rate_plan_id: BASE_RATE_PLAN.id,
                weekday: day,
                price: 1000 + day * 200, // Sun=1000, Mon=1200, ..., Sat=2200
                created_at: '2026-01-01',
            })) as WeekdayRate[],
        )

        const total = await RateEngineService.calculateStayPrice(
            BASE_RATE_PLAN,
            '2026-06-07', // Sunday
            '2026-06-14', // Next Sunday (7 nights)
        )

        // Sun(1000)+Mon(1200)+Tue(1400)+Wed(1600)+Thu(1800)+Fri(2000)+Sat(2200)
        expect(total).toBe(11200)
    })
})
