/**
 * Unit tests for Payment Service — pure calculations
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calculateTotalPaid, PaymentService } from '../services/payment-service'
import { PaymentRepository } from '../repositories/payment-repo'

// ─────────────────────────────────────────────
// calculateTotalPaid (pure function)
// ─────────────────────────────────────────────

describe('calculateTotalPaid', () => {
    it('sums amounts of completed payments', () => {
        const payments = [
            { status: 'completed', amount: 1000 },
            { status: 'completed', amount: 500 },
        ]
        expect(calculateTotalPaid(payments)).toBe(1500)
    })

    it('ignores non-completed payments', () => {
        const payments = [
            { status: 'completed', amount: 1000 },
            { status: 'pending', amount: 500 },
            { status: 'failed', amount: 300 },
            { status: 'refunded', amount: 200 },
        ]
        expect(calculateTotalPaid(payments)).toBe(1000)
    })

    it('returns 0 when no payments are completed', () => {
        const payments = [
            { status: 'pending', amount: 1000 },
            { status: 'failed', amount: 500 },
        ]
        expect(calculateTotalPaid(payments)).toBe(0)
    })

    it('returns 0 for empty array', () => {
        expect(calculateTotalPaid([])).toBe(0)
    })

    it('handles mixed completed and non-completed with zero amounts', () => {
        const payments = [
            { status: 'completed', amount: 2500 },
            { status: 'completed', amount: 0 },
            { status: 'pending', amount: 9999 },
        ]
        expect(calculateTotalPaid(payments)).toBe(2500)
    })
})

// ─────────────────────────────────────────────
// PaymentService.processPayment (with mocks)
// ─────────────────────────────────────────────

vi.mock('../repositories/payment-repo', () => ({
    PaymentRepository: {
        addPayment: vi.fn(),
        getPaymentsByReservation: vi.fn(),
    },
}))

describe('PaymentService.processPayment', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('delegates to PaymentRepository and returns result', async () => {
        vi.mocked(PaymentRepository.addPayment).mockResolvedValue({
            success: true,
            data: { id: 'pay-1' },
        } as any)

        const result = await PaymentService.processPayment(
            {
                reservation_id: '550e8400-e29b-41d4-a716-446655440000',
                amount: 1000,
                payment_method: 'credit_card',
                reference_number: 'REF-001',
            },
            'user-1',
        )

        expect(result.success).toBe(true)
        expect(PaymentRepository.addPayment).toHaveBeenCalledWith(
            expect.objectContaining({
                reservation_id: '550e8400-e29b-41d4-a716-446655440000',
                amount: 1000,
                payment_method: 'credit_card',
                created_by: 'user-1',
            }),
        )
    })

    it('returns error on repository failure', async () => {
        vi.mocked(PaymentRepository.addPayment).mockRejectedValue(new Error('DB error'))

        const result = await PaymentService.processPayment(
            {
                reservation_id: '550e8400-e29b-41d4-a716-446655440000',
                amount: 1000,
                payment_method: 'cash',
            },
            null,
        )

        expect(result.success).toBe(false)
        expect(result.error).toContain('DB error')
    })
})

describe('PaymentService.getReservationPayments', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('uses calculateTotalPaid logic internally', async () => {
        vi.mocked(PaymentRepository.getPaymentsByReservation).mockResolvedValue([
            { status: 'completed', amount: 1000 } as any,
            { status: 'completed', amount: 2500 } as any,
            { status: 'pending', amount: 500 } as any,
        ])

        const result = await PaymentService.getReservationPayments('res-1')

        expect(result.success).toBe(true)
        expect(result.totalPaid).toBe(3500)
    })
})
